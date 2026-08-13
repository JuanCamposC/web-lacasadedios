import autoAnimate from '@formkit/auto-animate';
import Sortable from 'sortablejs';
import { createBrowserSupabase } from '../lib/supabase';
import { youtubeId } from '../lib/supabase';

export type Field = {
  name: string;
  label: string;
  type:
    | 'text'
    | 'url'
    | 'textarea'
    /** textarea con barra de formato y vista previa */
    | 'markdown'
    | 'datetime-local'
    | 'number'
    | 'checkbox'
    | 'image';
  required?: boolean;
  help?: string;
};

export type CrudConfig = {
  table: string;
  singular: string;
  /** plural en minúscula, para los textos de la interfaz */
  plural?: string;
  fields: Field[];
  orderBy: { column: string; ascending: boolean };
  titleField: string;
  subtitleField?: string;
  /**
   * Si se define, la lista se puede reordenar arrastrando y el nuevo orden se
   * guarda en esa columna. Sustituye al campo numérico «orden», que obligaba a
   * imaginarse los números en vez de ver el resultado.
   */
  orderable?: { column: string };
  /**
   * Si se define, ofrece avisar a los suscriptores cuando el contenido pasa a
   * publicado — tanto al crearlo como al encenderlo desde la lista.
   * `porItem` añade el identificador a la URL, para enlazar a la ficha en vez
   * de al listado (solo noticias tiene ficha propia).
   */
  notify?: { type: string; urlBase: string; porItem?: boolean };
};

/** Ancho máximo al que se reducen las imágenes antes de subirlas. */
const ANCHO_MAX = 1600;

/**
 * Reduce y recomprime la imagen en el navegador antes de subirla.
 * Una foto de teléfono son 4–8 MB; en el sitio nunca se ve a más de 1600 px.
 * Subir el original malgastaría almacenamiento y haría más lenta la página.
 */
async function prepararImagen(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  try {
    const bitmap = await createImageBitmap(file);
    if (bitmap.width <= ANCHO_MAX) return file;

    const escala = ANCHO_MAX / bitmap.width;
    const lienzo = document.createElement('canvas');
    lienzo.width = ANCHO_MAX;
    lienzo.height = Math.round(bitmap.height * escala);
    lienzo.getContext('2d')!.drawImage(bitmap, 0, 0, lienzo.width, lienzo.height);

    const blob: Blob | null = await new Promise((r) => lienzo.toBlob(r, 'image/webp', 0.86));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file; // si el navegador no puede, se sube tal cual
  }
}

