/**
 * Página de construcción de lacasadedios.cl
 *
 * Sirve el mismo HTML para CUALQUIER ruta, con estado 200.
 *
 * POR QUÉ 200 Y NO 503 (cambiado el 10 de septiembre de 2026)
 * Empezó en 503, que es lo correcto para una caída pasajera: le dice a Google
 * «vuelve más tarde» y conserva lo que ya tenía del dominio. Pero casi todos
 * los previsualizadores de enlaces —WhatsApp, Instagram, Facebook— descartan
 * las respuestas que no son 200, así que el enlace se compartía pelado, sin la
 * tarjeta con el logo. Para una iglesia que va a difundir la dirección, eso
 * pesa más que el riesgo de que Google indexe el cartel unas semanas.
 *
 * Al lanzar, esta página desaparece entera y el sitio real ocupa las mismas
 * direcciones, así que lo indexado se reemplaza solo.
 *
 * POR QUÉ SIRVE TODAS LAS RUTAS
 * El WordPress anterior tiene direcciones indexadas. Si respondiéramos 404 en
 * ellas, quien llegue desde Google vería un error en vez del aviso. Todas
 * caen en la misma página.
 */

import html from './index.html';
import logo from './logo.svg';
import filigrana from './filigrana.svg';
import favicon from './favicon.png';
import ogImage from './og-image.png';

/** Los cuatro archivos que la página pide. Todo lo demás es la página misma. */
const RECURSOS = new Map([
  ['/logo.svg', [logo, 'image/svg+xml; charset=utf-8']],
  ['/filigrana.svg', [filigrana, 'image/svg+xml; charset=utf-8']],
  ['/favicon.png', [favicon, 'image/png']],
  ['/favicon.ico', [favicon, 'image/png']],
  ['/og-image.png', [ogImage, 'image/png']],
]);

/**
 * Cabeceras comunes.
 *
 * NO se emite `Strict-Transport-Security` a propósito. HSTS es una promesa de
 * dos años que el navegador recuerda aunque el sitio cambie; activarla desde
 * una página temporal es tomar por el equipo una decisión que corresponde al
 * sitio definitivo, y `includeSubDomains` rompería cualquier subdominio que
 * todavía no esté en HTTPS. Cloudflare ya fuerza HTTPS por su cuenta.
 */
const COMUNES = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
};

export default {
  fetch(request) {
    const { pathname } = new URL(request.url);

    const recurso = RECURSOS.get(pathname);
    if (recurso) {
      const [cuerpo, tipo] = recurso;
      return new Response(cuerpo, {
        headers: {
          ...COMUNES,
          'content-type': tipo,
          'cache-control': 'public, max-age=3600',
        },
      });
    }

    return new Response(html, {
      status: 200,
      headers: {
        ...COMUNES,
        'content-type': 'text/html; charset=utf-8',
        // Sin caché: el día del lanzamiento nadie debe quedarse con el cartel
        // guardado en el navegador.
        'cache-control': 'no-store',
        'x-frame-options': 'DENY',
      },
    });
  },
};
