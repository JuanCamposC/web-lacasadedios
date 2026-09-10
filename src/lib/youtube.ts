/**
 * Extrae el ID de un video de YouTube desde varias formas de URL.
 *
 * `/live/` NO ES OPCIONAL. Es la dirección que entrega el botón «Compartir» de
 * una transmisión en directo, y era la única forma que faltaba: sin ella
 * `/en-vivo` no encontraba ID y caía en el aviso de reserva —título y botón a
 * YouTube— en lugar de incrustar el reproductor.
 *
 * Ojo con `youtube.com/@canal/live`, que es otra cosa: esa dirección no lleva
 * ningún ID dentro, apunta a «lo que esté en directo ahora». Aquí no se puede
 * resolver, y devuelve null a propósito.
 */
export function youtubeId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /youtu\.be\/([\w-]{11})/,
    /youtube\.com\/watch\?v=([\w-]{11})/,
    /youtube\.com\/live\/([\w-]{11})/,
    // `-nocookie` porque es el dominio desde el que el sitio sirve sus propios
    // iframes: una dirección copiada de ahí y pegada en el panel debe valer.
    /youtube(?:-nocookie)?\.com\/embed\/([\w-]{11})/,
    /youtube\.com\/shorts\/([\w-]{11})/,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return null;
}
