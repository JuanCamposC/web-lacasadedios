/**
 * Agendar un evento en Google Calendar.
 *
 * ── DOS CAMINOS, Y EL TELÉFONO ELIGE ────────────────────────────────────────
 * En Android y en el escritorio, un enlace a Google Calendar abre el evento ya
 * relleno y listo para guardar. En iPhone y iPad ese camino es peor: lleva a
 * una cuenta de Google que mucha gente no usa, y el calendario del teléfono se
 * queda sin el evento. Ahí lo que funciona es un archivo `.ics`, que iOS abre
 * en su propio calendario sin pedir cuenta de nada.
 *
 * Por eso conviven los dos: `enlaceGoogleCalendar` y `construirIcs`. Cuál se
 * usa lo decide el navegador (ver src/components/AccionesEvento.astro).
 *
 * Emitir ICS correcto tiene tres trampas y las tres están cubiertas acá: las
 * líneas se pliegan a 75 OCTETOS contando bytes UTF-8 —no caracteres—, los
 * separadores son CRLF, y las comas, los puntos y coma y las barras invertidas
 * van escapados.
 *
 * ── LOS EVENTOS NO GUARDAN HORA DE TÉRMINO ──────────────────────────────────
 * La tabla solo tiene `fecha`. Un evento sin duración deja un hueco raro en el
 * calendario, así que se asumen dos horas, que es lo que dura una reunión larga.
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

// ── El archivo .ics ─────────────────────────────────────────────────────────

/**
 * Escapa un texto para un valor de ICS (RFC 5545, §3.3.11).
 *
 * El orden importa: la barra invertida primero, o se escaparían las barras que
 * este mismo escape acaba de introducir.
 */
function escapar(texto: string): string {
  return texto
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * Pliega una línea a 75 octetos, con un espacio al principio de cada
 * continuación.
 *
 * Se cuenta en BYTES y no en caracteres: con tildes y con «ñ» —que en UTF-8
 * ocupan dos— contar caracteres deja líneas más largas de lo que permite el
 * formato, y hay clientes que entonces cortan el texto.
 */
const AOCTETOS = new TextEncoder();
const ATEXTO = new TextDecoder();

function plegar(linea: string): string {
  // TextEncoder y no Buffer: esto corre en el Worker, y depender de Node ahí es
  // depender de una bandera de compatibilidad que alguien puede quitar.
  const bytes = AOCTETOS.encode(linea);
  if (bytes.length <= 75) return linea;

  const trozos: string[] = [];
  let desde = 0;
  let tope = 75;
  while (desde < bytes.length) {
    let hasta = Math.min(desde + tope, bytes.length);
    // No se parte un carácter por la mitad: los bytes de continuación de UTF-8
    // empiezan por 10xxxxxx.
    while (hasta < bytes.length && (bytes[hasta] & 0xc0) === 0x80) hasta--;
    trozos.push(ATEXTO.decode(bytes.subarray(desde, hasta)));
    desde = hasta;
    // Las continuaciones llevan un espacio delante, que también cuenta.
    tope = 74;
  }
  return trozos.join('\r\n ');
}

/**
 * El archivo de calendario de un evento, listo para servir.
 *
 * `UID` es el identificador del evento en la base: si alguien agenda dos veces
 * el mismo evento, el calendario lo reconoce y lo actualiza en vez de duplicarlo.
 */
export function construirIcs(e: EventoAgendable, sello = new Date()): string {
  const lineas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//La Casa de Dios//Eventos//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${e.id}@lacasadedios.cl`,
    `DTSTAMP:${fechaUtc(sello.toISOString())}`,
    `DTSTART:${fechaUtc(e.inicio)}`,
    `DTEND:${fechaUtc(e.inicio, DURACION_MIN)}`,
    `SUMMARY:${escapar(e.titulo)}`,
    `URL:${escapar(e.url)}`,
  ];
  if (e.descripcion) lineas.push(`DESCRIPTION:${escapar(e.descripcion)}`);
  if (e.lugar) lineas.push(`LOCATION:${escapar(e.lugar)}`);
  lineas.push('END:VEVENT', 'END:VCALENDAR');

  // CRLF entre líneas y al final: Outlook comprueba lo segundo.
  return lineas.map(plegar).join('\r\n') + '\r\n';
}
