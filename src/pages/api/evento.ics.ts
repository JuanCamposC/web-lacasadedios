import type { APIRoute } from 'astro';
import { construirIcs } from '../../lib/ics';
import { baseDeDatos } from '../../lib/base';
import { eventoPorId } from '../../lib/datos';

export const prerender = false;

/**
 * Archivo de calendario de un evento: `/api/evento.ics?id=<uuid>`.
 *
 * El filtro de publicado va en la consulta, no en la base: D1 no tiene RLS.
 * Un identificador de un borrador devuelve 404, igual que uno inventado. Que
 * ese filtro esté puesto lo garantiza `eventoPorId`, no un permiso.
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

export const GET: APIRoute = async ({ url, site }) => {
  const id = (url.searchParams.get('id') ?? '').trim();
  if (!ES_UUID.test(id)) return new Response('Evento no encontrado', { status: 404 });

  const evento = await eventoPorId(await baseDeDatos(), id);
  if (!evento) return new Response('Evento no encontrado', { status: 404 });

  const base = (process.env.SITE_URL || site?.toString() || url.origin).replace(/\/+$/, '');

  const ics = construirIcs({
    id: evento.id,
    titulo: evento.titulo,
    inicio: evento.fecha,
    descripcion: evento.descripcion,
    lugar: evento.lugar,
    url: `${base}/eventos#e-${evento.id}`,
  });

  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      // `attachment` es lo que hace que iOS ofrezca abrirlo en Calendario en
      // vez de enseñar el texto plano en el navegador.
      'Content-Disposition': `attachment; filename="${nombreArchivo(evento.titulo)}"`,
      // Un evento cambia como mucho un par de veces; que lo sirva la CDN.
      'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600',
    },
  });
};
