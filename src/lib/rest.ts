/**
 * Acceso mínimo a Supabase desde el sitio público, sin la librería cliente.
 *
 * POR QUÉ EXISTE ESTE ARCHIVO
 * El sitio público solo hace dos cosas contra la base: leer si hay transmisión
 * en vivo y confirmar o cancelar una suscripción con el token del correo.
 * Hacerlo con `@supabase/supabase-js` costaba **215 kB de JavaScript en cada
 * página** —más que las tres tipografías juntas— para una lectura y una
 * llamada a función.
 *
 * Aquí NO hay escritura directa. El alta al boletín pasa por /api/suscribir
 * con la clave de servicio: la tabla `subscribers` ya no acepta inserciones
 * con la clave anónima.
 *
 * Supabase expone PostgREST directamente, así que las mismas dos operaciones
 * son dos `fetch`. Misma clave pública, mismas políticas RLS, cero dependencias.
 *
 * El cliente completo se sigue usando en `/admin`, donde sí hace falta: sesión,
 * refresco de token y subida de archivos.
 */
const URL_BASE = import.meta.env.PUBLIC_SUPABASE_URL;
const CLAVE = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

export const restConfigurado = Boolean(URL_BASE && CLAVE);

function cabeceras(extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: CLAVE,
    Authorization: `Bearer ${CLAVE}`,
    ...extra,
  };
}

/** SELECT. `consulta` va en la sintaxis de PostgREST: `settings?id=eq.1&select=...` */
export async function restLeer<T>(consulta: string): Promise<T[]> {
  if (!restConfigurado) return [];
  const res = await fetch(`${URL_BASE}/rest/v1/${consulta}`, { headers: cabeceras() });
  if (!res.ok) return [];
  return (await res.json()) as T[];
}

/**
 * Llama a una función de Postgres expuesta por PostgREST.
 * Se usa para la baja del boletín: la función `baja_suscriptor` corre con
 * `security definer` y solo borra la fila cuyo token coincide, así que puede
 * invocarse sin sesión sin abrir la tabla a nadie.
 */
export async function restRpc<T>(fn: string, args: Record<string, unknown>): Promise<T | null> {
  if (!restConfigurado) return null;
  const res = await fetch(`${URL_BASE}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: cabeceras({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(args),
  });
  if (!res.ok) return null;
  return (await res.json()) as T;
}
