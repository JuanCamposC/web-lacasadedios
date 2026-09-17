import { describe, it, expect } from 'vitest';
import {
  altaSuscriptor,
  bajaSuscriptor,
  confirmados,
  confirmarSuscriptor,
  listarSuscriptores,
  registrarIntento,
} from './boletin';
import type { Base } from './datos';

/**
 * Acá se prueba la regla que no se puede romper: **a quien no ha confirmado no
 * se le escribe**.
 *
 * En Supabase la hacía cumplir Postgres. Acá la hace cumplir este módulo, y si
 * se rompe nadie lo nota: los correos salen igual, a gente que nunca los pidió,
 * y lo que llega después son quejas de spam y un dominio quemado. No hay
 * pantalla roja que avise.
 *
 * Por eso lo que se inspecciona es el SQL que sale, no un resultado: lo que
 * importa es que el filtro ESTÉ, no que la base devuelva algo.
 */

function espia(respuestas: unknown[] = []) {
  const llamadas: { sql: string; valores: unknown[] }[] = [];
  let i = 0;
  const base: Base = {
    prepare(sql: string) {
      return {
        bind(...valores: unknown[]) {
          llamadas.push({ sql, valores });
          const r = respuestas[i++];
          return {
            async all<T>() {
              return { results: (r ?? []) as T[] };
            },
            async first<T>() {
              return (r ?? null) as T | null;
            },
          };
        },
      };
    },
  };
  return { base, llamadas };
}

/** El SQL sin saltos ni espacios de más, para poder buscar frases en él. */
const plano = (sql: string) => sql.replace(/\s+/g, ' ').toLowerCase();

describe('a quién se le escribe', () => {
  it('confirmados() filtra siempre por pendiente = 0', async () => {
    const { base, llamadas } = espia([[]]);
    await confirmados(base);
    expect(plano(llamadas[0].sql)).toContain('pendiente = 0');
  });

  // El panel SÍ ve a los pendientes: es la explicación de la mitad de los «me
  // suscribí y no me llega nada». Lo que no puede pasar es que esa lista se use
  // para enviar, y por eso son dos funciones y no un parámetro.
  it('listarSuscriptores() NO filtra: el panel los ve a todos', async () => {
    const { base, llamadas } = espia([[]]);
    await listarSuscriptores(base);
    expect(plano(llamadas[0].sql)).not.toContain('pendiente =');
  });
});

describe('altaSuscriptor', () => {
  it('deja la fila pendiente, nunca confirmada', async () => {
    const { base, llamadas } = espia([{ token: 'abc' }]);
    await altaSuscriptor(base, 'alguien@ejemplo.cl');
    expect(plano(llamadas[0].sql)).toContain('pendiente');
    expect(llamadas[0].sql).toMatch(/values \(\?, \?, \?, 1, \?\)/);
  });

  // Sin esto habría que leer antes de escribir, y entre la lectura y la
  // escritura cabe otra petición con el mismo correo.
  it('resuelve el duplicado en la propia sentencia', async () => {
    const { base, llamadas } = espia([null]);
    const r = await altaSuscriptor(base, 'repetido@ejemplo.cl');
    expect(plano(llamadas[0].sql)).toContain('on conflict(correo) do nothing');
    expect(r.estado).toBe('ya_estaba');
  });

  it('devuelve el token cuando el alta es nueva', async () => {
    const { base } = espia([{ token: 'tok-123' }]);
    const r = await altaSuscriptor(base, 'nuevo@ejemplo.cl');
    expect(r).toEqual({ estado: 'nuevo', token: 'tok-123' });
  });

  // El token es la credencial del enlace de confirmación y del de baja: si se
  // pudiera adivinar, cualquiera daría de baja a cualquiera.
  it('el token no se deriva del correo', async () => {
    const { base, llamadas } = espia([{ token: 'x' }]);
    await altaSuscriptor(base, 'alguien@ejemplo.cl');
    const token = llamadas[0].valores[2] as string;
    expect(token).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/);
    expect(token).not.toContain('alguien');
  });
});

describe('confirmar y dar de baja', () => {
  // Buscar por correo permitiría confirmar o dar de baja a cualquiera sabiendo
  // solo su dirección, que es pública. Se busca SIEMPRE por token.
  it('ninguna de las dos busca por correo', async () => {
    const { base, llamadas } = espia([{ id: '1' }, { id: '1' }]);
    await confirmarSuscriptor(base, 'tok');
    await bajaSuscriptor(base, 'tok');
    for (const l of llamadas) {
      expect(plano(l.sql)).toContain('where token = ?');
      expect(plano(l.sql)).not.toContain('correo =');
    }
  });

  it('confirmar dos veces no reescribe la fecha', async () => {
    const { base, llamadas } = espia([null]);
    const r = await confirmarSuscriptor(base, 'tok');
    expect(plano(llamadas[0].sql)).toContain('and pendiente = 1');
    expect(r).toBe(false);
  });

  // La baja BORRA. Guardar a quien se fue sería guardar el dato personal de
  // alguien que acaba de pedir que dejes de tenerlo.
  it('la baja borra la fila, no la marca', async () => {
    const { base, llamadas } = espia([{ id: '1' }]);
    expect(await bajaSuscriptor(base, 'tok')).toBe(true);
    expect(plano(llamadas[0].sql)).toContain('delete from suscriptores');
  });
});

describe('registrarIntento', () => {
  it('cuenta solo dentro de la ventana y apunta el intento', async () => {
    const { base, llamadas } = espia([{ n: 3 }]);
    const previos = await registrarIntento(base, '1.2.3.4', 60);

    expect(previos).toBe(3);
    expect(plano(llamadas[0].sql)).toContain('where accion = ? and ip = ? and intentado_en >=');
    // Y limpia lo viejo, para que la tabla no crezca sin fin.
    expect(plano(llamadas[1].sql)).toContain('delete from intentos_alta');
    expect(plano(llamadas[2].sql)).toContain('insert into intentos_alta');
  });

  it('cada acción lleva su propia cuenta', async () => {
    // El formulario de contacto y el alta al boletín comparten tabla y freno;
    // quien escribe un mensaje no debe gastar el cupo de quien se suscribe.
    const { base, llamadas } = espia([{ n: 0 }]);
    await registrarIntento(base, '1.2.3.4', 60, 'contacto');
    expect(llamadas[0].valores[0]).toBe('contacto');
    expect(llamadas[2].valores[2]).toBe('contacto');
  });

  it('la ventana se calcula hacia atrás desde ahora', async () => {
    const { base, llamadas } = espia([{ n: 0 }]);
    await registrarIntento(base, '1.2.3.4', 60);
    // Los parámetros son (accion, ip, desde): la ventana es el tercero.
    const desde = Date.parse(llamadas[0].valores[2] as string);
    const esperado = Date.now() - 60 * 60_000;
    expect(Math.abs(desde - esperado)).toBeLessThan(5000);
  });
});
