/**
 * Envío de correo por la API de Resend.
 *
 * ── POR QUÉ YA NO ES SMTP ───────────────────────────────────────────────────
 * El sitio enviaba con `nodemailer` y una casilla del propio dominio, y era la
 * decisión correcta mientras vivió en Vercel. En Cloudflare Workers no se
 * puede: se probó, y la conexión muere en el socket. `node:net` está soportado
 * pero `node:tls` solo parcialmente, y todo el SMTP sobre 465 depende de esa
 * pieza. Construir el correo de una iglesia sobre una implementación declarada
 * incompleta no compensa.
 *
 * Resend habla HTTP, que es lo único que un Worker hace de forma nativa.
 *
 * ── LA MISMA FORMA DE ANTES ─────────────────────────────────────────────────
 * `crearTransporte()` devuelve algo con `sendMail()` y `close()`, igual que
 * nodemailer. Eso no es nostalgia: los cuatro sitios que mandan correo ya
 * estaban escritos así, probados así, y con sus casos de fallo resueltos así.
 * Cambiar la forma habría obligado a revisar los cuatro; cambiando solo el
 * motor, se revisa uno.
 *
 * ── EL REMITENTE ────────────────────────────────────────────────────────────
 * Resend solo deja enviar desde un dominio verificado. El de la iglesia lo
 * está, y los registros viven en el subdominio `send`, así que el SPF raíz
 * —el que autoriza a Google Workspace— no se toca. Quién es el remitente lo
 * sigue decidiendo `resolverRemitente()` de correo.ts.
 */

const API = 'https://api.resend.com/emails';

/** Un mensaje, con los nombres que ya usaban las rutas. */
export interface Mensaje {
  from: string;
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string;
  headers?: Record<string, string>;
}

export interface Enviador {
  sendMail(mensaje: Mensaje): Promise<{ id: string }>;
  /** No hace nada: no hay conexión que cerrar. Existe para no tocar las rutas. */
  close(): void;
}

function clave(): string {
  return (process.env.RESEND_API_KEY ?? '').trim();
}

/** ¿Se puede enviar correo? Si no, las rutas lo dicen en vez de fingir. */
export function envioConfigurado(): boolean {
  return clave().length > 0;
}

/** Traduce del vocabulario de nodemailer al de Resend. */
function aResend(m: Mensaje): Record<string, unknown> {
  return {
    from: m.from,
    to: m.to,
    subject: m.subject,
    ...(m.text ? { text: m.text } : {}),
    ...(m.html ? { html: m.html } : {}),
    // El único nombre que cambia entre las dos APIs.
    ...(m.replyTo ? { reply_to: m.replyTo } : {}),
    ...(m.headers ? { headers: m.headers } : {}),
  };
}

/**
 * Lee el error de Resend y lo deja en una frase.
 *
 * Importa más de lo que parece: los cuatro llamadores enseñan este texto —o lo
 * guardan— cuando algo falla. «error 422» no le dice nada a nadie; «from is not
 * a verified domain» se arregla en dos minutos.
 */
async function explicar(respuesta: Response): Promise<string> {
  const texto = await respuesta.text();
  try {
    const datos = JSON.parse(texto) as { message?: string; error?: string; name?: string };
    return datos.message ?? datos.error ?? datos.name ?? `error ${respuesta.status}`;
  } catch {
    return texto.slice(0, 300) || `error ${respuesta.status}`;
  }
}

async function llamar(url: string, cuerpo: unknown): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${clave()}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(cuerpo),
  });
}

/**
 * El enviador, o `null` si falta la clave.
 *
 * Devolver `null` y no un objeto que falla al usarse es lo que permite a las
 * rutas distinguir «no hay proveedor configurado» de «el envío falló», que para
 * quien escribe desde el formulario son dos mensajes muy distintos.
 */
export function crearTransporte(): Enviador | null {
  if (!envioConfigurado()) return null;

  return {
    async sendMail(mensaje) {
      const respuesta = await llamar(API, aResend(mensaje));
      // Se lanza, como hacía nodemailer: las cuatro rutas tienen su `catch`
      // escrito para eso y no miran el valor de retorno en busca de errores.
      if (!respuesta.ok) throw new Error(await explicar(respuesta));
      return (await respuesta.json()) as { id: string };
    },
    close() {},
  };
}

/**
 * Cuántos envíos van a la vez.
 *
 * Resend admite diez peticiones por segundo. Cinco deja margen y evita que una
 * lista larga se responda a sí misma con 429. El `pool` de nodemailer hacía
 * esto mismo con tres conexiones; al desaparecer, el freno hay que ponerlo acá
 * o `Promise.all` lanzaría tantas peticiones como suscriptores de golpe.
 */
const A_LA_VEZ = 5;

/**
 * Envía un correo distinto a cada destinatario, uno por uno.
 *
 * ── POR QUÉ NO SE USA EL ENDPOINT DE LOTE ───────────────────────────────────
 * Resend tiene `/emails/batch`, que manda hasta cien en una sola llamada, y a
 * primera vista es lo obvio para un boletín. No se usa a propósito: valida el
 * lote entero, así que **una sola dirección mala deja sin correo a todos los
 * que iban detrás**.
 *
 * Ese problema ya se sufrió en este proyecto con el envío por lotes anterior, y
 * el arreglo fue justamente pasar a uno por uno. Volver al lote por ahorrarse
 * peticiones sería desandar eso a cambio de nada: la lista es de decenas de
 * personas, no de miles.
 *
 * No lanza. En un envío masivo, que una dirección rebote no puede tumbar el
 * resto; se apunta y se sigue.
 */
export async function enviarCadaUno(
  mensajes: Mensaje[],
  alFallar?: (motivo: string) => void,
): Promise<{ enviados: number; fallidos: number; primerFallo: string }> {
  const enviador = crearTransporte();
  if (!enviador) {
    return { enviados: 0, fallidos: mensajes.length, primerFallo: 'falta RESEND_API_KEY' };
  }

  let enviados = 0;
  let fallidos = 0;
  let primerFallo = '';

  for (let i = 0; i < mensajes.length; i += A_LA_VEZ) {
    await Promise.all(
      mensajes.slice(i, i + A_LA_VEZ).map(async (mensaje) => {
        try {
          await enviador.sendMail(mensaje);
          enviados++;
        } catch (e) {
          fallidos++;
          const motivo = (e as Error).message;
          if (!primerFallo) primerFallo = motivo;
          alFallar?.(motivo);
        }
      }),
    );
  }

  return { enviados, fallidos, primerFallo };
}
