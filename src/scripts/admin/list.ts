import { youtubeId } from '../../lib/supabase';
import type { Contexto, Fila } from './tipos';
import { esc, fechaCorta } from './ui';

/** Miniatura: del campo de imagen si existe, si no de YouTube. */
function miniatura(ctx: Contexto, row: Fila): string {
  const { campoImagen, campoYoutube } = ctx;
  if (campoImagen && row[campoImagen]) {
    return `<img src="${esc(row[campoImagen])}" alt="" class="h-full w-full object-cover" loading="lazy" />`;
  }
  if (campoYoutube && row[campoYoutube]) {
    const id = youtubeId(row[campoYoutube]);
    if (id) {
      return `<img src="https://i.ytimg.com/vi/${id}/mqdefault.jpg" alt="" class="h-full w-full object-cover" loading="lazy" />`;
    }
  }
  return `<span class="flex h-full w-full items-center justify-center text-base-content/25">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="h-6 w-6"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="m3 16 5-5 4 4 3-3 6 6"/></svg>
    </span>`;
}

/** Las filas que pasan el filtro de estado y la búsqueda. */
export function visibles(ctx: Contexto): Fila[] {
  const q = ctx.buscarEl.value.trim().toLowerCase();
  return ctx.filas.filter((r) => {
    if (ctx.estado === 'publicados' && !r.published) return false;
    if (ctx.estado === 'borradores' && r.published) return false;
    if (!q) return true;
    const campos = [
      r[ctx.config.titleField],
      ctx.config.subtitleField ? r[ctx.config.subtitleField] : '',
    ];
    return campos.some((c) =>
      String(c ?? '')
        .toLowerCase()
        .includes(q),
    );
  });
}

export function pintar(ctx: Contexto) {
  const { config, listEl, conteoEl, plural } = ctx;
  const datos = visibles(ctx);

  conteoEl.textContent =
    ctx.filas.length === 0
      ? ''
      : `${datos.length} de ${ctx.filas.length} ${ctx.filas.length === 1 ? config.singular : plural}`;

  if (ctx.filas.length === 0) {
    listEl.innerHTML = `<div class="panel p-8 text-center">
        <p class="text-sm text-base-content/60">Todavía no hay ${esc(plural)}.</p>
        <p class="mt-1 text-sm text-base-content/60">Crea el primero con el formulario.</p>
      </div>`;
    return;
  }

  if (datos.length === 0) {
    listEl.innerHTML = `<div class="panel p-8 text-center text-sm text-base-content/60">
        Ningún resultado con ese filtro.
      </div>`;
    return;
  }

  listEl.innerHTML = datos
    .map((row: Fila) => {
      const sub = config.subtitleField ? String(row[config.subtitleField] ?? '') : '';
      const fecha = ctx.campoFecha
        ? fechaCorta(row[ctx.campoFecha])
        : fechaCorta(row.created_at ?? null);
      const asa = config.orderable
        ? `<button type="button" data-asa aria-label="Arrastrar para reordenar"
               class="flex w-8 shrink-0 cursor-grab items-center justify-center text-base-content/30 transition-colors hover:text-primary active:cursor-grabbing">
               <svg viewBox="0 0 24 24" fill="currentColor" class="h-4 w-4"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>
             </button>`
        : '';
      return `<article data-fila="${row.id}" class="panel flex items-stretch gap-0 overflow-hidden transition-shadow">
          ${asa}
          <div class="hidden h-auto w-24 shrink-0 bg-base-200 sm:block">${miniatura(ctx, row)}</div>
          <div class="flex min-w-0 flex-1 items-center gap-3 p-3">
            <div class="min-w-0 flex-1">
              <h3 class="truncate text-sm font-semibold">${esc(row[config.titleField])}</h3>
              ${sub ? `<p class="truncate text-xs text-base-content/55">${esc(sub)}</p>` : ''}
              ${fecha ? `<p class="font-data mt-0.5 text-xs uppercase tracking-wide text-base-content/45">${esc(fecha)}</p>` : ''}
            </div>
            <div class="flex shrink-0 flex-col items-end gap-1.5">
              <button type="button" data-toggle="${row.id}"
                class="badge badge-sm cursor-pointer gap-1 ${row.published ? 'badge-success' : 'badge-ghost'}"
                title="${row.published ? 'Pasar a borrador' : 'Publicar ahora'}">
                ${row.published ? 'Publicado' : 'Borrador'}
              </button>
              <div class="flex gap-0.5">
                <button type="button" class="btn btn-ghost btn-xs" data-edit="${row.id}">Editar</button>
                <button type="button" class="btn btn-ghost btn-xs text-error" data-del="${row.id}">Borrar</button>
              </div>
            </div>
          </div>
        </article>`;
    })
    .join('');

  listEl.querySelectorAll<HTMLElement>('[data-edit]').forEach((b) =>
    b.addEventListener('click', () => {
      const row = ctx.filas.find((r) => r.id === b.dataset.edit);
      if (row) ctx.startEdit(row);
    }),
  );
  listEl
    .querySelectorAll<HTMLElement>('[data-del]')
    .forEach((b) => b.addEventListener('click', () => ctx.remove(b.dataset.del!)));
  listEl
    .querySelectorAll<HTMLElement>('[data-toggle]')
    .forEach((b) => b.addEventListener('click', () => ctx.togglePublicado(b.dataset.toggle!)));

  if (ctx.editing)
    listEl
      .querySelector(`[data-fila="${ctx.editing.id}"]`)
      ?.classList.add('ring-2', 'ring-primary/40');
}

/** Trae las filas de la tabla y repinta. */
export async function cargar(ctx: Contexto) {
  const { data, error } = await ctx.supabase
    .from(ctx.config.table)
    .select('*')
    .order(ctx.config.orderBy.column, { ascending: ctx.config.orderBy.ascending });

  if (error) {
    ctx.listEl.innerHTML = `<div class="alert alert-error text-sm">No se pudo cargar: ${esc(error.message)}</div>`;
    return;
  }
  ctx.filas = data ?? [];
  ctx.pintar();
  if (ctx.avisoOrden) ctx.avisoOrden.classList.toggle('hidden', ctx.filas.length < 2);
}
