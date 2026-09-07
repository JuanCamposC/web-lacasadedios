import { createBrowserClient, createServerClient, parseCookieHeader } from '@supabase/ssr';
import type { AstroCookies } from 'astro';

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);

/** Cliente para el navegador (login y CRUD del panel). Guarda la sesión en cookies. */
export function createBrowserSupabase() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_KEY);
}

/** Cliente para el servidor (SSR + middleware), lee la sesión desde las cookies. */
export function createServerSupabase(cookies: AstroCookies, request: Request) {
  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => parseCookieHeader(request.headers.get('Cookie') ?? ''),
      setAll: (cookiesToSet) =>
        cookiesToSet.forEach(({ name, value, options }) =>
          cookies.set(name, value, options as Record<string, unknown>),
        ),
    },
  });
}

/* ── Tipos de contenido ─────────────────────────────────────────────────── */
export interface EventItem {
  id: string;
  title: string;
  slug: string | null;
  event_date: string;
  location: string | null;
  description: string | null;
  image_url: string | null;
  /** Templo al que pertenece, o 'general' (ver src/data/etiquetas.ts). */
  templo: string;
  published: boolean;
}

export interface NewsItem {
  id: string;
  title: string;
  slug: string | null;
  excerpt: string | null;
  body: string | null;
  image_url: string | null;
  /** Templo al que pertenece, o 'general' (ver src/data/etiquetas.ts). */
  templo: string;
  published: boolean;
  published_at: string;
}

export interface VideoItem {
  id: string;
  title: string;
  youtube_url: string;
  description: string | null;
  /** Templo al que pertenece, o 'general' (ver src/data/etiquetas.ts). */
  templo: string;
  published: boolean;
  sort_order: number;
  created_at: string;
}

export interface SiteSettings {
  live_enabled: boolean;
  live_url: string | null;
  live_title: string | null;
}

/**
 * Extrae el ID de un video de YouTube desde varias formas de URL.
 *
 * `/live/` NO ES OPCIONAL. Es la dirección que entrega el botón «Compartir» de
 * una transmisión en directo, y era la única forma que faltaba: sin ella
 * `/en-vivo` no encontraba ID y caía en el aviso de reserva —título y botón a
 * YouTube— en lugar de incrustar el reproductor.
 *
 * Ojo con `youtube.com/@canal/live`, que es otra cosa: esa dirección no lleva
 * ningún ID dentro, apunta a «lo que esté en directo ahora». Aquí no se puede
 * resolver, y devuelve null a propósito.
 */
export function youtubeId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /youtu\.be\/([\w-]{11})/,
    /youtube\.com\/watch\?v=([\w-]{11})/,
    /youtube\.com\/live\/([\w-]{11})/,
    // `-nocookie` porque es el dominio desde el que el sitio sirve sus propios
    // iframes: una dirección copiada de ahí y pegada en el panel debe valer.
    /youtube(?:-nocookie)?\.com\/embed\/([\w-]{11})/,
    /youtube\.com\/shorts\/([\w-]{11})/,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return null;
}
