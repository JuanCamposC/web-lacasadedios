import { api } from './api';
import { esc, toast, preguntar } from './ui';
import {
  abrirProgramar,
  cargarExcepciones,
  initExcepciones,
  pintarProgramados,
  programadosDe,
  queCambia,
} from './excepciones';
import { templos, estiloDistintivo, type Templo } from '../../data/templos';
import {
  DIAS,
  fechaEnPalabras,
  hoyEnChile,
  proximaFecha,
  proximaVezConMarca,
  reglaEnPalabras,
} from '../../lib/reuniones';

/**
 * El tablero de la semana: administrar los horarios como se leen.
 *
 * ── POR QUÉ NO USA EL CRUD GENÉRICO ─────────────────────────────────────────
 * Lo usaba, y era lo más incómodo del panel por tres razones que ningún campo
 * nuevo arreglaba:
 *
 * 1. UNA REUNIÓN EN CUATRO TEMPLOS ERAN CUATRO FILAS. El estudio bíblico de los
 *    lunes existe en los cuatro, así que crearlo era rellenar el formulario
 *    cuatro veces y cambiarle la hora era editar cuatro filas acordándose de
 *    las cuatro. El sitio público ya las junta en una línea desde el principio
 *    —ver `agrupar` en src/pages/horarios.astro—; el panel las enseñaba
 *    sueltas. Acá se agrupan igual, y las casillas de templo del formulario
 *    crean, actualizan y borran las filas que hagan falta de una sola vez.
 *
 * 2. SUSPENDER EL JUEVES QUE VIENE ERA UN FORMULARIO. Había que abrir la fila,
 *    poner el estado, escribir el aviso y —lo peor— calcular a mano la fecha
 *    del jueves siguiente para la fecha de término. Es la acción más común del
 *    año (feriados, aniversarios, 18 de septiembre) y era la más laboriosa. Y
 *    si se dejaba la fecha vacía, el cambio no caducaba nunca: eso es lo que
 *    dejó seis días de reuniones fantasma en el sitio. Ahora es un botón que
 *    ya sabe qué día es el jueves que viene.
 *
 * 3. NO SE VEÍA LA SEMANA. El listado ordenaba por templo, así que la pregunta
 *    «¿cómo queda la semana?» obligaba a leer dieciséis filas y reconstruirla
 *    de memoria. Era justo lo que el cartel del sitio hace de un vistazo.
 *
 * ── DÓNDE VIVE AHORA EL CAMBIO PASAJERO ─────────────────────────────────────
 * Fuera del formulario, entero. El formulario describe lo que la reunión ES
 * —templos, día, hora, nombre, qué se celebra— y eso se toca cuando cambia de
 * verdad. Lo de «solo esta vez» es una ACCIÓN sobre una reunión que ya existe,
 * y vive en el menú de su línea. Tenerlo en los dos sitios era lo que obligaba
 * a entender cuatro campos para suspender una reunión.
 */

/** Una línea del tablero: la misma reunión en uno o varios templos. */
interface Grupo {
  /** Los ids de las filas que la componen, uno por templo. */
  ids: string[];
  sedes: Templo[];
  dia: number;
  hora: string;
  nombre: string;
  estado: 'normal' | 'suspendida' | 'cambiada';
  aviso: string | null;
  aviso_hasta: string | null;
  hora_aviso: string | null;
  marca: string | null;
  marca_regla: string | null;
  publicado: number;
}

type FilaReunion = {
  id: string;
  templo: string;
  dia: number;
  hora: string;
  nombre: string;
  estado: Grupo['estado'];
  aviso: string | null;
  aviso_hasta: string | null;
  hora_aviso: string | null;
  marca: string | null;
  marca_regla: string | null;
  publicado: number;
};

const temploDe = (slug: string) => templos.find((t) => t.slug === slug);
const ordenTemplos = templos.map((t) => t.slug);

