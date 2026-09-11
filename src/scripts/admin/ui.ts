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

export function toast(message: string, type: 'success' | 'error' = 'success') {
  const c = document.getElementById('toast');
  if (!c) return;
  const el = document.createElement('div');
  const error = type === 'error';
  el.className = `alert ${error ? 'alert-error' : 'alert-success'} max-w-sm cursor-pointer shadow-lg`;
  el.textContent = message;
  // Los errores explican qué hacer: 3,5 s no alcanzan para leerlos. Se quedan
  // 15 s y se cierran al tocarlos.
  el.addEventListener('click', () => el.remove());
  c.appendChild(el);
  setTimeout(() => el.remove(), error ? 15000 : 3500);
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
