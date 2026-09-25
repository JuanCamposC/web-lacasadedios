import type { Contexto, Fila } from './tipos';
import { esc } from './ui';
import { deChileAIso, deIsoAChile } from '../../lib/hora';
import { subirImagen } from './upload';

export function resetForm(ctx: Contexto) {
  const { form, formTitle, cancelBtn, formCard, config, listEl } = ctx;

  form.reset();
  ctx.editing = null;
  (form.querySelector('[name="id"]') as HTMLInputElement).value = '';
  formTitle.textContent = `${ctx.articulo} ${config.singular}`;
  cancelBtn.classList.add('hidden');
  formCard.classList.remove('ring-2', 'ring-primary/40');
  ctx.imagenesListas.clear();

  config.fields.forEach((f) => {
    if (f.type === 'checkbox')
      (form.querySelector(`[name="${f.name}"]`) as HTMLInputElement).checked = true;
    if (f.type === 'image') {
      const prev = ctx.root.querySelector(`[data-preview="${f.name}"]`);
      if (prev) prev.innerHTML = '';
    }
  });

  listEl
    .querySelectorAll('[data-fila]')
    .forEach((el) => el.classList.remove('ring-2', 'ring-primary/40'));
}

export function startEdit(ctx: Contexto, row: Fila) {
  const { form, formTitle, cancelBtn, formCard, config, listEl } = ctx;

  ctx.editing = row;
  (form.querySelector('[name="id"]') as HTMLInputElement).value = row.id;
  formTitle.textContent = `Editando`;
  cancelBtn.classList.remove('hidden');
  formCard.classList.add('ring-2', 'ring-primary/40');

  config.fields.forEach((f) => {
    const el = form.querySelector(`[name="${f.name}"]`) as HTMLInputElement | HTMLTextAreaElement;
    if (!el) return;
    const val = row[f.name];
    if (f.type === 'checkbox') (el as HTMLInputElement).checked = Boolean(val);
    else if (f.type === 'datetime-local')
      (el as HTMLInputElement).value = val ? deIsoAChile(String(val)) : '';
    else if (f.type === 'image') {
      const prev = ctx.root.querySelector(`[data-preview="${f.name}"]`);
      // `imagen_url` y no `val`: `val` es la clave de R2, que en un `src` se lee
      // como ruta relativa y no carga. Ver `conUrl` en /api/admin/[recurso].
      if (prev)
        prev.innerHTML = row.imagen_url
          ? `<img src="${esc(row.imagen_url)}" class="h-20 rounded border border-base-300" alt="" /><span class="mt-1 block text-xs text-base-content/70">Sube otra imagen para reemplazarla</span>`
          : '';
    } else (el as HTMLInputElement).value = val ?? '';
  });

  listEl
    .querySelectorAll('[data-fila]')
    .forEach((el) => el.classList.remove('ring-2', 'ring-primary/40'));
  listEl.querySelector(`[data-fila="${row.id}"]`)?.classList.add('ring-2', 'ring-primary/40');

  formCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/**
 * Arma lo que se manda a la base a partir del formulario. Las imágenes se suben
 * aquí, así que puede lanzar: quien llama decide qué hacer con el fallo.
 */
export async function construirPayload(ctx: Contexto): Promise<Record<string, any>> {
  const payload: Record<string, any> = {};

  for (const f of ctx.config.fields) {
    const el = ctx.form.querySelector(`[name="${f.name}"]`) as
      HTMLInputElement | HTMLTextAreaElement;

    if (f.type === 'checkbox') payload[f.name] = (el as HTMLInputElement).checked;
    else if (f.type === 'image') {
      const blob = ctx.imagenesListas.get(f.name);
      if (blob) {
        const nombre = (el as HTMLInputElement).files?.[0]?.name ?? 'imagen.webp';
        payload[f.name] = await subirImagen(ctx.recurso, blob);
      } else if (ctx.editing) payload[f.name] = ctx.editing[f.name] ?? null;
    } else if (f.type === 'datetime-local') {
      // Lo escrito es hora de CHILE, no la del reloj de quien administra.
      // `new Date('2026-09-26T19:00')` interpretaba en el huso del navegador, y
      // como las páginas se arman en el Worker —que corre en UTC— la web
      // terminaba anunciando otra hora. Ver src/lib/hora.ts.
      payload[f.name] = el.value ? deChileAIso(el.value) : null;
    } else if (f.type === 'number') {
      payload[f.name] = el.value === '' ? 0 : Number(el.value);
    } else {
      payload[f.name] = el.value.trim() === '' ? null : el.value.trim();
    }
  }

  return payload;
}
