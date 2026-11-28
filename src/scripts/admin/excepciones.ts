import { api } from './api';
import { esc, toast } from './ui';
import { templos, estiloDistintivo } from '../../data/templos';
import { DIAS, fechaEnPalabras, hoyEnChile } from '../../lib/reuniones';

/**
 * Los cambios de UN día, programados con antelación.
 *
 * El menú de cada línea ya sabe suspender o mover «la próxima vez». Esto es
 * para lo otro: diciembre entero cargado a fines de noviembre. Suspender el
 * jueves 24 con el aviso de siempre suspendía también el 3, el 10 y el 17,
 * porque ese aviso significa «desde ahora hasta tal día». Una fila de
 * `excepciones` significa «ese día y ningún otro» (ver d1/0016).
 *
 * Como en el resto del tablero, una línea puede ser la misma reunión en varios
 * templos: el cambio se guarda una vez por templo y se enseña junto.
 */

export interface FilaExcepcion {
  id: string;
  reunion_id: string;
  fecha: string;
  estado: 'suspendida' | 'cambiada';
  hora: string | null;
  nombre: string | null;
  aviso: string | null;
}

/** Lo mínimo que este módulo necesita saber de una línea del tablero. */
export interface LineaReunion {
  ids: string[];
  dia: number;
  hora: string;
  nombre: string;
}

interface FilaMinima {
  id: string;
  templo: string;
  dia: number;
  hora: string;
  nombre: string;
}

const el = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel);

/** El día de la semana de una fecha «AAAA-MM-DD», con el domingo en 0. */
const diaDe = (fecha: string) => new Date(`${fecha}T12:00:00Z`).getUTCDay();

/** Qué pasa ese día, dicho corto, para la lista y para el tablero. */
export function queCambia(e: FilaExcepcion, habitual: { hora: string; nombre: string }): string {
  if (e.estado === 'suspendida') return 'Suspendida';
  const partes: string[] = [];
  if (e.nombre && e.nombre !== habitual.nombre) partes.push(`se llama «${e.nombre}»`);
  if (e.hora && e.hora !== habitual.hora) partes.push(`a las ${e.hora}`);
  return partes.length ? `Cambia: ${partes.join(', ')}` : 'Cambia (solo el mensaje)';
}

/* ── El diálogo ─────────────────────────────────────────────────────────── */

let linea: LineaReunion | null = null;
let alGuardar: () => Promise<void> = async () => {};
let todas: FilaExcepcion[] = [];

/** Abre el diálogo para programar un cambio a una línea del tablero. */
export function abrirProgramar(l: LineaReunion) {
  const dlg = el<HTMLDialogElement>('#dlg-excepcion');
  const form = el<HTMLFormElement>('#form-excepcion');
  if (!dlg || !form) return;
  linea = l;

  el('#exc-reunion')!.textContent = `${l.nombre} · ${DIAS[l.dia]} ${l.hora}`;
  form.reset();
  const fecha = form.elements.namedItem('fecha') as HTMLInputElement;
  fecha.min = hoyEnChile();
  (form.elements.namedItem('hora') as HTMLInputElement).value = l.hora;
  (form.elements.namedItem('nombre') as HTMLInputElement).placeholder = l.nombre;
  pintarPrevia();
  dlg.showModal();
  fecha.focus();
}

/** La línea bajo la fecha: qué día es, y si no calza con la reunión. */
function pintarPrevia() {
  const form = el<HTMLFormElement>('#form-excepcion');
  const previa = el('#exc-previa');
  if (!form || !previa || !linea) return;

  const estado = (form.elements.namedItem('estado') as RadioNodeList).value;
  el('#exc-solo-cambio')?.classList.toggle('hidden', estado !== 'cambiada');

  const fecha = (form.elements.namedItem('fecha') as HTMLInputElement).value;
  if (!fecha) {
    previa.textContent = `Elige un ${DIAS[linea.dia].toLowerCase()}.`;
    previa.className = 'mt-1 block text-xs text-base-content/70';
    return;
  }
  if (diaDe(fecha) !== linea.dia) {
    previa.textContent = `Esa fecha es ${DIAS[diaDe(fecha)].toLowerCase()}, y esta reunión es los ${DIAS[linea.dia].toLowerCase()}.`;
    previa.className = 'mt-1 block text-xs text-error';
    return;
  }
  previa.textContent = fechaEnPalabras(fecha);
  previa.className = 'mt-1 block text-xs text-success first-letter:uppercase';
}

