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
  adapter: vercel(),
  integrations: [sitemap(), icon()],
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
