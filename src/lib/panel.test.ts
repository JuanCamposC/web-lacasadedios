import { describe, it, expect } from 'vitest';
import { crear, actualizar, esRecurso, guardarAjustes, reordenar, type Recurso } from './panel';
import type { Base } from './datos';

/**
 * Lo que estas pruebas cuidan es la lista blanca de columnas.
 *
 * En Supabase, quién podía escribir qué lo decidía Postgres. Acá lo decide esta
 * lista, y nada más. Si deja pasar un nombre que no está en ella, ese nombre se
 * concatena al SQL: no es una fuga de datos, es ejecución de SQL ajeno.
 */

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

/**
 * La ESCRITURA de una tanda de llamadas.
 *
 * Hizo falta cuando `crear` y `actualizar` empezaron a consultar la base antes
 * de escribir, para calcular el slug. Mirar `llamadas[0]` pasó a mirar un
 * `select`, y varias pruebas empezaron a comprobar la consulta equivocada sin
 * que su nombre cambiara —que es la peor forma de romper una prueba, porque
 * sigue pareciendo que cuida lo que decía—.
 */
function escritura(llamadas: { sql: string; valores: unknown[] }[]) {
  const escrituras = llamadas.filter((l) => /^\s*(insert|update|delete)/i.test(l.sql));
  return escrituras.at(-1) ?? llamadas[0];
}

describe('esRecurso', () => {
  it('acepta las cuatro tablas del panel', () => {
    for (const r of ['eventos', 'noticias', 'videos', 'estudios']) {
      expect(esRecurso(r)).toBe(true);
    }
  });

  it('rechaza cualquier otra cosa', () => {
    for (const basura of [
      'ajustes',
      'suscriptores',
      'sqlite_master',
      'eventos; drop table eventos',
      '',
      null,
      undefined,
      42,
      {},
    ]) {
      expect(esRecurso(basura)).toBe(false);
    }
  });

  it('no se deja engañar por propiedades heredadas del prototipo', () => {
    // Con `in` en vez de `Object.hasOwn`, 'toString' y 'constructor' darían
    // true y acabarían pegados al nombre de la tabla en el SQL.
    for (const heredada of ['toString', 'constructor', 'valueOf', '__proto__']) {
      expect(esRecurso(heredada)).toBe(false);
    }
  });
});

describe('la lista blanca de columnas', () => {
  it('descarta columnas que no existen en la tabla', async () => {
    const { base, llamadas } = espia();
    await crear(base, 'videos', {
      titulo: 'Uno',
      youtube_url: 'https://youtu.be/aaaaaaaaaaa',
      columna_inventada: 'x',
      cuerpo: 'este campo es de noticias, no de videos',
    });
    expect(escritura(llamadas).sql).not.toContain('columna_inventada');
    expect(escritura(llamadas).sql).not.toContain('cuerpo');
    expect(escritura(llamadas).sql).toContain('titulo');
  });

  it('no deja inyectar SQL por el nombre de la columna', async () => {
    const { base, llamadas } = espia();
    await crear(base, 'videos', {
      titulo: 'Uno',
      'titulo = 1, publicado': 1,
      'x) values (1); drop table videos; --': 'x',
    });
    expect(escritura(llamadas).sql).not.toContain('drop table');
    expect(escritura(llamadas).sql).not.toContain('--');
  });

  it('los valores viajan enlazados, nunca dentro del SQL', async () => {
    const { base, llamadas } = espia();
    await crear(base, 'videos', {
      titulo: "'; drop table videos; --",
      youtube_url: 'https://youtu.be/aaaaaaaaaaa',
    });
    expect(escritura(llamadas).sql).not.toContain('drop table');
    expect(escritura(llamadas).valores).toContain("'; drop table videos; --");
  });

  it('actualizar no toca nada si no llega ninguna columna válida', async () => {
    const { base, llamadas } = espia();
    const hecho = await actualizar(base, 'videos', 'id-1', { inventada: 'x' });
    expect(hecho).toBe(false);
    expect(llamadas).toHaveLength(0);
  });
});

