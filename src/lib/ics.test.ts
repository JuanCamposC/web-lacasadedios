import { describe, it, expect } from 'vitest';
import { enlaceGoogleCalendar, fechaUtc, DURACION_MIN, construirIcs } from './ics';

/**
 * Un enlace de calendario mal armado no avisa: abre Google Calendar con el
 * evento a una hora que no es, y quien lo agenda llega tarde sin saber por qué.
 * Lo que se vigila acá es la conversión a UTC y que la duración esté puesta.
 *
 * (Antes había además un generador de `.ics` con sus pruebas de plegado y
 * escapado. Se quitó junto con el formato: ahora solo hay Google Calendar.)
 */

const evento = {
  id: '11111111-2222-3333-4444-555555555555',
  titulo: 'Culto de Aniversario',
  inicio: '2026-09-21T23:00:00.000Z',
  descripcion: 'Celebración especial de la congregación.',
  lugar: 'Templo San Miguel',
  url: 'https://lacasadedios.cl/eventos#e-11111111',
};

describe('fechaUtc', () => {
  it('da el formato compacto en Zulú', () => {
    expect(fechaUtc('2026-09-21T23:00:00.000Z')).toBe('20260921T230000Z');
  });

  // Postgres devuelve `timestamptz` con desfase; si no se normaliza, el evento
  // queda a otra hora en el calendario de quien lo agenda.
  it('normaliza una fecha con desfase horario', () => {
    expect(fechaUtc('2026-09-21T20:00:00-03:00')).toBe('20260921T230000Z');
  });

  it('suma los minutos de duración', () => {
    expect(fechaUtc('2026-09-21T23:00:00.000Z', DURACION_MIN)).toBe('20260922T010000Z');
  });

  it('se queja de una fecha inválida en vez de escribir NaN en el archivo', () => {
    expect(() => fechaUtc('cualquier cosa')).toThrow(RangeError);
  });
});

describe('enlaceGoogleCalendar', () => {
  it('lleva el rango de fechas en el formato que Google espera', () => {
    const url = new URL(enlaceGoogleCalendar(evento));
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render');
    expect(url.searchParams.get('action')).toBe('TEMPLATE');
    expect(url.searchParams.get('text')).toBe(evento.titulo);
    expect(url.searchParams.get('dates')).toBe('20260921T230000Z/20260922T010000Z');
    expect(url.searchParams.get('location')).toBe(evento.lugar);
  });

  it('mete el enlace del evento en el detalle, para poder volver', () => {
    const url = new URL(enlaceGoogleCalendar(evento));
    expect(url.searchParams.get('details')).toContain(evento.url);
  });
});

describe('construirIcs', () => {
  const evento = {
    id: 'ev-1',
    titulo: 'Culto de aniversario, con cena',
    inicio: '2026-10-04T22:00:00Z',
    descripcion: 'Traer algo para compartir; hay estacionamiento',
    lugar: 'Templo San Miguel',
    url: 'https://lacasadedios.cl/eventos',
  };
  const sello = new Date('2026-09-21T12:00:00Z');

  it('separa las líneas con CRLF y termina con uno', () => {
    // Outlook comprueba lo segundo y rechaza el archivo si falta.
    const ics = construirIcs(evento, sello);
    expect(ics.endsWith('\r\n')).toBe(true);
    expect(ics.includes('\n\n')).toBe(false);
  });

  it('escapa las comas y los puntos y coma, que separan valores en el formato', () => {
    const ics = construirIcs(evento, sello);
    expect(ics).toContain(String.raw`SUMMARY:Culto de aniversario\, con cena`);
    expect(ics).toContain(String.raw`DESCRIPTION:Traer algo para compartir\; hay estacionamiento`);
  });

  it('el identificador es el del evento: agendar dos veces no lo duplica', () => {
    expect(construirIcs(evento, sello)).toContain('UID:ev-1@lacasadedios.cl');
  });

  it('pliega las líneas largas a 75 OCTETOS, no a 75 caracteres', () => {
    // Con tildes y eñes, contar caracteres deja líneas más largas de lo que
    // admite el formato y hay clientes que cortan el texto.
    const largo = construirIcs(
      {
        ...evento,
        titulo: 'Reunión de jóvenes con la congregación de Limache y sus años de servicio',
      },
      sello,
    );
    for (const linea of largo.split('\r\n')) {
      expect(new TextEncoder().encode(linea).length).toBeLessThanOrEqual(75);
    }
  });

  it('la continuación de una línea plegada empieza con un espacio', () => {
    const largo = construirIcs({ ...evento, titulo: 'a'.repeat(200) }, sello);
    const lineas = largo.split('\r\n');
    const i = lineas.findIndex((l) => l.startsWith('SUMMARY:'));
    expect(lineas[i + 1].startsWith(' ')).toBe(true);
  });

  it('sin lugar ni descripción, esas líneas no salen', () => {
    const ics = construirIcs({ ...evento, descripcion: null, lugar: null }, sello);
    expect(ics).not.toContain('LOCATION:');
    expect(ics).not.toContain('DESCRIPTION:');
  });
});
