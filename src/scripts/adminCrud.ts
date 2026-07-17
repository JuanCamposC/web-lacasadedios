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
      const help = f.help ? `<span class="text-xs opacity-60">${esc(f.help)}</span>` : '';
      if (f.type === 'textarea')
        return `<label class="block"><span class="text-sm font-medium">${esc(f.label)}</span><textarea name="${f.name}" ${req} rows="4" class="textarea textarea-bordered w-full mt-1"></textarea>${help}</label>`;
      if (f.type === 'checkbox')
        return `<label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" name="${f.name}" checked class="checkbox checkbox-primary" /><span class="text-sm font-medium">${esc(f.label)}</span></label>`;
      if (f.type === 'image')
        return `<label class="block"><span class="text-sm font-medium">${esc(f.label)}</span><input type="file" name="${f.name}" accept="image/*" class="file-input file-input-bordered w-full mt-1" /><div data-preview="${f.name}" class="mt-2"></div>${help}</label>`;
      return `<label class="block"><span class="text-sm font-medium">${esc(f.label)}</span><input type="${f.type}" name="${f.name}" ${req} class="input input-bordered w-full mt-1" />${help}</label>`;
    })
    .join('');

  root.innerHTML = `
    <div class="grid lg:grid-cols-2 gap-8">
      <div>
        <div class="card bg-base-100 shadow border border-base-300">
          <div class="card-body">
            <h2 class="card-title" id="form-title">Nuevo ${esc(config.singular)}</h2>
            <form id="crud-form" class="space-y-3">
              <input type="hidden" name="id" />
              ${fieldHtml}
              <p class="text-sm text-error hidden" id="crud-error"></p>
              <div class="flex gap-2 pt-2">
                <button type="submit" class="btn btn-primary" id="crud-save">Guardar</button>
                <button type="button" class="btn btn-ghost hidden" id="crud-cancel">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      </div>
      <div>
        <h2 class="font-semibold mb-3 opacity-70">Publicados y borradores</h2>
        <div id="crud-list" class="space-y-3"><span class="loading loading-spinner"></span></div>
      </div>
    </div>
  `;

  const form = document.getElementById('crud-form') as HTMLFormElement;
  const listEl = document.getElementById('crud-list')!;
  const errorEl = document.getElementById('crud-error')!;
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
    errorEl.classList.add('hidden');
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
      listEl.innerHTML = `<p class="text-error text-sm">Error al cargar: ${esc(error.message)}</p>`;
      return;
    }
    if (!data || data.length === 0) {
      listEl.innerHTML = `<p class="opacity-60 text-sm">Aún no hay registros.</p>`;
      return;
    }
    listEl.innerHTML = data
      .map((row: any) => {
        const sub = config.subtitleField ? esc(row[config.subtitleField]) : '';
        const pub = row.published
          ? '<span class="badge badge-success badge-sm">Publicado</span>'
          : '<span class="badge badge-ghost badge-sm">Borrador</span>';
        return `<div class="card bg-base-100 border border-base-300">
          <div class="card-body p-4 flex-row items-center justify-between gap-3">
            <div class="min-w-0">
              <div class="font-medium truncate">${esc(row[config.titleField])}</div>
              <div class="text-xs opacity-60 truncate">${sub}</div>
              <div class="mt-1">${pub}</div>
            </div>
            <div class="flex gap-1 shrink-0">
              <button class="btn btn-ghost btn-xs" data-edit="${row.id}">Editar</button>
              <button class="btn btn-ghost btn-xs text-error" data-del="${row.id}">Borrar</button>
            </div>
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
        if (prev) prev.innerHTML = val ? `<img src="${esc(val)}" class="h-20 rounded" /><span class="text-xs opacity-60 block">Sube una nueva imagen para reemplazarla</span>` : '';
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
    if (error) alert('Error al borrar: ' + error.message);
    else load();
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.classList.add('hidden');
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
      resetForm();
      load();
    } catch (err: any) {
      errorEl.textContent = 'Error al guardar: ' + (err?.message ?? err);
      errorEl.classList.remove('hidden');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Guardar';
    }
  });

  cancelBtn.addEventListener('click', resetForm);
  load();
}
