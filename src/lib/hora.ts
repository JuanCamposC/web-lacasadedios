/**
 * Las horas del sitio, siempre en hora de Chile.
 *
 * ── EL ERROR QUE ESTO ARREGLA ───────────────────────────────────────────────
 * Antes cada punta hacía lo suyo:
 *
 *   · Al GUARDAR, el panel convertía lo escrito con `new Date('2026-09-26T19:00')`,
 *     que JavaScript interpreta en el huso DEL NAVEGADOR de quien administra.
 *   · Al MOSTRAR, las páginas usaban `Intl.DateTimeFormat` sin decir el huso,
 *     que en Cloudflare Workers es **UTC**.
 *
 * Las dos puntas no se hablaban: se escribían las 19:00 desde Santiago y la
 * página anunciaba las 22:00. Nada fallaba, nadie veía un error, y a la reunión
 * se llegaba tres horas tarde.
 *
 * A partir de acá hay una sola regla: **en la base todo es UTC, y lo que se
 * escribe y lo que se lee es hora de Chile, sin importar dónde corra.**
 *
 * ── POR QUÉ NO SE GUARDA DIRECTAMENTE LA HORA DE CHILE ──────────────────────
 * Porque Chile cambia la hora, y cambia por decreto: las fechas del cambio se
 * han movido varias veces en los últimos años. Un instante guardado en UTC
 * sigue siendo el mismo instante cuando cambian las reglas; «19:00 en Chile»
 * guardado a secas, no.
 *
 * Por eso el desfase se pregunta SIEMPRE al motor —`Intl` lo lleva al día— y
 * nunca se escribe a mano un −3 o un −4.
 */

/** El huso de la iglesia. Los cuatro templos están en el mismo. */
export const ZONA = 'America/Santiago';

/**
 * Cuántos minutos va Chile por delante de UTC en un instante dado.
 *
 * Negativo casi siempre (−180 en verano, −240 en invierno). Se calcula
 * preguntándole a `Intl` qué hora marca el reloj chileno en ese instante y
 * comparándolo con la hora UTC del mismo instante.
 */
export function desfaseChile(instante: Date): number {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONA,
    // `h23` y no `hour12: false`: con `hour12: false` algunos motores devuelven
    // «24» para la medianoche, y entonces la cuenta se va un día entero.
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instante);

  const v = Object.fromEntries(partes.map((p) => [p.type, p.value])) as Record<string, string>;
  const comoSiFueraUtc = Date.UTC(
    Number(v.year),
    Number(v.month) - 1,
    Number(v.day),
    Number(v.hour),
    Number(v.minute),
    Number(v.second),
  );
  return (comoSiFueraUtc - instante.getTime()) / 60_000;
}

/**
 * Lo que se escribe en un campo `datetime-local` → instante en UTC.
 *
 * `'2026-09-26T19:00'` significa **las 19:00 en Chile**, se escriba desde donde
 * se escriba. Devuelve `null` si el texto no tiene la forma esperada, en vez de
 * una fecha inventada.
 *
 * ── LAS DOS PASADAS ─────────────────────────────────────────────────────────
 * Para saber el desfase hay que saber el instante, y para saber el instante hay
 * que saber el desfase. Se rompe el círculo con una estimación —tratar lo
 * escrito como si fuera UTC— y se corrige con el desfase que salga. La segunda
 * pasada existe para las dos noches del año en que el país cambia la hora: si
 * la estimación cayó al otro lado del salto, el desfase era el del día
 * equivocado.
 */
