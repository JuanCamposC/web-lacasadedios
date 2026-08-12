import type { APIRoute } from 'astro';
import { Resend } from 'resend';
import { CONTACT } from '../../data/templos';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function esc(s: string) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export const POST: APIRoute = async ({ request, locals }) => {
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

  const { data: subs } = await supabase.from('subscribers').select('email');
  const emails: string[] = (subs ?? []).map((s: any) => s.email).filter(Boolean);
  if (!emails.length) return json({ ok: true, sent: 0 });

  const label =
    type === 'evento' ? 'un nuevo evento' : type === 'noticia' ? 'una nueva noticia' : type === 'video' ? 'un nuevo video' : 'una novedad';
  const from = process.env.CONTACT_FROM || 'La Casa de Dios <onboarding@resend.dev>';
  const link = url || 'https://web-lacasadedios.vercel.app';

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to: CONTACT.email,
      bcc: emails,
      subject: `La Casa de Dios — ${title}`,
      html: `<div style="font-family:sans-serif;max-width:520px;margin:auto">
        <h2 style="color:#14295c">La Casa de Dios</h2>
        <p>Publicamos ${label}:</p>
        <p style="font-size:1.15rem;font-weight:600">${esc(title)}</p>
        <p><a href="${esc(link)}" style="display:inline-block;background:#14295c;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Verlo en el sitio</a></p>
        <p style="color:#64748b;font-size:.85rem;margin-top:24px">Recibes este correo porque te suscribiste al newsletter de La Casa de Dios.</p>
      </div>`,
    });
    if (error) return json({ ok: false, reason: 'send_error' });
    return json({ ok: true, sent: emails.length });
  } catch {
    return json({ ok: false, reason: 'exception' });
  }
};