describe('la normalización de valores', () => {
  const casos: [unknown, number][] = [
    [true, 1],
    [1, 1],
    ['1', 1],
    ['on', 1],
    [false, 0],
    [0, 0],
    ['', 0],
    ['0', 0],
    [null, 0],
    [undefined, 0],
    ['cualquier cosa', 0],
  ];

  it.each(casos)('publicado: %s → %s', async (entrada, esperado) => {
    const { base, llamadas } = espia();
    await crear(base, 'videos', { titulo: 'x', publicado: entrada });
    expect(escritura(llamadas).valores).toContain(esperado);
  });

  it('una cadena vacía se guarda como null, no como cadena vacía', async () => {
    // Con `''`, dos filas sin slug chocarían entre sí en el índice único.
    const { base, llamadas } = espia();
    await crear(base, 'noticias', { titulo: 'Uno', slug: '   ' });
    const i = escritura(llamadas)
      .sql.split(',')
      .findIndex((c) => c.includes('slug'));
    expect(escritura(llamadas).valores[i]).toBeNull();
  });

  it('recorta los espacios de los textos', async () => {
    const { base, llamadas } = espia();
    await crear(base, 'noticias', { titulo: '  Con espacios  ' });
    expect(escritura(llamadas).valores).toContain('Con espacios');
  });

  it('los números que no lo son quedan en null, no en NaN', async () => {
    const { base, llamadas } = espia();
    await crear(base, 'estudios', { titulo: 'x', duracion_seg: 'hola' });
    expect(escritura(llamadas).valores).toContain(null);
    expect(escritura(llamadas).valores.some((v) => Number.isNaN(v))).toBe(false);
  });

  it('trunca los decimales en vez de mandárselos a una columna entera', async () => {
    const { base, llamadas } = espia();
    await crear(base, 'estudios', { titulo: 'x', duracion_seg: 3612.7 });
    expect(escritura(llamadas).valores).toContain(3612);
  });
});

describe('crear', () => {
  it('genera el id en el Worker y lo devuelve', async () => {
    const { base, llamadas } = espia();
    const id = await crear(base, 'videos', { titulo: 'Uno' });
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(escritura(llamadas).valores[0]).toBe(id);
  });
});

describe('el slug', () => {
  /** El valor que se guardó en una columna concreta. */
  function valorDe(l: { sql: string; valores: unknown[] }, columna: string) {
    const cols = l.sql
      .slice(l.sql.indexOf('(') + 1, l.sql.indexOf(')'))
      .split(',')
      .map((c) => c.trim());
    return l.valores[cols.indexOf(columna)];
  }

  it('sale del título, sin tildes ni signos', async () => {
    // EL CASO QUE FALLABA: la primera noticia publicada quedó sin slug y su
    // dirección pasó a ser /noticias/9c41d06d-c19a-4fdd-87b8-0fe7161b977b.
    const { base, llamadas } = espia();
    await crear(base, 'noticias', {
      titulo: 'Reunión de Acción de Gracias - Encuentro de Iglesias',
    });
    expect(valorDe(escritura(llamadas), 'slug')).toBe(
      'reunion-de-accion-de-gracias-encuentro-de-iglesias',
    );
  });

  it('respeta el que venga escrito a mano', async () => {
    const { base, llamadas } = espia();
    await crear(base, 'noticias', { titulo: 'Cualquier cosa', slug: 'mi-direccion' });
    expect(valorDe(escritura(llamadas), 'slug')).toBe('mi-direccion');
  });

  it('no se lo inventa para tablas que no lo tienen', async () => {
    const { base, llamadas } = espia();
    await crear(base, 'videos', { titulo: 'Uno' });
    expect(escritura(llamadas).sql).not.toContain('slug');
  });

  it('busca uno libre cuando el título se repite', async () => {
    // «Reunión de oración» se publica todos los meses. La columna es única en
    // la base: sin esto, el segundo guardado revienta con un error que nadie
    // sabría interpretar.
    const llamadas: { sql: string; valores: unknown[] }[] = [];
    const ocupados = new Set(['reunion-de-oracion', 'reunion-de-oracion-2']);
    const base = {
      prepare(sql: string) {
        return {
          bind(...valores: unknown[]) {
            llamadas.push({ sql, valores });
            return {
              async all<T>() {
                return { results: [] as T[] };
              },
              async first<T>() {
                const buscado = String(valores[0]);
                return (
                  sql.startsWith('select id') && ocupados.has(buscado) ? { id: 'x' } : null
                ) as T | null;
              },
            };
          },
        };
      },
    } as unknown as Base;

    await crear(base, 'noticias', { titulo: 'Reunión de oración' });
    expect(valorDe(escritura(llamadas), 'slug')).toBe('reunion-de-oracion-3');
  });

  it('no cambia el de una fila que ya lo tiene, aunque cambie el título', async () => {
    // Cambiar la dirección de algo ya publicado rompe el enlace que la gente
    // compartió por WhatsApp, y lo rompe en silencio.
    const llamadas: { sql: string; valores: unknown[] }[] = [];
    const base = {
      prepare(sql: string) {
        return {
          bind(...valores: unknown[]) {
            llamadas.push({ sql, valores });
            return {
              async all<T>() {
                return { results: [] as T[] };
              },
              async first<T>() {
                return (
                  sql.startsWith('select slug') ? { slug: 'el-de-siempre' } : null
                ) as T | null;
              },
            };
          },
        };
      },
    } as unknown as Base;

    await actualizar(base, 'noticias', 'id-1', { titulo: 'Título nuevo del todo' });
    expect(escritura(llamadas).sql).not.toContain('slug');
  });
});