/**
 * Junta en una línea las filas que son la misma reunión en distintos templos.
 *
 * Todo lo que puede diferir entra en la clave, no solo el día y la hora: si en
 * San Miguel se suspende la del domingo y en Limache no, son dos cosas
 * distintas y no pueden compartir línea, porque la línea diría que las dos
 * están suspendidas. Es la misma regla que usa el sitio público.
 */
function agrupar(filas: FilaReunion[]): Grupo[] {
  const mapa = new Map<string, Grupo>();

  for (const f of filas) {
    const sede = temploDe(f.templo);
    if (!sede) continue; // un templo que ya no existe: no se pinta, no se pierde
    const clave = [
      f.dia,
      f.hora,
      f.nombre,
      f.estado,
      f.aviso ?? '',
      f.aviso_hasta ?? '',
      f.hora_aviso ?? '',
      f.marca ?? '',
      f.marca_regla ?? '',
      f.publicado,
    ].join('|');

    const grupo = mapa.get(clave);
    if (grupo) {
      grupo.ids.push(f.id);
      grupo.sedes.push(sede);
    } else {
      mapa.set(clave, {
        ids: [f.id],
        sedes: [sede],
        dia: f.dia,
        hora: f.hora,
        nombre: f.nombre,
        estado: f.estado,
        aviso: f.aviso,
        aviso_hasta: f.aviso_hasta,
        hora_aviso: f.hora_aviso,
        marca: f.marca,
        marca_regla: f.marca_regla,
        publicado: f.publicado,
      });
    }
  }

  // Las sedes en el orden en que están los templos en el sitio, para que la
  // misma reunión no cambie de orden de un día a otro.
  return [...mapa.values()]
    .map((g) => ({
      ...g,
      sedes: g.sedes.sort((a, b) => ordenTemplos.indexOf(a.slug) - ordenTemplos.indexOf(b.slug)),
    }))
    .sort((a, b) => a.dia - b.dia || a.hora.localeCompare(b.hora));
}

/* ── Estado de la pantalla ──────────────────────────────────────────────── */

let filas: FilaReunion[] = [];
let grupos: Grupo[] = [];
/** La línea que se está editando, por su clave de grupo. `null` = una nueva. */
let editando: Grupo | null = null;

const el = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel);

/* ── El tablero ─────────────────────────────────────────────────────────── */

const ESTADO_TEXTO: Record<string, string> = {
  suspendida: 'Suspendida',
  cambiada: 'Cambio de horario',
};

/** El menú de una línea: lo que se puede hacer con esa reunión. */
function menuDe(g: Grupo, indice: number): string {
  const proxima = proximaFecha(g.dia, hoyEnChile());
  const cuando = fechaEnPalabras(proxima);

  const normal = `
    <li><button type="button" class="block w-full rounded px-3 py-2 text-left text-[0.8125rem] transition-colors hover:bg-base-200" data-accion="suspender">
      Suspender solo el ${esc(cuando)}
    </button></li>
    <li class="px-3 py-2">
      <span class="block text-xs font-medium">Cambiar la hora solo el ${esc(cuando)}</span>
      <span class="mt-1 flex gap-1">
        <input type="time" value="${esc(g.hora)}" data-nueva-hora
          class="input input-bordered input-xs w-full" aria-label="Hora nueva, solo esa vez" />
        <button type="button" class="btn btn-primary btn-xs" data-accion="mover">Aplicar</button>
      </span>
    </li>`;

  const conCambio = `
    <li><button type="button" class="block w-full rounded px-3 py-2 text-left text-[0.8125rem] transition-colors hover:bg-base-200" data-accion="quitar">
      Quitar el cambio · vuelve a la normalidad
    </button></li>
    <li class="px-3 py-2">
      <span class="block text-xs font-medium">Qué decirle a la gente</span>
      <span class="mt-1 flex gap-1">
        <input type="text" value="${esc(g.aviso ?? '')}" data-aviso
          placeholder="Suspendida por el feriado"
          class="input input-bordered input-xs w-full" aria-label="Mensaje del aviso" />
        <button type="button" class="btn btn-primary btn-xs" data-accion="mensaje">Guardar</button>
      </span>
    </li>`;

  return `
    <details class="dropdown dropdown-end" data-menu>
      <summary class="btn btn-ghost btn-xs list-none [&::-webkit-details-marker]:hidden"
        aria-label="Qué hacer con esta reunión">⋯</summary>
      <ul class="dropdown-content z-30 mt-1 w-72 rounded border border-base-300 bg-base-100 p-1 shadow-xl"
          data-grupo="${indice}">
        <li><button type="button" class="block w-full rounded px-3 py-2 text-left text-[0.8125rem] transition-colors hover:bg-base-200" data-accion="editar">Editar la reunión</button></li>
        <li><div class="my-1 h-px bg-base-300"></div></li>
        ${g.estado === 'normal' ? normal : conCambio}
        <li><button type="button" class="block w-full rounded px-3 py-2 text-left text-[0.8125rem] transition-colors hover:bg-base-200" data-accion="programar">
          Programar un cambio para otra fecha…
        </button></li>
        <li><div class="my-1 h-px bg-base-300"></div></li>
        <li><button type="button" class="block w-full rounded px-3 py-2 text-left text-[0.8125rem] transition-colors hover:bg-base-200 text-error" data-accion="borrar">
          Borrar la reunión${g.sedes.length > 1 ? ` de los ${g.sedes.length} templos` : ''}
        </button></li>
      </ul>
    </details>`;
}

