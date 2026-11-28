import type { APIRoute } from 'astro';
import { baseDeDatos } from '../../../lib/base';
import { esRecurso, listarPapelera, restaurar, purgar, tienePapelera } from '../../../lib/panel';
import { olvidarArchivos } from '../../../lib/archivos';

export const prerender = false;

/**
 * La papelera del panel.
 *
 *   GET                       qué hay borrado, de todas las tablas
 *   POST   {recurso, id}      lo saca de la papelera
 *   DELETE ?recurso=&id=      lo borra de verdad y libera su imagen
 *
 * ── POR QUÉ UNA RUTA APARTE Y NO UN PARÁMETRO DE /api/admin/[recurso] ───────
 * Porque restaurar y vaciar NO son «actualizar una fila»: son dos verbos
 * nuevos, y colgarlos de un `?accion=` del CRUD genérico habría obligado a que
 * esa ruta —la que escribe en siete tablas— aceptara un nombre de acción
 * llegado por la red. Menos superficie es menos que comprobar.
 *
 * El permiso lo da el middleware con el token de Cloudflare Access, igual que
 * para el resto del panel; acá solo se comprueba el origen, por lo mismo que
 * en /api/admin/[recurso]: Access autentica con una cookie, y las cookies las
 * manda el navegador también cuando quien pide es otro sitio.
 */

const json = (datos: unknown, status = 200) =>
  new Response(JSON.stringify(datos), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

function mismoOrigen(request: Request, url: URL): boolean {
  const origen = request.headers.get('Origin');
  if (!origen) return true;
  try {
    return new URL(origen).host === url.host;
  } catch {
    return false;
  }
}

/** El recurso que viene en el cuerpo o en la dirección, ya comprobado. */
function recursoValido(valor: unknown) {
  if (!esRecurso(valor)) return null;
  // Una tabla sin papelera no tiene nada que restaurar, y `purgar` sobre ella
  // sería un borrado definitivo por una puerta que no es la suya.
  return tienePapelera(valor) ? valor : null;
}

export const GET: APIRoute = async () => {
  const filas = await listarPapelera(await baseDeDatos());
  return json({ filas });
};

export const POST: APIRoute = async ({ request, url }) => {
  if (!mismoOrigen(request, url)) return json({ error: 'origen no permitido' }, 403);

  let cuerpo: Record<string, unknown> = {};
  try {
    cuerpo = (await request.json()) as Record<string, unknown>;
  } catch {
    /* cuerpo vacío: cae en el 400 de abajo */
  }

  const recurso = recursoValido(cuerpo.recurso);
  const id = String(cuerpo.id ?? '').trim();
  if (!recurso || !id) return json({ error: 'falta el recurso o el id' }, 400);

  const hecho = await restaurar(await baseDeDatos(), recurso, id);
  // `false` no es un error: pasa al pulsar «Deshacer» dos veces, y en ese caso
  // lo que el panel tiene que decir es que ya está, no que algo falló.
  return json({ ok: true, restaurado: hecho });
};

export const DELETE: APIRoute = async ({ request, url }) => {
  if (!mismoOrigen(request, url)) return json({ error: 'origen no permitido' }, 403);

  const recurso = recursoValido(url.searchParams.get('recurso'));
  const id = (url.searchParams.get('id') ?? '').trim();
  if (!recurso || !id) return json({ error: 'falta el recurso o el id' }, 400);

  const base = await baseDeDatos();
  // Las claves se liberan DESPUÉS de borrar la fila, no antes: así la
  // comprobación de «¿la usa alguien más?» ya no encuentra a esta fila y el
  // archivo se puede soltar. Es lo mismo que hace DELETE en [recurso].ts.
  await olvidarArchivos(base, await purgar(base, recurso, id));
  return json({ ok: true });
};
