// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';

// URL de producción (sobrescribible con la variable de entorno SITE_URL en Vercel).
const site = process.env.SITE_URL || 'https://web-lacasadedios.vercel.app';

// https://astro.build/config
export default defineConfig({
  site,
  // Estático por defecto; las páginas dinámicas (admin, eventos, noticias,
  // videos) se sirven bajo demanda con `export const prerender = false`.
  output: 'static',
  adapter: vercel(),
  integrations: [tailwind(), sitemap()],
});
