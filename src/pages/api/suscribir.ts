/**
 * Alta al boletín con doble opt-in.
 *
 * POR QUÉ EXISTE
 * Hubo un tiempo en que el navegador insertaba directamente en la tabla con una
 * clave pública. Cualquiera podía llenarla o suscribir a terceros a su nombre.
 * Este endpoint es desde entonces la única vía de escritura: valida el correo,
 * frena por IP y deja la fila `pendiente` hasta que la persona confirme desde
 * su bandeja.
 *
 * Ahora la base es D1, que no tiene políticas de fila: lo que sustituye a
 * aquellas reglas es que el acceso a la tabla vive en un solo módulo
 * (src/lib/boletin.ts) y nada más lo toca.
 */
import type { APIRoute } from 'astro';
import { crearTransporte } from '../../lib/envio';
import { SITE } from '../../data/site';
import { resolverRemitente } from '../../lib/correo';
import { construirCorreo } from '../../lib/correo-plantilla';
import { baseDeDatos } from '../../lib/base';
import { altaSuscriptor, registrarIntento } from '../../lib/boletin';
import { ipDe } from '../../lib/ip';

export const prerender = false;

/** Altas permitidas por IP dentro de la ventana. */
const LIMITE = 5;
const VENTANA_MIN = 60;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

/**
 * Un solo sitio por donde salen los fallos.
 *
 * El detalle NO viaja al navegador: se escribe en los registros de la función.
 * Devolverlo era cómodo para diagnosticar, pero este endpoint es público y sin
 * autenticar, así que cualquiera podía leer estado interno del servidor: llegó a
 * repetir el contenido literal de una variable de entorno mal pegada. Al
 * navegador le basta el motivo —el pie ya traduce cada uno a una frase—; el
 * detalle lo necesita quien mantiene el sitio, y ese mira los registros.
 */
function fallo(reason: string, detalle: string, status = 200) {
  console.error(`[suscribir] ${reason}: ${detalle}`);
  return json({ ok: false, reason }, status);
}

/** Igual que `fallo`, pero respetando cómo pidió quien llama. */
function falloDe(
  responder: (ok: boolean, motivo: string, status?: number) => Response,
  reason: string,
  detalle: string,
  status = 200,
) {
  console.error(`[suscribir] ${reason}: ${detalle}`);
  return responder(false, reason, status);
}

/**
 * Validación de formato, no de existencia. Deliberadamente más estricta que el
 * `type="email"` del navegador —sin espacios, un solo arroba, TLD de dos letras
 * o más— pero sin pretender cubrir el RFC entero: quien pase de aquí todavía
 * tiene que confirmar desde su bandeja, que es la comprobación de verdad.
 */
const CORREO = /^[^\s@,;<>()[\]\\]+@[^\s@.]+(\.[^\s@.]+)*\.[a-z]{2,}$/i;

function correoValido(email: string): boolean {
  return email.length <= 254 && CORREO.test(email);
}

/**
 * A dónde manda a quien se suscribió SIN JavaScript.
 *
 * El formulario del pie no tenía `action`: todo dependía del script. Sin
 * JavaScript, pulsar Enter hacía un GET a la misma página y el correo de la
 * persona quedaba escrito en la barra de direcciones —y en el historial, y en
 * el registro del servidor— sin que nadie quedara suscrito.
 *
 * Los motivos se agrupan a propósito: «ya estaba» y «alta nueva» llevan al
 * mismo sitio, porque distinguirlos permitiría comprobar desde fuera quién está
 * en la lista.
 */
const DESTINOS: Record<string, string> = {
  confirmacion_enviada: 'enviado',
  ya_estaba: 'enviado',
  correo_invalido: 'invalido',
  demasiados_intentos: 'muchos',
};

