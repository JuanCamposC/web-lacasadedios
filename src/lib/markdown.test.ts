import { describe, it, expect } from 'vitest';
import { renderMarkdown, markdownAResumen } from './markdown';

/**
 * El cuerpo de una noticia lo escribe una persona en el panel y se publica tal
 * cual en una página pública. Es la única entrada del sitio que se convierte en
 * HTML, así que es la que hay que sostener con pruebas.
 */
describe('renderMarkdown', () => {
  it('no deja pasar una etiqueta script', () => {
    const html = renderMarkdown('Hola <script>alert(1)</script> mundo');
    expect(html).not.toContain('<script');
    // Llega como texto visible, escapado.
    expect(html).toContain('&lt;script&gt;');
  });

  it('no deja pasar un manejador de eventos en una imagen', () => {
    const html = renderMarkdown('<img src=x onerror="alert(1)">');
    // El texto «onerror=» sigue ahí, pero como contenido escapado, no como
    // atributo: lo que importa es que no llegue a existir la etiqueta.
    expect(html).not.toMatch(/<img\b/);
    expect(html).toContain('&lt;img');
  });

  it('descarta el enlace con esquema javascript: y conserva el texto', () => {
    const html = renderMarkdown('[pincha aquí](javascript:alert(1))');
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('<a ');
    expect(html).toContain('pincha aquí');
  });

  it('descarta también data: y vbscript:', () => {
    for (const esquema of ['data:text/html;base64,PHNjcmlwdD4=', 'vbscript:msgbox(1)']) {
      const html = renderMarkdown(`[x](${esquema})`);
      expect(html).not.toContain('<a ');
    }
  });

  it('abre el enlace externo en otra pestaña y sin referente', () => {
    const html = renderMarkdown('[YouTube](https://www.youtube.com/algo)');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('deja el enlace propio en la misma pestaña', () => {
    const html = renderMarkdown('[Templos](https://lacasadedios.cl/templos)');
    expect(html).toContain('<a ');
    expect(html).not.toContain('target="_blank"');
  });

  it('deja el enlace relativo en la misma pestaña', () => {
    const html = renderMarkdown('[Horarios](/horarios)');
    expect(html).toContain('href="/horarios"');
    expect(html).not.toContain('target="_blank"');
  });

  it('sigue produciendo el Markdown de siempre', () => {
    const html = renderMarkdown('## Título\n\nTexto con **negrita**.');
    expect(html).toContain('<h2>');
    expect(html).toContain('<strong>');
  });

  it('devuelve cadena vacía sin texto', () => {
    expect(renderMarkdown('')).toBe('');
    expect(renderMarkdown(null)).toBe('');
    expect(renderMarkdown(undefined)).toBe('');
  });
});

describe('markdownAResumen', () => {
  it('quita el marcado y deja solo el texto', () => {
    expect(markdownAResumen('## Hola **mundo**')).toBe('Hola mundo');
  });

  it('conserva el texto del enlace y descarta la URL', () => {
    expect(markdownAResumen('Visita [nuestra sede](https://ejemplo.cl/muy/larga)')).toBe(
      'Visita nuestra sede',
    );
  });

  it('elimina las imágenes por completo', () => {
    expect(markdownAResumen('![foto](/a.jpg) Texto')).toBe('Texto');
  });

  it('trunca al largo pedido y cierra con puntos suspensivos', () => {
    const resumen = markdownAResumen('a'.repeat(300), 50);
    expect(resumen).toHaveLength(50);
    expect(resumen.endsWith('…')).toBe(true);
  });

  it('no trunca lo que ya cabe', () => {
    const corto = 'Un texto breve';
    expect(markdownAResumen(corto, 155)).toBe(corto);
    expect(markdownAResumen(corto, 155)).not.toContain('…');
  });

  it('colapsa los espacios y saltos de línea', () => {
    expect(markdownAResumen('Uno\n\n  dos   tres')).toBe('Uno dos tres');
  });

  it('devuelve cadena vacía sin texto', () => {
    expect(markdownAResumen(null)).toBe('');
    expect(markdownAResumen(undefined)).toBe('');
  });
});
