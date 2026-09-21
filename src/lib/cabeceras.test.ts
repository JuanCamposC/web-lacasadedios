import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { conSeguridad, SEGURIDAD } from './cabeceras';

/**
 * Lo que se vigila acá no son las cabeceras de seguridad —esas son una lista
 * fija— sino la regla del `noindex`, que es la que decide si el sitio de pruebas
 * aparece o no en Google.
 *
 * Equivocarse hacia un lado no se nota hasta que alguien busca la iglesia y le
 * salen dos resultados; hacia el otro, hasta que el sitio de verdad ha
 * desaparecido del buscador. Por eso se fijan los dos sentidos, y no solo el que
 * interesa hoy.
 */

const ORIGINAL = { ...process.env };
const respuesta = () => new Response('hola');

beforeEach(() => {
  delete process.env.SITE_URL;
});

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe('conSeguridad', () => {
  it('pone las cabeceras de seguridad', () => {
    const r = conSeguridad(respuesta());
    for (const nombre of Object.keys(SEGURIDAD)) {
      expect(r.headers.get(nombre)).toBe(SEGURIDAD[nombre]);
    }
  });

  it('no pisa una cabecera que la ruta puso a propósito', () => {
    const r = conSeguridad(new Response('x', { headers: { 'X-Frame-Options': 'SAMEORIGIN' } }));
    expect(r.headers.get('X-Frame-Options')).toBe('SAMEORIGIN');
  });

  describe('noindex', () => {
    it('marca el despliegue de pruebas', () => {
      process.env.SITE_URL = 'https://pruebas.lacasadedios.cl';
      expect(conSeguridad(respuesta()).headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    });

    // El sentido que de verdad duele: un `noindex` colado en producción saca a
    // la iglesia del buscador y nadie se entera hasta semanas después.
    it('NO marca producción, ni con www ni sin él', () => {
      for (const url of ['https://lacasadedios.cl', 'https://www.lacasadedios.cl']) {
        process.env.SITE_URL = url;
        expect(conSeguridad(respuesta()).headers.get('X-Robots-Tag')).toBeNull();
      }
    });

    it('la barra final o una ruta no cambian la decisión', () => {
      process.env.SITE_URL = 'https://lacasadedios.cl/';
      expect(conSeguridad(respuesta()).headers.get('X-Robots-Tag')).toBeNull();
    });

    // Sin SITE_URL se asume producción: de los dos errores, borrar el sitio real
    // del buscador es mucho peor que indexar de más uno de pruebas, que además
    // está detrás de Access.
    it('sin SITE_URL asume producción y no marca nada', () => {
      expect(conSeguridad(respuesta()).headers.get('X-Robots-Tag')).toBeNull();
    });

    it('una SITE_URL que no es una dirección no cuenta como producción', () => {
      process.env.SITE_URL = 'lacasadedios.cl';
      expect(conSeguridad(respuesta()).headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    });

    it('respeta el valor que ya traiga la respuesta', () => {
      process.env.SITE_URL = 'https://pruebas.lacasadedios.cl';
      const r = conSeguridad(new Response('x', { headers: { 'X-Robots-Tag': 'noindex' } }));
      expect(r.headers.get('X-Robots-Tag')).toBe('noindex');
    });
  });
});

describe('noindex por nombre de dominio', () => {
  it('pruebas pide no indexarse aunque el despliegue sea el de producción', () => {
    // Desde el lanzamiento, el MISMO Worker sirve el sitio y pruebas, con la
    // misma SITE_URL. Sin mirar el nombre, pruebas quedó indexable.
    process.env.SITE_URL = 'https://lacasadedios.cl';
    const r = conSeguridad(new Response('x'), new URL('https://pruebas.lacasadedios.cl/horarios'));
    expect(r.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
  });

  it('el sitio real NO pide no indexarse', () => {
    process.env.SITE_URL = 'https://lacasadedios.cl';
    const r = conSeguridad(new Response('x'), new URL('https://lacasadedios.cl/horarios'));
    expect(r.headers.get('X-Robots-Tag')).toBeNull();
  });

  it('sin nombre de petición manda SITE_URL, y producción se indexa', () => {
    // El nombre no siempre llega. Ante la duda, lo caro es sacar del buscador
    // el sitio de verdad, así que esa es la que no puede pasar por descuido.
    process.env.SITE_URL = 'https://lacasadedios.cl';
    expect(conSeguridad(new Response('x')).headers.get('X-Robots-Tag')).toBeNull();
  });
});