async function guardar(e: Event) {
  e.preventDefault();
  const form = el<HTMLFormElement>('#form-excepcion');
  const dlg = el<HTMLDialogElement>('#dlg-excepcion');
  const boton = el<HTMLButtonElement>('#exc-guardar');
  if (!form || !dlg || !boton || !linea) return;

  const fecha = (form.elements.namedItem('fecha') as HTMLInputElement).value;
  const estado = (form.elements.namedItem('estado') as RadioNodeList).value as
    'suspendida' | 'cambiada';
  const hora = (form.elements.namedItem('hora') as HTMLInputElement).value;
  const nombre = (form.elements.namedItem('nombre') as HTMLInputElement).value.trim();
  const aviso = (form.elements.namedItem('aviso') as HTMLInputElement).value.trim();

  if (!fecha) return toast('Falta la fecha.', 'error');
  if (fecha < hoyEnChile()) return toast('Esa fecha ya pasó.', 'error');
  if (diaDe(fecha) !== linea.dia) {
    return toast(`Esa fecha no es ${DIAS[linea.dia].toLowerCase()}.`, 'error');
  }
  if (estado === 'cambiada' && hora === linea.hora && (!nombre || nombre === linea.nombre)) {
    return toast(
      'Así no cambia nada: pon otra hora u otro nombre, o elige «Se suspende».',
      'error',
    );
  }

  const datos = {
    fecha,
    estado,
    // Solo se guarda lo que de verdad cambia: «la de siempre» es nulo, para que
    // si mañana se edita la hora habitual el cambio no arrastre la vieja.
    hora: estado === 'cambiada' && hora !== linea.hora ? hora : null,
    nombre: estado === 'cambiada' && nombre && nombre !== linea.nombre ? nombre : null,
    aviso: aviso || null,
  };

  boton.disabled = true;
  try {
    for (const id of linea.ids) {
      // Un cambio por reunión y día (`unique` en la base): si ya había uno, se
      // reemplaza en vez de chocar.
      const previa = todas.find((x) => x.reunion_id === id && x.fecha === fecha);
      if (previa) await api.actualizar('excepciones', previa.id, datos);
      else await api.crear('excepciones', { ...datos, reunion_id: id });
    }
  } catch (err) {
    return toast('No se pudo guardar: ' + (err as Error).message, 'error');
  } finally {
    boton.disabled = false;
  }

  dlg.close();
  await alGuardar();
  toast(`Programado para el ${fechaEnPalabras(fecha)}.`);
}

/* ── La lista de lo programado ──────────────────────────────────────────── */

interface Bloque {
  ids: string[];
  fecha: string;
  muestra: FilaExcepcion;
  reunion: FilaMinima;
  templos: string[];
}

/**
 * Junta en un bloque el mismo cambio en varios templos, igual que el tablero
 * junta la misma reunión.
 */
function agrupar(excepciones: FilaExcepcion[], filas: FilaMinima[]): Bloque[] {
  const mapa = new Map<string, Bloque>();
  for (const e of excepciones) {
    const r = filas.find((f) => f.id === e.reunion_id);
    if (!r) continue; // reunión en la papelera: el cambio no se aplica a nada
    const clave = [
      e.fecha,
      r.dia,
      r.hora,
      r.nombre,
      e.estado,
      e.hora ?? '',
      e.nombre ?? '',
      e.aviso ?? '',
    ].join('|');
    const b = mapa.get(clave);
    if (b) {
      b.ids.push(e.id);
      b.templos.push(r.templo);
    } else {
      mapa.set(clave, { ids: [e.id], fecha: e.fecha, muestra: e, reunion: r, templos: [r.templo] });
    }
  }
  return [...mapa.values()].sort(
    (a, b) => a.fecha.localeCompare(b.fecha) || a.reunion.hora.localeCompare(b.reunion.hora),
  );
}

