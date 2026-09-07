import type { APIRoute } from 'astro';
import { crearTransporteLote } from '../../lib/smtp';
import { SITE } from '../../data/site';
import { resolverRemitente } from '../../lib/correo';
import { construirCorreo } from '../../lib/correo-plantilla';

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

  const esVivo = type === 'vivo';

  /**
   * La transmisión tiene dos reglas que las publicaciones no tienen.
   *
   * PRIMERA: el enlace no se toma del cuerpo de la petición sino de la tabla.
   * Es la única fuente que sabe qué se está emitiendo de verdad.
   *
   * SEGUNDA: no se avisa dos veces de la misma transmisión. Sin esto, corregir
   * una errata en el título y volver a guardar le escribiría otra vez a toda la
   * lista. Cuando empiece la siguiente el enlace cambiará, dejará de coincidir,
   * y el aviso sale solo: no hay nada que acordarse de reiniciar.
   */
  let marcaVivo = '';
  if (esVivo) {
    const { data: aj, error: errAj } = await supabase
      .from('settings')
      .select('live_enabled, live_url, live_notified_url')
      .eq('id', 1)
      .maybeSingle();

    if (errAj) {
      const faltaColumna = /live_notified_url/i.test(errAj.message ?? '');
      return json({
        ok: false,
        reason: faltaColumna ? 'falta_migracion' : 'db_error',
        detalle: errAj.message,
      });
    }
    if (!aj?.live_enabled) return json({ ok: false, reason: 'no_en_vivo' });

    marcaVivo = aj.live_url ?? '';
    if (marcaVivo && marcaVivo === aj.live_notified_url) {
      // No es un fallo: es la protección funcionando.
      return json({ ok: true, sent: 0, reason: 'ya_avisado' });
    }
  }

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

  // El rótulo de arriba dice de qué va el correo en dos palabras; el título es
  // el del contenido. Antes iban juntos en una frase («Publicamos una nueva
  // noticia:») y el título quedaba de segundón.
  const rotulo = esVivo
    ? 'En vivo ahora'
    : type === 'evento'
      ? 'Nuevo evento'
      : type === 'noticia'
        ? 'Nueva noticia'
        : type === 'video'
          ? 'Nuevo video'
          : 'Novedad';

  // La transmisión no se «publica», está pasando. El correo lo dice así, y el
  // botón lleva a verla en vez de a leerla.
  const entradilla = esVivo
    ? 'Estamos transmitiendo en este momento. Acompáñanos desde donde estés.'
    : 'Acabamos de publicarlo en el sitio.';
  const textoBoton = esVivo ? 'Ver la transmisión' : 'Verlo en el sitio';
  const asunto = esVivo ? `${SITE.name} — En vivo ahora: ${title}` : `${SITE.name} — ${title}`;

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

  // Se arma por destinatario porque cada uno lleva SU enlace de baja.
  const cuerpo = (urlBaja: string) =>
    construirCorreo({
      base,
      preencabezado: esVivo ? entradilla : `${rotulo}: ${title}`,
      eyebrow: rotulo,
      titulo: title,
      bloques: [
        { tipo: 'parrafo', texto: entradilla },
        { tipo: 'boton', texto: textoBoton, url: link },
      ],
      pie: {
        texto: `Recibes este correo porque te suscribiste al boletín de ${SITE.name}.`,
        enlace: { texto: 'Darte de baja', url: urlBaja },
      },
    });

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
        const { html, texto } = cuerpo(urlBaja);
        try {
          await transporte.sendMail({
            from,
            to: s.email,
            subject: asunto,
            text: texto,
            html,
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

  // La transmisión se marca DESPUÉS de enviar y solo si salió alguno: si el
  // envío falla entero, el siguiente intento debe volver a intentarlo.
  if (esVivo && enviados && marcaVivo) {
    const { error } = await supabase
      .from('settings')
      .update({ live_notified_url: marcaVivo })
      .eq('id', 1);
    // No se le devuelve al panel: los correos YA salieron, y decir que falló
    // invitaría a reintentar y a escribir dos veces. Queda en los registros.
    if (error) console.error(`[notify] no se pudo marcar la transmisión avisada: ${error.message}`);
  }

  return json({ ok: true, sent: enviados, fallidos });
};
