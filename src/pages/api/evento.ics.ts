import type { APIRoute } from 'astro';
import { construirIcs } from '../../lib/ics';
import type { EventItem } from '../../lib/supabase';

export const prerender = false;

/**
 * Archivo de calendario de un evento: `/api/evento.ics?id=<uuid>`.
 *
 * Sin sesión y sin clave de servicio: se usa el cliente normal, así que la
 * política RLS `public read events` se encarga de que solo salgan los eventos
 * publicados. Un identificador de un borrador devuelve 404, igual que uno
 * inventado.
 *
 * El nombre del archivo sale del título porque es lo que la persona ve en su
 * carpeta de descargas: «culto-de-aniversario.ics» dice algo, «evento.ics» no.
 */

const ES_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Nombre de archivo seguro: sin acentos, sin espacios y sin nada raro. */
function nombreArchivo(titulo: string): string {
  const limpio = titulo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${limpio || 'evento'}.ics`;
}

export const GET: APIRoute = async ({ url, locals, site }) => {
  const id = (url.searchParams.get('id') ?? '').trim();
  if (!ES_UUID.test(id)) return new Response('Evento no encontrado', { status: 404 });

  const supabase = (locals as any).supabase;
  if (!supabase) return new Response('No disponible', { status: 503 });

  const { data } = await supabase
    .from('events')
    .select('id, title, event_date, description, location')
    .eq('id', id)
    .eq('published', true)
    .maybeSingle();

  const evento = data as EventItem | null;
  if (!evento) return new Response('Evento no encontrado', { status: 404 });

  const base = (process.env.SITE_URL || site?.toString() || url.origin).replace(/\/+$/, '');

  const ics = construirIcs({
    id: evento.id,
    titulo: evento.title,
    inicio: evento.event_date,
    descripcion: evento.description,
    lugar: evento.location,
    url: `${base}/eventos#e-${evento.id}`,
  });

  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      // `attachment` es lo que hace que iOS ofrezca abrirlo en Calendario en
      // vez de enseñar el texto plano en el navegador.
      'Content-Disposition': `attachment; filename="${nombreArchivo(evento.title)}"`,
      // Un evento cambia como mucho un par de veces; que lo sirva la CDN.
      'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600',
    },
  });
};