export const POST: APIRoute = async ({ request, url: reqUrl }) => {
  // Con JavaScript llega JSON; sin él, un formulario normal.
  const esFormulario = !(request.headers.get('content-type') ?? '').includes('application/json');

  const email = esFormulario
    ? String((await request.formData()).get('email') ?? '')
        .trim()
        .toLowerCase()
    : String(
        ((await request.json().catch(() => ({}) as Record<string, unknown>)) as any)?.email ?? '',
      )
        .trim()
        .toLowerCase();

  /** Una sola salida para las dos formas de pedir. */
  const responder = (ok: boolean, motivo: string, status = 200) => {
    if (!esFormulario) {
      return json(ok ? { ok, estado: motivo } : { ok, reason: motivo }, status);
    }
    const estado = DESTINOS[motivo] ?? 'error';
    return new Response(null, {
      status: 303,
      headers: { Location: `/boletin?estado=${estado}`, 'Cache-Control': 'no-store' },
    });
  };

  if (!correoValido(email)) return responder(false, 'correo_invalido', 400);

  let alta;
  try {
    const base = await baseDeDatos();

    // ── Freno por IP ────────────────────────────────────────────────────────
    // La cuenta vive en la base y no en memoria: cada isolate de Workers tiene
    // la suya y se recicla sin avisar, así que un contador en una variable se
    // reinicia solo y bastaría con reintentar para saltárselo.
    const previos = await registrarIntento(base, ipDe(request), VENTANA_MIN, 'alta', LIMITE);
    if (previos >= LIMITE) return responder(false, 'demasiados_intentos', 429);

    alta = await altaSuscriptor(base, email);
  } catch (e) {
    return falloDe(responder, 'db_error', (e as Error).message);
  }

  // Al navegador se le responde lo mismo que a un alta nueva: distinguirlas
  // permitiría comprobar desde fuera quién está en la lista. En los registros sí
  // se separan —sin la dirección, que es un dato personal— porque si no, un
  // «dice que lo envió y no llega» es indistinguible de un fallo de entrega.
  if (alta.estado === 'ya_estaba') {
    console.info('[suscribir] ya_estaba: la dirección ya figuraba, no se envía correo');
    return responder(true, 'ya_estaba');
  }

  // ── Correo de confirmación ────────────────────────────────────────────────
  const transporte = crearTransporte();
  // La confirmación de alta es el PRIMER correo del boletín, así que sale de la
  // casilla del boletín. Si alguien la marca como no deseada, el castigo de
  // reputación cae ahí y no sobre la casilla del formulario de contacto, que es
  // la que no puede fallar.
  const remitente = resolverRemitente('BOLETIN_FROM');

  // Los dos fallos van por separado y no en una disyunción: `remitente.valor`
  // solo existe en la rama de error del tipo, y agrupándolos TypeScript no
  // puede estrecharlo. Es lo que hacía que el mensaje dijera «undefined».
  //
  // En ambos casos la fila queda pendiente a propósito: confirmar es lo que da
  // permiso para escribir a esa persona, y sin correo saliente no hay permiso.
  if (!transporte) {
    return falloDe(
      responder,
      'sin_proveedor_correo',
      'Falta RESEND_API_KEY: el alta quedó pendiente de confirmar.',
    );
  }

  if (!remitente.ok) {
    return falloDe(
      responder,
      'from_invalido',
      `BOLETIN_FROM/CONTACT_FROM = «${remitente.valor}». Debe ser «correo@dominio.cl» o «Nombre <correo@dominio.cl>», sin comillas.`,
    );
  }

  const base = process.env.SITE_URL || reqUrl.origin;
  const enlace = `${base}/confirmar?t=${encodeURIComponent(alta.token)}`;

  const { html, texto } = construirCorreo({
    base,
    preencabezado: 'Un clic y quedas dentro. Si no fuiste tú, ignora este correo.',
    eyebrow: 'Boletín',
    titulo: 'Confirma tu suscripción',
    bloques: [
      {
        tipo: 'parrafo',
        texto:
          'Alguien —esperamos que tú— dejó este correo para recibir nuestras novedades. Confírmalo con el botón y quedas dentro.',
      },
      { tipo: 'boton', texto: 'Confirmar mi suscripción', url: enlace },
    ],
    pie: { texto: 'Si no fuiste tú, no hagas nada: sin confirmar no te llegará ningún boletín.' },
  });

  try {
    // El enviador lanza si el envío falla: no hay un error que mirar en el
    // resultado, todo el camino de fallo pasa por el catch.
    await transporte.sendMail({
      from: remitente.from,
      to: email,
      subject: `${SITE.name} — Confirma tu suscripción`,
      text: texto,
      html,
    });
  } catch (e) {
    return falloDe(responder, 'send_error', (e as Error).message);
  } finally {
    transporte.close();
  }

  console.info('[suscribir] confirmacion_enviada: el servidor de correo aceptó el envío');
  return responder(true, 'confirmacion_enviada');
};
