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
  falta_migracion: 'Falta correr la migración de baja del boletín en Supabase.',
  unauthorized: 'Tu sesión expiró. Vuelve a entrar al panel.',
  unconfigured: 'El servidor no tiene configurada la conexión a la base.',
  db_error: 'No se pudo leer la lista de suscriptores.',
  send_error: 'El servidor de correo rechazó todos los envíos.',
  exception: 'Error inesperado al enviar.',
};

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

    if (r.ok && r.sent > 0) {
      const hecho = `Avisamos a ${r.sent} suscriptor${r.sent === 1 ? '' : 'es'}`;
      // Un envío a medias se dice. Si no, «avisamos a 40» esconde que otros
      // cinco quedaron fuera, y nadie va a mirar los registros por su cuenta.
      return r.fallidos
        ? toast(`${hecho}. ${r.fallidos} no salieron: mira los registros.`, 'error')
        : toast(hecho);
    }
    if (r.ok) {
      return toast('Guardado. Todavía no hay nadie suscrito al boletín.');
    }

    const causa = EXPLICACION[r.reason] ?? `Fallo desconocido (${r.reason ?? 'sin código'}).`;
    console.error('[aviso a suscriptores]', r);
    toast(`Guardado, pero no se avisó. ${causa}${r.detalle ? ' ' + r.detalle : ''}`, 'error');
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