/** Una línea del tablero. */
function lineaDe(g: Grupo, indice: number): string {
  const sellos = g.sedes
    .map(
      (t) => `<span class="distintivo" style="${esc(estiloDistintivo(t))}">${esc(t.short)}</span>`,
    )
    .join('');

  // Con una hora pasajera puesta se enseñan las dos: «17:30 → 18:00». Si solo
  // se viera la de siempre, el panel diría una hora y el sitio otra.
  const hora =
    g.estado === 'cambiada' && g.hora_aviso
      ? `<span class="font-data text-base leading-none text-base-content/50 line-through">${esc(g.hora)}</span>
         <span class="font-data text-lg font-bold leading-none text-warning">${esc(g.hora_aviso)}</span>`
      : `<span class="font-data text-lg font-bold leading-none ${g.estado === 'suspendida' ? 'text-base-content/50 line-through' : ''}">${esc(g.hora)}</span>`;

  const aviso =
    g.estado !== 'normal'
      ? `<p class="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-warning">
           <span class="font-semibold">${esc(ESTADO_TEXTO[g.estado] ?? g.estado)}</span>
           ${g.aviso ? `<span>· ${esc(g.aviso)}</span>` : ''}
           ${
             g.aviso_hasta
               ? `<span>· vuelve sola el ${esc(fechaEnPalabras(elDiaDespues(g.aviso_hasta)))}</span>`
               : `<span class="font-semibold text-error">· SIN fecha de término: no se quita solo</span>`
           }
         </p>`
      : '';

  return `<li class="flex items-start gap-3 border-b border-base-300/70 px-3 py-2.5 last:border-0 ${
    g.publicado ? '' : 'opacity-60'
  }" data-linea="${indice}">
      <span class="flex w-16 shrink-0 flex-col items-end gap-0.5 pt-0.5">${hora}</span>
      <span class="min-w-0 flex-1">
        <span class="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span class="text-sm font-semibold">${esc(g.nombre)}</span>
          ${g.marca ? `<span class="badge badge-sm badge-warning">${esc(g.marca)}</span>` : ''}
          ${g.publicado ? '' : '<span class="badge badge-sm badge-ghost">No se muestra</span>'}
        </span>
        <span class="mt-1 flex flex-wrap gap-1">${sellos}</span>
        ${aviso}
        ${notaProgramados(g)}
        ${
          g.marca && g.marca_regla
            ? `<p class="mt-1 text-xs text-base-content/60">«${esc(g.marca)}» ${esc(reglaEnPalabras(g.marca_regla, g.dia))}</p>`
            : ''
        }
      </span>
      ${menuDe(g, indice)}
    </li>`;
}

