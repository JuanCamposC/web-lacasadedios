import type { APIRoute } from 'astro';
import { baseDeDatos } from '../../../lib/base';
import { esRecurso, listarTodo, crear, actualizar, borrar, unaFila } from '../../../lib/panel';
import { urlMedio } from '../../../lib/medios';
import { templos } from '../../../data/templos';
import { DIAS } from '../../../lib/reuniones';

export const prerender = false;

/**
 * CRUD del panel: `/api/admin/eventos`, `/noticias`, `/videos`, `/instagram`,
 * `/reuniones`, `/enlaces`, `/estudios`.
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

/**
 * Añade la dirección pública de la imagen a cada fila.
 *
 * En la base se guarda la CLAVE de R2 («eventos/2026/09/…jpg»), no una
 * dirección. El listado del panel la ponía tal cual en el `src` de la
 * miniatura, el navegador la resolvía como ruta relativa a /admin/eventos, y
 * ninguna imagen cargaba. El navegador no sabe cuál es el dominio del bucket,
 * así que la dirección se arma acá, que sí lo sabe.
 */
function conUrl<T extends Record<string, unknown>>(fila: T): T & { imagen_url: string | null } {
  const clave = typeof fila.imagen_clave === 'string' ? fila.imagen_clave : null;
  return { ...fila, ...detalleDeReunion(fila), imagen_url: urlMedio(clave) };
}

const ESTADOS: Record<string, string> = { suspendida: 'Suspendida', cambiada: 'Cambio de horario' };

/**
 * «San Miguel · Lunes 20:00 · Suspendida», para el listado del panel.
 *
 * Una reunión sola no tiene título que la distinga: hay cinco «Culto General».
 * El listado solo sabe enseñar una columna debajo del nombre, así que se le
 * arma una con lo que de verdad hace falta ver de un vistazo.
 */
function detalleDeReunion(fila: Record<string, unknown>): { detalle?: string } {
  if (typeof fila.dia !== 'number' || typeof fila.hora !== 'string') return {};
  const templo = templos.find((t) => t.slug === fila.templo)?.short ?? String(fila.templo);
  const estado = ESTADOS[String(fila.estado)];
  return {
    detalle: [templo, `${DIAS[fila.dia] ?? '?'} ${fila.hora}`, estado].filter(Boolean).join(' · '),
  };
}

/**
 * Una comprobación de la base que no se cumplió, dicha para quien administra.
 *
 * La base rechaza por su cuenta lo que no tiene el formato esperado —un link
 * que no empieza por https://, una hora que no es HH:MM— y el error sale como
 * «D1_ERROR: CHECK constraint failed», que el panel mostraba tal cual con un
 * 500. Es un dato mal puesto, no una caída: se responde 400 y en castellano.
 */
function rechazoDeLaBase(e: unknown): Response | null {
  if (!String((e as Error)?.message ?? e).includes('CHECK constraint failed')) return null;
  return json(
    {
      error:
        'La base rechazó un dato con formato incorrecto. Revisa que los links empiecen por https:// y que las horas y fechas estén completas.',
    },
    400,
  );
}

export const GET: APIRoute = async ({ params }) => {
  const recurso = recursoDe(params);
  if (!recurso) return json({ error: 'recurso desconocido' }, 404);
  const filas = await listarTodo<Record<string, unknown>>(await baseDeDatos(), recurso);
  return json({ filas: filas.map(conUrl) });
};

export const POST: APIRoute = async ({ params, request, url }) => {
  const recurso = recursoDe(params);
  if (!recurso) return json({ error: 'recurso desconocido' }, 404);
  if (!mismoOrigen(request, url)) return json({ error: 'origen no permitido' }, 403);

  const base = await baseDeDatos();
  let id: string;
  try {
    id = await crear(base, recurso, await cuerpo(request));
  } catch (e) {
    const rechazo = rechazoDeLaBase(e);
    if (rechazo) return rechazo;
    throw e;
  }
  // Se devuelve la fila tal como quedó, no solo el id: el slug lo calcula el
  // servidor, y el correo de aviso a suscriptores tiene que enlazar a la
  // dirección legible y no a /noticias/<uuid>.
  const fila = await unaFila<Record<string, unknown>>(base, recurso, id);
  return json({ id, fila: fila ? conUrl(fila) : null }, 201);
};

export const PUT: APIRoute = async ({ params, request, url }) => {
  const recurso = recursoDe(params);
  if (!recurso) return json({ error: 'recurso desconocido' }, 404);
  if (!mismoOrigen(request, url)) return json({ error: 'origen no permitido' }, 403);

  const id = (url.searchParams.get('id') ?? '').trim();
  if (!id) return json({ error: 'falta el id' }, 400);

  let hecho: boolean;
  try {
    hecho = await actualizar(await baseDeDatos(), recurso, id, await cuerpo(request));
  } catch (e) {
    const rechazo = rechazoDeLaBase(e);
    if (rechazo) return rechazo;
    throw e;
  }
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
