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
import { api } from './admin/api';
import { esRecurso } from '../lib/panel';
import { plantilla } from './admin/plantilla';
import { construirPayload, resetForm, startEdit } from './admin/form';
import { cargar, pintar } from './admin/list';
import { initImagenes } from './admin/upload';
import { initMarkdown } from './admin/markdown-editor';
import { initArrastre } from './admin/sortable';
import { avisarSuscriptores } from './admin/notificar';
import { preguntar, toast } from './admin/ui';
import type { Contexto, CrudConfig, Estado } from './admin/tipos';

export type { Field, CrudConfig } from './admin/tipos';

export function setupCrud(config: CrudConfig) {
  const root = document.getElementById('crud-root');
  if (!root) return;

  // El nombre de la tabla viene de la configuracion de cada pantalla. Se
  // comprueba contra la lista blanca aca tambien, aunque el servidor lo repita:
  // asi un error de configuracion se ve al abrir el panel y no al guardar.
  if (!esRecurso(config.table)) {
    root.innerHTML = 'Recurso desconocido: ' + config.table;
    return;
  }
  const recurso = config.table;

  const plural = config.plural ?? `${config.singular}s`;
  // Concordancia de género a partir de la palabra: noticia → nueva/creada,
  // evento y video → nuevo/creado.
  // Se adivina por la última letra, que acierta con «noticia» y falla con
  // «reunión» o «publicación»: para esas, la pantalla lo dice explícitamente.
  const femenino = config.femenino ?? /a$/.test(config.singular);
  const articulo = femenino ? 'Nueva' : 'Nuevo';
  const creado = femenino ? 'creada' : 'creado';

  root.innerHTML = plantilla(config, plural, articulo);

  const ctx: Contexto = {
    config,
    api,
    recurso,
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
    const nuevo = !row.publicado;

    // Al encender, se pregunta antes de mandar correos.
    let avisar = false;
    if (nuevo && ctx.config.notify) {
      avisar = await preguntar(ctx.dlgAvisar, String(row[ctx.config.titleField] ?? ''));
    }

    try {
      await ctx.api.actualizar(ctx.recurso, id, { publicado: nuevo });
    } catch (e) {
      return toast('No se pudo cambiar el estado: ' + (e as Error).message, 'error');
    }

    row.publicado = nuevo ? 1 : 0;
    ctx.pintar();
    toast(nuevo ? 'Publicado: ya se ve en el sitio' : 'Pasó a borrador: ya no se ve en el sitio');

    if (avisar) {
      await avisarSuscriptores(ctx, row);
    }
  }

  async function borrar(ctx: Contexto, id: string) {
    const row = ctx.filas.find((r) => r.id === id);
    const nombre = row ? String(row[ctx.config.titleField] ?? '') : 'este registro';

    if (!(await preguntar(ctx.dlgBorrar, nombre))) return;

    try {
      await ctx.api.borrar(ctx.recurso, id);
    } catch (e) {
      return toast('No se pudo borrar: ' + (e as Error).message, 'error');
    }

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

      // Al crear hace falta el id de vuelta para enlazar al elemento concreto
      // en el correo de aviso, no al listado.
      let creada: Record<string, unknown> | null = null;
      let creadoId = id;
      if (id) {
        await api.actualizar(recurso, id, payload);
      } else {
        const r = await api.crear(recurso, payload);
        creadoId = r.id;
        creada = r.fila;
      }

      // Aviso a suscriptores al CREAR contenido ya publicado.
      if (!id && config.notify && payload.publicado) {
        const notifyEl = ctx.form.querySelector('[name="__notify"]') as HTMLInputElement | null;
        if (notifyEl?.checked) {
          // El id lo devuelve el servidor al crear: hace falta para enlazar al
          // elemento concreto en el correo, no al listado.
          // La fila que devuelve el servidor, no el formulario: trae el slug que
          // se calculó al guardar y la dirección pública de la imagen.
          await avisarSuscriptores(ctx, creada ?? { ...payload, id: creadoId });
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
