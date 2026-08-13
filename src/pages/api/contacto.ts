import type { APIRoute } from 'astro';
import { Resend } from 'resend';
import { CONTACT, SITE } from '../../data/site';
import { resolverRemitente } from '../../lib/correo';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function esc(s: unknown) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);

/** Lee el cuerpo venga como formulario (sin JS) o como JSON. */
async function readBody(request: Request): Promise<Record<string, string>> {
  const type = request.headers.get('content-type') ?? '';
  if (type.includes('application/json')) {
    const raw = await request.json().catch(() => ({}));
    return Object.fromEntries(
      Object.entries(raw ?? {}).map(([k, v]) => [k, String(v ?? '')]),
    );
  }
  const form = await request.formData();
  return Object.fromEntries(
    Array.from(form.entries()).map(([k, v]) => [k, typeof v === 'string' ? v : '']),
  );
}

export const POST: APIRoute = async ({ request, redirect }) => {
  // Sin JavaScript el navegador espera HTML; con fetch pedimos JSON.
  const wantsJson = (request.headers.get('accept') ?? '').includes('application/json');
  const done = (
    ok: boolean,
    { status, ...payload }: { status?: number } & Record<string, unknown> = {},
  ) =>
    wantsJson
      ? json({ ok, ...payload }, ok ? 200 : (status ?? 400))
      : redirect(`/contacto?enviado=${ok ? '1' : '0'}#contacto`, 303);

  const body = await readBody(request);

  // Anti-bot: campo señuelo + envío sospechosamente rápido.
  // Se responde "ok" a propósito para no darle pistas al bot.
  const enviadoEn = Number(body._t || 0);
  if (body.website || (enviadoEn > 0 && Date.now() - enviadoEn < 2500)) {
    return done(true, { skipped: true });
  }

  const nombre = (body.nombre ?? '').trim();
  const email = (body.email ?? '').trim();
  const telefono = (body.telefono ?? '').trim();
  const templo = (body.templo ?? '').trim();
  const asunto = (body.asunto ?? '').trim();
  const mensaje = (body.mensaje ?? '').trim();

  if (!nombre || !isEmail(email) || !asunto || mensaje.length < 10) {
    return done(false, { reason: 'invalid', status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Sin proveedor de correo no se finge un envío exitoso: se le dice a la
    // persona que escriba directamente.
    return done(false, { reason: 'no_email_provider', email: CONTACT.email, status: 200 });
  }

  const remitente = resolverRemitente();
  if (!remitente.ok) return done(false, { reason: 'from_invalido', email: CONTACT.email, status: 500 });
  const from = remitente.from;
  const filas: [string, string][] = [
    ['Nombre', nombre],
    ['Correo', email],
    ['Teléfono', telefono || '—'],
    ['Templo', templo || 'Consulta general'],
    ['Asunto', asunto],
  ];

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to: CONTACT.email,
      replyTo: email,
      subject: `Contacto web — ${asunto} (${nombre})`,
      html: `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:auto;color:#0f172a">
        <h2 style="color:#14295c;margin:0 0 4px">${esc(SITE.name)}</h2>
        <p style="color:#64748b;margin:0 0 20px">Nuevo mensaje desde el formulario de contacto.</p>
        <table style="width:100%;border-collapse:collapse;font-size:.95rem">
          ${filas
            .map(
              ([k, v]) =>
                `<tr><td style="padding:6px 12px 6px 0;color:#64748b;white-space:nowrap;vertical-align:top">${esc(k)}</td><td style="padding:6px 0;font-weight:600">${esc(v)}</td></tr>`,
            )
            .join('')}
        </table>
        <div style="margin-top:20px;padding:16px;background:#f1f5f9;border-radius:10px;white-space:pre-wrap">${esc(mensaje)}</div>
        <p style="color:#64748b;font-size:.8rem;margin-top:24px">Responde a este correo para contestarle directamente a ${esc(nombre)}.</p>
      </div>`,
    });

    if (error) return done(false, { reason: 'send_error', status: 502 });
    return done(true);
  } catch {
    return done(false, { reason: 'exception', status: 500 });
  }
};
