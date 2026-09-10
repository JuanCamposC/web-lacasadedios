/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    /**
     * Las bindings de Cloudflare, tal como llegan en ejecución.
     *
     * El tipo `Runtime` que exporta @astrojs/cloudflare 14 solo declara
     * `cfContext`, pero en ejecución `locals.runtime` trae además `env`, `cf`,
     * `caches` y `ctx` —comprobado sirviendo el sitio—. Se declara acá lo que
     * de verdad hay, para no andar poniendo `as` por las páginas.
     */
    runtime: {
      env: {
        DB: import('@cloudflare/workers-types').D1Database;
        MEDIOS?: import('@cloudflare/workers-types').R2Bucket;
        ACCESS_TEAM_DOMAIN?: string;
        ACCESS_AUD?: string;
        SITE_URL?: string;
      };
      cf?: unknown;
      caches?: unknown;
      ctx?: unknown;
    };
    /** Quién entró por Cloudflare Access, ya verificado. Ver src/lib/access.ts. */
    identidad: import('./lib/access').Identidad | null;

    /**
     * TRANSITORIO — se va cuando el panel deje de usar Supabase.
     *
     * Las páginas públicas ya leen de D1. El panel todavía no, y quitar esto
     * antes de tiempo rompería la compilación de golpe en vez de dejar migrar
     * pantalla por pantalla. Cuando `grep -r "locals.supabase" src/` no
     * devuelva nada, estas dos líneas se borran.
     */
    supabase: import('@supabase/supabase-js').SupabaseClient;
    user: import('@supabase/supabase-js').User | null;
  }
}

interface ImportMetaEnv {
  readonly SITE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
