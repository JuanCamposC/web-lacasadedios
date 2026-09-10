/**
 * Cabeceras de seguridad para las respuestas que genera el Worker.
 *
 * POR QUÉ EXISTE ESTE ARCHIVO
 * En Vercel, el bloque `headers` de vercel.json se aplicaba a TODO: páginas
 * estáticas, páginas dinámicas y endpoints por igual. En Cloudflare no hay
 * equivalente: `public/_headers` solo cubre lo que sirve el binding de assets,
 * o sea las páginas prerenderizadas y los archivos. Todo lo que arma el Worker
 * —el panel, /noticias, /eventos, /videos, /en-vivo, /contacto, /baja,
 * /confirmar y los endpoints— sale sin ninguna cabecera.
 *
 * Se comprobó sirviendo el sitio: `/` y `/horarios` traían las seis cabeceras;
 * `/noticias` y `/eventos`, ninguna.
 *
 * Así que las mismas cabeceras se ponen dos veces, en dos formatos distintos:
 *   · public/_headers  → para lo estático
 *   · este archivo     → para lo dinámico, aplicado desde el middleware
 *
 * SI CAMBIAS UNA, CAMBIA LA OTRA. No hay forma de compartir el valor: `_headers`
 * es un archivo de texto que lee Cloudflare, no código que se pueda importar.
 *
 * La CSP no está acá: Astro la calcula por página, con los hashes de cada script
 * y cada estilo, y la emite en un <meta> (ver `security.csp` en astro.config).
 */
export const SEGURIDAD: Record<string, string> = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy':
    'accelerometer=(), autoplay=(self "https://www.youtube-nocookie.com"), camera=(), display-capture=(), encrypted-media=(self "https://www.youtube-nocookie.com"), fullscreen=(self "https://www.youtube-nocookie.com" "https://www.google.com"), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), midi=(), payment=(), picture-in-picture=(self "https://www.youtube-nocookie.com"), usb=(), xr-spatial-tracking=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  // Sin `includeSubDomains`, a diferencia de lo que mandaba vercel.json: los
  // subdominios de cPanel siguen en Netexplora y su certificado vence el 4 de
  // noviembre de 2026 sin poder renovarse. El motivo largo está en
  // public/_headers.
  'Strict-Transport-Security': 'max-age=31536000',
};

/**
 * Añade las cabeceras a una respuesta, sin pisar las que ya vengan puestas:
 * una ruta que fije la suya a propósito manda sobre esto.
 */
export function conSeguridad(response: Response): Response {
  for (const [nombre, valor] of Object.entries(SEGURIDAD)) {
    if (!response.headers.has(nombre)) response.headers.set(nombre, valor);
  }
  return response;
}
