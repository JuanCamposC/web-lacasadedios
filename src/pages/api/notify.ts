import type { APIRoute } from 'astro';
import { Resend } from 'resend';
import { CONTACT, SITE } from '../../data/site';

export const prerender = false;

/** Resend acepta hasta 100 correos por llamada al envío por lotes. */
const TAMANO_LOTE = 100;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function esc(s: unknown) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function trozos<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

export const POST: APIRoute = async ({ request, locals, url: reqUrl }) => {
  const supabase = (locals as any).supabase;
  if (!supabase) return json({ ok: false, reason: 'unconfigured' });

  // Solo el mantenedor autenticado puede disparar notificaciones.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ ok: false, reason: 'unauthorized' }, 401);

  const body = await request.json().catch(() => ({}));
  const type = String(body?.type ?? '');
  const title = String(body?.title ?? '').trim();
  const url = String(body?.url ?? '').trim();
  if (!title) return json({ ok: false, reason: 'bad_request' }, 400);

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return json({ ok: false, reason: 'no_email_provider' });

  // `token` viene de la migración de baja (ver supabase/schema.sql). Si la
  // migración todavía no se corrió, la consulta falla y se dice por qué en
  // vez de enviar correos sin enlace de baja.
  const { data: subs, error: errorSubs } = await supabase
    .from('subscribers')
    .select('email, token');

  if (errorSubs) {
    const faltaToken = /token/i.test(errorSubs.message ?? '');
    return json({
      ok: false,
      reason: faltaToken ? 'falta_migracion' : 'db_error',
      detalle: errorSubs.message,
    });
  }

  const destinatarios = (subs ?? []).filter((s: any) => s.email && s.token);
  if (!destinatarios.length) return json({ ok: true, sent: 0 });

  const label =
    type === 'evento'
      ? 'un nuevo evento'
      : type === 'noticia'
        ? 'una nueva noticia'
        : type === 'video'
          ? 'un nuevo video'
          : 'una novedad';

  const from = process.env.CONTACT_FROM || `${SITE.name} <onboarding@resend.dev>`;
  const base = process.env.SITE_URL || reqUrl.origin;
  const link = url || base;

  const cuerpo = (urlBaja: string) => `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:auto;color:#17202e">
    <h2 style="color:#14295c;margin:0 0 4px">${esc(SITE.name)}</h2>
    <p style="color:#64748b;margin:0 0 20px">Publicamos ${label}:</p>
    <p style="font-size:1.15rem;font-weight:600;margin:0 0 20px">${esc(title)}</p>
    <p><a href="${esc(link)}" style="display:inline-block;background:#14295c;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Verlo en el sitio</a></p>
    <p style="color:#64748b;font-size:.8rem;margin-top:28px;border-top:1px solid #e2e8f0;padding-top:14px">
      Recibes este correo porque te suscribiste al boletín de ${esc(SITE.name)}.<br />
      <a href="${esc(urlBaja)}" style="color:#64748b">Darte de baja</a>
    </p>
  </div>`;

  try {
    const resend = new Resend(apiKey);
    let enviados = 0;

    // Un correo por persona, en lotes de 100. Antes iba un solo mensaje con
    // todos en copia oculta: era imposible poner un enlace de baja propio para
    // cada uno, y los proveedores penalizan el envío masivo sin esa salida.
    for (const lote of trozos(destinatarios, TAMANO_LOTE)) {
      const mensajes = lote.map((s: any) => {
        const urlBaja = `${base}/baja?t=${encodeURIComponent(s.token)}`;
        return {
          from,
          to: s.email,
          subject: `${SITE.name} — ${title}`,
          html: cuerpo(urlBaja),
          headers: {
            // Cabecera estándar: pone el botón «Cancelar suscripción» en Gmail
            // y Outlook, y es lo que miran para no marcar el envío como spam.
            //
            // A propósito SIN `List-Unsubscribe-Post`: la baja en un clic exige
            // que la URL acepte POST sin cabecera Origin, y Astro bloquea eso
            // por protección CSRF. Desactivar esa protección para todo el sitio
            // por una lista de decenas de personas no compensa; así el botón
            // igual aparece y abre la página de baja.
            'List-Unsubscribe': `<${urlBaja}>`,
          },
        };
      });

      const { error } = await resend.batch.send(mensajes);
      if (error) {
        // El detalle de Resend es lo único que dice si el dominio no está
        // verificado, si el remitente no corresponde o si se topó el límite.
        // Este endpoint ya exige sesión de administrador, así que devolverlo
        // no expone nada a un visitante — y sin él, el panel solo podía decir
        // «no se pudo enviar», que no ayuda a nadie.
        return json({
          ok: false,
          reason: 'send_error',
          sent: enviados,
          detalle: (error as any)?.message ?? String(error),
        });
      }
      enviados += mensajes.length;
    }

    return json({ ok: true, sent: enviados });
  } catch (e: any) {
    return json({ ok: false, reason: 'exception', detalle: e?.message ?? String(e) });
  }
};
