import { createHash } from 'node:crypto';

/**
 * Hash SHA-256 en el formato que espera la CSP.
 *
 * POR QUÉ HACE FALTA
 * Astro calcula solo el hash de los scripts que él procesa. Los marcados
 * `is:inline` los deja intactos —es el sentido de la directiva— y por eso
 * quedan fuera de la política: el navegador los rechaza con
 * `script-src-elem`. Son dos: el que aplica el tema antes de pintar, que tiene
 * que ejecutarse sí o sí antes del primer fotograma, y los datos estructurados
 * de la organización.
 *
 * La alternativa era escribir los hashes a mano en astro.config.mjs. No sirve:
 * el de los datos estructurados cambia en cada página (lleva la descripción
 * dentro) y el del tema se desincronizaría en silencio la primera vez que
 * alguien tocara una línea del script. Calculándolo aquí sobre la MISMA cadena
 * que se renderiza, no pueden separarse nunca.
 */
export function hashCsp(contenido: string): `sha256-${string}` {
  return `sha256-${createHash('sha256').update(contenido, 'utf8').digest('base64')}`;
}
