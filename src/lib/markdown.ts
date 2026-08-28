import { marked } from 'marked';

/**
 * Convierte el cuerpo en Markdown de una noticia a HTML, en el servidor.
 *
 * Se ejecuta solo al renderizar la página: el visitante no descarga ni un byte
 * de librería de Markdown.
 *
 * SEGURIDAD — el texto se escapa ANTES de interpretarlo. Así, si alguien
 * pegara `<script>` o un `<img onerror=…>` en el panel, llega al lector como
 * texto literal y no como etiqueta. Solo existen las etiquetas que genera el
 * propio Markdown, y los enlaces con esquema peligroso se descartan.
 */
function escaparHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const ESQUEMA_SEGURO = /^(https?:|mailto:|tel:|\/|#)/i;

const renderer = new marked.Renderer();
const enlaceOriginal = renderer.link.bind(renderer);
renderer.link = function ({ href, title, tokens }: any) {
  if (!href || !ESQUEMA_SEGURO.test(String(href).trim())) {
    // Enlace con esquema no permitido (javascript:, data:…): se deja el texto.
    return this.parser.parseInline(tokens);
  }
  // `marked` tipa Link con más campos de los que hacen falta aquí; se pasa
  // exactamente lo que el renderer original usa.
  const html = enlaceOriginal({ href, title, tokens } as any);
  // Los enlaces externos salen en pestaña nueva y sin pasar referente.
  return /^https?:/i.test(String(href)) && !String(href).includes('lacasadedios')
    ? html.replace('<a ', '<a target="_blank" rel="noopener noreferrer" ')
    : html;
};

marked.use({ renderer, gfm: true, breaks: true });

export function renderMarkdown(texto: string | null | undefined): string {
  if (!texto) return '';
  return marked.parse(escaparHtml(texto), { async: false }) as string;
}

/** Primeros N caracteres en texto plano, para descripciones y resúmenes. */
export function markdownAResumen(texto: string | null | undefined, largo = 155): string {
  if (!texto) return '';
  const plano = texto
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#*_`>~-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return plano.length > largo ? plano.slice(0, largo - 1).trimEnd() + '…' : plano;
}