/**
 * «Programado: 24 dic suspendida · 31 dic a las 19:00», bajo la línea.
 *
 * Sin esto, quien mira el tablero en noviembre no sabe que diciembre ya está
 * cargado, y lo vuelve a cargar o, peor, cambia la reunión de verdad.
 */
function notaProgramados(g: Grupo): string {
  const suyos = programadosDe(g);
  if (suyos.length === 0) return '';
  const corto = new Intl.DateTimeFormat('es-CL', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
  const partes = suyos.map(
    (e) =>
      `${corto.format(new Date(`${e.fecha}T12:00:00Z`)).replace('.', '')}: ${queCambia(e, g).replace(/^./, (c) => c.toLowerCase())}`,
  );
  return `<p class="mt-1 text-xs text-info">Programado · ${esc(partes.join(' · '))}</p>`;
}

/** El día siguiente a una fecha de Chile, «AAAA-MM-DD». */
function elDiaDespues(fecha: string): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function pintarTablero() {
  const caja = el('#tablero');
  if (!caja) return;

  if (grupos.length === 0) {
    caja.innerHTML = `<div class="panel p-8 text-center text-sm text-base-content/70">
        Todavía no hay reuniones cargadas. Crea la primera con el formulario.
      </div>`;
    return;
  }

  const hoyIndice = new Date(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date()) +
      'T12:00:00Z',
  ).getUTCDay();

  // Los siete días, siempre, también los vacíos: un día sin reuniones es un
  // dato —«los viernes no hay nada»— y esconderlo obliga a contar para saberlo.
  const dias = DIAS.map((nombre, i) => {
    const suyos = grupos.filter((g) => g.dia === i);
    const esHoy = i === hoyIndice;
    const cuerpo =
      suyos.length === 0
        ? `<li class="px-3 py-3 text-xs text-base-content/55">Sin reuniones</li>`
        : suyos.map((g) => lineaDe(g, grupos.indexOf(g))).join('');
    const reuniones = suyos.reduce((n, g) => n + g.sedes.length, 0);

    return `<section class="panel ${esHoy ? 'border-accent/50' : ''}">
        <header class="flex items-baseline justify-between gap-3 rounded-t-[calc(0.5rem-1px)] border-b border-base-300 bg-base-200/60 px-3 py-2">
          <h2 class="font-data text-xs font-bold uppercase tracking-[0.14em]">
            ${esc(nombre)}${esHoy ? ' <span class="text-accent">· hoy</span>' : ''}
          </h2>
          <span class="font-data text-xs text-base-content/60">
            ${reuniones} ${reuniones === 1 ? 'reunión' : 'reuniones'}
          </span>
        </header>
        <ul>${cuerpo}</ul>
      </section>`;
  }).join('');

  caja.innerHTML = `<div class="space-y-3">${dias}</div>`;
  engancharLineas();
}

/* ── Acciones de cada línea ─────────────────────────────────────────────── */

/** Aplica unos cambios a TODAS las filas de un grupo, y recarga. */
async function aplicarAlGrupo(g: Grupo, cambios: Record<string, unknown>, aviso: string) {
  try {
    // En serie y no en paralelo: son como mucho cuatro filas, y D1 con cuatro
    // escrituras simultáneas sobre la misma tabla responde con «database is
    // locked» lo bastante a menudo como para no arriesgarlo por 300 ms.
    for (const id of g.ids) await api.actualizar('reuniones', id, cambios);
  } catch (e) {
    return toast('No se pudo guardar: ' + (e as Error).message, 'error');
  }
  await cargar();
  toast(aviso);
}

/**
 * Suspende la reunión SOLO la próxima vez que toca.
 *
 * Las dos cosas que esto resuelve de una vez: la fecha de término la calcula el
 * panel —nadie tiene que mirar un calendario para saber cuándo cae el jueves
 * que viene— y nunca queda vacía, que es el error que no se nota hasta que
 * alguien pregunta por qué la web dice que la reunión sigue suspendida.
 */
