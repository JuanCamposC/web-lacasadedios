import type { Contexto } from './tipos';
import { deChileAIso, enChile, minutosEntre } from '../../lib/hora';

/**
 * Lo que se va a ver en el sitio, mientras se escribe.
 *
 * ── POR QUÉ ESTO EXISTE ─────────────────────────────────────────────────────
 * La pantalla del aviso emergente tiene vista previa desde el principio y es lo
 * que mejor funciona del panel: se escribe y se ve. Eventos y noticias no la
 * tenían, así que el ciclo era guardar → abrir el sitio en otra pestaña →
 * mirar → volver → corregir.
 *
 * Donde más se nota es con los afiches. Casi todo lo que se sube a un evento es
 * un afiche vertical, y la tarjeta del sitio es un recuadro ancho: hasta ahora
 * no había forma de saber cómo iba a quedar sin publicarlo primero.
 *
 * ── CÓMO SE CONSTRUYE ───────────────────────────────────────────────────────
 * Con `createElement` y `textContent`, nunca con `innerHTML`. Lo que se pinta
 * acá es exactamente lo que alguien está escribiendo en el formulario, así que
 * concatenar HTML con eso sería escribirse una inyección a sí mismo. Es la
 * misma regla que sigue la lista de «hoy» en /horarios.
 *
 * ── DE DÓNDE SALE LA IMAGEN ─────────────────────────────────────────────────
 * Del `<img>` que ya hay dentro de la zona de imagen, que es el mismo tanto si
 * la foto se acaba de elegir —ahí es un objeto de memoria— como si viene de una
 * fila guardada. No se vuelve a leer el archivo: ya está decodificado en la
 * página y pedirlo otra vez solo serviría para tener dos verdades.
 */

/** El valor de un campo del formulario, recortado. */
function valor(ctx: Contexto, nombre: string | undefined): string {
  if (!nombre) return '';
  const el = ctx.form.querySelector(`[name="${nombre}"]`) as
    HTMLInputElement | HTMLTextAreaElement | null;
  return el?.value?.trim() ?? '';
}

/** La imagen que la zona de imagen está enseñando ahora mismo, si hay alguna. */
function imagenActual(ctx: Contexto): string | null {
  const img = ctx.root.querySelector<HTMLImageElement>('[data-preview] img');
  return img?.src || null;
}

function elemento(etiqueta: string, clase: string, texto?: string): HTMLElement {
  const el = document.createElement(etiqueta);
  el.className = clase;
  if (texto !== undefined) el.textContent = texto;
  return el;
}

/**
 * La parte de arriba de la tarjeta: la imagen.
 *
 * Con `object-contain` sobre una copia desenfocada, igual que el sitio: un
 * afiche recortado a la forma del recuadro pierde el título por arriba y la
 * dirección por abajo. Si no hay imagen se enseña el hueco con el icono, que es
 * también lo que haría el sitio.
 */
function cabeceraConImagen(src: string | null, recortar: boolean): HTMLElement {
  const caja = elemento('div', 'relative h-40 overflow-hidden rounded-t bg-base-200');
  if (!src) {
    caja.className += ' flex items-center justify-center text-base-content/40';
    caja.append(elemento('span', 'text-xs', 'Sin imagen'));
    return caja;
  }

  if (!recortar) {
    const fondo = document.createElement('img');
    fondo.src = src;
    fondo.alt = '';
    fondo.setAttribute('aria-hidden', 'true');
    fondo.className = 'absolute inset-0 h-full w-full scale-125 object-cover blur-xl';
    caja.append(fondo);
  }

  const foto = document.createElement('img');
  foto.src = src;
  foto.alt = '';
  foto.className = `relative h-full w-full ${recortar ? 'object-cover' : 'object-contain'}`;
  caja.append(foto);
  return caja;
}

/** «NOV / 07», el taco de calendario de la tarjeta de evento. */
function tacoDeFecha(iso: string): HTMLElement {
  const taco = elemento(
    'div',
    'absolute left-3 top-3 flex w-12 flex-col items-center overflow-hidden rounded-lg bg-base-100 shadow',
  );
  taco.append(
    elemento(
      'span',
      'w-full bg-primary py-0.5 text-center text-[0.6rem] font-bold uppercase text-primary-content',
      enChile(iso, { month: 'short' }).replace('.', ''),
    ),
    elemento(
      'span',
      'font-data py-0.5 text-lg font-bold leading-none',
      enChile(iso, { day: '2-digit' }),
    ),
  );
  return taco;
}

