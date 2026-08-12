/**
 * Acceso mínimo a Supabase desde el sitio público, sin la librería cliente.
 *
 * POR QUÉ EXISTE ESTE ARCHIVO
 * El sitio público solo hace dos cosas contra la base: leer si hay transmisión
 * en vivo y dar de alta un correo en el boletín. Hacerlo con
 * `@supabase/supabase-js` costaba **215 kB de JavaScript en cada página** —más
 * que las tres tipografías juntas— para una lectura y una escritura.
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

export interface RestEscritura {
  ok: boolean;
  /** 23505 = clave duplicada (por ejemplo, un correo ya suscrito) */
  code?: string;
  status: number;
}

/** INSERT. No devuelve la fila: al sitio público no le hace falta. */
export async function restInsertar(
  tabla: string,
  fila: Record<string, unknown>,
): Promise<RestEscritura> {
  if (!restConfigurado) return { ok: false, status: 0 };

  const res = await fetch(`${URL_BASE}/rest/v1/${tabla}`, {
    method: 'POST',
    headers: cabeceras({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
    body: JSON.stringify(fila),
  });

  if (res.ok) return { ok: true, status: res.status };

  const detalle = await res.json().catch(() => ({}) as Record<string, string>);
  return { ok: false, status: res.status, code: detalle.code };
}