function pintarLista(filas: FilaMinima[]) {
  const caja = el('#programados');
  if (!caja) return;
  const hoy = hoyEnChile();
  const bloques = agrupar(
    todas.filter((e) => e.fecha >= hoy),
    filas,
  );

  if (bloques.length === 0) {
    caja.innerHTML = `<p class="px-3 py-3 text-xs text-base-content/60">
        Nada programado. Usa «Programar un cambio para otra fecha» en el menú de una reunión.
      </p>`;
    return;
  }

  caja.innerHTML = `<ul>${bloques
    .map((b, i) => {
      const sellos = b.templos
        .map((slug) => templos.find((t) => t.slug === slug))
        .filter((t): t is NonNullable<typeof t> => t !== undefined)
        .map(
          (t) =>
            `<span class="distintivo" style="${esc(estiloDistintivo(t))}">${esc(t.short)}</span>`,
        )
        .join('');
      const color = b.muestra.estado === 'suspendida' ? 'text-error' : 'text-warning';
      return `<li class="flex items-start gap-3 border-b border-base-300/70 px-3 py-2.5 last:border-0">
          <span class="min-w-0 flex-1">
            <span class="block text-xs font-semibold first-letter:uppercase">${esc(fechaEnPalabras(b.fecha))}</span>
            <span class="mt-0.5 block text-sm">${esc(b.reunion.nombre)} · ${esc(b.reunion.hora)}</span>
            <span class="mt-0.5 block text-xs font-medium ${color}">${esc(queCambia(b.muestra, b.reunion))}</span>
            ${b.muestra.aviso ? `<span class="block text-xs text-base-content/70">«${esc(b.muestra.aviso)}»</span>` : ''}
            <span class="mt-1 flex flex-wrap gap-1">${sellos}</span>
          </span>
          <button type="button" class="btn btn-ghost btn-xs text-error" data-quitar-exc="${i}">Quitar</button>
        </li>`;
    })
    .join('')}</ul>`;

  caja.querySelectorAll<HTMLButtonElement>('[data-quitar-exc]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const b = bloques[Number(btn.dataset.quitarExc)];
      if (!b) return;
      btn.disabled = true;
      try {
        for (const id of b.ids) await api.borrar('excepciones', id);
      } catch (err) {
        btn.disabled = false;
        return toast('No se pudo quitar: ' + (err as Error).message, 'error');
      }
      await alGuardar();
      toast(`Quitado: el ${fechaEnPalabras(b.fecha)} la reunión vuelve a ser la de siempre.`);
    }),
  );
}

/** Los cambios programados de una línea, para anotarlos en el tablero. */
export function programadosDe(l: LineaReunion): FilaExcepcion[] {
  const hoy = hoyEnChile();
  const vistas = new Set<string>();
  return todas
    .filter((e) => l.ids.includes(e.reunion_id) && e.fecha >= hoy)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .filter((e) => (vistas.has(e.fecha) ? false : (vistas.add(e.fecha), true)));
}

/**
 * Carga los cambios. Se llama ANTES de pintar el tablero, para que cada línea
 * pueda anotar los suyos.
 */
export async function cargarExcepciones(): Promise<void> {
  todas = await api.listar<FilaExcepcion>('excepciones');
}

/** Pinta la lista de lo programado. Se llama DESPUÉS de cargar las reuniones. */
export function pintarProgramados(filas: FilaMinima[]) {
  pintarLista(filas);
}

export function initExcepciones(recargar: () => Promise<void>) {
  alGuardar = recargar;
  const form = el<HTMLFormElement>('#form-excepcion');
  if (!form) return;
  form.addEventListener('submit', guardar);
  form.addEventListener('input', pintarPrevia);
  form.addEventListener('change', pintarPrevia);
  el('#exc-cancelar')?.addEventListener('click', () =>
    el<HTMLDialogElement>('#dlg-excepcion')?.close(),
  );
}
