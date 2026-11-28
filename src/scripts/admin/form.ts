import type { Contexto, Fila } from './tipos';
import { esc } from './ui';
// `minutosEntre` y `horaDeTermino` traducen entre los minutos que guarda la
// base y la hora que enseña el formulario. Viven en hora.ts, con el resto de
// la aritmética de horas del sitio, para poder probarse.
import { deChileAIso, deIsoAChile, horaDeTermino, minutosEntre } from '../../lib/hora';
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

  // Rellenar un campo desde JavaScript no dispara `input` ni `change` ni muta
  // ningún atributo, así que una pantalla que quiera reaccionar a esto no tiene
  // forma de enterarse. Se le avisa con un evento propio.
  form.dispatchEvent(new CustomEvent('crud:rellenado', { bubbles: true }));

  listEl
    .querySelectorAll('[data-fila]')
    .forEach((el) => el.classList.remove('ring-2', 'ring-primary/40'));
}

/**
 * Vuelca una fila en el formulario. La comparten editar y duplicar.
 *
 * Se separó de `startEdit` al añadir «Duplicar»: las dos hacen exactamente lo
 * mismo con los campos y se diferencian solo en el id —una lo pone y la otra lo
 * deja vacío— y en lo que dice el título. Tenerlo escrito dos veces habría
 * garantizado que un campo nuevo funcionara al editar y no al duplicar.
 */
function rellenar(ctx: Contexto, row: Fila) {
  const { form, config } = ctx;

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
    } else if (f.type === 'duracion') {
      // La columna trae minutos; el campo enseña la hora a la que termina.
      (el as HTMLInputElement).value = horaDeTermino(
        ctx.campoFecha ? row[ctx.campoFecha] : null,
        val,
      );
    } else (el as HTMLInputElement).value = val ?? '';
  });

  // Rellenar un campo desde JavaScript no dispara `input` ni `change` ni muta
  // ningún atributo, así que una pantalla que quiera reaccionar a esto no tiene
  // forma de enterarse. Se le avisa con un evento propio.
  form.dispatchEvent(new CustomEvent('crud:rellenado', { bubbles: true }));
}

/** Marca en la lista la fila que se está editando, y quita la marca anterior. */
function marcarEnLista(ctx: Contexto, id: string | null) {
  ctx.listEl
    .querySelectorAll('[data-fila]')
    .forEach((el) => el.classList.remove('ring-2', 'ring-primary/40'));
  if (id)
    ctx.listEl.querySelector(`[data-fila="${id}"]`)?.classList.add('ring-2', 'ring-primary/40');
}

