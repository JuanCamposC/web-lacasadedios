import { createBrowserSupabase } from '../lib/supabase';

export type Field = {
  name: string;
  label: string;
  type: 'text' | 'url' | 'textarea' | 'datetime-local' | 'number' | 'checkbox' | 'image';
  required?: boolean;
  help?: string;
};

export type CrudConfig = {
  table: string;
  singular: string;
  fields: Field[];
  orderBy: { column: string; ascending: boolean };
  titleField: string;
  subtitleField?: string;
  /** si se define, ofrece notificar a suscriptores al crear contenido publicado */
  notify?: { type: string; urlBase: string };
};

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

function toast(message: string, type: 'success' | 'error' = 'success') {
  const c = document.getElementById('toast');
  if (!c) return;
  const el = document.createElement('div');
  el.className = `alert ${type === 'error' ? 'alert-error' : 'alert-success'} shadow-lg`;
  el.textContent = message;
  c.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

export function setupCrud(config: CrudConfig) {
  const supabase = createBrowserSupabase();
  const root = document.getElementById('crud-root');
  if (!root) return;

  supabase.auth.getSession().then(({ data }) => {
    if (!data.session) window.location.href = '/admin/login';
  });

  const fieldHtml = config.fields
    .map((f) => {
      const req = f.required ? 'required' : '';
      const help = f.help ? `<span class="mt-1 block text-xs opacity-60">${esc(f.help)}</span>` : '';
      const labelSpan = `<span class="mb-1 block text-sm font-medium">${esc(f.label)}</span>`;
      if (f.type === 'textarea')
        return `<label class="block">${labelSpan}<textarea name="${f.name}" ${req} rows="4" class="textarea textarea-bordered w-full"></textarea>${help}</label>`;
      if (f.type === 'checkbox')
        return `<label class="flex cursor-pointer items-center gap-2"><input type="checkbox" name="${f.name}" checked class="checkbox checkbox-primary" /><span class="text-sm font-medium">${esc(f.label)}</span></label>`;
      if (f.type === 'image')
        return `<label class="block">${labelSpan}<input type="file" name="${f.name}" accept="image/*" class="file-input file-input-bordered w-full" /><div data-preview="${f.name}" class="mt-2"></div>${help}</label>`;
      return `<label class="block">${labelSpan}<input type="${f.type}" name="${f.name}" ${req} class="input input-bordered w-full" />${help}</label>`;
    })
    .join('');

  root.innerHTML = `
    <div class="grid gap-8 lg:grid-cols-2">
      <div class="lg:sticky lg:top-32 lg:self-start">
        <div class="rounded-2xl border border-base-300 bg-base-100 p-6 shadow-sm">
          <h2 class="mb-4 font-display text-xl font-bold" id="form-title">Nuevo ${esc(config.singular)}</h2>
          <form id="crud-form" class="space-y-4">
            <input type="hidden" name="id" />
            ${fieldHtml}
            ${config.notify ? `<label class="flex cursor-pointer items-center gap-2 rounded-lg bg-base-200 p-3"><input type="checkbox" name="__notify" checked class="checkbox checkbox-primary checkbox-sm" /><span class="text-sm">Notificar a suscriptores <span class="opacity-60">(al crear, si está publicado)</span></span></label>` : ''}
            <div class="flex gap-2 pt-1">
              <button type="submit" class="btn btn-primary" id="crud-save">Guardar</button>
              <button type="button" class="btn btn-ghost hidden" id="crud-cancel">Cancelar</button>
            </div>
          </form>
        </div>
      </div>
      <div>
        <h2 class="mb-3 text-sm font-semibold uppercase tracking-wider opacity-60">Publicados y borradores</h2>
        <div id="crud-list" class="space-y-3"><span class="loading loading-spinner"></span></div>
      </div>
    </div>
  `;

  const form = document.getElementById('crud-form') as HTMLFormElement;
  const listEl = document.getElementById('crud-list')!;
  const saveBtn = document.getElementById('crud-save') as HTMLButtonElement;
  const cancelBtn = document.getElementById('crud-cancel') as HTMLButtonElement;
  const formTitle = document.getElementById('form-title')!;
  let editing: Record<string, any> | null = null;

  function resetForm() {
    form.reset();
    editing = null;
    (form.querySelector('[name="id"]') as HTMLInputElement).value = '';
    formTitle.textContent = `Nuevo ${config.singular}`;
    cancelBtn.classList.add('hidden');
    config.fields.forEach((f) => {
      if (f.type === 'checkbox') (form.querySelector(`[name="${f.name}"]`) as HTMLInputElement).checked = true;
      if (f.type === 'image') {
        const prev = root!.querySelector(`[data-preview="${f.name}"]`);
        if (prev) prev.innerHTML = '';
      }
    });
  }

  async function load() {
    const { data, error } = await supabase
      .from(config.table)
      .select('*')
      .order(config.orderBy.column, { ascending: config.orderBy.ascending });
    if (error) {
      listEl.innerHTML = `<p class="text-sm text-error">Error al cargar: ${esc(error.message)}</p>`;
      return;
    }
    if (!data || data.length === 0) {
      listEl.innerHTML = `<div class="rounded-xl border border-dashed border-base-300 p-6 text-center text-sm opacity-60">Aún no hay registros. Crea el primero con el formulario.</div>`;
      return;
    }
    listEl.innerHTML = data
      .map((row: any) => {
        const sub = config.subtitleField ? esc(row[config.subtitleField]) : '';
        const pub = row.published
          ? '<span class="badge badge-success badge-sm gap-1">Publicado</span>'
          : '<span class="badge badge-ghost badge-sm">Borrador</span>';
        return `<div class="flex items-center justify-between gap-3 rounded-xl border border-base-300 bg-base-100 p-4">
          <div class="min-w-0">
            <div class="truncate font-medium">${esc(row[config.titleField])}</div>
            ${sub ? `<div class="truncate text-xs opacity-60">${sub}</div>` : ''}
            <div class="mt-1">${pub}</div>
          </div>
          <div class="flex shrink-0 gap-1">
            <button class="btn btn-ghost btn-xs" data-edit="${row.id}">Editar</button>
            <button class="btn btn-ghost btn-xs text-error" data-del="${row.id}">Borrar</button>
          </div>
        </div>`;
      })
      .join('');

    listEl.querySelectorAll('[data-edit]').forEach((b) =>
      b.addEventListener('click', () => {
        const row = data.find((r: any) => r.id === (b as HTMLElement).dataset.edit);
        if (row) startEdit(row);
      }),
    );
    listEl.querySelectorAll('[data-del]').forEach((b) =>
      b.addEventListener('click', () => remove((b as HTMLElement).dataset.del!)),
    );
  }

  function startEdit(row: Record<string, any>) {
    editing = row;
    (form.querySelector('[name="id"]') as HTMLInputElement).value = row.id;
    formTitle.textContent = `Editar ${config.singular}`;
    cancelBtn.classList.remove('hidden');
    config.fields.forEach((f) => {
      const el = form.querySelector(`[name="${f.name}"]`) as HTMLInputElement | HTMLTextAreaElement;
      if (!el) return;
      const val = row[f.name];
      if (f.type === 'checkbox') (el as HTMLInputElement).checked = Boolean(val);
      else if (f.type === 'datetime-local') (el as HTMLInputElement).value = val ? toLocalInput(val) : '';
      else if (f.type === 'image') {
        const prev = root!.querySelector(`[data-preview="${f.name}"]`);
        if (prev) prev.innerHTML = val ? `<img src="${esc(val)}" class="h-20 rounded-lg" /><span class="mt-1 block text-xs opacity-60">Sube una nueva imagen para reemplazarla</span>` : '';
      } else (el as HTMLInputElement).value = val ?? '';
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function uploadImage(file: File): Promise<string> {
    const safe = file.name.replace(/[^\w.-]/g, '_');
    const path = `${config.table}/${Date.now()}-${safe}`;
    const { error } = await supabase.storage.from('media').upload(path, file);
    if (error) throw error;
    return supabase.storage.from('media').getPublicUrl(path).data.publicUrl;
  }

  async function remove(id: string) {
    if (!confirm('¿Borrar este registro? Esta acción no se puede deshacer.')) return;
    const { error } = await supabase.from(config.table).delete().eq('id', id);
    if (error) toast('Error al borrar: ' + error.message, 'error');
    else {
      toast('Registro borrado');
      load();
    }
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
          const file = (el as HTMLInputElement).files?.[0];
          if (file) payload[f.name] = await uploadImage(file);
          else if (editing) payload[f.name] = editing[f.name] ?? null;
        } else if (f.type === 'datetime-local') {
          payload[f.name] = el.value ? new Date(el.value).toISOString() : null;
        } else if (f.type === 'number') {
          payload[f.name] = el.value === '' ? 0 : Number(el.value);
        } else {
          payload[f.name] = el.value.trim() === '' ? null : el.value.trim();
        }
      }

      const id = (form.querySelector('[name="id"]') as HTMLInputElement).value;
      const res = id
        ? await supabase.from(config.table).update(payload).eq('id', id)
        : await supabase.from(config.table).insert(payload);

      if (res.error) throw res.error;

      // Notificar a suscriptores al CREAR contenido publicado
      if (!id && config.notify && payload.published) {
        const notifyEl = form.querySelector('[name="__notify"]') as HTMLInputElement | null;
        if (notifyEl?.checked) {
          try {
            const r = await fetch('/api/notify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: config.notify.type,
                title: payload[config.titleField],
                url: location.origin + config.notify.urlBase,
              }),
            }).then((x) => x.json());
            if (r.ok) toast(`Notificados ${r.sent} suscriptor(es)`);
            else if (r.reason === 'no_email_provider') toast('Guardado. Falta configurar el correo para notificar.', 'error');
          } catch {
            /* notificación silenciosa si falla */
          }
        }
      }

      toast('Guardado correctamente');
      resetForm();
      load();
    } catch (err: any) {
      toast('Error al guardar: ' + (err?.message ?? err), 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Guardar';
    }
  });

  cancelBtn.addEventListener('click', resetForm);
  load();
}
