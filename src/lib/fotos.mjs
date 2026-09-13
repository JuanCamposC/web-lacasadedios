/**
 * Las fotos del sitio en tamaños ya preparados, para las páginas que se arman
 * al servir.
 *
 * ── EL PROBLEMA ─────────────────────────────────────────────────────────────
 * `<Image />` de Astro optimiza las fotos AL COMPILAR, pero solo en las páginas
 * prerenderizadas. En una página que se arma al servir apunta a `/_image?…`, y
 * en Cloudflare Workers no hay nada que transforme ahí (ver
 * `imageService.runtime: 'passthrough'` en astro.config.mjs): se sirve el JPEG
 * original. Medido: 12 kB en WebP contra 211 kB en JPEG, la misma foto.
 *
 * Eso ya les pasaba sin que nadie lo notara a /eventos, /noticias, /videos,
 * /contacto y /estudio-biblico, todas con portada fotográfica. Y bloqueaba lo
 * que se pidió: horarios que se editan desde el panel obligan a que /horarios y
 * las fichas de templo se armen al servir.
 *
 * ── LA SOLUCIÓN ─────────────────────────────────────────────────────────────
 * `scripts/fotos.mjs` genera, ANTES de compilar, cada foto de src/assets/img en
 * WebP a varios anchos, dentro de public/fotos/. `<Foto />` (src/components)
 * escribe el `srcset` apuntando a esos archivos. Son estáticos: da igual si la
 * página se prerenderiza o se arma al servir.
 *
 * Este archivo es `.mjs` y no `.ts` a propósito: lo importan el script, que
 * corre en Node sin compilar, y el componente, que pasa por Vite. Una sola lista
 * de anchos para los dos: si divergieran, el `srcset` pediría archivos que no
 * existen y el síntoma sería una foto rota solo en ciertos teléfonos.
 */

/** Anchos que se generan. Nunca por encima del ancho real de la foto. */
export const ANCHOS = [480, 768, 1280, 1600];

/**
 * Los anchos disponibles para una foto de `ancho` píxeles.
 *
 * Los menores que el original, más el original mismo si no está en la lista:
 * agrandar una foto no la mejora, solo la hace pesar más.
 *
 * @param {number} ancho
 * @returns {number[]}
 */
export function anchosDe(ancho) {
  const menores = ANCHOS.filter((a) => a < ancho);
  const tope = Math.min(ancho, ANCHOS[ANCHOS.length - 1]);
  return menores.includes(tope) ? menores : [...menores, tope];
}

/**
 * El nombre base de una foto a partir de su ruta.
 *
 * Sirve para las dos formas que tiene la ruta: la de compilación
 * (`/_astro/biblia.CdXy12.jpg`) y la de desarrollo
 * (`/@fs/C:/…/biblia.jpg?origWidth=…`). En ambas, lo que va antes del primer
 * punto del nombre de archivo es «biblia».
 *
 * @param {string} ruta
 * @returns {string}
 */
export function nombreDe(ruta) {
  const archivo = ruta.split('?')[0].split('/').pop() ?? '';
  return archivo.split('.')[0];
}

/**
 * Dirección pública de una variante.
 *
 * @param {string} nombre
 * @param {number} ancho
 * @returns {string}
 */
export const rutaFoto = (nombre, ancho) => `/fotos/${nombre}-${ancho}.webp`;
