/**
 * Filtro por templo de noticias, eventos y videos.
 *
 * Trabaja sobre lo ya pintado —esconde y muestra— en vez de volver a consultar
 * la base: los listados no pasan de unas decenas de fichas, así que una
 * segunda vuelta al servidor por cada clic costaría más de lo que ahorra y
 * añadiría un parpadeo donde ahora no hay ninguno.
 *
 * Cada ficha filtrable lleva `data-etiqueta` con su templo. La regla está en
 * src/data/etiquetas.ts y se repite aquí porque este módulo corre en el
 * navegador y no puede importar del servidor sin arrastrar el resto.
 */

const GENERAL = 'general';

/** Lo general aparece siempre; ver `coincide` en src/data/etiquetas.ts. */
function coincide(etiqueta: string, filtro: string): boolean {
  if (filtro === 'all') return true;
  const e = etiqueta || GENERAL;
  return e === filtro || e === GENERAL;
}

function initFiltro() {
  const barra = document.querySelector<HTMLElement>('[data-filtro-templos]');
  if (!barra || barra.dataset.listo) return;
  barra.dataset.listo = '1';

  const chips = Array.from(barra.querySelectorAll<HTMLButtonElement>('.filtro-chip'));
  const fichas = Array.from(document.querySelectorAll<HTMLElement>('[data-etiqueta]'));
  const vacio = document.querySelector<HTMLElement>('[data-filtro-vacio]');
  if (!chips.length || !fichas.length) return;

  const activo = 'border-primary bg-primary text-primary-content';
  const inactivo = 'border-base-300 bg-base-100 hover:border-primary hover:text-primary';

  const aplicar = (slug: string) => {
    let visibles = 0;
    fichas.forEach((f) => {
      const ok = coincide(f.dataset.etiqueta ?? '', slug);
      f.classList.toggle('hidden', !ok);
      if (ok) visibles++;
    });

    vacio?.classList.toggle('hidden', visibles > 0);

    chips.forEach((c) => {
      const on = c.dataset.filter === slug;
      c.setAttribute('aria-pressed', String(on));
      c.className = `filtro-chip shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition ${on ? activo : inactivo}`;
    });

    // La elección queda en la URL sin recargar: así se puede compartir o
    // recargar la página filtrada, y el botón atrás sigue haciendo lo suyo.
    const url = new URL(location.href);
    if (slug === 'all') url.searchParams.delete('templo');
    else url.searchParams.set('templo', slug);
    history.replaceState(null, '', url);
  };

  chips.forEach((c) => c.addEventListener('click', () => aplicar(c.dataset.filter || 'all')));

  const pedido = new URLSearchParams(location.search).get('templo');
  aplicar(pedido && chips.some((c) => c.dataset.filter === pedido) ? pedido : 'all');
}

document.addEventListener('astro:page-load', initFiltro);
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFiltro);
} else {
  initFiltro();
}
