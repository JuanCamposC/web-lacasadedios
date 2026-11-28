/** Utilidades de presentación compartidas por los módulos del panel. */
import { enChile } from '../../lib/hora';

export function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function pesoLegible(bytes: number): string {
  return bytes > 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} kB`;
}

/**
 * La fecha que se ve en cada fila del listado del panel.
 *
 * En hora de Chile y en reloj de 24 horas, igual que la web pública: si el
 * panel dijera «7:00 p. m.» y la página «19:00», habría que comprobar dos veces
 * cada evento para creerse que dicen lo mismo. Ver src/lib/hora.ts.
 *
 * (`toLocalInput` vivía aquí y usaba el huso del navegador. Se fue a hora.ts
 * como `deIsoAChile`, que es lo mismo pero anclado a Santiago.)
 */
export function fechaCorta(iso: string | null): string {
  if (!iso) return '';
  return enChile(iso, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
}

/**
 * Un botón dentro del aviso. Hoy solo «Deshacer».
 *
 * Existe porque el deshacer tiene que estar DONDE pasó la cosa. Un «Deshacer»
 * en otra pantalla —la papelera— sirve para arrepentirse al rato; este sirve
 * para el clic equivocado, que es el caso que de verdad asusta.
 */
export interface AccionDeAviso {
  texto: string;
  /** Se llama al pulsarlo. El aviso se cierra solo antes de llamarla. */
  hacer: () => void | Promise<void>;
}

export function toast(
  message: string,
  type: 'success' | 'error' = 'success',
  accion?: AccionDeAviso,
) {
  const c = document.getElementById('toast');
  if (!c) return;
  const el = document.createElement('div');
  const error = type === 'error';
  // Con acción el aviso NO se cierra al tocarlo en cualquier parte: el gesto
  // de cerrarlo y el de deshacer estarían a un píxel de distancia, y errar
  // significaría perder la única oportunidad de recuperar lo borrado.
  el.className = `alert ${error ? 'alert-error' : 'alert-success'} max-w-sm shadow-lg ${
    accion ? 'items-center' : 'cursor-pointer'
  }`;

  const texto = document.createElement('span');
  texto.className = 'flex-1';
  texto.textContent = message;
  el.append(texto);

  if (accion) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-ghost btn-xs shrink-0 underline';
    btn.textContent = accion.texto;
    btn.addEventListener('click', () => {
      el.remove();
      void accion.hacer();
    });
    el.append(btn);

    const cerrar = document.createElement('button');
    cerrar.type = 'button';
    cerrar.className = 'btn btn-ghost btn-xs btn-circle shrink-0';
    cerrar.setAttribute('aria-label', 'Cerrar el aviso');
    cerrar.textContent = '×';
    cerrar.addEventListener('click', () => el.remove());
    el.append(cerrar);
  } else {
    // Los errores explican qué hacer: 3,5 s no alcanzan para leerlos. Se quedan
    // 15 s y se cierran al tocarlos.
    el.addEventListener('click', () => el.remove());
  }

  c.appendChild(el);
  // Con acción, diez segundos: es el tiempo que se tarda en darse cuenta de que
  // se borró lo que no era. Menos convierte el deshacer en una carrera.
  setTimeout(() => el.remove(), accion ? 10000 : error ? 15000 : 3500);
}

/**
 * Abre un `<dialog>` y espera a que se cierre, devolviendo el valor del botón.
 * Sustituye a `confirm()`, que en el teléfono aparece como un aviso del
 * navegador sin contexto ni nombre.
 */
export function preguntar(dlg: HTMLDialogElement, nombre: string): Promise<boolean> {
  dlg.querySelector('[data-nombre]')!.textContent = `«${nombre}»`;
  dlg.showModal();
  return new Promise<string>((r) =>
    dlg.addEventListener('close', () => r(dlg.returnValue), { once: true }),
  ).then((v) => v === 'si');
}
