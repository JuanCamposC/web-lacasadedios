import { api } from './api';

/**
 * El interruptor de «se ve en el sitio» de cada episodio del Instituto.
 *
 * Esconder = crear una fila en `estudios_ocultos`. Volver a enseñar = borrarla.
 * No hay nada que editar, así que no hay formulario ni botón de guardar: el
 * interruptor guarda solo.
 *
 * El id de la fila se recuerda en el `dataset` del propio elemento porque es lo
 * que hace falta para borrarla después, y así no hay que volver a preguntarle
 * al servidor entre un clic y el siguiente.
 */
export function setupOcultos() {
  const estado = document.querySelector<HTMLElement>('[data-estado]');

  const decir = (texto: string) => {
    if (estado) estado.textContent = texto;
  };

  document.querySelectorAll<HTMLElement>('[data-episodio]').forEach((fila) => {
    const casilla = fila.querySelector<HTMLInputElement>('[data-ver]');
    const etiqueta = fila.querySelector<HTMLElement>('[data-etiqueta]');
    if (!casilla || casilla.dataset.listo) return;
    casilla.dataset.listo = '1';

    casilla.addEventListener('change', async () => {
      const guid = fila.dataset.guid ?? '';
      const titulo = fila.dataset.titulo ?? '';
      const seVe = casilla.checked;

      // Se bloquea mientras viaja: dos clics seguidos crearían dos filas para
      // el mismo episodio, y la base solo admite una (`guid` es único).
      casilla.disabled = true;
      decir(seVe ? 'Enseñando el episodio…' : 'Escondiendo el episodio…');

      try {
        if (seVe) {
          const id = fila.dataset.fila;
          if (id) await api.borrar('estudios_ocultos', id);
          fila.dataset.fila = '';
        } else {
          const { id } = await api.crear('estudios_ocultos', { guid, titulo });
          fila.dataset.fila = id;
        }
        if (etiqueta) etiqueta.hidden = seVe;
        fila.classList.toggle('opacity-55', !seVe);
        decir(
          seVe
            ? `«${titulo}» vuelve a verse en el sitio.`
            : `«${titulo}» ya no se ve en el sitio. Sigue publicado en RSS.com.`,
        );
      } catch (e) {
        // El interruptor vuelve a donde estaba: dejarlo movido diría que se
        // guardó algo que no se guardó.
        casilla.checked = !seVe;
        decir(`No se pudo guardar: ${e instanceof Error ? e.message : 'error desconocido'}`);
      } finally {
        casilla.disabled = false;
      }
    });

    // Estado inicial, para que un episodio escondido se note de un vistazo.
    fila.classList.toggle('opacity-55', !casilla.checked);
  });
}
