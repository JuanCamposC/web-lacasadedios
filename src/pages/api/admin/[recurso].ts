import type { APIRoute } from 'astro';
import { baseDeDatos } from '../../../lib/base';
import { esRecurso, listarTodo, crear, actualizar, borrar } from '../../../lib/panel';

export const prerender = false;

/**
 * CRUD del panel: `/api/admin/eventos`, `/noticias`, `/videos`, `/estudios`.
 *
 *   GET                  todo lo que hay, borradores incluidos
 *   POST                 crea; devuelve el id
 *   PUT    ?id=…         actualiza
 *   DELETE ?id=…         borra
 *
 * ── QUÉ PROTEGE ESTO Y QUÉ NO ───────────────────────────────────────────────
 * Quién puede llegar hasta acá lo decide el middleware, que exige un token de
 * Cloudflare Access verificado (ver src/lib/access.ts). Este archivo no repite
 * esa comprobación; se ocupa de lo otro: que lo que llegue, con permiso o no,
 * no pueda escribir donde no debe. De eso se encarga la lista blanca de
 * columnas de src/lib/panel.ts.
 *
 * ── POR QUÉ SE MIRA EL ORIGEN ───────────────────────────────────────────────
 * Access autentica con una cookie, y las cookies las manda el navegador solo,
 * también cuando quien pide es otro sitio. Sin comprobar el origen, una página
 * cualquiera podría hacer que el navegador de alguien del equipo —con su sesión
 * abierta— borrara noticias sin que esa persona se entere. Comparar el origen
 * es lo que corta eso, y solo hace falta en los métodos que escriben.
 */

const json = (datos: unknown, status = 200) =>
  new Response(JSON.stringify(datos), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

/** ¿Viene esta escritura de nuestro propio sitio? */
function mismoOrigen(request: Request, url: URL): boolean {
  const origen = request.headers.get('Origin');
  // Sin cabecera `Origin` no es una petición de navegador entre sitios: los
  // navegadores la ponen siempre en POST, PUT y DELETE desde JavaScript.
  if (!origen) return true;
  try {
    return new URL(origen).host === url.host;
  } catch {
    return false;
  }
}

async function cuerpo(request: Request): Promise<Record<string, unknown>> {
  try {
    const datos = await request.json();
    return datos && typeof datos === 'object' ? (datos as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Comprueba el recurso de la URL antes de dejar que toque nada. */
function recursoDe(params: Record<string, string | undefined>) {
  const nombre = params.recurso;
  return esRecurso(nombre) ? nombre : null;
}

export const GET: APIRoute = async ({ params }) => {
  const recurso = recursoDe(params);
  if (!recurso) return json({ error: 'recurso desconocido' }, 404);
  return json({ filas: await listarTodo(await baseDeDatos(), recurso) });
};

export const POST: APIRoute = async ({ params, request, url }) => {
  const recurso = recursoDe(params);
  if (!recurso) return json({ error: 'recurso desconocido' }, 404);
  if (!mismoOrigen(request, url)) return json({ error: 'origen no permitido' }, 403);

  const id = await crear(await baseDeDatos(), recurso, await cuerpo(request));
  return json({ id }, 201);
};

export const PUT: APIRoute = async ({ params, request, url }) => {
  const recurso = recursoDe(params);
  if (!recurso) return json({ error: 'recurso desconocido' }, 404);
  if (!mismoOrigen(request, url)) return json({ error: 'origen no permitido' }, 403);

  const id = (url.searchParams.get('id') ?? '').trim();
  if (!id) return json({ error: 'falta el id' }, 400);

  const hecho = await actualizar(await baseDeDatos(), recurso, id, await cuerpo(request));
  // `false` significa que no llegó ninguna columna válida. Se avisa en vez de
  // responder que sí: un formulario mal armado se descubriría meses después,
  // cuando alguien note que sus cambios no se guardan.
  if (!hecho) return json({ error: 'no hay nada que guardar' }, 400);
  return json({ ok: true });
};

export const DELETE: APIRoute = async ({ params, request, url }) => {
  const recurso = recursoDe(params);
  if (!recurso) return json({ error: 'recurso desconocido' }, 404);
  if (!mismoOrigen(request, url)) return json({ error: 'origen no permitido' }, 403);

  const id = (url.searchParams.get('id') ?? '').trim();
  if (!id) return json({ error: 'falta el id' }, 400);

  await borrar(await baseDeDatos(), recurso, id);
  return json({ ok: true });
};
