// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import icon from 'astro-icon';
import tailwindcss from '@tailwindcss/vite';

// URL de producción (sobrescribible con la variable de entorno SITE_URL en Vercel).
const site = process.env.SITE_URL || 'https://web-lacasadedios.vercel.app';

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
  //     <meta>. Se cubre con X-Frame-Options en vercel.json, que sí es cabecera.
  security: {
    csp: {
      directives: [
        "default-src 'self'",
        "base-uri 'self'",
        "form-action 'self'",
        "object-src 'none'",
        "font-src 'self'",
        // Miniaturas de YouTube e imágenes subidas al storage de Supabase.
        "img-src 'self' data: blob: https://i.ytimg.com https://*.supabase.co",
        // El panel habla con Supabase (sesión, CRUD y subidas) desde el navegador.
        "connect-src 'self' https://*.supabase.co",
        // Los dos únicos embebidos: el reproductor de YouTube sin cookies y el
        // mapa de cada templo. Cualquier otro iframe queda bloqueado.
        "frame-src https://www.youtube-nocookie.com https://www.google.com",
        "upgrade-insecure-requests",
      ],
      styleDirective: {
        resources: [
          { resource: "'self'", kind: 'default' },
          { resource: "'unsafe-inline'", kind: 'attribute' },
        ],
      },
    },
  },
  adapter: vercel(),
  integrations: [
    // /baja solo se alcanza con un enlace personal: fuera del sitemap.
    sitemap({ filter: (page) => !page.includes('/baja') }),
    icon(),
  ],
  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      // Estas dependencias solo se importan desde /admin, así que Vite no las
      // descubría al arrancar: las encontraba al entrar por primera vez al
      // panel, reoptimizaba a mitad de sesión e invalidaba los módulos ya
      // servidos. El navegador respondía con «504 (Outdated Optimize Dep)».
      // Declarándolas aquí se empaquetan al inicio y no hay reoptimización.
      // Solo afecta al servidor de desarrollo; la compilación nunca tuvo esto.
      include: [
        '@supabase/ssr',
        '@supabase/supabase-js',
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
