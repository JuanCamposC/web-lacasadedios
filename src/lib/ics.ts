/**
 * Agendar un evento: archivo `.ics` y enlace a Google Calendar.
 *
 * DOS CAMINOS PORQUE NO HAY UNO SOLO QUE SIRVA
 * El `.ics` es el formato estándar (RFC 5545) y es lo que entienden Apple
 * Calendar, Outlook y prácticamente todo lo demás; en un iPhone, tocarlo abre
 * el calendario directamente. En Android, en cambio, se descarga un archivo y
 * hay que buscarlo, así que ahí vale más el enlace de Google Calendar, que abre
 * el evento ya rellenado.
 *
 * LOS EVENTOS NO GUARDAN HORA DE TÉRMINO. La tabla solo tiene `event_date`.
 * Poner un evento sin duración deja un hueco raro en el calendario, así que se
 * asumen dos horas, que es lo que dura un culto largo.
 */

/** Lo que dura un evento cuando nadie dijo cuánto dura. */
export const DURACION_MIN = 120;

export interface EventoAgendable {
  id: string;
  titulo: string;
  /** Fecha de inicio en ISO, tal como sale de Postgres (`timestamptz`). */
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

/** Coma, punto y coma y barra invertida separan campos en ICS: hay que escaparlos. */
function escapar(texto: string): string {
  return texto
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * Parte las líneas de más de 75 OCTETOS, como manda el RFC.
 *
 * Octetos y no caracteres: en UTF-8 una «ó» ocupa dos bytes, y cortar por la
 * mitad de un carácter produce un archivo que Outlook rechaza entero. Por eso
 * se recorre por puntos de código y se cuenta lo que ocupa cada uno.
 *
 * La continuación empieza por un espacio, que también cuenta, así que a partir
 * de la segunda línea el tope es 74.
 */
function plegar(linea: string): string {
  const enc = new TextEncoder();
  if (enc.encode(linea).length <= 75) return linea;

  const trozos: string[] = [];
  let actual = '';
  let bytes = 0;

  for (const ch of linea) {
    const n = enc.encode(ch).length;
    const tope = trozos.length === 0 ? 75 : 74;
    if (bytes + n > tope) {
      trozos.push(actual);
      actual = '';
      bytes = 0;
    }
    actual += ch;
    bytes += n;
  }
  trozos.push(actual);
  return trozos.join('\r\n ');
}

export function construirIcs(e: EventoAgendable, ahora = new Date()): string {
  const campos: [string, string][] = [
    ['BEGIN', 'VCALENDAR'],
    ['VERSION', '2.0'],
    ['PRODID', '-//La Casa de Dios//Eventos//ES'],
    ['CALSCALE', 'GREGORIAN'],
    ['METHOD', 'PUBLISH'],
    ['BEGIN', 'VEVENT'],
    // El identificador tiene que ser único y estable: si cambia, el calendario
    // crea un evento nuevo en vez de actualizar el que ya estaba.
    ['UID', `${e.id}@lacasadedios.cl`],
    ['DTSTAMP', fechaUtc(ahora.toISOString())],
    ['DTSTART', fechaUtc(e.inicio)],
    ['DTEND', fechaUtc(e.inicio, DURACION_MIN)],
    ['SUMMARY', escapar(e.titulo)],
    ...(e.descripcion ? ([['DESCRIPTION', escapar(e.descripcion)]] as [string, string][]) : []),
    ...(e.lugar ? ([['LOCATION', escapar(e.lugar)]] as [string, string][]) : []),
    ['URL', escapar(e.url)],
    ['END', 'VEVENT'],
    ['END', 'VCALENDAR'],
  ];

  // Saltos CRLF, no LF: el RFC lo exige y Outlook es de los que lo comprueban.
  return campos.map(([k, v]) => plegar(`${k}:${v}`)).join('\r\n') + '\r\n';
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
