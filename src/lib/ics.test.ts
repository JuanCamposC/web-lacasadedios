import { describe, it, expect } from 'vitest';
import { construirIcs, enlaceGoogleCalendar, fechaUtc, DURACION_MIN } from './ics';

/**
 * Un `.ics` mal formado no avisa: el calendario simplemente no lo abre, o abre
 * un evento a una hora que no es. Aquí se fijan las tres cosas del RFC que se
 * saltan casi todas las implementaciones caseras —saltos CRLF, plegado a 75
 * octetos y escapado de comas— más la conversión a UTC.
 */

const evento = {
  id: '11111111-2222-3333-4444-555555555555',
  titulo: 'Culto de Aniversario',
  inicio: '2026-09-21T23:00:00.000Z',
  descripcion: 'Celebración especial de la congregación.',
  lugar: 'Templo San Miguel',
  url: 'https://lacasadedios.cl/eventos#e-11111111',
};

const ahora = new Date('2026-09-07T12:00:00.000Z');

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

describe('construirIcs', () => {
  it('trae la estructura mínima que espera un calendario', () => {
    const ics = construirIcs(evento, ahora);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('VERSION:2.0');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain(`UID:${evento.id}@lacasadedios.cl`);
    expect(ics).toContain('DTSTART:20260921T230000Z');
    expect(ics).toContain('DTEND:20260922T010000Z');
    expect(ics).toContain('END:VCALENDAR');
  });

  // El RFC exige CRLF. Outlook es de los que lo comprueban.
  it('separa las líneas con CRLF y termina con uno', () => {
    const ics = construirIcs(evento, ahora);
    expect(ics.split('\r\n').length).toBeGreaterThan(10);
    expect(ics).not.toMatch(/[^\r]\n/);
    expect(ics.endsWith('\r\n')).toBe(true);
  });

  // La coma separa valores dentro de un campo: sin escapar, el título se parte.
  it('escapa comas, punto y coma y saltos de línea', () => {
    const ics = construirIcs(
      { ...evento, titulo: 'Culto, cena y vigilia', descripcion: 'Primero;\nDespués' },
      ahora,
    );
    expect(ics).toContain('SUMMARY:Culto\\, cena y vigilia');
    expect(ics).toContain('DESCRIPTION:Primero\\;\\nDespués');
  });

  it('omite los campos que el evento no tiene', () => {
    const ics = construirIcs({ ...evento, descripcion: null, lugar: null }, ahora);
    expect(ics).not.toContain('DESCRIPTION:');
    expect(ics).not.toContain('LOCATION:');
  });

  describe('plegado', () => {
    it('parte las líneas largas con un espacio al empezar la continuación', () => {
      const ics = construirIcs({ ...evento, descripcion: 'a'.repeat(200) }, ahora);
      for (const linea of ics.split('\r\n')) {
        expect(new TextEncoder().encode(linea).length).toBeLessThanOrEqual(75);
      }
      expect(ics).toContain('\r\n ');
    });

    // El caso que rompe las implementaciones caseras: el límite es en OCTETOS,
    // y una vocal acentuada ocupa dos. Cortar por la mitad de un carácter da un
    // archivo que Outlook rechaza entero.
    it('no parte un carácter multibyte por la mitad', () => {
      const ics = construirIcs({ ...evento, descripcion: 'ó'.repeat(120) }, ahora);
      expect(ics).not.toContain('�');
      for (const linea of ics.split('\r\n')) {
        expect(new TextEncoder().encode(linea).length).toBeLessThanOrEqual(75);
      }
      // Y no se pierde ninguna: 120 dentro y 120 fuera.
      expect((ics.match(/ó/g) ?? []).length).toBe(120);
    });
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