async function suspender(g: Grupo) {
  const proxima = proximaFecha(g.dia, hoyEnChile());
  await aplicarAlGrupo(
    g,
    { estado: 'suspendida', aviso_hasta: proxima, hora_aviso: null },
    `Suspendida el ${fechaEnPalabras(proxima)}. Vuelve sola el ${fechaEnPalabras(elDiaDespues(proxima))}.`,
  );
}

/** Mueve la hora SOLO la próxima vez que toca. La de siempre no se toca. */
async function mover(g: Grupo, nueva: string) {
  if (!/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/.test(nueva)) {
    return toast('Esa no es una hora. Tiene que ser como 18:00.', 'error');
  }
  if (nueva === g.hora) {
    return toast('Esa es la hora que ya tiene. No hay nada que cambiar.', 'error');
  }
  const proxima = proximaFecha(g.dia, hoyEnChile());
  await aplicarAlGrupo(
    g,
    { estado: 'cambiada', hora_aviso: nueva, aviso_hasta: proxima },
    `El ${fechaEnPalabras(proxima)} será a las ${nueva}. Después vuelve sola a las ${g.hora}.`,
  );
}

/** Deshace el cambio pasajero: la reunión vuelve a ser la de siempre. */
async function quitarCambio(g: Grupo) {
  await aplicarAlGrupo(
    g,
    { estado: 'normal', aviso: null, aviso_hasta: null, hora_aviso: null },
    'Listo: la reunión vuelve a su horario de siempre.',
  );
}

/** Cambia solo la frase que ve la gente, sin tocar el estado ni las fechas. */
async function mensaje(g: Grupo, texto: string) {
  await aplicarAlGrupo(
    g,
    { aviso: texto.trim() || null },
    texto.trim() ? 'Mensaje guardado.' : 'Mensaje quitado: el sitio dirá solo el estado.',
  );
}

/** Manda a la papelera todas las filas del grupo, con deshacer. */
async function borrarGrupo(g: Grupo) {
  const dlg = el<HTMLDialogElement>('#dlg-borrar');
  const nombre = `${g.nombre} · ${DIAS[g.dia]} ${g.hora}`;
  if (dlg && !(await preguntar(dlg, nombre))) return;

  const ids = [...g.ids];
  try {
    for (const id of ids) await api.borrar('reuniones', id);
  } catch (e) {
    return toast('No se pudo borrar: ' + (e as Error).message, 'error');
  }
  await cargar();

  toast('Se fue a la papelera', 'success', {
    texto: 'Deshacer',
    hacer: async () => {
      try {
        for (const id of ids) await api.restaurar('reuniones', id);
      } catch (e) {
        return toast(
          'No se pudo deshacer: ' + (e as Error).message + ' Está en la papelera del panel.',
          'error',
        );
      }
      await cargar();
      toast(`«${g.nombre}» volvió a su sitio`);
    },
  });
}

function engancharLineas() {
  document.querySelectorAll<HTMLElement>('[data-grupo]').forEach((menu) => {
    const g = grupos[Number(menu.dataset.grupo)];
    if (!g) return;
    const cerrar = () => menu.closest('details')?.removeAttribute('open');

    menu.querySelectorAll<HTMLElement>('[data-accion]').forEach((btn) =>
      btn.addEventListener('click', async () => {
        const accion = btn.dataset.accion;
        cerrar();
        if (accion === 'editar') return rellenarForm(g);
        if (accion === 'programar') return abrirProgramar(g);
        if (accion === 'suspender') return suspender(g);
        if (accion === 'quitar') return quitarCambio(g);
        if (accion === 'borrar') return borrarGrupo(g);
        if (accion === 'mover') {
          const campo = menu.querySelector<HTMLInputElement>('[data-nueva-hora]');
          return mover(g, campo?.value ?? '');
        }
        if (accion === 'mensaje') {
          const campo = menu.querySelector<HTMLInputElement>('[data-aviso]');
          return mensaje(g, campo?.value ?? '');
        }
      }),
    );
  });

  // Un menú abierto cierra los demás, y un clic fuera los cierra todos. Es lo
  // mismo que hace la barra del sitio público (ver Navigation.astro).
  document.querySelectorAll<HTMLDetailsElement>('[data-menu]').forEach((d) =>
    d.addEventListener('toggle', () => {
      if (!d.open) return;
      document
        .querySelectorAll<HTMLDetailsElement>('[data-menu][open]')
        .forEach((otro) => otro !== d && otro.removeAttribute('open'));
    }),
  );
}

