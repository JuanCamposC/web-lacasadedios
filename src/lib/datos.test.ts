import { describe, it, expect } from 'vitest';
import {
  eventosProximos,
  noticiasPublicadas,
  videosPublicados,
  estudiosPublicados,
  seriesDeEstudios,
  contarNoticias,
  avisoVigente,
  ahora,
  type Base,
  type Ajustes,
} from './datos';

/**
 * Lo que estas pruebas cuidan no es que las consultas devuelvan filas —eso se
 * comprueba contra una D1 de verdad— sino la promesa que reemplazó a las 25
 * políticas RLS de Postgres: **ninguna lectura pública puede olvidar
 * `publicado = 1`**.
 *
 * En Supabase, olvidarlo daba una lista vacía porque la base bloqueaba. Acá
 * daría la lista completa, borradores incluidos, sin ningún error. Es el fallo
 * que no avisa, y por eso tiene prueba propia.
 */

/** Base falsa que no consulta nada: solo apunta el SQL y los valores. */
function espia() {
  const llamadas: { sql: string; valores: unknown[] }[] = [];
  const base: Base = {
    prepare(sql: string) {
      return {
        bind(...valores: unknown[]) {
          llamadas.push({ sql, valores });
          return {
            async all<T>() {
              return { results: [] as T[] };
            },
            async first<T>() {
              return null as T | null;
            },
          };
        },
      };
    },
  };
  return { base, llamadas };
}

const LECTURAS: [string, (b: Base, f?: Record<string, unknown>) => Promise<unknown>][] = [
  ['eventosProximos', eventosProximos],
  ['noticiasPublicadas', noticiasPublicadas],
  ['videosPublicados', videosPublicados],
  ['estudiosPublicados', estudiosPublicados],
];

describe('el filtro de publicado', () => {
  it.each(LECTURAS)('%s nunca consulta sin `publicado = 1`', async (_nombre, consulta) => {
    const { base, llamadas } = espia();
    await consulta(base);
    expect(llamadas).toHaveLength(1);
    expect(llamadas[0].sql).toContain('publicado = 1');
  });

  it('contarNoticias tampoco cuenta borradores', async () => {
    const { base, llamadas } = espia();
    await contarNoticias(base);
    expect(llamadas[0].sql).toContain('publicado = 1');
  });

  it('seriesDeEstudios tampoco delata series que solo tienen borradores', async () => {
    const { base, llamadas } = espia();
    await seriesDeEstudios(base);
    expect(llamadas[0].sql).toContain('publicado = 1');
  });

  it('seriesDeEstudios cuenta con el mismo criterio con que se lista', async () => {
    // Regresión encontrada probando contra una D1 de verdad: sin `fecha <= ?`,
    // la serie anunciaba «Fundamentos (2)» contando un estudio programado para
    // más adelante, y al entrar había uno solo. Toda consulta que CUENTE tiene
    // que filtrar igual que la que LISTA, o el número miente.
    const { base: b1, llamadas: l1 } = espia();
    await estudiosPublicados(b1);
    const { base: b2, llamadas: l2 } = espia();
    await seriesDeEstudios(b2);
    expect(l1[0].sql).toContain('fecha <= ?');
    expect(l2[0].sql).toContain('fecha <= ?');
  });
});

describe('el tope de los listados', () => {
  it.each(LECTURAS)('%s trae 24 por omisión', async (_nombre, consulta) => {
    const { base, llamadas } = espia();
    await consulta(base);
    expect(llamadas[0].valores).toContain(24);
  });

  it('recorta un límite absurdo venido de la URL', async () => {
    // Sin esto, `?limite=999999` sería la forma más fácil de hacer que cada
    // visita arrastre la tabla entera.
    const { base, llamadas } = espia();
    await noticiasPublicadas(base, { limite: 999999 });
    expect(llamadas[0].valores).toContain(100);
    expect(llamadas[0].valores).not.toContain(999999);
  });

  it('nunca pide cero ni un número negativo de filas', async () => {
    for (const limite of [0, -5, -999]) {
      const { base, llamadas } = espia();
      await noticiasPublicadas(base, { limite });
      expect(llamadas[0].valores).toContain(1);
    }
  });

  it('ignora un desplazamiento negativo', async () => {
    const { base, llamadas } = espia();
    await noticiasPublicadas(base, { desplazamiento: -10 });
    expect(llamadas[0].valores).toContain(0);
    expect(llamadas[0].valores).not.toContain(-10);
  });

  it('trunca un límite fraccionario en vez de pasárselo a SQL', async () => {
    const { base, llamadas } = espia();
    await noticiasPublicadas(base, { limite: 7.9 });
    expect(llamadas[0].valores).toContain(7);
  });
});

