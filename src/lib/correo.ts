import { SITE, CONTACT } from '../data/site';

/**
 * Resuelve y valida el remitente de los correos (`CONTACT_FROM`).
 *
 * POR QUÉ EXISTE: el servidor exige el formato `correo@dominio.cl` o
 * `Nombre <correo@dominio.cl>`, y rechaza el envío entero si no calza. El
 * error más común es dejar comillas alrededor del valor al pegarlo en el panel
 * de Vercel: quedan DENTRO del valor y lo invalidan, sin ninguna pista.
 *
 * Aquí se limpian los errores recuperables (espacios, comillas de más) y, si
 * aun así no es válido, se devuelve el valor exacto para poder decir qué está
 * mal en vez de un «no se pudo enviar».
 */
const SOLO_CORREO = /^[^<>@\s]+@[^<>@\s]+\.[^<>@\s]+$/;
const CON_NOMBRE = /^[^<>]+<[^<>@\s]+@[^<>@\s]+\.[^<>@\s]+>$/;

export type Remitente =
  { ok: true; from: string; porDefecto: boolean } | { ok: false; valor: string };

/**
 * `BOLETIN_FROM` separa lo que sale a la lista de lo que sale de una persona.
 *
 * POR QUÉ IMPORTA: si alguien marca como no deseado un aviso del boletín, el
 * castigo cae sobre la dirección que lo mandó. Con una sola casilla para todo,
 * eso se lleva por delante también los correos del formulario de contacto, que
 * son los que no pueden fallar. Con dos, el daño queda acotado.
 *
 * Si no está puesta se usa `CONTACT_FROM`, y si tampoco, la casilla del SMTP:
 * el sitio funciona igual, solo que sin la separación.
 */
export function resolverRemitente(
  clave: 'CONTACT_FROM' | 'BOLETIN_FROM' = 'CONTACT_FROM',
): Remitente {
  const crudo = (
    (process.env[clave] ?? '').trim() ||
    (clave === 'BOLETIN_FROM' ? (process.env.CONTACT_FROM ?? '').trim() : '')
  ).trim();

  if (!crudo) {
    // Sin configurar: la casilla de contacto del sitio.
    //
    // Antes se usaba `SMTP_USER`, la cuenta con la que se autenticaba el envío,
    // porque muchos servidores rechazan un `From` que no coincide con quien
    // abrió la sesión. Con Resend ya no hay sesión que coincidir: lo que exige
    // es que el dominio esté verificado, y `contacto@lacasadedios.cl` lo está.
    //
    // Sigue siendo mejor tener `CONTACT_FROM` puesto. Esto es el suelo, para
    // que la falta de una variable no deje al sitio sin poder responder.
    return { ok: true, from: `${SITE.name} <${CONTACT.email}>`, porDefecto: true };
  }

  // Comillas envolventes: error de copiar y pegar, no intención del usuario.
  const limpio = crudo.replace(/^\s*(['"])([\s\S]*)\1\s*$/, '$2').trim();

  if (SOLO_CORREO.test(limpio) || CON_NOMBRE.test(limpio)) {
    return { ok: true, from: limpio, porDefecto: false };
  }
  return { ok: false, valor: crudo };
}

/**
 * Cambia el NOMBRE visible de un remitente, conservando su dirección.
 *
 * PARA QUÉ: el aviso del formulario sale de una casilla de la iglesia y llega a
 * otra de la iglesia. Si además lleva el nombre de la casa, en la bandeja no se
 * distingue un mensaje de otro —Gmail llegaba a mostrar «yo»—. Poniendo delante
 * el nombre de quien escribió, la lista se lee de un vistazo.
 *
 * LA DIRECCIÓN NO SE TOCA. Solo el nombre. Cambiar la dirección rompería la
 * firma DKIM y el correo acabaría en no deseados.
 *
 * ── POR QUÉ SE LIMPIA TANTO ─────────────────────────────────────────────────
 * `nombre` lo escribe un desconocido en un formulario público, y acaba dentro
 * de una cabecera `From`. Sin limpiar, alguien que se llamara
 *
 *     Banco <cobros@estafa.cl>
 *
 * produciría `Banco <cobros@estafa.cl> <formulario@lacasadedios.cl>`, y a quien
 * lo interprete de izquierda a derecha le queda un correo que parece salir del
 * atacante y llega con el sello de la iglesia. Por eso se quitan `< >` y las
 * comillas —que arman una dirección—, la coma y el punto y coma —que separan
 * destinatarios— y los saltos de línea —que abren una cabecera nueva—.
 *
 * Sin nombre utilizable se devuelve el remitente tal cual: un nombre vacío es
 * peor que el de siempre.
 */
export function conNombre(from: string, nombre: string): string {
  const direccion = from.match(/<([^<>]+)>/)?.[1] ?? from.trim();
  const limpio = nombre
    .replace(/[<>"'\r\n,;]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
  return limpio ? `${limpio} <${direccion}>` : from;
}
