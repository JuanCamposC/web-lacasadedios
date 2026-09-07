import type { APIRoute } from 'astro';
import { crearTransporte } from '../../lib/smtp';
import { CONTACT } from '../../data/site';
import { resolverRemitente } from '../../lib/correo';
import { construirCorreo } from '../../lib/correo-plantilla';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);

/** Lee el cuerpo venga como formulario (sin JS) o como JSON. */
async function readBody(request: Request): Promise<Record<string, string>> {
  const type = request.headers.get('content-type') ?? '';
  if (type.includes('application/json')) {
    const raw = await request.json().catch(() => ({}));
    return Object.fromEntries(Object.entries(raw ?? {}).map(([k, v]) => [k, String(v ?? '')]));
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

  const transporte = crearTransporte();
  if (!transporte) {
    // Sin proveedor de correo no se finge un envío exitoso: se le dice a la
    // persona que escriba directamente.
    return done(false, { reason: 'no_email_provider', email: CONTACT.email, status: 200 });
  }

  const remitente = resolverRemitente();
  if (!remitente.ok)
    return done(false, { reason: 'from_invalido', email: CONTACT.email, status: 500 });
  const from = remitente.from;
  // El asunto sube a título del correo, así que aquí no se repite.
  const filas: [string, string][] = [
    ['Nombre', nombre],
    ['Correo', email],
    ['Teléfono', telefono || '—'],
    ['Templo', templo || 'Consulta general'],
  ];

  const { html, texto } = construirCorreo({
    base: process.env.SITE_URL || new URL(request.url).origin,
    preencabezado: `${nombre} escribió desde el formulario: ${asunto}`,
    eyebrow: 'Formulario de contacto',
    titulo: asunto,
    bloques: [
      { tipo: 'ficha', filas },
      { tipo: 'cita', texto: mensaje },
    ],
    pie: { texto: `Responde a este correo para contestarle directamente a ${nombre}.` },
  });

  try {
    await transporte.sendMail({
      from,
      to: CONTACT.email,
      replyTo: email,
      subject: `Contacto web — ${asunto} (${nombre})`,
      text: texto,
      html,
    });

    return done(true);
  } catch {
    // nodemailer lanza: aquí caen tanto el rechazo del servidor como que no
    // se pueda ni conectar. La persona ve el mismo mensaje en los dos casos.
    return done(false, { reason: 'send_error', status: 502 });
  } finally {
    transporte.close();
  }
};
