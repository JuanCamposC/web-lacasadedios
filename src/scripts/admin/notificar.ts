import type { Contexto, Fila } from './tipos';
import { toast } from './ui';

/**
 * Aviso a los suscriptores.
 *
 * Antes solo se disparaba al CREAR. Como el panel ahora invita a guardar en
 * borrador y publicar después desde la lista, ese camino no avisaba a nadie y no
 * lo decía. Ahora avisa por los dos caminos y SIEMPRE informa qué pasó, incluido
 * «no hay suscriptores», que era el silencio más confuso.
 */

// Siempre se dice QUÉ falló. La versión anterior tenía un comodín «no se pudo
// enviar» que se tragaba la causa real y dejaba sin pistas.
const EXPLICACION: Record<string, string> = {
  no_email_provider: 'Falta el secreto RESEND_API_KEY en Cloudflare.',
  from_invalido: 'La variable BOLETIN_FROM está mal escrita en Cloudflare.',
  falta_migracion:
    'Falta correr el esquema en la base. Aplica d1/0001_esquema.sql con `wrangler d1 execute`.',
  unauthorized: 'Tu sesión de Cloudflare Access expiró. Recarga la página para volver a entrar.',
  unconfigured: 'El servidor no tiene configurada la conexión a la base.',
  db_error: 'No se pudo leer la lista de suscriptores.',
  send_error: 'El servidor de correo rechazó todos los envíos.',
  remitente_inexistente:
    'Resend no acepta ese remitente. Revisa CONTACT_FROM: tiene que ser una dirección del dominio verificado en Resend.',
  auth_invalida: 'La clave de Resend no es válida o fue revocada.',
  limite_proveedor: 'Se topó el límite de envíos de Resend. Espera un momento y reintenta.',
  exception: 'Error inesperado al enviar.',
  no_en_vivo: 'La transmisión no está encendida. Enciende el interruptor, guarda y reintenta.',
  // Pasa cuando se entra con el panel abierto a propósito o desde localhost:
  // no hay token de Access, así que no hay correo al que mandar la prueba.
  sin_correo_admin:
    'No se pudo saber tu correo. Entra por Cloudflare Access para poder mandarte la prueba.',
};

/**
 * Traduce la respuesta de /api/notify a una frase.
 *
 * Vive aparte porque hay dos sitios que avisan y no comparten interfaz: el
 * panel de listados, que habla por avisos flotantes, y el de «En vivo», que
 * escribe en el recuadro de su propio formulario. La frase debe ser la misma en
 * los dos; lo único distinto es dónde se pinta.
 */
export function resumenAviso(r: any): { ok: boolean; texto: string } {
  // `ya_avisado` llega con ok:true a propósito: no pasó nada malo, es la
  // protección contra escribirle dos veces a la lista por la misma transmisión.
  if (r?.ok && r.reason === 'ya_avisado') {
    return { ok: true, texto: 'Guardado. Ya se había avisado de esta transmisión.' };
  }
  if (r?.ok && r.prueba) {
    return r.sent
      ? { ok: true, texto: 'Prueba enviada a tu correo. Ábrela en el teléfono antes de mandarla.' }
      : { ok: false, texto: 'La prueba no salió. Mira los registros del servidor.' };
  }
  if (r?.ok && r.sent > 0) {
    const hecho = `Avisamos a ${r.sent} suscriptor${r.sent === 1 ? '' : 'es'}`;
    // Un envío a medias se dice. Si no, «avisamos a 40» esconde que otros
    // cinco quedaron fuera, y nadie va a mirar los registros por su cuenta.
    return r.fallidos
      ? { ok: false, texto: `${hecho}. ${r.fallidos} no salieron: mira los registros.` }
      : { ok: true, texto: hecho };
  }
  if (r?.ok) return { ok: true, texto: 'Guardado. Todavía no hay nadie suscrito al boletín.' };

  const causa = EXPLICACION[r?.reason] ?? `Fallo desconocido (${r?.reason ?? 'sin código'}).`;
  return {
    ok: false,
    texto: `Guardado, pero no se avisó. ${causa}${r?.detalle ? ' ' + r.detalle : ''}`,
  };
}

/** Llama a /api/notify y cuenta lo que pasó. La única forma de avisar. */
export async function pedirAviso(cuerpo: Record<string, unknown>): Promise<void> {
  try {
    const r = await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    }).then((x) => x.json());

    const { ok, texto } = resumenAviso(r);
    if (!ok) console.error('[aviso a suscriptores]', r);
    toast(texto, ok ? undefined : 'error');
  } catch (e) {
    console.error('[aviso a suscriptores]', e);
    toast('Guardado, pero no se pudo contactar al servidor para avisar.', 'error');
  }
}

/**
 * Aviso al publicar.
 *
 * Recibe la FILA entera y no solo el título: de ahí salen también la bajada y
 * la imagen, que son las que hacen que el correo dé ganas de entrar. Un correo
 * con título y botón pelados se parece demasiado a una notificación de sistema.
 */
export async function avisarSuscriptores(ctx: Contexto, row: Fila) {
  const { titleField, subtitleField, notify } = ctx.config;
  await pedirAviso({
    type: notify!.type,
    title: String(row[titleField] ?? ''),
    url: location.origin + rutaDe(ctx, row),
    // Los videos no tienen imagen y una noticia puede ir sin bajada: el
    // servidor descarta lo que llegue vacío.
    excerpt: subtitleField ? String(row[subtitleField] ?? '') : '',
    image: String(row.image_url ?? ''),
  });
}

/** URL pública del elemento (ficha propia si la tiene, listado si no). */
export function rutaDe(ctx: Contexto, row: Fila): string {
  const base = ctx.config.notify!.urlBase;
  return ctx.config.notify!.porItem ? `${base}/${row.slug ?? row.id}` : base;
}
