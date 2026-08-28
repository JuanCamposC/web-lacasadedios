import { SITE } from '../data/site';

/**
 * Resuelve y valida el remitente de los correos (`CONTACT_FROM`).
 *
 * POR QUÉ EXISTE: Resend exige el formato `correo@dominio.cl` o
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

export function resolverRemitente(): Remitente {
  const crudo = (process.env.CONTACT_FROM ?? '').trim();

  if (!crudo) {
    // Sin configurar: remitente de pruebas de Resend. Sirve para desarrollo,
    // no para producción (ver README).
    return { ok: true, from: `${SITE.name} <onboarding@resend.dev>`, porDefecto: true };
  }

  // Comillas envolventes: error de copiar y pegar, no intención del usuario.
  const limpio = crudo.replace(/^\s*(['"])([\s\S]*)\1\s*$/, '$2').trim();

  if (SOLO_CORREO.test(limpio) || CON_NOMBRE.test(limpio)) {
    return { ok: true, from: limpio, porDefecto: false };
  }
  return { ok: false, valor: crudo };
}