describe('actualizar', () => {
  it('marca la fecha de modificación', async () => {
    const { base, llamadas } = espia();
    await actualizar(base, 'noticias', 'id-1', { titulo: 'Otro' });
    expect(escritura(llamadas).sql).toContain('actualizado_en = ?');
  });

  it('no la marca en videos, que no tiene esa columna', async () => {
    const { base, llamadas } = espia();
    await actualizar(base, 'videos', 'id-1', { titulo: 'Otro' });
    expect(escritura(llamadas).sql).not.toContain('actualizado_en');
  });

  it('el id va enlazado al final y no pegado al SQL', async () => {
    const { base, llamadas } = espia();
    await actualizar(base, 'videos', "x' or '1'='1", { titulo: 'Otro' });
    expect(escritura(llamadas).sql).toContain('where id = ?');
    expect(escritura(llamadas).valores.at(-1)).toBe("x' or '1'='1");
  });
});

describe('reordenar', () => {
  it('guarda la posición de cada uno según el orden recibido', async () => {
    const { base, llamadas } = espia();
    await reordenar(base, ['c', 'a', 'b']);
    expect(llamadas).toHaveLength(3);
    expect(llamadas.map((l) => l.valores)).toEqual([
      [0, 'c'],
      [1, 'a'],
      [2, 'b'],
    ]);
  });
});

describe('guardarAjustes', () => {
  it('solo acepta las columnas de ajustes', async () => {
    const { base, llamadas } = espia();
    await guardarAjustes(base, { vivo_titulo: 'Culto', id: 99, otra_cosa: 'x' });
    expect(escritura(llamadas).sql).toContain('vivo_titulo = ?');
    expect(escritura(llamadas).sql).not.toContain('otra_cosa');
    // `id` no se puede cambiar: la fila es una sola y siempre es la 1.
    expect(escritura(llamadas).sql).not.toMatch(/set[^]*\bid = \?/);
    expect(escritura(llamadas).sql).toContain('where id = 1');
  });

  it('no escribe si no llega nada válido', async () => {
    const { base, llamadas } = espia();
    expect(await guardarAjustes(base, { inventado: 1 })).toBe(false);
    expect(llamadas).toHaveLength(0);
  });

  it('convierte las banderas a 0 y 1', async () => {
    const { base, llamadas } = espia();
    await guardarAjustes(base, { vivo_activo: 'on', aviso_activo: false });
    expect(escritura(llamadas).valores.slice(0, 2)).toEqual([1, 0]);
  });
});

// Comprobación de tipos: que `Recurso` no admita cualquier cadena.
const _tipo: Recurso = 'eventos';
void _tipo;
