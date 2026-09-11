import { describe, it, expect } from 'vitest';
import { enlaceGoogleCalendar, fechaUtc, DURACION_MIN } from './ics';

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
