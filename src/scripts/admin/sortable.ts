import Sortable from 'sortablejs';
import type { Contexto } from './tipos';
import { toast } from './ui';

/**
 * Reordenar arrastrando.
 *
 * Sustituye al campo «Orden (menor primero)»: en vez de imaginar números, se
 * mueve la tarjeta y se ve el resultado. Funciona con el dedo, que es como se
 * administra esto la mitad de las veces.
 */
export function initArrastre(ctx: Contexto) {
  if (!ctx.config.orderable) return;

  Sortable.create(ctx.listEl, {
    handle: '[data-asa]',
    animation: 160,
    ghostClass: 'opacity-40',
    // El arrastre solo tiene sentido viendo la lista completa: con un filtro
    // puesto, las posiciones que no se ven quedarían mal calculadas.
    filter: () => ctx.estado !== 'todos' || ctx.buscarEl.value.trim() !== '',
    onEnd: async () => {
      const ids = Array.from(ctx.listEl.querySelectorAll<HTMLElement>('[data-fila]')).map(
        (el) => el.dataset.fila!,
      );
      const col = ctx.config.orderable!.column;
      const asc = ctx.config.orderBy.ascending;

      // El servidor asigna la posicion segun el orden del arreglo, asi que
      // basta con mandarle los identificadores en el orden en que quedaron.
      const enOrden = asc ? ids : [...ids].reverse();
      enOrden.forEach((id, i) => {
        const row = ctx.filas.find((r) => r.id === id);
        if (row) row[col] = i;
      });

      try {
        await ctx.api.reordenar(enOrden);
        toast('Orden guardado');
      } catch (e) {
        toast('No se pudo guardar el nuevo orden: ' + (e as Error).message, 'error');
        ctx.load();
      }
    },
  });
}
