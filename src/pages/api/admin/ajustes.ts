import type { APIRoute } from 'astro';
import { baseDeDatos } from '../../../lib/base';
import { ajustes } from '../../../lib/datos';
import { guardarAjustes } from '../../../lib/panel';

export const prerender = false;

/**
 * La fila única de ajustes: transmisión en vivo y aviso emergente.
 *
 *   GET   devuelve la fila
 *   PUT   guarda solo las columnas permitidas (ver src/lib/panel.ts)
 *
 * Se lee con `ajustes()` de datos.ts, la misma función que usan las páginas
 * públicas, porque acá no hay nada que ocultar: la fila es una sola y no tiene
 * concepto de borrador.
 */
const json = (datos: unknown, status = 200) =>
  new Response(JSON.stringify(datos), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

export const GET: APIRoute = async () => json({ ajustes: await ajustes(await baseDeDatos()) });

export const PUT: APIRoute = async ({ request, url }) => {
  const origen = request.headers.get('Origin');
  if (origen) {
    try {
      if (new URL(origen).host !== url.host) return json({ error: 'origen no permitido' }, 403);
    } catch {
      return json({ error: 'origen no permitido' }, 403);
    }
  }

  let datos: Record<string, unknown>;
  try {
    datos = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: 'cuerpo ilegible' }, 400);
  }

  const hecho = await guardarAjustes(await baseDeDatos(), datos);
  if (!hecho) return json({ error: 'no hay nada que guardar' }, 400);
  return json({ ok: true });
};
