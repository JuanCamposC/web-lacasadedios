/**
 * Cliente de Supabase con la clave de servicio. SOLO para endpoints SSR.
 *
 * POR QUÉ HACE FALTA
 * El alta al boletín se hacía con la clave anónima y una política
 * `for insert with check (true)`: cualquiera podía escribir en `subscribers`
 * sin límite y suscribir a terceros. La política se eliminó (ver la migración
 * «ALTA DEL BOLETÍN CON DOBLE OPT-IN» en supabase/schema.sql), así que ahora la
 * única vía de escritura es este cliente, que salta RLS y vive únicamente en el
 * servidor.
 *
 * NUNCA importar este archivo desde un componente con `<script>` de cliente ni
 * desde una página prerenderizada: la clave acabaría en el bundle. Solo desde
 * `src/pages/api/*.ts` con `prerender = false`.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Se lee de `process.env` y no de `import.meta.env` a propósito: así el valor
 * se resuelve en ejecución dentro de la función serverless y Vite no puede
 * incrustarlo en ningún bundle.
 */
function leerEntorno() {
  const url = process.env.PUBLIC_SUPABASE_URL ?? import.meta.env.PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return { url, service };
}

export function servicioConfigurado(): boolean {
  const { url, service } = leerEntorno();
  return Boolean(url && service);
}

/**
 * Devuelve el cliente, o `null` si falta la clave. Se prefiere `null` a lanzar
 * para que el endpoint pueda responder con un motivo concreto en vez de un 500
 * mudo, igual que hace `resolverRemitente` con CONTACT_FROM.
 */
export function crearSupabaseServicio(): SupabaseClient | null {
  const { url, service } = leerEntorno();
  if (!url || !service) return null;

  return createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
