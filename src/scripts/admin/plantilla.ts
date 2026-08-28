import type { CrudConfig } from './tipos';
import { esc } from './ui';

/**
 * Marca de la pantalla completa: buscador, filtros, listado, formulario y los
 * dos diálogos de confirmación.
 *
 * Está aparte del resto porque son 160 líneas de plantilla que no tienen estado
 * ni dependen de nada: entra la configuración, sale una cadena. Eso además la
 * hace comprobable — se puede comparar la salida antes y después de tocar nada.
 */

/** Un campo del formulario, según su tipo. */
function campoHtml(f: CrudConfig['fields'][number]): string {
  const req = f.required ? 'required' : '';
  const marca = f.required ? ' <span class="text-error">*</span>' : '';
  const help = f.help
    ? `<span class="mt-1 block text-xs text-base-content/55">${esc(f.help)}</span>`
    : '';
  const label = `<span class="mb-1.5 block text-sm font-medium">${esc(f.label)}${marca}</span>`;

  if (f.type === 'textarea')
    return `<label class="block">${label}<textarea name="${f.name}" ${req} rows="4" class="textarea textarea-bordered w-full"></textarea>${help}</label>`;

  // Editor con barra de formato sobre un <textarea> nativo. Se descartó un
  // editor completo (EasyMDE/CodeMirror) porque en el teléfono el teclado
  // se comporta mucho peor que en un campo nativo, y aquí se escribe desde
  // el teléfono.
  if (f.type === 'markdown')
    return `<div class="block" data-md="${f.name}">
          ${label}
          <div class="rounded-t border border-b-0 border-base-300 bg-base-200/60 p-1">
            <div class="flex flex-wrap items-center gap-0.5">
              <button type="button" class="btn btn-ghost btn-xs font-bold" data-md-cmd="bold" title="Negrita (Ctrl+B)">B</button>
              <button type="button" class="btn btn-ghost btn-xs italic" data-md-cmd="italic" title="Cursiva (Ctrl+I)">I</button>
              <button type="button" class="btn btn-ghost btn-xs" data-md-cmd="h2" title="Subtítulo">H</button>
              <button type="button" class="btn btn-ghost btn-xs" data-md-cmd="ul" title="Lista">&bull;&nbsp;Lista</button>
              <button type="button" class="btn btn-ghost btn-xs" data-md-cmd="quote" title="Cita">&ldquo;&rdquo;</button>
              <button type="button" class="btn btn-ghost btn-xs" data-md-cmd="link" title="Enlace (Ctrl+K)">Enlace</button>
              <span class="mx-1 h-4 w-px bg-base-300"></span>
              <button type="button" class="btn btn-ghost btn-xs" data-md-preview aria-pressed="false">Vista previa</button>
            </div>
          </div>
          <textarea name="${f.name}" ${req} rows="10"
            class="textarea textarea-bordered w-full rounded-t-none font-mono text-[0.9rem] leading-relaxed"></textarea>
          <div data-md-out
            class="prose-lcd hidden min-h-[12rem] rounded-b border border-t-0 border-base-300 bg-base-100 p-4 text-[0.95rem]"></div>
          ${help}
        </div>`;

  if (f.type === 'checkbox')
    return `<label class="flex cursor-pointer items-start gap-3 rounded border border-base-300 bg-base-200/50 p-3">
          <input type="checkbox" name="${f.name}" checked class="toggle toggle-primary toggle-sm mt-0.5" />
          <span><span class="block text-sm font-medium">${esc(f.label)}</span>
          <span class="block text-xs text-base-content/55">Si lo apagas queda como borrador y no se ve en el sitio.</span></span>
        </label>`;

  // Zona de imagen: se puede arrastrar el archivo encima, se ve antes de
  // guardar y se reduce en el navegador.
  if (f.type === 'image')
    return `<div class="block" data-zona="${f.name}">
          ${label}
          <label data-drop
            class="flex cursor-pointer flex-col items-center justify-center gap-1 rounded border border-dashed border-base-300 bg-base-200/40 px-4 py-6 text-center transition-colors hover:border-primary hover:bg-base-200">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="h-6 w-6 text-base-content/40"><path d="M12 16V4m0 0L8 8m4-4 4 4"/><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>
            <span class="text-sm font-medium">Arrastra una imagen o toca para elegirla</span>
            <span class="text-xs text-base-content/50">Se reduce sola antes de subirse</span>
            <input type="file" name="${f.name}" accept="image/*" class="hidden" />
          </label>
          <div data-preview="${f.name}" class="mt-2"></div>${help}
        </div>`;

  return `<label class="block">${label}<input type="${f.type}" name="${f.name}" ${req} class="input input-bordered w-full" />${help}</label>`;
}

