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

/** Extrae el ID de un video de YouTube desde varias formas de URL. */
export function youtubeId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /youtu\.be\/([\w-]{11})/,
    /youtube\.com\/watch\?v=([\w-]{11})/,
    /youtube\.com\/embed\/([\w-]{11})/,
    /youtube\.com\/shorts\/([\w-]{11})/,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return null;
}
