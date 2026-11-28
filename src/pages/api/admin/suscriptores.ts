import type { APIRoute } from 'astro';
import { baseDeDatos } from '../../../lib/base';
import { barrerSinConfirmar, DIAS_PARA_CONFIRMAR } from '../../../lib/boletin';

export const prerender = false;

/**
 * Limpiar a mano las altas que nunca se confirmaron.
 *
 * ── POR QUÉ UN BOTÓN SI YA SE BARRE SOLO ────────────────────────────────────
 * Porque el barrido automático viaja pegado a cada alta nueva (ver
 * `/api/suscribir`), y eso deja un hueco: si nadie se suscribe en un mes, lo
 * caducado se queda ahí un mes. No hace daño —a los pendientes no se les
 * escribe nunca— pero sí ensucia la única pantalla donde se mira cuánta gente
 * hay de verdad.
 *
 * ── POR QUÉ NO SE BARRE AL ABRIR LA PANTALLA ────────────────────────────────
 * Porque entonces MIRAR borraría. Una pantalla que se abre por costumbre no
 * debería cambiar nada; un prefetch del navegador, tampoco. Abrir cuenta, el
 * botón borra, y esa diferencia tiene que notarse.
 *
 * El permiso lo da el middleware con el token de Cloudflare Access, igual que
 * el resto del panel. Acá solo se comprueba el origen, por lo mismo que en
 * /api/admin/[recurso]: Access autentica con una cookie, y las cookies las
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

export const POST: APIRoute = async ({ request, url }) => {
  if (!mismoOrigen(request, url)) return json({ error: 'origen no permitido' }, 403);

  const borrados = await barrerSinConfirmar(await baseDeDatos());
  return json({ ok: true, borrados, dias: DIAS_PARA_CONFIRMAR });
};
