/**
 * La rejilla de un mes, en hora de Chile.
 *
 * ── POR QUÉ ESTO NO ES UNA LIBRERÍA ─────────────────────────────────────────
 * Un calendario mensual son dos cuentas —qué día de la semana cae el 1 y
 * cuántos días trae el mes— y una lista. Traer una librería de fechas para eso
 * costaría más kilobytes en cada visita que todo el JavaScript que el sitio
 * usa hoy, y añadiría su propia idea de en qué huso vive el mundo. Acá el huso
 * es uno solo y ya está resuelto en src/lib/hora.ts.
 *
 * ── TODO SON CADENAS «AAAA-MM-DD» ───────────────────────────────────────────
 * No objetos `Date`, salvo para calcular. Una fecha de calendario es un día del
 * almanaque de la iglesia, no un instante: el 7 de noviembre es el 7 de
 * noviembre a cualquier hora y en cualquier máquina. En cuanto se guarda como
 * `Date` aparece la hora, con ella el huso, y con el huso el error de un día
 * que este proyecto ya pagó una vez.
 *
 * Para convertir sí se usa `Date`, siempre a las 12:00 UTC. A medianoche UTC,
 * Chile va tres horas por detrás y la fecha sale corrida; al mediodía no hay
 * desfase posible. Es el mismo truco que `fechaEnPalabras`.
 */
import { deIsoAChile } from './hora';
import { enFecha, type Excepcion, type FilaReunion, type Reunion } from './reuniones';

/** Los meses en castellano, para los títulos. */
export const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/**
 * Los días de la semana empezando por LUNES.
 *
 * `DIAS` en src/lib/reuniones.ts empieza por domingo porque sigue el orden de
 * `Date.getDay()`, que es lo que guarda la base. Un calendario de pared chileno
 * empieza el lunes, así que acá van en el otro orden y la conversión está en
 * `columnaDe`. Son dos listas a propósito: la de allá es un formato de dato y
 * esta es una convención de lectura.
 */
export const DIAS_LUNES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

/** En qué columna cae un día de `Date.getDay()` si la semana empieza el lunes. */
export const columnaDe = (dia: number) => (dia + 6) % 7;

export interface Mes {
  anio: number;
  /** 1–12, como lo escribe una persona, no 0–11 como `Date`. */
  mes: number;
}

/** «2026-12» → el mes. Cualquier otra cosa → el mes de `hoy`. */
export function mesDe(valor: string | null | undefined, hoy: string): Mes {
  const m = /^(\d{4})-(\d{2})$/.exec((valor ?? '').trim());
  if (m) {
    const anio = Number(m[1]);
    const mes = Number(m[2]);
    // Se comprueba el rango además del formato: «2026-13» calza con la
    // expresión y no existe. Sin esto, la rejilla saltaría a enero del año
    // siguiente sin decir nada.
    if (mes >= 1 && mes <= 12 && anio >= 2000 && anio <= 2100) return { anio, mes };
  }
  return { anio: Number(hoy.slice(0, 4)), mes: Number(hoy.slice(5, 7)) };
}

/** El mes, como se escribe en la dirección: «2026-12». */
export const comoParametro = ({ anio, mes }: Mes) => `${anio}-${String(mes).padStart(2, '0')}`;

/** «diciembre de 2026». */
export const enPalabras = ({ anio, mes }: Mes) => `${MESES[mes - 1]} de ${anio}`;

export const mesAnterior = ({ anio, mes }: Mes): Mes =>
  mes === 1 ? { anio: anio - 1, mes: 12 } : { anio, mes: mes - 1 };

export const mesSiguiente = ({ anio, mes }: Mes): Mes =>
  mes === 12 ? { anio: anio + 1, mes: 1 } : { anio, mes: mes + 1 };

/** El primer instante del mes, en hora de Chile, como ISO con Z. */
export function primerInstante({ anio, mes }: Mes): string {
  // Chile está a UTC−3 o UTC−4 según la época del año. En vez de decidir cuál,
  // se pide el día anterior a las 00:00 UTC: cubre los dos casos y la consulta
  // filtra de más por unas horas, nunca de menos. Lo que sobra lo descarta la
  // rejilla, que solo pinta los días que de verdad son de este mes.
  const d = new Date(Date.UTC(anio, mes - 1, 1));
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 19) + 'Z';
}

