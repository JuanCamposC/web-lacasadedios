import { esc } from './ui';

/**
 * Editor con barra de formato sobre un `<textarea>` nativo.
 *
 * Markdown mínimo —negrita, cursiva, subtítulo, lista, cita, enlace—; a HTML lo
 * convierte el servidor al publicar. Se descartó un editor completo
 * (EasyMDE/CodeMirror) porque en el teléfono el teclado se comporta mucho peor
 * que en un campo nativo, y aquí se escribe desde el teléfono.
 *
 * No necesita el contexto del panel: opera solo sobre el DOM que recibe.
 */
export function initMarkdown(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('[data-md]').forEach((caja) => {
    const ta = caja.querySelector('textarea') as HTMLTextAreaElement;
    const salida = caja.querySelector('[data-md-out]') as HTMLElement;
    const btnPrev = caja.querySelector('[data-md-preview]') as HTMLButtonElement;

    const envolver = (antes: string, despues = antes, marcador = 'texto') => {
      const { selectionStart: a, selectionEnd: b, value } = ta;
      const sel = value.slice(a, b) || marcador;
      ta.value = value.slice(0, a) + antes + sel + despues + value.slice(b);
      ta.focus();
      ta.setSelectionRange(a + antes.length, a + antes.length + sel.length);
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    };

    const prefijo = (marca: string) => {
      const { selectionStart: a, value } = ta;
      const ini = value.lastIndexOf('\n', a - 1) + 1;
      ta.value = value.slice(0, ini) + marca + value.slice(ini);
      ta.focus();
      ta.setSelectionRange(a + marca.length, a + marca.length);
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    };

    const acciones: Record<string, () => void> = {
      bold: () => envolver('**', '**', 'negrita'),
      italic: () => envolver('_', '_', 'cursiva'),
      h2: () => prefijo('## '),
      ul: () => prefijo('- '),
      quote: () => prefijo('> '),
      link: () => envolver('[', '](https://)', 'texto del enlace'),
    };

    caja
      .querySelectorAll<HTMLButtonElement>('[data-md-cmd]')
      .forEach((b) => b.addEventListener('click', () => acciones[b.dataset.mdCmd!]?.()));

    ta.addEventListener('keydown', (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'b') {
        e.preventDefault();
        acciones.bold();
      }
      if (k === 'i') {
        e.preventDefault();
        acciones.italic();
      }
      if (k === 'k') {
        e.preventDefault();
        acciones.link();
      }
    });

    // Vista previa: el mismo Markdown mínimo, resuelto en el navegador solo
    // para mirar. Lo que se publica lo convierte el servidor.
    const aHtml = (md: string) =>
      esc(md)
        .replace(/^### (.*)$/gm, '<h3>$1</h3>')
        .replace(/^## (.*)$/gm, '<h2>$1</h2>')
        .replace(/^&gt; (.*)$/gm, '<blockquote>$1</blockquote>')
        .replace(/^[-*] (.*)$/gm, '<li>$1</li>')
        .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/_([^_]+)_/g, '<em>$1</em>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
        .split(/\n{2,}/)
        .map((b) => (/^<(h2|h3|ul|blockquote)/.test(b.trim()) ? b : `<p>${b.trim()}</p>`))
        .join('');

    btnPrev.addEventListener('click', () => {
      const viendo = salida.classList.toggle('hidden');
      ta.classList.toggle('hidden', !viendo);
      btnPrev.setAttribute('aria-pressed', String(!viendo));
      btnPrev.classList.toggle('btn-active', !viendo);
      btnPrev.textContent = viendo ? 'Vista previa' : 'Volver a editar';
      if (!viendo) {
        salida.innerHTML = ta.value.trim()
          ? aHtml(ta.value)
          : '<p class="italic opacity-50">Todavía no hay texto.</p>';
      }
    });
  });
}