export function startEdit(ctx: Contexto, row: Fila) {
  const { form, formTitle, cancelBtn, formCard } = ctx;

  ctx.editing = row;
  (form.querySelector('[name="id"]') as HTMLInputElement).value = row.id;
  formTitle.textContent = `Editando`;
  cancelBtn.classList.remove('hidden');
  formCard.classList.add('ring-2', 'ring-primary/40');

  rellenar(ctx, row);
  marcarEnLista(ctx, row.id);
  formCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/**
 * Abre el formulario con una copia de una fila: sin id, en borrador y sin fecha.
 *
 * ── QUÉ SE COPIA Y QUÉ NO ───────────────────────────────────────────────────
 * · El id NO, porque entonces no sería una copia sino la misma fila.
 * · El `slug` tampoco: lo calcula el servidor al guardar, y copiarlo chocaría
 *   con el índice único de la base — el guardado fallaría con un error que no
 *   dice nada.
 * · La fecha NO. Es lo único que con seguridad cambia —el congreso del año que
 *   viene no es el mismo día— y dejarla puesta es la forma más fácil de
 *   publicar un evento con la fecha del anterior.
 * · La imagen SÍ: el afiche viejo sirve de referencia y se reemplaza subiendo
 *   otro. Las dos filas comparten la clave de R2 hasta que se cambie, y eso ya
 *   está previsto (ver `sigueEnUso` en src/lib/archivos.ts).
 * · `publicado` queda en NO, siempre. Una copia que naciera publicada
 *   duplicaría el evento en el sitio en el mismo instante en que se pulsa.
 */
export function duplicar(ctx: Contexto, row: Fila) {
  const { form, formTitle, cancelBtn, formCard, config } = ctx;

  const copia: Fila = { ...row, id: '', slug: null, publicado: 0 };
  if (ctx.campoFecha) copia[ctx.campoFecha] = null;

  ctx.editing = null;
  (form.querySelector('[name="id"]') as HTMLInputElement).value = '';
  formTitle.textContent = `Copia de ${config.singular}`;
  cancelBtn.classList.remove('hidden');
  formCard.classList.add('ring-2', 'ring-primary/40');

  rellenar(ctx, copia);
  // La casilla de publicado la pone `rellenar` a partir de la copia, pero la de
  // avisar a los suscriptores vive fuera de `config.fields`: se apaga a mano.
  // Duplicar y avisar a toda la lista con el mismo clic sería una sorpresa cara.
  const notifyEl = form.querySelector('[name="__notify"]') as HTMLInputElement | null;
  if (notifyEl) notifyEl.checked = false;

  marcarEnLista(ctx, null);
  formCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  (form.querySelector('input, textarea') as HTMLElement | null)?.focus();
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
        payload[f.name] = await subirImagen(ctx.recurso, blob);
        // Y su tarjeta para compartir, si el campo la pide. Se sube aparte
        // porque son dos archivos distintos: la del sitio en WebP y esta en
        // JPEG de 1200×630 (ver `tarjetaSocial` en upload.ts).
        if (f.social) {
          const tarjeta = ctx.imagenesListas.get(f.social);
          // Si el navegador no pudo generarla, la columna queda vacía y al
          // compartir se usa la imagen normal: peor vista previa, no un error.
          payload[f.social] = tarjeta ? await subirImagen(ctx.recurso, tarjeta) : null;
        }
      } else if (ctx.editing) {
        payload[f.name] = ctx.editing[f.name] ?? null;
        if (f.social) payload[f.social] = ctx.editing[f.social] ?? null;
      }
    } else if (f.type === 'datetime-local') {
      // Lo escrito es hora de CHILE, no la del reloj de quien administra.
      // `new Date('2026-09-26T19:00')` interpretaba en el huso del navegador, y
      // como las páginas se arman en el Worker —que corre en UTC— la web
      // terminaba anunciando otra hora. Ver src/lib/hora.ts.
      payload[f.name] = el.value ? deChileAIso(el.value) : null;
    } else if (f.type === 'duracion') {
      /*
       * «Termina a las 18:00» → 540 minutos.
       *
       * La resta se hace contra el campo de fecha y hora de inicio del propio
       * formulario, no contra la fila guardada: si alguien corrige la hora de
       * inicio y la de término en el mismo gesto, lo que vale es lo que está
       * escrito en la pantalla.
       *
       * Vacío significa «la de siempre», que la base guarda como nulo (ver el
       * `check` de la migración 0012 y la nota de `duracion_min` en panel.ts).
       *
       * Si la hora de término es menor o igual que la de inicio se entiende que
       * termina al día siguiente: una vigilia de 22:00 a 01:00 son tres horas,
       * no menos veintiuna.
       */
      const inicio = ctx.campoFecha
        ? ((ctx.form.querySelector(`[name="${ctx.campoFecha}"]`) as HTMLInputElement | null)
            ?.value ?? '')
        : '';
      payload[f.name] = minutosEntre(inicio, el.value);
    } else if (f.type === 'number') {
      payload[f.name] = el.value === '' ? 0 : Number(el.value);
    } else {
      payload[f.name] = el.value.trim() === '' ? null : el.value.trim();
    }
  }

  return payload;
}
