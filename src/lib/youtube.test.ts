import { describe, it, expect } from 'vitest';
import { youtubeId } from './supabase';

/**
 * El identificador sale de una URL que se pega a mano en el panel y termina
 * dentro del `src` de un iframe. Si aceptara algo que no es un identificador,
 * ese texto acabaría en el atributo.
 */
describe('youtubeId', () => {
  it('reconoce las cuatro formas de URL', () => {
    expect(youtubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(youtubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(youtubeId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(youtubeId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('tolera parámetros de más detrás del identificador', () => {
    expect(youtubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s')).toBe('dQw4w9WgXcQ');
    expect(youtubeId('https://youtu.be/dQw4w9WgXcQ?si=abc')).toBe('dQw4w9WgXcQ');
  });

  it('devuelve null con una URL que no es de YouTube', () => {
    expect(youtubeId('https://vimeo.com/123456')).toBeNull();
    expect(youtubeId('https://ejemplo.cl/watch?v=dQw4w9WgXcQ')).toBeNull();
  });

  it('devuelve null con texto vacío o basura', () => {
    expect(youtubeId('')).toBeNull();
    expect(youtubeId('no es una url')).toBeNull();
  });

  it('devuelve null si el identificador no mide once caracteres', () => {
    expect(youtubeId('https://youtu.be/corto')).toBeNull();
  });

  it('no acepta caracteres fuera del alfabeto de los identificadores', () => {
    // Comillas y signos romperían el atributo src del iframe.
    expect(youtubeId('https://youtu.be/abc"onload=x')).toBeNull();
    expect(youtubeId('https://www.youtube.com/watch?v="><script>')).toBeNull();
  });
});