/* ── El formulario ──────────────────────────────────────────────────────── */

function rellenarForm(g: Grupo | null) {
  const form = el<HTMLFormElement>('#form-reunion');
  if (!form) return;
  editando = g;

  const titulo = el('#form-titulo');
  const cancelar = el('#form-cancelar');
  if (titulo) titulo.textContent = g ? 'Editando la reunión' : 'Nueva reunión';
  cancelar?.classList.toggle('hidden', !g);

  form.querySelectorAll<HTMLInputElement>('[name="templos"]').forEach((c) => {
    c.checked = g ? g.sedes.some((t) => t.slug === c.value) : false;
  });
  (form.elements.namedItem('dia') as HTMLSelectElement).value = String(g?.dia ?? 0);
  (form.elements.namedItem('hora') as HTMLInputElement).value = g?.hora ?? '';
  (form.elements.namedItem('nombre') as HTMLInputElement).value = g?.nombre ?? '';
  (form.elements.namedItem('marca') as HTMLInputElement).value = g?.marca ?? '';
  (form.elements.namedItem('marca_regla') as HTMLSelectElement).value = g?.marca_regla ?? '';
  (form.elements.namedItem('publicado') as HTMLInputElement).checked = g ? g.publicado === 1 : true;

  pintarPreviaMarca();
  form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/**
 * La línea que traduce la periodicidad de una marca a una fecha.
 *
 * «El primero de los meses pares» es correcto y no se entiende hasta que se
 * convierte en «la próxima vez: el domingo 1 de febrero de 2026». Y avisa de
 * las dos formas de rellenarlo mal, que son silenciosas: una marca sin
 * periodicidad no se ve nunca, y una periodicidad sin marca no dice nada.
 */
function pintarPreviaMarca() {
  const form = el<HTMLFormElement>('#form-reunion');
  const linea = el('#previa-marca');
  if (!form || !linea) return;

  const texto = (form.elements.namedItem('marca') as HTMLInputElement).value.trim();
  const regla = (form.elements.namedItem('marca_regla') as HTMLSelectElement).value;
  const dia = Number((form.elements.namedItem('dia') as HTMLSelectElement).value);

  if (!texto && !regla) {
    linea.textContent = '';
    linea.className = 'mt-1 text-xs';
    return;
  }
  if (texto && !regla) {
    linea.textContent = 'Falta decir cada cuánto: así escrito no se va a ver nunca.';
    linea.className = 'mt-1 text-xs text-warning';
    return;
  }
  if (!texto && regla) {
    linea.textContent = 'Falta escribir qué pasa ese día.';
    linea.className = 'mt-1 text-xs text-warning';
    return;
  }

  const proxima = proximaVezConMarca(dia, regla, hoyEnChile());
  linea.textContent = proxima
    ? `«${texto}» se verá ${reglaEnPalabras(regla, dia)}. La próxima vez: ${fechaEnPalabras(proxima)}.`
    : `«${texto}» se verá ${reglaEnPalabras(regla, dia)}.`;
  linea.className = 'mt-1 text-xs text-success';
}

/**
 * Guarda la reunión en todos los templos marcados.
 *
 * ── LAS TRES COSAS QUE PASAN A LA VEZ ───────────────────────────────────────
 * Una línea del tablero son varias filas de la base, una por templo, así que
 * guardar significa comparar lo que había con lo que se marcó:
 *
 *   · Templo que ya la tenía y sigue marcado  → se actualiza su fila.
 *   · Templo recién marcado                   → se crea una fila.
 *   · Templo que la tenía y se desmarcó       → su fila va a la papelera.
 *
 * Ese último caso es el que hace que desmarcar un templo sea una operación
 * segura: no se pierde nada, queda 30 días recuperable (ver d1/0014_papelera).
 *
 * El cambio pasajero NO se toca acá: si la reunión estaba suspendida y se le
 * corrige el nombre, sigue suspendida. Son dos cosas distintas y mezclarlas
 * haría que arreglar una falta de ortografía reactivara una reunión.
 */
async function guardar(e: Event) {
  e.preventDefault();
  const form = el<HTMLFormElement>('#form-reunion');
  const boton = el<HTMLButtonElement>('#form-guardar');
  if (!form || !boton) return;

  const marcados = [...form.querySelectorAll<HTMLInputElement>('[name="templos"]:checked')].map(
    (c) => c.value,
  );
  if (marcados.length === 0) {
    return toast('Elige al menos un templo: sin eso la reunión no va a ninguna parte.', 'error');
  }

  const comun = {
    dia: Number((form.elements.namedItem('dia') as HTMLSelectElement).value),
    hora: (form.elements.namedItem('hora') as HTMLInputElement).value,
    nombre: (form.elements.namedItem('nombre') as HTMLInputElement).value.trim(),
    marca: (form.elements.namedItem('marca') as HTMLInputElement).value.trim() || null,
    marca_regla: (form.elements.namedItem('marca_regla') as HTMLSelectElement).value || null,
    publicado: (form.elements.namedItem('publicado') as HTMLInputElement).checked,
  };

  boton.disabled = true;
  boton.textContent = 'Guardando…';
  try {
    // Qué fila tiene cada templo hoy, para esta línea.
    const porTemplo = new Map<string, string>();
    if (editando) {
      for (const id of editando.ids) {
        const fila = filas.find((f) => f.id === id);
        if (fila) porTemplo.set(fila.templo, fila.id);
      }
    }

    for (const slug of marcados) {
      const id = porTemplo.get(slug);
      if (id) await api.actualizar('reuniones', id, comun);
      else await api.crear('reuniones', { ...comun, templo: slug });
    }

    const quitados = [...porTemplo.entries()].filter(([slug]) => !marcados.includes(slug));
    for (const [, id] of quitados) await api.borrar('reuniones', id);

    const cuantos = marcados.length;
    await cargar();
    rellenarForm(null);
    toast(
      editando
        ? `Guardada en ${cuantos} ${cuantos === 1 ? 'templo' : 'templos'}${
            quitados.length ? ` · quitada de ${quitados.length}` : ''
          }`
        : `Creada en ${cuantos} ${cuantos === 1 ? 'templo' : 'templos'}`,
    );
  } catch (err) {
    toast('No se pudo guardar: ' + (err as Error).message, 'error');
  } finally {
    boton.disabled = false;
    boton.textContent = 'Guardar';
  }
}

/* ── Arranque ───────────────────────────────────────────────────────────── */

async function cargar() {
  const caja = el('#tablero');
  try {
    // Los cambios programados primero: cada línea del tablero anota los suyos.
    [filas] = await Promise.all([api.listar<FilaReunion>('reuniones'), cargarExcepciones()]);
  } catch (e) {
    if (caja)
      caja.innerHTML = `<div class="alert alert-error text-sm">No se pudo cargar: ${esc((e as Error).message)}</div>`;
    return;
  }
  grupos = agrupar(filas);
  pintarTablero();
  pintarProgramados(filas);
}

export function initHorarios() {
  const form = el<HTMLFormElement>('#form-reunion');
  if (!form) return;

  form.addEventListener('submit', guardar);
  form.addEventListener('input', pintarPreviaMarca);
  form.addEventListener('change', pintarPreviaMarca);
  el('#form-cancelar')?.addEventListener('click', () => rellenarForm(null));
  el('#form-nueva')?.addEventListener('click', () => {
    rellenarForm(null);
    (form.elements.namedItem('nombre') as HTMLInputElement)?.focus();
  });

  initExcepciones(cargar);
  rellenarForm(null);
  cargar();
}
