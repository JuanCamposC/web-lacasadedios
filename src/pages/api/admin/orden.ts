import type { APIRoute } from 'astro';
import { baseDeDatos } from '../../../lib/base';
import { reordenar, esOrdenable } from '../../../lib/panel';

export const prerender = false;

/**
 * Guarda el orden de una tabla: `POST /api/admin/orden` con
 * `{ recurso: 'videos' | 'instagram' | 'enlaces', ids: [...] }`.
 *
 * Va aparte del CRUD porque no es una fila lo que cambia sino la relación entre
 * todas. Meterlo en el PUT de un recurso obligaría a inventar un campo que no
 * existe en la tabla.
 */
export const POST: APIRoute = async ({ request, url }) => {
  const origen = request.headers.get('Origin');
  if (origen) {
    try {
      if (new URL(origen).host !== url.host) {
        return new Response('origen no permitido', { status: 403 });
      }
    } catch {
      return new Response('origen no permitido', { status: 403 });
    }
  }

  let ids: unknown;
  let recurso: unknown;
  try {
    ({ ids, recurso } = (await request.json()) as { ids?: unknown; recurso?: unknown });
  } catch {
    return new Response('cuerpo ilegible', { status: 400 });
  }

  if (!Array.isArray(ids) || ids.some((x) => typeof x !== 'string')) {
    return new Response('se esperaba { ids: string[] }', { status: 400 });
  }

  if (!esOrdenable(recurso)) {
    return new Response('esa tabla no se ordena', { status: 400 });
  }

  await reordenar(await baseDeDatos(), recurso, ids as string[]);
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
};
