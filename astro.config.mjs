// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import cloudflare from '@astrojs/cloudflare';
import icon from 'astro-icon';
import tailwindcss from '@tailwindcss/vite';

// URL del sitio. Se lee AL COMPILAR, no al servir: Astro la incrusta en las
// canónicas y en el sitemap, y ambos quedan fijos dentro del HTML generado.
//
// Por eso compilar para pruebas y compilar para producción NO son lo mismo.
// Ponerla como `var` del Worker no basta —eso solo la deja en `process.env`
// cuando ya se está sirviendo— y hay que darla también acá:
//     SITE_URL=https://pruebas.lacasadedios.cl npm run build
//
// El respaldo es el dominio de verdad: si alguien compila sin la variable, lo
// peor que pasa es que las canónicas apunten a producción. El respaldo de antes
// era la dirección de Vercel, que ya no sirve nada.
const site = process.env.SITE_URL || 'https://lacasadedios.cl';

// Dominio público del bucket de R2, para la CSP. Tiene que coincidir con
// MEDIOS_DOMINIO (ver src/lib/medios.ts): aquella dice de dónde se sacan las
// imágenes, y esta decide si el navegador las deja cargar.
const medios = process.env.MEDIOS_DOMINIO || 'medios.lacasadedios.cl';

// Servidores desde los que RSS.com entrega los audios y la portada del estudio
// bíblico (ver src/lib/rss.ts). Va aparte de la dirección del feed —que es una
// variable del Worker y se lee al servir— porque la CSP se calcula AL COMPILAR
// y queda escrita dentro de cada página.
//
// `media.rss.com` es el que usa RSS.com hoy: responde, y los otros nombres
// candidatos (`feeds.rss.com`, `anchor.rss.com`) ni siquiera existen. Aun así
// acepta una lista separada por comas, porque el día que cambien de servidor el
// síntoma es feo y mudo: la lista de estudios se ve entera, con sus títulos y
// sus fechas, y ningún reproductor suena. El error solo sale en la consola del
// navegador. Con la lista, eso se arregla con una variable y no con un parche.
//
//     RSS_MEDIA_HOST="media.rss.com,cdn.rss.com" npm run build
const audios = (process.env.RSS_MEDIA_HOST || 'media.rss.com')
  .split(',')
  .map((h) =>
    h
      .trim()
      .replace(/^https?:\/\//, '')
      .replace(/\/+$/, ''),
  )
  .filter(Boolean);

/** `https://a https://b`, listo para pegar dentro de una directiva. */
const fuentesAudio = audios.map((h) => `https://${h}`).join(' ');

// https://astro.build/config
export default defineConfig({
  site,
  // Estático por defecto; las páginas dinámicas (admin, eventos, noticias,
  // videos) se sirven bajo demanda con `export const prerender = false`.
  output: 'static',
  // Política de seguridad de contenido. Astro calcula el hash de cada script y
  // cada bloque <style> propios y los emite en un <meta> por página, así que
  // 'script-src' queda sin 'unsafe-inline': un script inyectado no se ejecuta
  // aunque llegue a colarse en el HTML. Es la defensa que de verdad importa.
  //
  // Dos detalles que costaron descubrir:
  //   · Los atributos style= sueltos (los `--i:N` del hero) NO los cubren los
  //     hashes de 'style-src', y añadir 'unsafe-inline' ahí no sirve: cuando
  //     hay hashes, el navegador ignora 'unsafe-inline'. Van por su propia
  //     directiva, style-src-attr, que aquí se pide con `kind: 'attribute'`.
  //   · 'frame-ancestors' no va aquí: los navegadores lo ignoran dentro de un
  //     <meta>. Se cubre con X-Frame-Options, que sí es cabecera de verdad (ver
  //     public/_headers y src/lib/cabeceras.ts).
  security: {
    csp: {
      directives: [
        "default-src 'self'",
        "base-uri 'self'",
        "form-action 'self'",
        "object-src 'none'",
        "font-src 'self'",
        // Miniaturas de YouTube y lo que se sube al bucket de R2.
        //
        // SIN el dominio de medios acá, TODA imagen subida desde el panel sale
        // rota, y de la peor manera: la página no dice nada y el bloqueo solo
        // aparece en la consola del navegador.
        `img-src 'self' data: blob: https://i.ytimg.com https://${medios} ${fuentesAudio}`,
        // De dónde puede sonar el audio: R2 (lo que se sube desde el panel) y
        // RSS.com (los estudios bíblicos). Sin esta directiva caerían en
        // `default-src 'self'` y no sonaría ninguno.
        `media-src 'self' https://${medios} ${fuentesAudio}`,
        // El navegador habla con este mismo sitio —el panel con /api/admin, las
        // páginas públicas con /api/estado— y con el contador de visitas de
        // Cloudflare, que manda su medición a cloudflareinsights.com.
        "connect-src 'self' https://cloudflareinsights.com",
        // Los dos únicos embebidos: el reproductor de YouTube sin cookies y el
        // mapa de cada templo. Cualquier otro iframe queda bloqueado.
        'frame-src https://www.youtube-nocookie.com https://www.google.com',
        'upgrade-insecure-requests',
      ],
      // Cloudflare inyecta solo el script del contador de visitas (Web
      // Analytics) en cada página que sirve. No lo pone Astro, así que no lleva
      // hash, y la política lo rechazaba: la consola mostraba el bloqueo en
      // cada visita y la medición no llegaba nunca.
      //
      // Va en las dos directivas a propósito: los hashes de este sitio viven en
      // `script-src-elem` (ver `insertScriptHash` en Layout.astro), y cuando esa
      // directiva existe el navegador deja de mirar `script-src` para los
      // <script> del documento.
      //
      // Si algún día se prefiere no cargar nada de terceros, la otra salida es
      // apagar Web Analytics en el panel de Cloudflare y borrar estas líneas.
      scriptDirective: {
        resources: [
          { resource: "'self'", kind: 'default' },
          { resource: "'self'", kind: 'element' },
          { resource: 'https://static.cloudflareinsights.com', kind: 'default' },
          { resource: 'https://static.cloudflareinsights.com', kind: 'element' },
        ],
      },
      styleDirective: {
        resources: [
          { resource: "'self'", kind: 'default' },
          { resource: "'unsafe-inline'", kind: 'attribute' },
        ],
      },
    },
  },
  // Cloudflare Workers. Dos opciones que no son el valor por defecto:
  //
  // · `imageService: { build: 'compile' }` optimiza las imágenes DURANTE la
  //   compilación, con sharp, igual que hacía Vercel. En Workers no hay sharp,
  //   así que la alternativa sería servirlas sin tocar o pagar el servicio de
  //   imágenes de Cloudflare. Como todas las fotos son fijas y viven en el
  //   repositorio, compilarlas una vez es gratis y más rápido para el visitante.
  //   `runtime: 'passthrough'` dice que en producción no se transforma nada.
  //
  // · `prerenderEnvironment: 'node'` — por defecto el adaptador prerenderiza en
  //   workerd, el mismo runtime de producción. Acá no sirve: la compilación usa
  //   `createHash` de `node:crypto` (src/lib/csp.ts) y sharp, que son de Node.
  //   Solo afecta a la compilación; lo que corre en producción sigue siendo
  //   workerd.
  adapter: cloudflare({
    imageService: { build: 'compile', runtime: 'passthrough' },
    prerenderEnvironment: 'node',
  }),
  integrations: [
    sitemap({
      // Qué NO se le ofrece a Google:
      //   · /admin — el panel entero. Estaba saliendo en el sitemap, que es
      //     publicar la dirección de la puerta de servicio. Access la protege,
      //     pero eso no es razón para anunciarla.
      //   · /baja — solo se alcanza con el enlace personal de cada correo.
      filter: (page) => !page.includes('/admin') && !page.includes('/baja'),

      // Sin barra final, igual que las canónicas de Layout.astro. Astro las
      // genera con barra porque compila en carpetas; Cloudflare sirve sin ella
      // y redirige. Un sitemap lleno de direcciones que redirigen le hace
      // gastar a Google la mitad de las visitas en 301.
      serialize: (item) => ({ ...item, url: item.url.replace(/(.)\/+$/, '$1') }),
    }),
    icon(),
  ],
  vite: {
    plugins: [tailwindcss()],
    build: {
      // Astro incrusta en el HTML los scripts de menos de 4 kB. Suena a mejora
      // y rompía la navegación: ClientRouter, cuando detecta un
      // <script type="module"> en línea, inyecta en cada navegación un
      // <script src="data:application/javascript,"> vacío (ver runScripts en
      // astro/dist/transitions/router.js) y la CSP con hashes lo bloquea. No
      // se puede arreglar permitiendo el esquema data: en script-src: eso es una vía de
      // XSS conocida y anularía justo lo que protegen los hashes.
      //
      // Devolver false solo para JavaScript deja los scripts en archivos
      // aparte —que Astro sí sabe hashear— y undefined para el resto
      // conserva el umbral de siempre en las imágenes pequeñas.
      assetsInlineLimit: (ruta) => (ruta.endsWith('.js') ? false : undefined),
    },
    optimizeDeps: {
      // Estas dependencias solo se importan desde /admin, así que Vite no las
      // descubría al arrancar: las encontraba al entrar por primera vez al
      // panel, reoptimizaba a mitad de sesión e invalidaba los módulos ya
      // servidos. El navegador respondía con «504 (Outdated Optimize Dep)».
      // Declarándolas aquí se empaquetan al inicio y no hay reoptimización.
      // Solo afecta al servidor de desarrollo; la compilación nunca tuvo esto.
      include: [
        '@formkit/auto-animate',
        'sortablejs',
        // Los módulos de <ClientRouter />: también se descubrían tarde.
        'astro/virtual-modules/transitions-router.js',
        'astro/virtual-modules/transitions-events.js',
        'astro/virtual-modules/transitions-swap-functions.js',
        'astro/virtual-modules/transitions-types.js',
      ],
    },
  },
});
