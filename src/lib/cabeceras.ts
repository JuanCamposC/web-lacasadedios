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

/** Los nombres con los que el sitio sale de verdad al público. */
const PRODUCCION = new Set(['lacasadedios.cl', 'www.lacasadedios.cl']);

/**
 * ¿Este despliegue es el de producción?
 *
 * Se decide por `SITE_URL`, la variable que YA distingue un despliegue del otro,
 * y NO por el nombre con el que entró la petición.
 *
 * POR QUÉ NO POR LA PETICIÓN: es lo que se intentó primero y se descartó al
 * medirlo. Entre el Worker de assets y el de la aplicación hay un salto interno,
 * y el nombre que llega al middleware no siempre es el que escribió el visitante
 * —bajo `wrangler dev` desde luego no lo es—. Colgar de ahí una decisión de
 * indexación significa que el día del lanzamiento podría marcarse `noindex` el
 * sitio de verdad, y eso no se nota hasta que la iglesia desaparece de Google
 * semanas después. `SITE_URL` la fija quien despliega, a propósito, y no la
 * reescribe nadie por el camino.
 *
 * SIN `SITE_URL` SE ASUME PRODUCCIÓN. De los dos errores posibles, sacar el
 * sitio real del buscador es mucho peor que indexar de más uno de pruebas —que
 * además está detrás de Access, donde Google ni entra—.
 */
export function esProduccion(): boolean {
  const crudo = (process.env.SITE_URL ?? '').trim();
  if (!crudo) return true;
  try {
    return PRODUCCION.has(new URL(crudo).hostname);
  } catch {
    // Una SITE_URL que ni siquiera es una dirección es un despliegue mal
    // configurado, no producción.
    return false;
  }
}

/**
 * Añade las cabeceras a una respuesta, sin pisar las que ya vengan puestas:
 * una ruta que fije la suya a propósito manda sobre esto.
 *
 * Fuera de producción se añade además `X-Robots-Tag: noindex`, que es lo que
 * mantiene el sitio de pruebas fuera del buscador. Lo estático lleva esa misma
 * cabecera desde public/_headers, con una regla por nombre de dominio: acá solo
 * se cubre lo que arma el Worker, porque el middleware no llega a correr cuando
 * se sirve una página prerenderizada.
 */
/**
 * Nombres que NO son el sitio público, aunque los sirva el mismo Worker.
 *
 * `pruebas.lacasadedios.cl` se dio de baja el 25 de septiembre de 2026 (ver el
 * comentario de `routes` en wrangler.jsonc): compartía base y bucket con el
 * sitio real, así que no servía para probar. El nombre se deja escrito igual, a
 * propósito: si algún día vuelve a existir un sitio de desarrollo reusará este
 * nombre, y el día que eso pase conviene que nazca ya sin indexar en vez de
 * descubrirlo cuando Google lo tenga.
 */
const FUERA_DE_PRODUCCION = new Set(['pruebas.lacasadedios.cl']);

/**
 * ¿Hay que pedir que esta respuesta no se indexe?
 *
 * Dos motivos, y el orden importa:
 *
 *   1. El despliegue no es el de producción (lo dice `SITE_URL`).
 *   2. La petición entró por un nombre que sabemos que no es el público.
 *
 * El segundo hizo falta el día del lanzamiento: hasta entonces cada dominio
 * tenía su propio Worker y bastaba con `SITE_URL`. Ahora un mismo Worker sirve
 * el sitio y `pruebas`, con la misma variable, y sin esto `pruebas` quedó de
 * golpe indexable.
 *
 * Se SUMA a la comprobación de `SITE_URL` en vez de reemplazarla: el nombre de
 * la petición no siempre es el que escribió el visitante —hay un salto interno
 * entre el Worker de archivos y este—, así que solo se usa para AÑADIR noindex
 * a un nombre conocido, nunca para quitárselo a producción. El error que eso
 * evita es el caro: sacar el sitio real del buscador y no notarlo en semanas.
 */
function pedirNoIndexar(url?: URL): boolean {
  if (!esProduccion()) return true;
  return url ? FUERA_DE_PRODUCCION.has(url.hostname) : false;
}

export function conSeguridad(response: Response, url?: URL): Response {
  for (const [nombre, valor] of Object.entries(SEGURIDAD)) {
    if (!response.headers.has(nombre)) response.headers.set(nombre, valor);
  }

  if (pedirNoIndexar(url) && !response.headers.has('X-Robots-Tag')) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }

  return response;
}
