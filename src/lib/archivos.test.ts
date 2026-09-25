import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Base } from './datos';

/**
 * Lo que estas pruebas cuidan es que NO se borre un archivo que alguien sigue
 * usando.
 *
 * El caso que las hizo falta: la galería del panel del aviso emergente permite
 * reutilizar la foto de un evento. Si borrar el evento borrara el archivo, el
 * aviso se quedaría con un hueco y nadie sabría por qué. Un archivo de más en el
 * bucket cuesta unos céntimos; una imagen que desaparece de una pantalla
 * pública no se nota hasta que alguien la mira.
 */

const borrados: string[] = [];
const bucket = {
  get: async () => null,
  put: async () => undefined,
  delete: async (clave: string) => {
    borrados.push(clave);
  },
  list: async () => ({ objects: [], truncated: false }),
};

vi.mock('./base', () => ({ almacen: async () => bucket }));

const { olvidarArchivos, sigueEnUso } = await import('./archivos');

/** Una base que dice que sí a las claves de `enUso` y no al resto. */
function baseCon(enUso: string[]) {
  const consultas: string[] = [];
  const base: Base = {
    prepare(sql: string) {
      consultas.push(sql);
      return {
        bind(...valores: unknown[]) {
          return {
            async all<T>() {
              return { results: [] as T[] };
            },
            async first<T>() {
              return (enUso.includes(String(valores[0])) ? ({ 1: 1 } as T) : null) as T | null;
            },
          };
        },
      };
    },
  };
  return { base, consultas };
}

beforeEach(() => {
  borrados.length = 0;
});

describe('olvidarArchivos', () => {
  it('borra la que ya no nombra nadie', async () => {
    const { base } = baseCon([]);
    expect(await olvidarArchivos(base, ['noticias/2026/09/a.webp'])).toEqual([
      'noticias/2026/09/a.webp',
    ]);
    expect(borrados).toEqual(['noticias/2026/09/a.webp']);
  });

  it('deja en su sitio la que otra fila sigue usando', async () => {
    const { base } = baseCon(['eventos/2026/09/compartida.webp']);
    expect(await olvidarArchivos(base, ['eventos/2026/09/compartida.webp'])).toEqual([]);
    expect(borrados).toEqual([]);
  });

  it('no toca el bucket cuando no hay nada que soltar', async () => {
    const { base, consultas } = baseCon([]);
    expect(await olvidarArchivos(base, [null, undefined, ''])).toEqual([]);
    expect(consultas).toEqual([]);
  });

  it('no repite una clave que llega dos veces', async () => {
    const { base } = baseCon([]);
    await olvidarArchivos(base, ['a.webp', 'a.webp']);
    expect(borrados).toEqual(['a.webp']);
  });

  /**
   * Quien borra una noticia quiere que la noticia desaparezca. Si R2 falla, el
   * fallo no puede convertirse en «no se pudo borrar»: la fila ya no está.
   */
  it('se aguanta un fallo del bucket sin lanzar', async () => {
    const { base } = baseCon([]);
    const antes = bucket.delete;
    bucket.delete = async () => {
      throw new Error('R2 caído');
    };
    await expect(olvidarArchivos(base, ['a.webp'])).resolves.toEqual([]);
    bucket.delete = antes;
  });
});

describe('sigueEnUso', () => {
  it('pregunta por las cinco columnas que guardan archivos', async () => {
    const { base, consultas } = baseCon([]);
    await sigueEnUso(base, 'x.webp');
    const sql = consultas.join(' ');
    for (const tabla of ['eventos', 'noticias', 'instagram', 'estudios', 'ajustes']) {
      expect(sql).toContain(tabla);
    }
    expect(sql).toContain('aviso_imagen_clave');
    expect(sql).toContain('archivo_clave');
  });
});
