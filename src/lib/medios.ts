/**
 * De una clave de R2 a una dirección pública.
 *
 * En la base no se guardan URL sino CLAVES («noticias/2026/09/reunion.webp»). La
 * diferencia importa: si mañana cambia el dominio desde el que se sirven los
 * archivos, se cambia una variable y no cuatro mil filas.
 *
 * ── MIENTRAS NO HAYA DOMINIO ────────────────────────────────────────────────
 * El bucket todavía no tiene dominio propio —está anotado como pendiente en
 * MIGRACION.md—. Hasta que lo tenga, esto devuelve `null` en vez de inventar
 * una dirección que daría 404. Las plantillas ya saben qué hacer con `null`:
 * lo mismo que hacían con una noticia sin foto, que es enseñar la imagen de
 * respaldo. Así el sitio se ve bien hoy y se ve mejor cuando el dominio exista,
 * sin tocar una línea.
 */

/** Dominio público del bucket, sin protocolo. Ej.: `medios.lacasadedios.cl`. */
function dominio(): string | null {
  const valor = (process.env.MEDIOS_DOMINIO ?? '').trim();
  return valor ? valor.replace(/^https?:\/\//, '').replace(/\/+$/, '') : null;
}

/**
 * Dirección pública de un archivo, o `null` si no se puede construir.
 *
 * Devuelve `null` —y no una cadena vacía— a propósito: una cadena vacía en un
 * `src` hace que el navegador vuelva a pedir la página actual como si fuera una
 * imagen, que es un viaje inútil y un error raro en el registro.
 */
export function urlMedio(clave: string | null | undefined): string | null {
  if (!clave) return null;
  const base = dominio();
  if (!base) return null;
  // Cada tramo va codificado por separado para no romper las barras de la ruta.
  const ruta = clave.replace(/^\/+/, '').split('/').map(encodeURIComponent).join('/');
  return `https://${base}/${ruta}`;
}

/**
 * Duración en un formato legible: «1 h 2 min», «47 min», «—».
 *
 * Los estudios duran alrededor de una hora, así que las horas se muestran
 * aparte en vez de anunciar «62 min», que obliga a dividir mentalmente.
 */
export function duracionLegible(segundos: number | null | undefined): string {
  if (!segundos || segundos <= 0) return '—';
  const totalMin = Math.round(segundos / 60);
  const horas = Math.floor(totalMin / 60);
  const min = totalMin % 60;
  if (horas === 0) return `${min} min`;
  if (min === 0) return `${horas} h`;
  return `${horas} h ${min} min`;
}

/** Peso legible, para que el equipo vea cuánto ocupa la biblioteca. */
export function pesoLegible(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return '—';
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return `${Math.round(bytes / 1024)} kB`;
  if (mb < 1024) return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}
