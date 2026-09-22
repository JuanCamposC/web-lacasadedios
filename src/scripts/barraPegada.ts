/**
 * Las barras que se quedan pegadas arriba se retiran al terminar su contenido.
 *
 * ── QUÉ ARREGLA ─────────────────────────────────────────────────────────────
 * Una barra `sticky` deja de pegarse al llegar al final de su contenedor, y eso
 * ya está resuelto encerrándola con lo que filtra (ver `.ambito-filtro`). Pero
 * el último momento se ve mal: la barra queda apoyada justo en el borde de su
 * contenedor, que en páginas cortas cae dentro de la pantalla, y parece que
 * siguiera flotando sobre el pie de página.
 *
 * Acá se retira un poco antes y con un desvanecido, para que se entienda que
 * terminó lo que la barra gobernaba.
 *
 * ── POR QUÉ NO ES SOLO CSS ──────────────────────────────────────────────────
 * Porque hace falta saber dónde está el borde inferior del contenedor respecto
 * de la barra, y eso el CSS no lo puede preguntar. `scroll-driven animations`
 * lo haría, pero todavía no está en Safari, que es la mitad de las visitas.
 */

/** Cuánto antes del borde empieza a irse, en píxeles. */
const MARGEN = 24;

export function initBarrasPegadas() {
  const ambitos = Array.from(document.querySelectorAll<HTMLElement>('.ambito-filtro'));
  if (!ambitos.length) return;

  const pares = ambitos
    .map((ambito) => ({
      ambito,
      // La barra es el primer hijo pegajoso: no se le pide una clase propia
      // para que esto siga funcionando si mañana cambia el maquetado.
      barra: Array.from(ambito.children).find(
        (hijo): hijo is HTMLElement =>
          hijo instanceof HTMLElement && getComputedStyle(hijo).position === 'sticky',
      ),
    }))
    .filter((p): p is { ambito: HTMLElement; barra: HTMLElement } => Boolean(p.barra));

  if (!pares.length) return;

  let pedido = 0;
  const revisar = () => {
    pedido = 0;
    for (const { ambito, barra } of pares) {
      const fin = ambito.getBoundingClientRect().bottom;
      const barraAbajo = barra.getBoundingClientRect().bottom;
      barra.classList.toggle('barra-fuera', fin <= barraAbajo + MARGEN);
    }
  };

  // Una sola medición por fotograma: leer posiciones en cada evento de scroll
  // obliga al navegador a recalcular la maqueta decenas de veces por segundo.
  const alDesplazar = () => {
    if (pedido) return;
    pedido = requestAnimationFrame(revisar);
  };

  window.addEventListener('scroll', alDesplazar, { passive: true });
  window.addEventListener('resize', alDesplazar, { passive: true });
  revisar();
}
