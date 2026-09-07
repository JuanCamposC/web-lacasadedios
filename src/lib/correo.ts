import { SITE } from '../data/site';

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
    // Sin configurar: la propia casilla con la que se autentica el SMTP. No es
    // solo una comodidad — muchos servidores rechazan, o marcan como suplantación,
    // un `From` que no coincide con la cuenta que abrió la sesión.
    const casilla = (process.env.SMTP_USER ?? '').trim();
    if (!casilla) return { ok: false, valor: '' };
    return { ok: true, from: `${SITE.name} <${casilla}>`, porDefecto: true };
  }

  // Comillas envolventes: error de copiar y pegar, no intención del usuario.
  const limpio = crudo.replace(/^\s*(['"])([\s\S]*)\1\s*$/, '$2').trim();

  if (SOLO_CORREO.test(limpio) || CON_NOMBRE.test(limpio)) {
    return { ok: true, from: limpio, porDefecto: false };
  }
  return { ok: false, valor: crudo };
}