export function deChileAIso(valor: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(valor.trim());
  if (!m) return null;
  const [, Y, M, D, h, min] = m.map(Number) as unknown as number[];

  const escrito = Date.UTC(Y, M - 1, D, h, min);
  let instante = escrito - desfaseChile(new Date(escrito)) * 60_000;
  instante = escrito - desfaseChile(new Date(instante)) * 60_000;

  const d = new Date(instante);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Instante en UTC → lo que hay que poner en un campo `datetime-local`.
 *
 * El inverso de `deChileAIso`. Sin esto, abrir un evento para editarlo mostraría
 * una hora distinta de la publicada, y guardarlo sin tocar nada la correría.
 */
export function deIsoAChile(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const local = new Date(d.getTime() + desfaseChile(d) * 60_000);
  return local.toISOString().slice(0, 16);
}

/**
 * Formatea una fecha en hora de Chile.
 *
 * Envuelve a `Intl` solo para una cosa: que no se pueda olvidar el huso. Esa
 * omisión es justamente la que hacía que la misma fecha se leyera distinta en
 * el servidor y en el navegador.
 */
export function enChile(iso: string, opciones: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('es-CL', { ...opciones, timeZone: ZONA }).format(new Date(iso));
}

/** «26 de septiembre de 2026». */
export const fechaLarga = (iso: string) => enChile(iso, { dateStyle: 'long' });

/**
 * «19:00».
 *
 * RELOJ DE 24 HORAS, Y HAY QUE PEDIRLO. La configuración de `es-CL` es de 12
 * horas, así que sin `hourCycle` esto devuelve «7:00 p. m.» — que no está mal,
 * pero choca con el resto del sitio: el cartel de horarios y las fichas de cada
 * templo escriben «20:00 · Estudio Bíblico». Que un evento a la misma hora se
 * anuncie de otra forma obliga a traducir mentalmente.
 */
export const horaCorta = (iso: string) =>
  enChile(iso, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** «26 sep 2026, 19:00», para los listados del panel. */
export const fechaYHora = (iso: string) =>
  enChile(iso, { dateStyle: 'medium', timeStyle: 'short', hourCycle: 'h23' });

/* ── Duraciones ──────────────────────────────────────────────────────────────
   La base guarda MINUTOS (`eventos.duracion_min`, migración 0012) y el panel
   pregunta «¿a qué hora termina?» (migración… ninguna: es solo el formulario).
   Las dos cuentas que traducen de una cosa a la otra viven acá y no en el
   formulario por dos razones:

     · Son aritmética de horas, y en este proyecto eso vive en este archivo.
     · Son la única cuenta nueva del panel cuyo resultado no se ve en pantalla
       hasta que el evento ya está publicado. Eso pide pruebas, y las pruebas
       solo miran `src/lib` (ver vitest.config.ts).
   ────────────────────────────────────────────────────────────────────────── */

/** «19:30» → 1170. `null` si no es una hora válida. */
export function minutosDeHora(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const horas = Number(m[1]);
  const minutos = Number(m[2]);
  if (horas > 23 || minutos > 59) return null;
  return horas * 60 + minutos;
}

/**
 * Cuántos minutos van del inicio a la hora de término.
 *
 * `inicio` es lo que tiene escrito un campo `datetime-local`
 * («2026-11-07T09:00») y `fin` lo que tiene un campo `time` («18:00»).
 *
 * ── LAS DOS DECISIONES QUE LLEVA DENTRO ─────────────────────────────────────
 * 1. Si la hora de término es MENOR O IGUAL que la de inicio, se entiende que
 *    termina al día siguiente. Una vigilia de 22:00 a 01:00 dura tres horas, no
 *    menos veintiuna, y pedirle a quien la carga que escriba la fecha del día
 *    siguiente sería volver a pedirle una cuenta.
 * 2. Cero devuelve `null`, no cero. En esta columna, nulo significa «la
 *    duración de siempre» y cero no existe: lo rechazaría el `check` de la base
 *    con un mensaje que no le dice nada a nadie. Ver la nota de `duracion_min`
 *    en src/lib/panel.ts.
 */
export function minutosEntre(inicio: string, fin: string): number | null {
  const desde = minutosDeHora(inicio.slice(11, 16));
  const hasta = minutosDeHora(fin);
  if (desde === null || hasta === null) return null;
  const diferencia = (hasta - desde + 1440) % 1440;
  return diferencia === 0 ? null : diferencia;
}

/**
 * La hora de término de algo que empieza en `inicio` y dura `minutos`.
 *
 * La cuenta inversa de `minutosEntre`: la usa el formulario para enseñar, en un
 * selector de hora, lo que en la base son minutos. Devuelve «HH:MM» en hora de
 * Chile, o '' si falta cualquiera de los dos.
 */
export function horaDeTermino(inicio: unknown, minutos: unknown): string {
  if (typeof inicio !== 'string' || !inicio) return '';
  const min = Number(minutos);
  if (!Number.isFinite(min) || min <= 0) return '';
  const fin = new Date(new Date(inicio).getTime() + min * 60_000);
  if (Number.isNaN(fin.getTime())) return '';
  return deIsoAChile(fin.toISOString()).slice(11, 16);
}