/** La tarjeta de un evento, como la pinta /eventos. */
function tarjetaEvento(ctx: Contexto): HTMLElement {
  const caja = elemento('div', 'overflow-hidden rounded border border-base-300 bg-base-100');

  const titulo = valor(ctx, 'titulo') || 'Sin título todavía';
  const fechaLocal = valor(ctx, ctx.campoFecha);
  const iso = fechaLocal ? deChileAIso(fechaLocal) : null;
  const lugar = valor(ctx, 'lugar');
  const descripcion = valor(ctx, 'descripcion');

  const cabecera = cabeceraConImagen(imagenActual(ctx), false);
  if (iso) cabecera.append(tacoDeFecha(iso));

  // La franja de la hora, con el término si se dijo a qué hora acaba.
  if (iso) {
    const minutos = minutosEntre(fechaLocal, valor(ctx, 'duracion_min'));
    const desde = enChile(iso, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    const hasta = minutos
      ? enChile(new Date(new Date(iso).getTime() + minutos * 60_000).toISOString(), {
          hour: '2-digit',
          minute: '2-digit',
          hourCycle: 'h23',
        })
      : null;
    const todoElDia =
      ctx.form.querySelector<HTMLInputElement>('[name="todo_el_dia"]')?.checked ?? false;
    cabecera.append(
      elemento(
        'span',
        'absolute bottom-3 left-3 rounded-full bg-black/60 px-2.5 py-0.5 text-xs font-medium text-white backdrop-blur',
        todoElDia ? 'Todo el día' : hasta ? `${desde} a ${hasta}` : desde,
      ),
    );
  }
  caja.append(cabecera);

  const cuerpo = elemento('div', 'p-4');
  if (iso)
    cuerpo.append(
      elemento('p', 'text-xs text-base-content/70', enChile(iso, { dateStyle: 'long' })),
    );
  cuerpo.append(elemento('h3', 'mt-0.5 text-lg font-bold leading-snug', titulo));
  if (lugar) cuerpo.append(elemento('p', 'mt-1 text-sm font-medium text-accent', lugar));
  if (descripcion)
    cuerpo.append(elemento('p', 'clamp-3 mt-2 text-sm text-base-content/75', descripcion));
  caja.append(cuerpo);

  return caja;
}

/** La tarjeta de una noticia, como la pinta /noticias. */
function tarjetaNoticia(ctx: Contexto): HTMLElement {
  const caja = elemento('div', 'overflow-hidden rounded border border-base-300 bg-base-100');

  // La foto de una noticia SÍ se recorta: son fotografías, no afiches, y así se
  // ve igual que en el listado del sitio.
  caja.append(cabeceraConImagen(imagenActual(ctx), true));

  const cuerpo = elemento('div', 'p-4');
  const publicado = valor(ctx, 'publicado_en');
  const iso = publicado ? deChileAIso(publicado) : null;
  if (iso)
    cuerpo.append(
      elemento('p', 'text-xs text-base-content/70', enChile(iso, { dateStyle: 'long' })),
    );
  cuerpo.append(
    elemento(
      'h3',
      'mt-0.5 text-lg font-bold leading-snug',
      valor(ctx, 'titulo') || 'Sin título todavía',
    ),
  );
  const bajada = valor(ctx, 'bajada');
  if (bajada) cuerpo.append(elemento('p', 'clamp-3 mt-2 text-sm text-base-content/75', bajada));
  caja.append(cuerpo);

  return caja;
}

/**
 * La línea bajo «¿a qué hora termina?», que dice en palabras lo que se guardará.
 *
 * Una resta que no se ve es una resta en la que no se confía, y el número que
 * de verdad va a la base —minutos— no se enseña en ninguna parte. Acá se dice
 * cuánto dura y, si cruza la medianoche, que termina al día siguiente.
 */
function pintarDuracion(ctx: Contexto) {
  const campo = ctx.config.fields.find((f) => f.type === 'duracion');
  if (!campo) return;
  const caja = ctx.root.querySelector<HTMLElement>(`[data-duracion="${campo.name}"]`);
  const linea = caja?.querySelector<HTMLElement>('[data-duracion-previa]');
  if (!linea) return;

  const inicio = valor(ctx, ctx.campoFecha);
  const fin = valor(ctx, campo.name);

  if (!fin) {
    linea.textContent = 'Sin hora de término: el sitio no anuncia hasta cuándo dura.';
    linea.className = 'mt-1 block text-xs text-base-content/70';
    return;
  }
  if (!inicio) {
    linea.textContent = 'Falta la fecha y hora de inicio para poder calcular cuánto dura.';
    linea.className = 'mt-1 block text-xs text-warning';
    return;
  }

  const minutos = minutosEntre(inicio, fin);
  if (minutos === null) {
    linea.textContent = 'Esa hora de término es igual a la de inicio.';
    linea.className = 'mt-1 block text-xs text-warning';
    return;
  }

  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  const cuanto = [
    horas ? `${horas} ${horas === 1 ? 'hora' : 'horas'}` : '',
    resto ? `${resto} min` : '',
  ]
    .filter(Boolean)
    .join(' y ');
  // Cruza la medianoche cuando la hora escrita es menor o igual que la de
  // inicio: una vigilia de 22:00 a 01:00. Decirlo evita que parezca un error.
  const otroDia =
    minutos + Number(inicio.slice(11, 13)) * 60 + Number(inicio.slice(14, 16)) >= 1440;
  linea.textContent = `Dura ${cuanto}${otroDia ? `, hasta las ${fin} del día siguiente` : ''}.`;
  linea.className = 'mt-1 block text-xs text-success';
}

/**
 * Engancha la vista previa al formulario.
 *
 * Tres disparadores, y los tres hacen falta:
 *   · `input` y `change`, para lo que se escribe y lo que se elige.
 *   · `crud:rellenado`, para cuando el formulario se rellena desde JavaScript
 *     —al abrir una fila para editarla—, que no dispara ninguno de los dos.
 *   · un observador sobre la zona de imagen, porque elegir una foto la pinta de
 *     forma asíncrona (hay que reducirla antes) y eso tampoco es un evento del
 *     formulario.
 */
export function initVistaPrevia(ctx: Contexto) {
  const pintar = () => {
    pintarDuracion(ctx);

    const caja = ctx.root.querySelector<HTMLElement>('[data-vista-previa]');
    const destino = caja?.querySelector<HTMLElement>('[data-vp-tarjeta]');
    if (!destino) return;
    destino.replaceChildren(
      caja!.dataset.vistaPrevia === 'noticia' ? tarjetaNoticia(ctx) : tarjetaEvento(ctx),
    );
  };

  ctx.form.addEventListener('input', pintar);
  ctx.form.addEventListener('change', pintar);
  ctx.form.addEventListener('crud:rellenado', pintar);

  const zona = ctx.root.querySelector('[data-zona]');
  if (zona) new MutationObserver(pintar).observe(zona, { childList: true, subtree: true });

  pintar();
}
