/**
 * Datos estructurados listos para meter en un `<script type="application/ld+json">`.
 *
 * ── POR QUÉ NO BASTA `JSON.stringify` ───────────────────────────────────────
 * Porque no escapa `<`. Un título con `</script>` dentro —y los títulos los
 * escribe quien publica desde el panel— cierra el bloque antes de tiempo, y lo
 * que venga después deja de ser datos y pasa a ser HTML de la página.
 *
 * La política de seguridad del sitio impide ejecutar el JavaScript que se cuele
 * ahí, así que el techo era desfigurar la página y no robar nada; aun así es
 * una inyección, y se cierra donde se produce.
 *
 * Se escapan también `>` y `&` para que el resultado no dependa de dónde se
 * incruste, y los dos separadores de línea que rompen el análisis en motores
 * viejos.
 */
const ESCAPES: Record<string, string> = {
  '<': '\\u003c',
  '>': '\\u003e',
  '&': '\\u0026',
  '\u2028': '\\u2028',
  '\u2029': '\\u2029',
};

export function jsonLd(datos: unknown): string {
  return JSON.stringify(datos).replace(/[<>&\u2028\u2029]/g, (c) => ESCAPES[c]);
}
