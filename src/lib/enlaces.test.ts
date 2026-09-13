import { describe, it, expect } from 'vitest';
import { plataformaDe, esEnlaceSeguro } from './enlaces';

describe('plataformaDe', () => {
  it('reconoce los enlaces del Linktree de los jóvenes', () => {
    expect(plataformaDe('https://open.spotify.com/playlist/3cI6HAUA3JJbpF5uNYY0Os').nombre).toBe(
      'Spotify',
    );
    expect(plataformaDe('https://music.apple.com/cl/playlist/x/pl.u-1').nombre).toBe('Apple Music');
    expect(plataformaDe('https://www.instagram.com/jovenescasadedios._').nombre).toBe('Instagram');
  });

  it('YouTube Music no se confunde con YouTube', () => {
    expect(plataformaDe('https://music.youtube.com/playlist?list=PL1').nombre).toBe(
      'YouTube Music',
    );
    expect(plataformaDe('https://www.youtube.com/@lacasadedioscl').nombre).toBe('YouTube');
  });

  it('un dominio que solo se parece no pasa por la marca', () => {
    expect(plataformaDe('https://notinstagram.com/x').nombre).toBe('');
    expect(plataformaDe('https://spotify.com.ejemplo.net/x').nombre).toBe('');
  });

  it('una dirección rota da la genérica en vez de romper la página', () => {
    expect(plataformaDe('no es una url').icono).toBe('lucide:link');
  });
});

describe('esEnlaceSeguro', () => {
  it('solo deja pasar http y https', () => {
    expect(esEnlaceSeguro('https://open.spotify.com/x')).toBe(true);
    expect(esEnlaceSeguro('javascript:alert(1)')).toBe(false);
    expect(esEnlaceSeguro('data:text/html,hola')).toBe(false);
    expect(esEnlaceSeguro('')).toBe(false);
  });
});
