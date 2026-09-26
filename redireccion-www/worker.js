/**
 * Un Worker cuyo único trabajo es mandar `www` al dominio sin `www`.
 *
 * ── POR QUÉ HACE FALTA UN WORKER APARTE ─────────────────────────────────────
 * El sitio ya redirigía `www` desde su middleware (src/middleware.ts), y
 * funcionaba en casi todo… menos en las páginas compiladas. En Cloudflare, una
 * petición que coincide con un archivo del almacén de assets se sirve SIN
 * invocar al Worker: es lo que hace que la portada sea rápida y gratis. El
 * efecto secundario es que `www.lacasadedios.cl/` devolvía la portada con un
 * 200, igual que `/sobre-nosotros` y la página de error, porque esas tres son
 * las únicas compiladas.
 *
 * Tres caminos se intentaron antes y ninguno sirve (están anotados en
 * src/middleware.ts): `public/_redirects` rechaza dominios en el origen,
 * `run_worker_first` no llega porque el adaptador mira si hay archivo compilado
 * antes de montar el middleware, y volver dinámica la portada cuesta más de un
 * mega por visita en fotos sin optimizar.
 *
 * La salida es quitarle `www` al Worker del sitio y dárselo a este, que no tiene
 * almacén de assets. Sin assets no hay nada que pueda saltárselo: cada petición
 * a `www`, sea la portada o cualquier otra, entra acá y sale redirigida.
 *
 * ── LO QUE CUESTA ───────────────────────────────────────────────────────────
 * Nada en el dominio bueno: el sitio sigue sirviendo sus páginas compiladas sin
 * invocar Worker ninguno. Acá solo caen las visitas que llegan con `www`, y cada
 * una es una respuesta de tres líneas sin leer base ni archivos.
 */

/** Dónde vive el sitio de verdad. Todo lo demás es un alias que lleva acá. */
const SITIO = 'lacasadedios.cl';

export default {
  fetch(request) {
    const url = new URL(request.url);

    // Se cambia SOLO el nombre del servidor: la ruta y la consulta siguen
    // intactas. Quien llegue a www.lacasadedios.cl/templos/coya tiene que acabar
    // en esa misma página y no en la portada, y quien tenga guardado
    // pruebas.lacasadedios.cl/admin tiene que acabar en el panel de verdad.
    //
    // Se asigna el sitio entero en vez de recortarle el prefijo al nombre que
    // vino: así vale para cualquier alias que se agregue a las rutas, sin tener
    // que acordarse de volver acá.
    url.hostname = SITIO;

    // 301 y no 302: el traslado es definitivo, y así los buscadores mueven a la
    // dirección buena lo que tuvieran indexado con un alias. El navegador también
    // se lo queda, que es lo que hace que un marcador viejo deje de doler a la
    // segunda vez.
    //
    // Se responde con `Response.redirect` y no con una plantilla para que no
    // haya cuerpo que servir: un 301 no se lee, se sigue.
    return Response.redirect(url.toString(), 301);
  },
};
