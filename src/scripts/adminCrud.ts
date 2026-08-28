/**
 * Pantalla de administración de una tabla: listado, formulario, imágenes,
 * reordenar y aviso a suscriptores.
 *
 * Este archivo es solo el orquestador: monta la plantilla, arma el contexto
 * compartido y conecta las piezas de `./admin/`. Antes eran 880 líneas en un
 * único cierre donde cada parte veía las variables de las demás sin decirlo.
 *
 * La API pública no cambió: las páginas siguen llamando a `setupCrud(config)`.
 */
import autoAnimate from '@formkit/auto-animate';
import { createBrowserSupabase } from '../lib/supabase';
import { plantilla } from './admin/plantilla';
import { construirPayload, resetForm, startEdit } from './admin/form';
import { cargar, pintar } from './admin/list';
import { initImagenes } from './admin/upload';
import { initMarkdown } from './admin/markdown-editor';
import { initArrastre } from './admin/sortable';
import { avisarSuscriptores, rutaDe } from './admin/notificar';
import { preguntar, toast } from './admin/ui';
import type { Contexto, CrudConfig, Estado } from './admin/tipos';

export type { Field, CrudConfig } from './admin/tipos';

export function setupCrud(config: CrudConfig) {
  const supabase = createBrowserSupabase();
  const root = document.getElementById('crud-root');
  if (!root) return;

  const plural = config.plural ?? `${config.singular}s`;
  // Concordancia de género a partir de la palabra: noticia → nueva/creada,
  // evento y video → nuevo/creado.
  const femenino = /a$/.test(config.singular);
  const articulo = femenino ? 'Nueva' : 'Nuevo';
  const creado = femenino ? 'creada' : 'creado';

  supabase.auth.getSession().then(({ data }) => {
    if (!data.session) window.location.href = '/admin/login';
  });

  root.innerHTML = plantilla(config, plural, articulo);

  const ctx: Contexto = {
    config,
    supabase,
    root,
    plural,
    articulo,
    creado,

    campoImagen: config.fields.find((f) => f.type === 'image')?.name,
    campoYoutube: config.fields.find((f) => f.name === 'youtube_url')?.name,
    campoFecha: config.fields.find((f) => f.type === 'datetime-local')?.name,

    form: document.getElementById('crud-form') as HTMLFormElement,
    formCard: document.getElementById('crud-form-card')!,
    listEl: document.getElementById('crud-list')!,
    conteoEl: document.getElementById('crud-conteo')!,
    buscarEl: document.getElementById('crud-buscar') as HTMLInputElement,
    saveBtn: document.getElementById('crud-save') as HTMLButtonElement,
    cancelBtn: document.getElementById('crud-cancel') as HTMLButtonElement,
    formTitle: document.getElementById('form-title')!,
    dlgBorrar: document.getElementById('crud-borrar') as HTMLDialogElement,
    dlgAvisar: document.getElementById('crud-avisar') as HTMLDialogElement,
    avisoOrden: document.getElementById('crud-orden-aviso'),

    filas: [],
    editing: null,
    estado: 'todos',
    imagenesListas: new Map(),

    // Se rellenan justo debajo: la lista llama al formulario y el formulario a
    // la lista, así que alguien tiene que cerrar el círculo.
    pintar: () => {},
    load: async () => {},
    resetForm: () => {},
    startEdit: () => {},
    remove: async () => {},
    togglePublicado: async () => {},
  };

  ctx.pintar = () => pintar(ctx);
  ctx.load = () => cargar(ctx);
  ctx.resetForm = () => resetForm(ctx);
  ctx.startEdit = (row) => startEdit(ctx, row);
  ctx.remove = (id) => borrar(ctx, id);
  ctx.togglePublicado = (id) => togglePublicado(ctx, id);

  const nuevoBtn = document.getElementById('crud-nuevo') as HTMLButtonElement | null;

  autoAnimate(ctx.listEl);
  initMarkdown(root);
  initImagenes(ctx);

  /* ── Acciones ────────────────────────────────────────────────────────── */
  async function togglePublicado(ctx: Contexto, id: string) {
    const row = ctx.filas.find((r) => r.id === id);
    if (!row) return;
    const nuevo = !row.published;

    // Al encender, se pregunta antes de mandar correos.
    let avisar = false;
    if (nuevo && ctx.config.notify) {
      avisar = await preguntar(ctx.dlgAvisar, String(row[ctx.config.titleField] ?? ''));
    }

    const { error } = await ctx.supabase
      .from(ctx.config.table)
      .update({ published: nuevo })
      .eq('id', id);
    if (error) return toast('No se pudo cambiar el estado: ' + error.message, 'error');

    row.published = nuevo;
    ctx.pintar();
    toast(nuevo ? 'Publicado: ya se ve en el sitio' : 'Pasó a borrador: ya no se ve en el sitio');

    if (avisar) {
      await avisarSuscriptores(ctx, String(row[ctx.config.titleField] ?? ''), rutaDe(ctx, row));
    }
  }

  async function borrar(ctx: Contexto, id: string) {
    const row = ctx.filas.find((r) => r.id === id);
    const nombre = row ? String(row[ctx.config.titleField] ?? '') : 'este registro';

    if (!(await preguntar(ctx.dlgBorrar, nombre))) return;

    const { error } = await ctx.supabase.from(ctx.config.table).delete().eq('id', id);
    if (error) return toast('No se pudo borrar: ' + error.message, 'error');

    ctx.filas = ctx.filas.filter((r) => r.id !== id);
    if (ctx.editing?.id === id) ctx.resetForm();
    ctx.pintar();
    toast('Borrado');
  }

  /* ── Guardar ─────────────────────────────────────────────────────────── */
  ctx.form.addEventListener('submit', async (e) => {
    e.preventDefault();
    ctx.saveBtn.disabled = true;
    ctx.saveBtn.textContent = 'Guardando…';
    try {
      const payload = await construirPayload(ctx);
      const id = (ctx.form.querySelector('[name="id"]') as HTMLInputElement).value;

      // `.select()` en el alta: hace falta la fila creada para enlazar al
      // elemento concreto en el correo, no al listado.
      const res = id
        ? await supabase.from(config.table).update(payload).eq('id', id)
        : await supabase.from(config.table).insert(payload).select().single();

      if (res.error) throw res.error;

      // Aviso a suscriptores al CREAR contenido ya publicado.
      if (!id && config.notify && payload.published) {
        const notifyEl = ctx.form.querySelector('[name="__notify"]') as HTMLInputElement | null;
        if (notifyEl?.checked) {
          await avisarSuscriptores(
            ctx,
            String(payload[config.titleField] ?? ''),
            rutaDe(ctx, (res as any).data ?? {}),
          );
        }
      }

      toast(
        id
          ? 'Cambios guardados'
          : `${config.singular[0].toUpperCase()}${config.singular.slice(1)} ${creado}`,
      );
      ctx.resetForm();
      ctx.load();
    } catch (err: any) {
      toast('No se pudo guardar: ' + (err?.message ?? err), 'error');
    } finally {
      ctx.saveBtn.disabled = false;
      ctx.saveBtn.textContent = 'Guardar';
    }
  });

  /* ── Controles sueltos ───────────────────────────────────────────────── */
  ctx.cancelBtn.addEventListener('click', ctx.resetForm);
  ctx.buscarEl.addEventListener('input', ctx.pintar);

  // Ctrl/Cmd + S guarda sin tener que buscar el botón.
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      ctx.form.requestSubmit();
    }
  });

  nuevoBtn?.addEventListener('click', () => {
    ctx.resetForm();
    ctx.formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    (ctx.form.querySelector('input, textarea') as HTMLElement | null)?.focus();
  });

  root.querySelectorAll<HTMLButtonElement>('[data-estado]').forEach((b) =>
    b.addEventListener('click', () => {
      ctx.estado = b.dataset.estado as Estado;
      root.querySelectorAll('[data-estado]').forEach((x) => x.classList.remove('btn-active'));
      b.classList.add('btn-active');
      ctx.pintar();
    }),
  );

  initArrastre(ctx);
  ctx.load();
}
