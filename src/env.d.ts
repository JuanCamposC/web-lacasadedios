/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    /**
     * Quién entró por Cloudflare Access, con la firma de su token ya
     * verificada. Ver src/lib/access.ts.
     */
    identidad: import('./lib/access').Identidad | null;

    /**
     * Por qué se dejó entrar al panel. El panel lo enseña en pantalla cuando
     * NO fue por Access: si alguien está trabajando con la puerta abierta,
     * tiene que verlo, no deducirlo.
     */
    motivoAcceso: import('./lib/access').Motivo;

    /**
     * TRANSITORIO — se va cuando el boletín deje de usar Supabase.
     *
     * Las páginas públicas y el panel ya leen de D1. Quedan los dos endpoints
     * de suscripción. Cuando `grep -r "locals.supabase" src/` no devuelva nada,
     * estas dos líneas se borran.
     */
    supabase: import('@supabase/supabase-js').SupabaseClient;
    user: import('@supabase/supabase-js').User | null;
  }
}

/**
 * NO se declara `locals.runtime.env`, y estuvo declarado por error.
 *
 * Astro v6 lo quitó y lo dejó como un accesor que lanza:
 *
 *   «Astro.locals.runtime.env has been removed in Astro v6.
 *    Use 'import { env } from "cloudflare:workers"' instead.»
 *
 * La trampa es que `Object.keys(locals.runtime)` SÍ devuelve `env`, así que
 * mirar las claves hace creer que está. Declararlo aquí era enseñarle a
 * TypeScript una mentira que solo se descubre en producción. Las bindings se
 * toman con `baseDeDatos()` y `almacen()` de src/lib/base.ts.
 */

interface ImportMetaEnv {
  readonly SITE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * `cloudflare:workers` es un módulo del runtime de Cloudflare: existe al
 * ejecutar, no al compilar, así que TypeScript no lo encuentra por su cuenta.
 * Se declara lo mínimo que el sitio usa. Los tipos completos vendrían de
 * `@cloudflare/workers-types`, pero referenciarlos globalmente pisa los del DOM
 * y rompe todo el código de navegador —comprobado—, así que se declara a mano.
 */
declare module 'cloudflare:workers' {
  export const env: Record<string, unknown>;
}
