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
  no_email_provider: 'Faltan SMTP_HOST, SMTP_USER o SMTP_PASS en Vercel.',
  from_invalido: 'La variable CONTACT_FROM está mal escrita en Vercel.',
  falta_migracion:
    'Falta correr una migración en Supabase. Copia supabase/schema.sql en el editor SQL.',
  unauthorized: 'Tu sesión expiró. Vuelve a entrar al panel.',
  unconfigured: 'El servidor no tiene configurada la conexión a la base.',
  db_error: 'No se pudo leer la lista de suscriptores.',
  send_error: 'El servidor de correo rechazó todos los envíos.',
  remitente_inexistente:
    'El remitente no existe como casilla en el servidor. Revisa CONTACT_FROM en Vercel, o crea esa dirección en cPanel.',
  auth_invalida: 'La contraseña de SMTP_PASS no es correcta.',
  limite_hosting: 'Se topó el límite de correos por hora del hosting. Espera o súbelo en cPanel.',
  exception: 'Error inesperado al enviar.',
  no_en_vivo: 'La transmisión no está encendida. Enciende el interruptor, guarda y reintenta.',
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

export async function avisarSuscriptores(ctx: Contexto, titulo: string, ruta: string) {
  try {
    const r = await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: ctx.config.notify!.type,
        title: titulo,
        url: location.origin + ruta,
      }),
    }).then((x) => x.json());

    const { ok, texto } = resumenAviso(r);
    if (!ok) console.error('[aviso a suscriptores]', r);
    toast(texto, ok ? undefined : 'error');
  } catch (e) {
    console.error('[aviso a suscriptores]', e);
    toast('Guardado, pero no se pudo contactar al servidor para avisar.', 'error');
  }
}

/** URL pública del elemento (ficha propia si la tiene, listado si no). */
export function rutaDe(ctx: Contexto, row: Fila): string {
  const base = ctx.config.notify!.urlBase;
  return ctx.config.notify!.porItem ? `${base}/${row.slug ?? row.id}` : base;
}
