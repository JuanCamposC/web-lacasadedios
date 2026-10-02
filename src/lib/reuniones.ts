/**
 * Las reuniones semanales, tal como se enseñan en la web.
 *
 * Lo que hay acá es puro —sin base, sin red— para poder probarlo: qué estado
 * rige HOY para cada reunión, y cómo se ordena la semana. La lectura de la base
 * está en src/lib/datos.ts.
 */
import { deIsoAChile } from './hora';

export type EstadoReunion = 'normal' | 'suspendida' | 'cambiada';

/**
 * Cada cuánto le toca a una reunión su marca.
 *
 * ── QUÉ ES UNA MARCA Y POR QUÉ NO ES UN AVISO ───────────────────────────────
 * Un AVISO dice que algo se sale de lo normal esta vez —«suspendida por el
 * feriado»— y se escribe a mano con fecha de caducidad. Una MARCA dice algo que
 * se repite para siempre: «este domingo hay Santa Cena». Nadie tiene que
 * acordarse de ponerla ni de quitarla.
 *
 * Esa diferencia importa porque ya se pagó el precio de no tenerla: para
 * anunciar la Reunión de Acción de Gracias hubo que inventar filas temporales,
 * y al caducar su aviso quedaron anunciando una reunión semanal que no existía.
 * Una marca no deja residuo.
 *
 * ── POR QUÉ «EL PRIMERO DEL MES» Y NO «EL PRIMER FIN DE SEMANA» ─────────────
 * Porque la regla se aplica a UNA reunión, que ya sabe su día. Santiago Centro
 * se reúne el domingo y Limache el sábado, así que a cada una le toca el primer
 * día suyo del mes. Casi siempre caen en el mismo fin de semana; cuando el día
 * 1 es domingo no —agosto de 2027, por ejemplo—, y la iglesia prefirió que cada
 * templo cuente los suyos antes que atar los sábados a los domingos.
 */
export type ReglaMarca = 'siempre' | 'primer' | 'primer-par' | 'primer-impar' | 'ultimo';

export const REGLAS_MARCA: ReglaMarca[] = [
  'siempre',
  'primer',
  'primer-par',
  'primer-impar',
  'ultimo',
];

export const esReglaMarca = (v: unknown): v is ReglaMarca =>
  typeof v === 'string' && (REGLAS_MARCA as string[]).includes(v);

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
  /** La frase que se repite, p. ej. «Santa Cena». Sin regla no se enseña. */
  marca: string | null;
  marca_regla: string | null;
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
  /** La marca, SOLO si le toca en su próxima fecha. Si no, `null`. */
  marca: string | null;
}

/** Nombres de los días, en el orden de `Date.getDay()`: domingo primero. */
export const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

/** El día de hoy en Chile, «AAAA-MM-DD». */
export function hoyEnChile(ahora = new Date()): string {
  return deIsoAChile(ahora.toISOString()).slice(0, 10);
}

/**
 * La próxima fecha en que cae ese día de la semana, contando HOY.
 *
 * Contar hoy es la parte que importa. La web no enseña un calendario sino una
 * semana, así que «¿le toca la marca?» hay que preguntarlo sobre una fecha
 * concreta, y la natural es la próxima vez que esa reunión se hace. Si el
 * domingo a las 15:00 se dejara de contar hoy, la marca de la Santa Cena
 * desaparecería a media tarde del mismo día en que se celebra.
 *
 * Se trabaja en UTC a propósito. La fecha ya viene en día de Chile (la calcula
 * `hoyEnChile`), y volver a pasarla por un huso solo podría correrla un día.
 */
export function proximaFecha(dia: number, hoy: string): string {
  const d = new Date(`${hoy}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + ((dia - d.getUTCDay() + 7) % 7));
  return d.toISOString().slice(0, 10);
}

/**
 * ¿Le toca la marca a esa fecha?
 *
 * «El primer domingo del mes» es exactamente «un domingo que cae del 1 al 7»:
 * en siete días consecutivos cada día de la semana aparece una vez y solo una.
 * El último, lo mismo contando desde el final. Sale sin recorrer el calendario
 * ni preguntar cuántos domingos lleva el mes.
 */
export function tocaMarca(regla: string | null, fecha: string): boolean {
  if (!esReglaMarca(regla)) return false;
  if (regla === 'siempre') return true;

  const d = new Date(`${fecha}T00:00:00Z`);
  const dia = d.getUTCDate();
  // Mes en 1..12, para que «par» signifique lo que dice: febrero, abril…
  const mes = d.getUTCMonth() + 1;

  if (regla === 'ultimo') {
    const ultimoDelMes = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
    ).getUTCDate();
    return dia > ultimoDelMes - 7;
  }

  if (dia > 7) return false;
  if (regla === 'primer') return true;
  return regla === 'primer-par' ? mes % 2 === 0 : mes % 2 === 1;
}

/**
 * La próxima fecha en que a esta reunión le toca su marca.
 *
 * Existe para el panel: una regla como «el primer domingo de los meses pares»
 * es correcta y no dice nada hasta que se convierte en «el 4 de octubre». Quien
 * la configura necesita ver la fecha para saber si acertó, y es la diferencia
 * entre un formulario que se rellena a ciegas y uno que se comprueba solo.
 *
 * Mira semana a semana, nunca más de dos años. El tope es una red: todas las
 * reglas que existen tocan al menos una vez cada dos meses, así que si el bucle
 * llegara al final sería porque alguien agregó una regla y olvidó esto.
 */
export function proximaVezConMarca(dia: number, regla: string | null, desde: string): string | null {
  if (!esReglaMarca(regla)) return null;
  let fecha = proximaFecha(dia, desde);
  for (let i = 0; i < 105; i++) {
    if (tocaMarca(regla, fecha)) return fecha;
    const d = new Date(`${fecha}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 7);
    fecha = d.toISOString().slice(0, 10);
  }
  return null;
}

