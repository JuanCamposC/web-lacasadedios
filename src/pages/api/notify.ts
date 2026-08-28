import type { APIRoute } from 'astro';
import { crearTransporteLote } from '../../lib/smtp';
import { SITE } from '../../data/site';
import { resolverRemitente } from '../../lib/correo';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Traduce el rechazo del servidor a un motivo que el panel sepa explicar.
 *
 * Sin esto, cualquier fallo caía en «el servidor rechazó los envíos», que es
 * cierto y no sirve de nada: manda a revisar cPanel cuando el problema puede
 * ser una variable de entorno. El caso real que lo motivó: CONTACT_FROM
 * apuntaba a una casilla que no existía y Exim rechazaba por verificación de
 * remitente, no por nada del hosting.
 */
function clasificar(mensaje: string): string {
  if (/sender verify|no such user|verification failed/i.test(mensaje)) {
    return 'remitente_inexistente';
  }
  if (/535|authentication/i.test(mensaje)) return 'auth_invalida';
  if (/max emails|exceeded|per hour/i.test(mensaje)) return 'limite_hosting';
  return 'send_error';
}

function esc(s: unknown) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
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

  const transporte = crearTransporteLote();
  if (!transporte) return json({ ok: false, reason: 'no_email_provider' });

  // `token` viene de la migración de baja (ver supabase/schema.sql). Si la
  // migración todavía no se corrió, la consulta falla y se dice por qué en
  // vez de enviar correos sin enlace de baja.
  //
  // `pending` viene de la migración de doble opt-in: solo se escribe a quien
  // confirmó su correo desde su propia bandeja. Enviar a los pendientes sería
  // escribir a direcciones que nadie verificó, que es justo lo que dispara las
  // quejas de spam y arrastra la reputación del dominio.
  const { data: subs, error: errorSubs } = await supabase
    .from('subscribers')
    .select('email, token')
    .eq('pending', false);

  if (errorSubs) {
    const faltaColumna = /token|pending/i.test(errorSubs.message ?? '');
    return json({
      ok: false,
      reason: faltaColumna ? 'falta_migracion' : 'db_error',
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

  const remitente = resolverRemitente();
  if (!remitente.ok) {
    return json({
      ok: false,
      reason: 'from_invalido',
      detalle: `CONTACT_FROM = «${remitente.valor}». Debe ser «correo@dominio.cl» o «Nombre <correo@dominio.cl>», sin comillas.`,
    });
  }
  const from = remitente.from;
  const base = process.env.SITE_URL || reqUrl.origin;
  const link = url || base;

  const cuerpo = (
    urlBaja: string,
  ) => `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:auto;color:#17202e">
    <h2 style="color:#14295c;margin:0 0 4px">${esc(SITE.name)}</h2>
    <p style="color:#64748b;margin:0 0 20px">Publicamos ${label}:</p>
    <p style="font-size:1.15rem;font-weight:600;margin:0 0 20px">${esc(title)}</p>
    <p><a href="${esc(link)}" style="display:inline-block;background:#14295c;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Verlo en el sitio</a></p>
    <p style="color:#64748b;font-size:.8rem;margin-top:28px;border-top:1px solid #e2e8f0;padding-top:14px">
      Recibes este correo porque te suscribiste al boletín de ${esc(SITE.name)}.<br />
      <a href="${esc(urlBaja)}" style="color:#64748b">Darte de baja</a>
    </p>
  </div>`;

  let enviados = 0;
  let fallidos = 0;
  // El primero manda: si fallan todos, fallan por lo mismo.
  let primerFallo = '';

  try {
    // Se lanzan todos a la vez y el pool los encola de tres en tres: la
    // concurrencia la decide el transporte (ver crearTransporteLote), no este
    // bucle. Un correo por persona, nunca copia oculta: cada uno lleva su
    // propio enlace de baja, y sin esa salida los proveedores penalizan.
    //
    // Un rechazo individual YA NO aborta el resto. Con el envío por lotes que
    // había antes, un solo destinatario malo dejaba sin aviso a toda la lista
    // que venía detrás; ahora se apunta y se sigue.
    await Promise.all(
      destinatarios.map(async (s: any) => {
        const urlBaja = `${base}/baja?t=${encodeURIComponent(s.token)}`;
        try {
          await transporte.sendMail({
            from,
            to: s.email,
            subject: `${SITE.name} — ${title}`,
            html: cuerpo(urlBaja),
            headers: {
              // Cabecera estándar: pone el botón «Cancelar suscripción» en
              // Gmail y Outlook, y es lo que miran para no marcar el envío
              // como spam.
              //
              // A propósito SIN `List-Unsubscribe-Post`: la baja en un clic
              // exige que la URL acepte POST sin cabecera Origin, y Astro lo
              // bloquea por protección CSRF. Desactivar esa protección en todo
              // el sitio por una lista de decenas de personas no compensa; así
              // el botón igual aparece y abre la página de baja.
              'List-Unsubscribe': `<${urlBaja}>`,
            },
          });
          enviados++;
        } catch (e: any) {
          // La dirección no va a los registros: es un dato personal. Basta con
          // saber cuántos fallaron y con qué motivo los rechazaron.
          fallidos++;
          const mensaje = String(e?.message ?? e);
          if (!primerFallo) primerFallo = mensaje;
          console.error(`[notify] destinatario rechazado: ${mensaje}`);
        }
      }),
    );
  } catch (e: any) {
    return json({
      ok: false,
      reason: 'exception',
      sent: enviados,
      detalle: e?.message ?? String(e),
    });
  } finally {
    // El pool deja conexiones abiertas si no se cierra, y la función se
    // congelaría con ellas dentro.
    transporte.close();
  }

  // Que no saliera NI UNO es un fallo; que fallen algunos, un aviso.
  if (!enviados && fallidos) {
    return json({ ok: false, reason: clasificar(primerFallo), sent: 0, fallidos });
  }
  return json({ ok: true, sent: enviados, fallidos });
};
