/**
 * Las reuniones semanales, tal como se enseñan en la web.
 *
 * Lo que hay acá es puro —sin base, sin red— para poder probarlo: qué estado
 * rige HOY para cada reunión, y cómo se ordena la semana. La lectura de la base
 * está en src/lib/datos.ts.
 */
import { deIsoAChile } from './hora';

export type EstadoReunion = 'normal' | 'suspendida' | 'cambiada';

/** Una fila de la tabla `reuniones`, tal como sale de la base. */
export interface FilaReunion {
  id: string;
  templo: string;
  dia: number;
  hora: string;
  nombre: string;
  estado: EstadoReunion;
  aviso: string | null;
  aviso_hasta: string | null;
}

/** Una reunión con el estado que rige hoy ya resuelto. */
export interface Reunion {
  id: string;
  templo: string;
  dia: number;
  hora: string;
  nombre: string;
  estado: EstadoReunion;
  /** La frase para la gente, o `null` si la reunión va normal. */
  aviso: string | null;
}

/** Nombres de los días, en el orden de `Date.getDay()`: domingo primero. */
export const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

/** El día de hoy en Chile, «AAAA-MM-DD». */
export function hoyEnChile(ahora = new Date()): string {
  return deIsoAChile(ahora.toISOString()).slice(0, 10);
}

/**
 * El estado que rige hoy.
 *
 * Un aviso con `aviso_hasta` ya pasado se da por terminado y la reunión vuelve
 * a ser normal. Es lo que evita el caso de siempre: se suspende la reunión de
 * esta semana y nadie se acuerda de volver a encenderla, así que durante meses
 * la web dice que no hay reunión los jueves.
 *
 * «Pasado» significa DESPUÉS de ese día: un aviso hasta el jueves se sigue
 * enseñando todo el jueves.
 */
export function vigente(fila: FilaReunion, hoy: string): Reunion {
  const caducado = fila.aviso_hasta !== null && fila.aviso_hasta < hoy;
  const estado = caducado ? 'normal' : fila.estado;
  return {
    id: fila.id,
    templo: fila.templo,
    dia: fila.dia,
    hora: fila.hora,
    nombre: fila.nombre,
    estado,
    // Una reunión normal no arrastra una frase vieja de «se suspende por
    // feriado». Y una suspendida sin frase no se inventa una.
    aviso: estado === 'normal' ? null : fila.aviso?.trim() || null,
  };
}

export interface DiaDeReuniones {
  dia: number;
  nombre: string;
  reuniones: Reunion[];
}

/**
 * La semana agrupada por día, de domingo a sábado, sin los días vacíos, y cada
 * día ordenado por hora.
 *
 * La hora se compara como texto, y funciona porque la base obliga a «HH:MM»
 * con cero delante (ver la migración 0003): «09:00» va antes que «10:30». Con
 * «9:00» a secas, las nueve irían después de las diez.
 */
export function porDia(reuniones: Reunion[]): DiaDeReuniones[] {
  return DIAS.map((nombre, dia) => ({
    dia,
    nombre,
    reuniones: reuniones.filter((r) => r.dia === dia).sort((a, b) => a.hora.localeCompare(b.hora)),
  })).filter((d) => d.reuniones.length > 0);
}

/** Cuántas reuniones hay en la semana sin contar las suspendidas. */
export const enPie = (reuniones: Reunion[]) =>
  reuniones.filter((r) => r.estado !== 'suspendida').length;

// ── La próxima reunión ──────────────────────────────────────────────────────

/** Un momento de la semana en Chile: día (0 = domingo) y minutos desde las 00:00. */
export interface MomentoSemana {
  dia: number;
  minutos: number;
}

/** El momento de la semana en Chile, sin importar el huso de quien pregunta. */
export function momentoEnChile(ahora = new Date()): MomentoSemana {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Santiago',
    // `h23`: con `hour12: false` hay motores que dan «24» a medianoche.
    hourCycle: 'h23',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(ahora);
  const v = Object.fromEntries(partes.map((p) => [p.type, p.value])) as Record<string, string>;
  const dia = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(v.weekday);
  return { dia: Math.max(0, dia), minutos: Number(v.hour) * 60 + Number(v.minute) };
}

export interface Proxima {
  /** La próxima reunión que SÍ se hace, o `null` si el templo no tiene ninguna. */
  reunion: Reunion | null;
  /** «Hoy», «Mañana» o el nombre del día. */
  cuando: string;
  /**
   * Las suspendidas que caen ANTES de la próxima. Quien ve «próxima: domingo»
   * un jueves tiene que saber por qué no es hoy: que la de hoy se suspendió.
   */
  suspendidas: Reunion[];
}

const SEMANA = 7 * 24 * 60;

/** Minutos que faltan para una reunión, dando la vuelta a la semana si ya pasó. */
function faltanMinutos(r: Reunion, ahora: MomentoSemana): number {
  const [h, m] = r.hora.split(':').map(Number);
  const diferencia = (r.dia - ahora.dia) * 24 * 60 + (h * 60 + m) - ahora.minutos;
  // Una que empieza justo ahora cuenta como próxima; una de hace un minuto, no.
  return ((diferencia % SEMANA) + SEMANA) % SEMANA;
}

/**
 * La próxima reunión de una lista, en hora de Chile.
 *
 * Las suspendidas no pueden ser «la próxima» —se llegaría a un templo cerrado—
 * pero tampoco se esconden: vuelven aparte, para decir que no hay.
 */
export function proximaReunion(reuniones: Reunion[], ahora: MomentoSemana): Proxima {
  const enOrden = reuniones
    .map((r) => ({ r, faltan: faltanMinutos(r, ahora) }))
    .sort((a, b) => a.faltan - b.faltan);

  const i = enOrden.findIndex(({ r }) => r.estado !== 'suspendida');
  if (i === -1) return { reunion: null, cuando: '', suspendidas: reuniones.slice() };

  const { r, faltan } = enOrden[i];
  // Se cuenta en días de calendario, no en horas: el sábado a las 23:00, una
  // reunión del domingo a las 10:00 es «mañana» aunque falten once horas.
  const dias = Math.floor((ahora.minutos + faltan) / (24 * 60));
  const cuando = dias === 0 ? 'Hoy' : dias === 1 ? 'Mañana' : DIAS[r.dia];

  return {
    reunion: r,
    cuando,
    suspendidas: enOrden.slice(0, i).map(({ r }) => r),
  };
}