/** «domingo 4 de octubre de 2026», a partir de «2026-10-04». */
export function fechaEnPalabras(fecha: string): string {
  // `T12:00:00Z` y no medianoche: al formatear en el huso de Chile, las 00:00
  // UTC son las 21:00 del día ANTERIOR, y la fecha saldría corrida.
  return new Intl.DateTimeFormat('es-CL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Santiago',
  }).format(new Date(`${fecha}T12:00:00Z`));
}

/** Cómo se lee una regla, para el panel y para las pruebas. */
export function reglaEnPalabras(regla: string | null, dia: number): string {
  if (!esReglaMarca(regla)) return 'nunca';
  const d = DIAS[dia]?.toLowerCase() ?? 'día';
  switch (regla) {
    case 'siempre':
      return `todos los ${d}`;
    case 'primer':
      return `el primer ${d} de cada mes`;
    case 'primer-par':
      return `el primer ${d} de los meses pares`;
    case 'primer-impar':
      return `el primer ${d} de los meses impares`;
    case 'ultimo':
      return `el último ${d} de cada mes`;
  }
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
    // La marca se calcula sobre la PRÓXIMA vez que esta reunión se hace, no
    // sobre hoy: el jueves ya se puede anunciar la Santa Cena del domingo.
    //
    // Una suspendida no la lleva: anunciar la Santa Cena de una reunión que no
    // se hace es peor que no anunciar nada.
    marca:
      estado === 'suspendida' || !fila.marca?.trim()
        ? null
        : tocaMarca(fila.marca_regla, proximaFecha(fila.dia, hoy))
          ? fila.marca.trim()
          : null,
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

/**
 * Cuánto se da por que dura una reunión.
 *
 * La tabla guarda la hora de inicio y nada más, así que «está pasando ahora»
 * hay que decidirlo con una duración supuesta. Dos horas es lo que dura una
 * reunión larga, y es la misma cifra que ya asumen los eventos al agendarse
 * (ver DURACION_MIN en src/lib/ics.ts).
 *
 * Pasarse es mejor que quedarse corto: si alguien mira a la hora y media y la
 * web ya no dice nada, parece que no hay reunión.
 */
export const DURACION_REUNION_MIN = 120;

export interface Proxima {
  /**
   * La que está pasando AHORA MISMO, si hay alguna.
   *
   * Se separa de `reunion` a propósito: quien abre la página a las 20:30 un
   * domingo no quiere leer «próxima reunión: el jueves», quiere saber que la de
   * ahora ya empezó y que todavía llega.
   */
  enCurso: Reunion | null;
  /** Minutos que lleva la reunión en curso. 0 si no hay ninguna. */
  llevaMinutos: number;
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

  /*
   * Lo que está pasando ahora es lo que EMPEZÓ hace menos de dos horas, y
   * `faltanMinutos` cuenta hacia delante dando la vuelta a la semana: una
   * reunión que empezó hace media hora devuelve «faltan 10.050 minutos». Por
   * eso se busca desde el otro extremo de la semana.
   *
   * Una suspendida nunca está en curso: sería anunciar que hay algo pasando en
   * una puerta cerrada.
   */
  const empezoHace = (faltan: number) => (SEMANA - faltan) % SEMANA;
  const corriendo = enOrden
    .filter(
      ({ r, faltan }) => r.estado !== 'suspendida' && empezoHace(faltan) < DURACION_REUNION_MIN,
    )
    .sort((a, b) => empezoHace(a.faltan) - empezoHace(b.faltan));
  const enCurso = corriendo[0] ?? null;

  const i = enOrden.findIndex(({ r }) => r.estado !== 'suspendida');
  if (i === -1) {
    return {
      enCurso: enCurso?.r ?? null,
      llevaMinutos: enCurso ? empezoHace(enCurso.faltan) : 0,
      reunion: null,
      cuando: '',
      suspendidas: reuniones.slice(),
    };
  }

  const { r, faltan } = enOrden[i];
  // Se cuenta en días de calendario, no en horas: el sábado a las 23:00, una
  // reunión del domingo a las 10:00 es «mañana» aunque falten once horas.
  const dias = Math.floor((ahora.minutos + faltan) / (24 * 60));
  const cuando = dias === 0 ? 'Hoy' : dias === 1 ? 'Mañana' : DIAS[r.dia];

  return {
    enCurso: enCurso?.r ?? null,
    llevaMinutos: enCurso ? empezoHace(enCurso.faltan) : 0,
    reunion: r,
    cuando,
    suspendidas: enOrden.slice(0, i).map(({ r }) => r),
  };
}