export function plantilla(config: CrudConfig, plural: string, articulo: string): string {
  const camposHtml = config.fields.map(campoHtml).join('');

  return `
    <div class="grid gap-6 lg:grid-cols-12">
      <!-- Listado -->
      <section class="lg:col-span-7 xl:col-span-8">
        <div class="panel mb-4 flex flex-wrap items-center gap-2 p-3">
          <label class="relative min-w-[10rem] flex-1">
            <span class="sr-only">Buscar ${esc(plural)}</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-base-content/40"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
            <input id="crud-buscar" type="search" placeholder="Buscar…" class="input input-bordered input-sm w-full pl-9" />
          </label>
          <div class="join" role="group" aria-label="Filtrar por estado">
            <button type="button" data-estado="todos" class="btn btn-sm join-item btn-active">Todos</button>
            <button type="button" data-estado="publicados" class="btn btn-sm join-item">Publicados</button>
            <button type="button" data-estado="borradores" class="btn btn-sm join-item">Borradores</button>
          </div>
          <button type="button" id="crud-nuevo" class="btn btn-primary btn-sm gap-1.5 lg:hidden">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-4 w-4"><path d="M12 5v14M5 12h14"/></svg>
            Nuevo
          </button>
        </div>

        <p id="crud-conteo" class="mb-2 px-1 text-xs uppercase tracking-wide text-base-content/50"></p>
        ${
          config.orderable
            ? `<p id="crud-orden-aviso" class="mb-2 hidden rounded border border-base-300 bg-base-200/60 px-3 py-2 text-xs text-base-content/60">
                 Arrastra por el asa de la izquierda para cambiar el orden en que se ven en el sitio.
               </p>`
            : ''
        }
        <div id="crud-list" class="space-y-2.5">
          <div class="panel p-6 text-center"><span class="loading loading-spinner loading-sm"></span></div>
        </div>
      </section>

      <!-- Formulario -->
      <section class="lg:col-span-5 xl:col-span-4">
        <div id="crud-form-card" class="panel p-5 lg:sticky lg:top-24">
          <div class="mb-4 flex items-center justify-between gap-2">
            <h2 class="text-base font-bold" id="form-title">${articulo} ${esc(config.singular)}</h2>
            <button type="button" class="btn btn-ghost btn-xs hidden" id="crud-cancel">Cancelar</button>
          </div>
          <form id="crud-form" class="space-y-4">
            <input type="hidden" name="id" />
            ${camposHtml}
            ${
              config.notify
                ? `<label class="flex cursor-pointer items-start gap-3 rounded border border-base-300 p-3">
                     <input type="checkbox" name="__notify" checked class="checkbox checkbox-primary checkbox-sm mt-0.5" />
                     <span><span class="block text-sm font-medium">Avisar a los suscriptores</span>
                     <span class="block text-xs text-base-content/55">Solo al crear, y solo si está publicado.</span></span>
                   </label>`
                : ''
            }
            <button type="submit" class="btn btn-primary w-full" id="crud-save">Guardar</button>
            <p class="text-center text-xs text-base-content/45">Atajo: Ctrl + S</p>
          </form>
        </div>
      </section>
    </div>

    <!-- Confirmación de borrado. Sustituye a confirm(), que en el teléfono
         aparece como un aviso del navegador sin contexto ni nombre. -->
    <dialog id="crud-borrar" class="modal">
      <div class="modal-box max-w-sm">
        <h3 class="text-lg font-bold">¿Borrar este ${esc(config.singular)}?</h3>
        <p class="mt-2 text-sm text-base-content/70">
          Se eliminará <strong data-nombre class="break-words"></strong> del sitio. No se puede deshacer.
        </p>
        <div class="modal-action">
          <form method="dialog" class="flex w-full gap-2">
            <button value="no" class="btn btn-ghost flex-1">Cancelar</button>
            <button value="si" class="btn btn-error flex-1">Sí, borrar</button>
          </form>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop"><button>cerrar</button></form>
    </dialog>

    <!-- Confirmación antes de avisar a los suscriptores. Publicar desde la
         lista no debe mandar correos sin preguntar. -->
    <dialog id="crud-avisar" class="modal">
      <div class="modal-box max-w-sm">
        <h3 class="text-lg font-bold">¿Avisar a los suscriptores?</h3>
        <p class="mt-2 text-sm text-base-content/70">
          Se enviará un correo con <strong data-nombre class="break-words"></strong>
          a todas las personas suscritas al boletín.
        </p>
        <div class="modal-action">
          <form method="dialog" class="flex w-full gap-2">
            <button value="no" class="btn btn-ghost flex-1">Solo publicar</button>
            <button value="si" class="btn btn-primary flex-1">Publicar y avisar</button>
          </form>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop"><button>cerrar</button></form>
    </dialog>
  `;
}
