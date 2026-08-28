/**
 * Envío de correo por SMTP, con una casilla del propio dominio.
 *
 * POR QUÉ NO UN SERVICIO DE ENVÍO
 * Resend —y cualquier otro— exige verificar un dominio propio con registros
 * DNS. El sitio vive hoy en `web-lacasadedios.vercel.app`, que es de Vercel:
 * no se le pueden añadir registros, así que no hay nada que verificar. La
 * casilla que la iglesia ya tiene en su servidor sí puede enviar, y ese
 * servidor está autorizado en el SPF del dominio desde siempre, así que el
 * correo sale autenticado sin tocar un solo registro de DNS.
 *
 * A cambio: es un hosting compartido, con su límite de envíos por hora y sin
 * panel de rebotes. Para una lista de decenas de personas sobra; si algún día
 * son miles, esto se queda corto y toca volver a un servicio de envío.
 *
 * Se lee de `process.env` y no de `import.meta.env` por lo mismo que
 * supabaseAdmin.ts: la contraseña se resuelve en ejecución, dentro de la
 * función, y así Vite no puede incrustarla en ningún bundle del navegador.
 */
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

/** Puerto por defecto: TLS desde el primer byte, sin ventana en claro. */
const PUERTO_TLS = 465;

type Ajustes = {
  host: string;
  port: number;
  secure: boolean;
  requireTLS: boolean;
  auth: { user: string; pass: string };
};

function leerAjustes(): Ajustes | null {
  const host = (process.env.SMTP_HOST ?? '').trim();
  const user = (process.env.SMTP_USER ?? '').trim();
  const pass = process.env.SMTP_PASS ?? '';
  if (!host || !user || !pass) return null;

  const port = Number((process.env.SMTP_PORT ?? '').trim()) || PUERTO_TLS;
  return {
    host,
    port,
    // 465 habla TLS desde el saludo. 587 empieza en claro y sube con STARTTLS,
    // y ahí `requireTLS` aborta si el servidor no lo ofrece, en vez de mandar
    // la contraseña y el correo a la vista.
    secure: port === PUERTO_TLS,
    requireTLS: port !== PUERTO_TLS,
    auth: { user, pass },
  };
}

export function smtpConfigurado(): boolean {
  return leerAjustes() !== null;
}

/**
 * La casilla con la que se autentica. Es el remitente por defecto: muchos
 * servidores rechazan un `From` que no coincide con la cuenta autenticada.
 */
export function casillaSmtp(): string {
  return (process.env.SMTP_USER ?? '').trim();
}

/**
 * Un envío suelto —alta al boletín, formulario de contacto—. Sin pool a
 * propósito: la función se congela entre peticiones, así que una conexión
 * guardada llegaría muerta a la siguiente y costaría más de lo que ahorra.
 */
export function crearTransporte(): Transporter | null {
  const ajustes = leerAjustes();
  return ajustes ? nodemailer.createTransport(ajustes) : null;
}

/**
 * Envío del boletín a toda la lista. Aquí sí compensa el pool: son decenas de
 * mensajes seguidos y abrir un TLS nuevo para cada uno multiplicaría el tiempo.
 *
 * Los números van bajos a propósito. Enfrente hay un Exim de hosting
 * compartido, no un servicio de envío: pasarse hace que corte la conexión o
 * que limite la cuenta, y el precio de ir despacio son unos segundos.
 *
 * Quien lo crea DEBE cerrarlo al terminar, o el pool deja conexiones abiertas.
 */
export function crearTransporteLote(): Transporter | null {
  const ajustes = leerAjustes();
  if (!ajustes) return null;
  return nodemailer.createTransport({
    ...ajustes,
    pool: true,
    maxConnections: 3,
    maxMessages: 50,
    rateDelta: 1000,
    rateLimit: 5,
  });
}