/** El primer instante del mes SIGUIENTE, para cerrar el tramo. */
export function instanteDeCierre(m: Mes): string {
  const { anio, mes } = mesSiguiente(m);
  const d = new Date(Date.UTC(anio, mes - 1, 1));
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 19) + 'Z';
}

export interface Casilla {
  /** «AAAA-MM-DD». */
  fecha: string;
  /** El número del día, para pintarlo. */
  numero: number;
  /** `Date.getDay()`: 0 domingo … 6 sábado. */
  dia: number;
  /** `false` para los días de relleno del mes anterior o siguiente. */
  delMes: boolean;
}

/**
 * Las casillas de la rejilla: semanas completas de lunes a domingo.
 *
 * Incluye los días de relleno de los meses vecinos para que la rejilla no tenga
 * huecos. Van marcados con `delMes: false`: se pintan apagados y no se les
 * cuelga nada, porque un evento del 2 de enero asomando en la rejilla de
 * diciembre confundiría más de lo que informa.
 */
export function casillasDe({ anio, mes }: Mes): Casilla[] {
  const primero = new Date(Date.UTC(anio, mes - 1, 1, 12));
  // Se retrocede hasta el lunes de esa semana. Si el 1 ya es lunes, cero pasos.
  const inicio = new Date(primero);
  inicio.setUTCDate(inicio.getUTCDate() - columnaDe(primero.getUTCDay()));

  const casillas: Casilla[] = [];
  const cursor = new Date(inicio);
  // Seis semanas cubren cualquier mes: 31 días que empiecen un domingo ocupan
  // 37 casillas. Se cortan las semanas finales que sean todas de relleno, para
  // no dejar una fila entera vacía abajo.
  for (let i = 0; i < 42; i++) {
    casillas.push({
      fecha: cursor.toISOString().slice(0, 10),
      numero: cursor.getUTCDate(),
      dia: cursor.getUTCDay(),
      delMes: cursor.getUTCMonth() === mes - 1 && cursor.getUTCFullYear() === anio,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  while (casillas.length > 7 && casillas.slice(-7).every((c) => !c.delMes)) {
    casillas.length -= 7;
  }
  return casillas;
}

/** La fecha de Chile en la que cae un evento guardado como instante ISO. */
export const fechaDeEvento = (iso: string) => deIsoAChile(iso).slice(0, 10);

/**
 * Las reuniones que tocan en una fecha, con su estado EN ESA FECHA.
 *
 * Esto es lo que hace honesto el calendario. `vigente` ya sabe resolver el
 * estado contra una fecha cualquiera —no solo contra hoy—, así que una reunión
 * suspendida hasta el día 8 sale tachada el 4 y normal el 11, que es la
 * verdad. Pintar el patrón semanal a secas habría sido más fácil y habría
 * mentido en los días que importan.
 *
 * Las suspendidas se devuelven igual, no se esconden: quien mira el calendario
 * necesita ver que ese día NO hay, y un hueco no dice eso.
 *
 * Los cambios de un día (`excepciones`) mandan en su fecha. El aviso de la
 * propia fila, en cambio, significa «desde AHORA hasta `aviso_hasta`», así que
 * con `hoy` no se aplica a los días que ya pasaron: una suspensión puesta hoy
 * hasta el jueves no dice nada del jueves de hace dos semanas, y pintarlo
 * tachado sería inventar historia.
 */
export function reunionesEnFecha(
  filas: FilaReunion[],
  fecha: string,
  excepciones: Excepcion[] = [],
  hoy?: string,
): Reunion[] {
  const dia = new Date(`${fecha}T12:00:00Z`).getUTCDay();
  const pasado = hoy !== undefined && fecha < hoy;
  return filas
    .filter((f) => f.dia === dia)
    .map((f) =>
      enFecha(
        pasado ? { ...f, estado: 'normal', aviso: null, aviso_hasta: null } : f,
        fecha,
        excepciones,
      ),
    );
}