function pesoLegible(bytes: number): string {
  return bytes > 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} kB`;
}

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function fechaCorta(iso: string | null): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function toast(message: string, type: 'success' | 'error' = 'success') {
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

export function setupCrud(config: CrudConfig) {
  const supabase = createBrowserSupabase();
  const root = document.getElementById('crud-root');
  if (!root) return;

  const plural = config.plural ?? `${config.singular}s`;
  // Concordancia de género a partir de la palabra: noticia → nueva/creada,
  // evento y video → nuevo/creado.
  const femenino = /a$/.test(config.singular);
  const ARTICULO = femenino ? 'Nueva' : 'Nuevo';
  const CREADO = femenino ? 'creada' : 'creado';

  supabase.auth.getSession().then(({ data }) => {
    if (!data.session) window.location.href = '/admin/login';
  });

  // Miniatura: del campo de imagen si existe, si no de YouTube.
  const campoImagen = config.fields.find((f) => f.type === 'image')?.name;
  const campoYoutube = config.fields.find((f) => f.name === 'youtube_url')?.name;
  const campoFecha = config.fields.find((f) => f.type === 'datetime-local')?.name;

  function miniatura(row: any): string {
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

  /* ── Estructura de la página ─────────────────────────────────────────── */
  const camposHtml = config.fields
    .map((f) => {
      const req = f.required ? 'required' : '';
      const marca = f.required ? ' <span class="text-error">*</span>' : '';
      const help = f.help ? `<span class="mt-1 block text-xs text-base-content/55">${esc(f.help)}</span>` : '';
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
    })
    .join('');

  root.innerHTML = `
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
            <h2 class="text-base font-bold" id="form-title">${ARTICULO} ${esc(config.singular)}</h2>
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

  const form = document.getElementById('crud-form') as HTMLFormElement;
  const formCard = document.getElementById('crud-form-card')!;
  const listEl = document.getElementById('crud-list')!;
  const conteoEl = document.getElementById('crud-conteo')!;
  const buscarEl = document.getElementById('crud-buscar') as HTMLInputElement;
  const saveBtn = document.getElementById('crud-save') as HTMLButtonElement;
  const cancelBtn = document.getElementById('crud-cancel') as HTMLButtonElement;
  const nuevoBtn = document.getElementById('crud-nuevo') as HTMLButtonElement | null;
  const formTitle = document.getElementById('form-title')!;

  const dlgBorrar = document.getElementById('crud-borrar') as HTMLDialogElement;
  const dlgAvisar = document.getElementById('crud-avisar') as HTMLDialogElement;
  const avisoOrden = document.getElementById('crud-orden-aviso');

  autoAnimate(listEl);

  let filas: any[] = [];
  let editing: Record<string, any> | null = null;
  let estado: 'todos' | 'publicados' | 'borradores' = 'todos';
  /** Archivos ya reducidos, listos para subir, por nombre de campo. */
  const imagenesListas = new Map<string, Blob>();

  /* ── Editor con barra de formato ─────────────────────────────────────────
     Markdown mínimo (negrita, cursiva, subtítulo, lista, cita, enlace) sobre
     un textarea nativo. Se convierte a HTML en el servidor al publicar. */
  function initMarkdown() {
    root!.querySelectorAll<HTMLElement>('[data-md]').forEach((caja) => {
      const ta = caja.querySelector('textarea') as HTMLTextAreaElement;
      const salida = caja.querySelector('[data-md-out]') as HTMLElement;
      const btnPrev = caja.querySelector('[data-md-preview]') as HTMLButtonElement;

      const envolver = (antes: string, despues = antes, marcador = 'texto') => {
        const { selectionStart: a, selectionEnd: b, value } = ta;
        const sel = value.slice(a, b) || marcador;
        ta.value = value.slice(0, a) + antes + sel + despues + value.slice(b);
        ta.focus();
        ta.setSelectionRange(a + antes.length, a + antes.length + sel.length);
        ta.dispatchEvent(new Event('input', { bubbles: true }));
      };

      const prefijo = (marca: string) => {
        const { selectionStart: a, value } = ta;
        const ini = value.lastIndexOf('\n', a - 1) + 1;
        ta.value = value.slice(0, ini) + marca + value.slice(ini);
        ta.focus();
        ta.setSelectionRange(a + marca.length, a + marca.length);
        ta.dispatchEvent(new Event('input', { bubbles: true }));
      };

      const acciones: Record<string, () => void> = {
        bold: () => envolver('**', '**', 'negrita'),
        italic: () => envolver('_', '_', 'cursiva'),
        h2: () => prefijo('## '),
        ul: () => prefijo('- '),
        quote: () => prefijo('> '),
        link: () => envolver('[', '](https://)', 'texto del enlace'),
      };

      caja.querySelectorAll<HTMLButtonElement>('[data-md-cmd]').forEach((b) =>
        b.addEventListener('click', () => acciones[b.dataset.mdCmd!]?.()),
      );

      ta.addEventListener('keydown', (e) => {
        if (!(e.ctrlKey || e.metaKey)) return;
        const k = e.key.toLowerCase();
        if (k === 'b') { e.preventDefault(); acciones.bold(); }
        if (k === 'i') { e.preventDefault(); acciones.italic(); }
        if (k === 'k') { e.preventDefault(); acciones.link(); }
      });

      // Vista previa: el mismo Markdown mínimo, resuelto en el navegador solo
      // para mirar. Lo que se publica lo convierte el servidor.
      const aHtml = (md: string) =>
        esc(md)
          .replace(/^### (.*)$/gm, '<h3>$1</h3>')
          .replace(/^## (.*)$/gm, '<h2>$1</h2>')
          .replace(/^&gt; (.*)$/gm, '<blockquote>$1</blockquote>')
          .replace(/^[-*] (.*)$/gm, '<li>$1</li>')
          .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
          .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
          .replace(/_([^_]+)_/g, '<em>$1</em>')
          .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
          .split(/\n{2,}/)
          .map((b) => (/^<(h2|h3|ul|blockquote)/.test(b.trim()) ? b : `<p>${b.trim()}</p>`))
          .join('');

      btnPrev.addEventListener('click', () => {
        const viendo = salida.classList.toggle('hidden');
        ta.classList.toggle('hidden', !viendo);
        btnPrev.setAttribute('aria-pressed', String(!viendo));
        btnPrev.classList.toggle('btn-active', !viendo);
        btnPrev.textContent = viendo ? 'Vista previa' : 'Volver a editar';
        if (!viendo) {
          salida.innerHTML = ta.value.trim()
            ? aHtml(ta.value)
            : '<p class="italic opacity-50">Todavía no hay texto.</p>';
        }
      });
    });
  }

  /* ── Zona de imagen ──────────────────────────────────────────────────────
     Arrastrar, ver antes de guardar y reducir en el navegador. */
  function initImagenes() {
    root!.querySelectorAll<HTMLElement>('[data-zona]').forEach((zona) => {
      const campo = zona.dataset.zona!;
      const input = zona.querySelector('input[type="file"]') as HTMLInputElement;
      const drop = zona.querySelector('[data-drop]') as HTMLElement;
      const prev = zona.querySelector(`[data-preview="${campo}"]`) as HTMLElement;

      const mostrar = async (file: File) => {
        prev.innerHTML = `<p class="text-xs text-base-content/55">Preparando imagen…</p>`;
        const blob = await prepararImagen(file);
        imagenesListas.set(campo, blob);
        const ahorro =
          blob.size < file.size
            ? ` · reducida de ${pesoLegible(file.size)} a ${pesoLegible(blob.size)}`
            : ` · ${pesoLegible(blob.size)}`;
        prev.innerHTML = `<div class="flex items-center gap-3 rounded border border-base-300 p-2">
            <img src="${URL.createObjectURL(blob)}" alt="" class="h-16 w-16 rounded object-cover" />
            <div class="min-w-0 flex-1">
              <p class="truncate text-xs font-medium">${esc(file.name)}</p>
              <p class="text-xs text-base-content/55">Lista para subir${ahorro}</p>
            </div>
            <button type="button" data-quitar class="btn btn-ghost btn-xs">Quitar</button>
          </div>`;
        prev.querySelector('[data-quitar]')?.addEventListener('click', () => {
          imagenesListas.delete(campo);
          input.value = '';
          prev.innerHTML = '';
        });
      };

      input.addEventListener('change', () => {
        const f = input.files?.[0];
        if (f) mostrar(f);
      });

      ['dragenter', 'dragover'].forEach((ev) =>
        drop.addEventListener(ev, (e) => {
          e.preventDefault();
          drop.classList.add('border-primary', 'bg-base-200');
        }),
      );
      ['dragleave', 'drop'].forEach((ev) =>
        drop.addEventListener(ev, (e) => {
          e.preventDefault();
          drop.classList.remove('border-primary', 'bg-base-200');
        }),
      );
      drop.addEventListener('drop', (e) => {
        const f = (e as DragEvent).dataTransfer?.files?.[0];
        if (f) mostrar(f);
      });
    });
  }

  initMarkdown();
  initImagenes();

  /* ── Formulario ──────────────────────────────────────────────────────── */
  function resetForm() {
    form.reset();
    editing = null;
    (form.querySelector('[name="id"]') as HTMLInputElement).value = '';
    formTitle.textContent = `${ARTICULO} ${config.singular}`;
    cancelBtn.classList.add('hidden');
    formCard.classList.remove('ring-2', 'ring-primary/40');
    imagenesListas.clear();
    config.fields.forEach((f) => {
      if (f.type === 'checkbox') (form.querySelector(`[name="${f.name}"]`) as HTMLInputElement).checked = true;
      if (f.type === 'image') {
        const prev = root!.querySelector(`[data-preview="${f.name}"]`);
        if (prev) prev.innerHTML = '';
      }
    });
    listEl.querySelectorAll('[data-fila]').forEach((el) => el.classList.remove('ring-2', 'ring-primary/40'));
  }

  function startEdit(row: Record<string, any>) {
    editing = row;
    (form.querySelector('[name="id"]') as HTMLInputElement).value = row.id;
    formTitle.textContent = `Editando`;
    cancelBtn.classList.remove('hidden');
    formCard.classList.add('ring-2', 'ring-primary/40');

    config.fields.forEach((f) => {
      const el = form.querySelector(`[name="${f.name}"]`) as HTMLInputElement | HTMLTextAreaElement;
      if (!el) return;
      const val = row[f.name];
      if (f.type === 'checkbox') (el as HTMLInputElement).checked = Boolean(val);
      else if (f.type === 'datetime-local') (el as HTMLInputElement).value = val ? toLocalInput(val) : '';
      else if (f.type === 'image') {
        const prev = root!.querySelector(`[data-preview="${f.name}"]`);
        if (prev)
          prev.innerHTML = val
            ? `<img src="${esc(val)}" class="h-20 rounded border border-base-300" alt="" /><span class="mt-1 block text-xs text-base-content/55">Sube otra imagen para reemplazarla</span>`
            : '';
      } else (el as HTMLInputElement).value = val ?? '';
    });

    listEl.querySelectorAll('[data-fila]').forEach((el) => el.classList.remove('ring-2', 'ring-primary/40'));
    listEl.querySelector(`[data-fila="${row.id}"]`)?.classList.add('ring-2', 'ring-primary/40');

    formCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* ── Listado ─────────────────────────────────────────────────────────── */
  function visibles(): any[] {
    const q = buscarEl.value.trim().toLowerCase();
    return filas.filter((r) => {
      if (estado === 'publicados' && !r.published) return false;
      if (estado === 'borradores' && r.published) return false;
      if (!q) return true;
      const campos = [r[config.titleField], config.subtitleField ? r[config.subtitleField] : ''];
      return campos.some((c) => String(c ?? '').toLowerCase().includes(q));
    });
  }

  function pintar() {
    const datos = visibles();
    conteoEl.textContent =
      filas.length === 0
        ? ''
        : `${datos.length} de ${filas.length} ${filas.length === 1 ? config.singular : plural}`;

    if (filas.length === 0) {
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
      .map((row: any) => {
        const sub = config.subtitleField ? String(row[config.subtitleField] ?? '') : '';
        const fecha = campoFecha ? fechaCorta(row[campoFecha]) : fechaCorta(row.created_at ?? null);
        const asa = config.orderable
          ? `<button type="button" data-asa aria-label="Arrastrar para reordenar"
               class="flex w-8 shrink-0 cursor-grab items-center justify-center text-base-content/30 transition-colors hover:text-primary active:cursor-grabbing">
               <svg viewBox="0 0 24 24" fill="currentColor" class="h-4 w-4"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>
             </button>`
          : '';
        return `<article data-fila="${row.id}" class="panel flex items-stretch gap-0 overflow-hidden transition-shadow">
          ${asa}
          <div class="hidden h-auto w-24 shrink-0 bg-base-200 sm:block">${miniatura(row)}</div>
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
        const row = filas.find((r) => r.id === b.dataset.edit);
        if (row) startEdit(row);
      }),
    );
    listEl.querySelectorAll<HTMLElement>('[data-del]').forEach((b) =>
      b.addEventListener('click', () => remove(b.dataset.del!)),
    );
    listEl.querySelectorAll<HTMLElement>('[data-toggle]').forEach((b) =>
      b.addEventListener('click', () => togglePublicado(b.dataset.toggle!)),
    );

    if (editing) listEl.querySelector(`[data-fila="${editing.id}"]`)?.classList.add('ring-2', 'ring-primary/40');
  }

  async function load() {
    const { data, error } = await supabase
      .from(config.table)
      .select('*')
      .order(config.orderBy.column, { ascending: config.orderBy.ascending });
    if (error) {
      listEl.innerHTML = `<div class="alert alert-error text-sm">No se pudo cargar: ${esc(error.message)}</div>`;
      return;
    }
    filas = data ?? [];
    pintar();
    if (avisoOrden) avisoOrden.classList.toggle('hidden', filas.length < 2);
  }

  /* ── Acciones ────────────────────────────────────────────────────────── */
  /* ── Aviso a los suscriptores ────────────────────────────────────────────
     Antes solo se disparaba al CREAR. Como el panel ahora invita a guardar en
     borrador y publicar después desde la lista, ese camino no avisaba a nadie
     y no lo decía. Ahora avisa por los dos caminos y SIEMPRE informa qué pasó,
     incluido «no hay suscriptores», que era el silencio más confuso. */
  async function avisarSuscriptores(titulo: string, ruta: string) {
    try {
      const r = await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: config.notify!.type, title: titulo, url: location.origin + ruta }),
      }).then((x) => x.json());

      if (r.ok && r.sent > 0) {
        return toast(`Avisamos a ${r.sent} suscriptor${r.sent === 1 ? '' : 'es'}`);
      }
      if (r.ok) {
        return toast('Guardado. Todavía no hay nadie suscrito al boletín.');
      }

      // Siempre se dice QUÉ falló. La versión anterior tenía un comodín
      // «no se pudo enviar» que se tragaba la causa real y dejaba sin pistas.
      const EXPLICACION: Record<string, string> = {
        no_email_provider: 'Falta configurar RESEND_API_KEY en Vercel.',
        falta_migracion: 'Falta correr la migración de baja del boletín en Supabase.',
        unauthorized: 'Tu sesión expiró. Vuelve a entrar al panel.',
        unconfigured: 'El servidor no tiene configurada la conexión a la base.',
        db_error: 'No se pudo leer la lista de suscriptores.',
        send_error: 'Resend rechazó el envío.',
        exception: 'Error inesperado al enviar.',
      };
      const causa = EXPLICACION[r.reason] ?? `Fallo desconocido (${r.reason ?? 'sin código'}).`;
      console.error('[aviso a suscriptores]', r);
      toast(`Guardado, pero no se avisó. ${causa}${r.detalle ? ' ' + r.detalle : ''}`, 'error');
    } catch (e) {
      console.error('[aviso a suscriptores]', e);
      toast('Guardado, pero no se pudo contactar al servidor para avisar.', 'error');
    }
  }

  /** URL pública del elemento (ficha propia si la tiene, listado si no). */
  function rutaDe(row: any): string {
    const base = config.notify!.urlBase;
    return config.notify!.porItem ? `${base}/${row.slug ?? row.id}` : base;
  }

  async function togglePublicado(id: string) {
    const row = filas.find((r) => r.id === id);
    if (!row) return;
    const nuevo = !row.published;

    // Al encender, se pregunta antes de mandar correos.
    let avisar = false;
    if (nuevo && config.notify) {
      dlgAvisar.querySelector('[data-nombre]')!.textContent = `«${String(row[config.titleField] ?? '')}»`;
      dlgAvisar.showModal();
      avisar = await new Promise<string>((r) =>
        dlgAvisar.addEventListener('close', () => r(dlgAvisar.returnValue), { once: true }),
      ).then((v) => v === 'si');
    }

    const { error } = await supabase.from(config.table).update({ published: nuevo }).eq('id', id);
    if (error) return toast('No se pudo cambiar el estado: ' + error.message, 'error');
    row.published = nuevo;
    pintar();
    toast(nuevo ? 'Publicado: ya se ve en el sitio' : 'Pasó a borrador: ya no se ve en el sitio');

    if (avisar) await avisarSuscriptores(String(row[config.titleField] ?? ''), rutaDe(row));
  }

  async function uploadImage(blob: Blob, nombre: string): Promise<string> {
    const ext = blob.type === 'image/webp' ? 'webp' : nombre.split('.').pop() || 'jpg';
    const base = nombre.replace(/\.[^.]+$/, '').replace(/[^\w-]/g, '_').slice(0, 40);
    const path = `${config.table}/${Date.now()}-${base}.${ext}`;
    const { error } = await supabase.storage.from('media').upload(path, blob, {
      contentType: blob.type || 'image/jpeg',
    });
    if (error) throw error;
    return supabase.storage.from('media').getPublicUrl(path).data.publicUrl;
  }

  async function remove(id: string) {
    const row = filas.find((r) => r.id === id);
    const nombre = row ? String(row[config.titleField] ?? '') : 'este registro';

    dlgBorrar.querySelector('[data-nombre]')!.textContent = `«${nombre}»`;
    dlgBorrar.showModal();
    const respuesta: string = await new Promise((r) =>
      dlgBorrar.addEventListener('close', () => r(dlgBorrar.returnValue), { once: true }),
    );
    if (respuesta !== 'si') return;

    const { error } = await supabase.from(config.table).delete().eq('id', id);
    if (error) return toast('No se pudo borrar: ' + error.message, 'error');
    filas = filas.filter((r) => r.id !== id);
    if (editing?.id === id) resetForm();
    pintar();
    toast('Borrado');
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    saveBtn.disabled = true;
    saveBtn.textContent = 'Guardando…';
    try {
      const payload: Record<string, any> = {};
      for (const f of config.fields) {
        const el = form.querySelector(`[name="${f.name}"]`) as HTMLInputElement | HTMLTextAreaElement;
        if (f.type === 'checkbox') payload[f.name] = (el as HTMLInputElement).checked;
        else if (f.type === 'image') {
          const blob = imagenesListas.get(f.name);
          if (blob) {
            const nombre = (el as HTMLInputElement).files?.[0]?.name ?? 'imagen.webp';
            payload[f.name] = await uploadImage(blob, nombre);
          } else if (editing) payload[f.name] = editing[f.name] ?? null;
        } else if (f.type === 'datetime-local') {
          payload[f.name] = el.value ? new Date(el.value).toISOString() : null;
        } else if (f.type === 'number') {
          payload[f.name] = el.value === '' ? 0 : Number(el.value);
        } else {
          payload[f.name] = el.value.trim() === '' ? null : el.value.trim();
        }
      }

      const id = (form.querySelector('[name="id"]') as HTMLInputElement).value;
      // `.select()` en el alta: hace falta la fila creada para enlazar al
      // elemento concreto en el correo, no al listado.
      const res = id
        ? await supabase.from(config.table).update(payload).eq('id', id)
        : await supabase.from(config.table).insert(payload).select().single();

      if (res.error) throw res.error;

      // Aviso a suscriptores al CREAR contenido ya publicado.
      if (!id && config.notify && payload.published) {
        const notifyEl = form.querySelector('[name="__notify"]') as HTMLInputElement | null;
        if (notifyEl?.checked) {
          await avisarSuscriptores(String(payload[config.titleField] ?? ''), rutaDe(res.data ?? {}));
        }
      }

      toast(id ? 'Cambios guardados' : `${config.singular[0].toUpperCase()}${config.singular.slice(1)} ${CREADO}`);
      resetForm();
      load();
    } catch (err: any) {
      toast('No se pudo guardar: ' + (err?.message ?? err), 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Guardar';
    }
  });

  /* ── Reordenar arrastrando ───────────────────────────────────────────────
     Sustituye al campo «Orden (menor primero)»: en vez de imaginar números, se
     mueve la tarjeta y se ve el resultado. Funciona con el dedo, que es como
     se administra esto la mitad de las veces. */
  function initArrastre() {
    if (!config.orderable) return;
    Sortable.create(listEl, {
      handle: '[data-asa]',
      animation: 160,
      ghostClass: 'opacity-40',
      // El arrastre solo tiene sentido viendo la lista completa: con un filtro
      // puesto, las posiciones que no se ven quedarían mal calculadas.
      filter: () => estado !== 'todos' || buscarEl.value.trim() !== '',
      onEnd: async () => {
        const ids = Array.from(listEl.querySelectorAll<HTMLElement>('[data-fila]')).map(
          (el) => el.dataset.fila!,
        );
        const col = config.orderable!.column;
        const asc = config.orderBy.ascending;

        const cambios = ids.map((id, i) => {
          const pos = asc ? i : ids.length - 1 - i;
          const row = filas.find((r) => r.id === id);
          if (row) row[col] = pos;
          return supabase.from(config.table).update({ [col]: pos }).eq('id', id);
        });

        const res = await Promise.all(cambios);
        if (res.some((r) => r.error)) {
          toast('No se pudo guardar el nuevo orden', 'error');
          load();
        } else {
          toast('Orden guardado');
        }
      },
    });
  }

  cancelBtn.addEventListener('click', resetForm);
  buscarEl.addEventListener('input', pintar);

  // Ctrl/Cmd + S guarda sin tener que buscar el botón.
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      form.requestSubmit();
    }
  });
  nuevoBtn?.addEventListener('click', () => {
    resetForm();
    formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    (form.querySelector('input, textarea') as HTMLElement | null)?.focus();
  });

  root.querySelectorAll<HTMLButtonElement>('[data-estado]').forEach((b) =>
    b.addEventListener('click', () => {
      estado = b.dataset.estado as typeof estado;
      root.querySelectorAll('[data-estado]').forEach((x) => x.classList.remove('btn-active'));
      b.classList.add('btn-active');
      pintar();
    }),
  );

  initArrastre();
  load();
}
