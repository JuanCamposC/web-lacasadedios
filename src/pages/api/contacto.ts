import type { APIRoute } from 'astro';
import { procesarContacto, readBody } from '../../lib/contacto';
import { CONTACT } from '../../data/site';

export const prerender = false;

/**
 * El formulario de contacto para quien tiene JavaScript.
 *
 * La lógica vive en src/lib/contacto.ts, porque la comparte con /contacto: esa
 * página atiende el mismo envío cuando NO hay JavaScript y necesita volver a
 * dibujarse con lo que la persona escribió, cosa que una redirección no puede
 * hacer. Acá solo se traduce el resultado a JSON.
 */
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request, redirect }) => {
  const body = await readBody(request);
  const r = await procesarContacto(request, body);

  // Sin JavaScript el navegador espera HTML. Este camino queda para quien
  // llegue con un formulario antiguo apuntando acá; el del sitio manda a
  // /contacto, que conserva lo escrito.
  const quiereJson = (request.headers.get('accept') ?? '').includes('application/json');
  if (!quiereJson) {
    return redirect(`/contacto?enviado=${r.ok ? '1' : '0'}#contacto`, 303);
  }

  // `email` acompaña a los fallos que obligan a escribir a mano.
  const extra =
    r.reason === 'no_email_provider' ||
    r.reason === 'from_invalido' ||
    r.reason === 'demasiados_intentos'
      ? { email: CONTACT.email }
      : {};

  return json(
    r.ok ? { ok: true } : { ok: false, reason: r.reason, ...extra },
    r.ok ? 200 : (r.status ?? 400),
  );
};
