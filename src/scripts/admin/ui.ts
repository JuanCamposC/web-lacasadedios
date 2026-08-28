/** Utilidades de presentación compartidas por los módulos del panel. */

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

export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function fechaCorta(iso: string | null): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
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
