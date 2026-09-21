import type { APIRoute } from 'astro';
import { baseDeDatos } from '../../../lib/base';
import { eventoPorId } from '../../../lib/datos';
import { construirIcs } from '../../../lib/ics';

export const prerender = false;

/**
 * El archivo de calendario de un evento: `/api/evento/<id>.ics`.
 *
 * ── PARA QUÉ ────────────────────────────────────────────────────────────────
 * En iPhone y iPad, el enlace a Google Calendar lleva a una cuenta que mucha
 * gente no usa y el evento no llega nunca al calendario del teléfono. Un `.ics`
 * lo abre el calendario del propio sistema, sin cuenta de nada. Quién recibe
 * cada cosa lo decide el navegador (ver src/components/AccionesEvento.astro).
 *
 * ── LO QUE PROTEGE ──────────────────────────────────────────────────────────
 * `eventoPorId` filtra por `publicado = 1`, así que un borrador da 404 igual
 * que un identificador inventado: este enlace no puede usarse para espiar lo
 * que todavía no se anuncia.
 */
export const GET: APIRoute = async ({ params, url }) => {
  const id = (params.id ?? '').trim();
  if (!id) return new Response('falta el evento', { status: 400 });

  let evento;
  try {
    evento = await eventoPorId(await baseDeDatos(), id);
  } catch (e) {
    console.error(`[evento.ics] ${(e as Error).message}`);
    return new Response('no se pudo preparar el archivo', { status: 500 });
  }
  if (!evento) return new Response('evento no encontrado', { status: 404 });

  const sitio = (process.env.SITE_URL || url.origin).replace(/\/$/, '');
  const ics = construirIcs({
    id: evento.id,
    titulo: evento.titulo,
    inicio: evento.fecha,
    descripcion: evento.descripcion,
    lugar: evento.lugar,
    url: `${sitio}/eventos#e-${evento.id}`,
  });

  // El nombre del archivo sale del slug para que, al guardarlo, se entienda qué
  // es: «culto-aniversario.ics» y no «a3f1….ics».
  const nombre = `${evento.slug || 'evento'}.ics`;

  return new Response(ics, {
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      // `attachment` y no `inline`: en iOS es lo que dispara la hoja de
      // «Agregar al calendario» en vez de enseñar el texto del archivo.
      'content-disposition': `attachment; filename="${nombre}"`,
      // Un evento no cambia casi nunca, pero cuando cambia —se corrige la hora—
      // el archivo viejo deja de servir. Cinco minutos es suficiente.
      'cache-control': 'public, max-age=300',
    },
  });
};
