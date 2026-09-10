import type { Recurso } from '../../lib/panel';

/**
 * El panel hablando con su propio servidor.
 *
 * ── POR QUÉ EXISTE ──────────────────────────────────────────────────────────
 * Antes el navegador escribía DIRECTO en Supabase, y era Postgres quien decidía
 * qué podía tocar cada quien con sus políticas RLS. Con D1 eso no se puede: no
 * hay API pública a la que un navegador pueda hablarle.
 *
 * Lejos de ser un estorbo, es lo que hace verdadera la regla que reemplazó a
 * RLS: **toda escritura pasa por el Worker**, y el Worker solo acepta columnas
 * de una lista blanca (src/lib/panel.ts) y solo a quien traiga un token de
 * Access verificado (src/lib/access.ts). Antes había dos caminos hasta los
 * datos; ahora hay uno.
 */

async function pedir<T>(url: string, opciones: RequestInit = {}): Promise<T> {
  const respuesta = await fetch(url, {
    ...opciones,
    headers: { 'content-type': 'application/json', ...(opciones.headers ?? {}) },
  });

  // El cuerpo se lee una sola vez, pase lo que pase: si el servidor devolvió un
  // error con explicación, es la explicación lo que hay que enseñar, y no un
  // «error 400» que no le dice nada a nadie.
  const texto = await respuesta.text();
  let datos: unknown = null;
  try {
    datos = texto ? JSON.parse(texto) : null;
  } catch {
    /* no era JSON: se usa el texto tal cual más abajo */
  }

  if (!respuesta.ok) {
    const mensaje =
      (datos as { error?: string } | null)?.error ??
      texto.slice(0, 200) ??
      `error ${respuesta.status}`;
    throw new Error(mensaje);
  }

  return datos as T;
}

export const api = {
  listar: <T>(recurso: Recurso) =>
    pedir<{ filas: T[] }>(`/api/admin/${recurso}`).then((r) => r.filas),

  crear: (recurso: Recurso, datos: Record<string, unknown>) =>
    pedir<{ id: string }>(`/api/admin/${recurso}`, {
      method: 'POST',
      body: JSON.stringify(datos),
    }).then((r) => r.id),

  actualizar: (recurso: Recurso, id: string, datos: Record<string, unknown>) =>
    pedir<{ ok: true }>(`/api/admin/${recurso}?id=${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(datos),
    }),

  borrar: (recurso: Recurso, id: string) =>
    pedir<{ ok: true }>(`/api/admin/${recurso}?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  reordenar: (ids: string[]) =>
    pedir<{ ok: true }>('/api/admin/orden', { method: 'POST', body: JSON.stringify({ ids }) }),

  ajustes: <T>() => pedir<{ ajustes: T }>('/api/admin/ajustes').then((r) => r.ajustes),

  guardarAjustes: (datos: Record<string, unknown>) =>
    pedir<{ ok: true }>('/api/admin/ajustes', { method: 'PUT', body: JSON.stringify(datos) }),
};

export type Api = typeof api;
