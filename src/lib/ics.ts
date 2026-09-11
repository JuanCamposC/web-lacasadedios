/**
 * Agendar un evento en Google Calendar.
 *
 * ── HUBO UN `.ics` Y SE QUITÓ ───────────────────────────────────────────────
 * Antes se ofrecían dos caminos: este enlace y un archivo `.ics` descargable
 * para Apple Calendar y Outlook. Emitir ICS correcto es más trabajo del que
 * parece —plegar líneas a 75 OCTETOS contando bytes UTF-8, escapar comas y
 * puntos y coma, saltos CRLF que Outlook sí comprueba— y encima en Android baja
 * un archivo que hay que ir a buscar. Un enlace que abre el evento ya relleno
 * hace el trabajo para casi todo el mundo.
 *
 * ── LOS EVENTOS NO GUARDAN HORA DE TÉRMINO ──────────────────────────────────
 * La tabla solo tiene `fecha`. Un evento sin duración deja un hueco raro en el
 * calendario, así que se asumen dos horas, que es lo que dura un culto largo.
 *
 * ── LA HORA ─────────────────────────────────────────────────────────────────
 * Lo que se guarda es un instante en UTC (ver src/lib/hora.ts), y a Google se le
 * manda en UTC. Google lo pinta en el huso de quien agenda, que es lo correcto:
 * quien esté en Chile verá la hora de la iglesia.
 */

/** Lo que dura un evento cuando nadie dijo cuánto dura. */
export const DURACION_MIN = 120;

export interface EventoAgendable {
  id: string;
  titulo: string;
  /** Instante de inicio en ISO-8601 UTC, tal como se guarda en D1. */
  inicio: string;
  descripcion?: string | null;
  lugar?: string | null;
  /** Dirección pública del evento, para que el recordatorio lleve de vuelta. */
  url: string;
}

/**
 * `20260921T230000Z`.
 *
 * Se pasa todo a UTC a propósito: así no hace falta incrustar un bloque
 * VTIMEZONE con las reglas del horario de verano chileno, que cambian por
 * decreto cada pocos años y dejarían archivos viejos con horas equivocadas.
 */
export function fechaUtc(iso: string, minutosExtra = 0): string {
  const d = new Date(new Date(iso).getTime() + minutosExtra * 60_000);
  if (Number.isNaN(d.getTime())) throw new RangeError(`fecha inválida: ${iso}`);
  return d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

/** Enlace que abre Google Calendar con el evento ya rellenado. */
export function enlaceGoogleCalendar(e: EventoAgendable): string {
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.titulo,
    dates: `${fechaUtc(e.inicio)}/${fechaUtc(e.inicio, DURACION_MIN)}`,
    details: [e.descripcion, e.url].filter(Boolean).join('\n\n'),
    location: e.lugar ?? '',
  });
  return `https://calendar.google.com/calendar/render?${p}`;
}