describe('el filtro por templo', () => {
  it('lo agrega como valor enlazado y no pegado al SQL', async () => {
    const { base, llamadas } = espia();
    await eventosProximos(base, { templo: 'san-miguel' });
    expect(llamadas[0].sql).toContain('templo = ?');
    expect(llamadas[0].valores).toContain('san-miguel');
  });

  it('sin templo, no filtra por templo', async () => {
    const { base, llamadas } = espia();
    await eventosProximos(base);
    expect(llamadas[0].sql).not.toContain('templo = ?');
  });

  it('resiste un intento de inyección: viaja como valor, no como SQL', async () => {
    const { base, llamadas } = espia();
    await eventosProximos(base, { templo: "x' or '1'='1" });
    expect(llamadas[0].sql).toContain('templo = ?');
    expect(llamadas[0].sql).not.toContain("or '1'='1");
    expect(llamadas[0].valores).toContain("x' or '1'='1");
  });
});

describe('la publicación programada', () => {
  it('las noticias con fecha futura no salen todavía', async () => {
    const { base, llamadas } = espia();
    await noticiasPublicadas(base);
    expect(llamadas[0].sql).toContain('publicado_en <= ?');
  });

  it('los eventos ya pasados no salen', async () => {
    const { base, llamadas } = espia();
    await eventosProximos(base);
    expect(llamadas[0].sql).toContain('fecha >= ?');
  });
});

describe('ahora()', () => {
  it('usa el mismo formato que guarda SQLite, para poder comparar como texto', () => {
    // Si los formatos no coinciden, la comparación de fechas falla en silencio
    // y no devuelve nada, o lo devuelve todo.
    expect(ahora()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  });

  it('ordena correctamente como cadena', () => {
    const antes = '2026-09-10T21:00:00Z';
    const despues = '2026-09-10T22:00:00Z';
    expect(antes < despues).toBe(true);
  });
});

describe('avisoVigente', () => {
  const base: Ajustes = {
    vivo_activo: 0,
    vivo_url: null,
    vivo_titulo: null,
    vivo_url_avisada: null,
    aviso_activo: 1,
    aviso_titulo: 'Aviso',
    aviso_cuerpo: null,
    aviso_boton: null,
    aviso_boton_url: null,
    aviso_imagen_clave: null,
    aviso_desde: null,
    aviso_hasta: null,
    aviso_version: 1,
    aviso_diseno: 'normal',
    aviso_boton_pos: 'abajo-centro',
    compartir_whatsapp: null,
  };
  const AHORA = '2026-09-10T21:00:00Z';

  it('no muestra nada si no hay ajustes', () => {
    expect(avisoVigente(null, AHORA)).toBe(false);
  });

  it('no muestra el aviso si está apagado', () => {
    expect(avisoVigente({ ...base, aviso_activo: 0 }, AHORA)).toBe(false);
  });

  it('sin ventana definida, se muestra', () => {
    expect(avisoVigente(base, AHORA)).toBe(true);
  });

  it('no se muestra antes de su fecha de inicio', () => {
    expect(avisoVigente({ ...base, aviso_desde: '2026-09-11T00:00:00Z' }, AHORA)).toBe(false);
  });

  it('no se muestra después de su fecha de término', () => {
    expect(avisoVigente({ ...base, aviso_hasta: '2026-09-10T20:00:00Z' }, AHORA)).toBe(false);
  });

  it('se muestra dentro de la ventana', () => {
    expect(
      avisoVigente(
        { ...base, aviso_desde: '2026-09-10T20:00:00Z', aviso_hasta: '2026-09-10T22:00:00Z' },
        AHORA,
      ),
    ).toBe(true);
  });
});
