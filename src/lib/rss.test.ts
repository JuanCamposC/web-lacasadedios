import { describe, it, expect, afterEach } from 'vitest';
import { analizar, aTextoPlano, duracionEnSegundos, recortar, urlDelFeed } from './rss';

/**
 * Pruebas del lector del feed de RSS.com.
 *
 * Lo que se vigila acá no es «que analice XML» —no es un analizador de XML—
 * sino las cuatro formas concretas en que esto se rompe sin avisar:
 *
 *   · que el título del PROGRAMA se cuele como título del primer episodio,
 *   · que la descripción salga con etiquetas HTML a la vista,
 *   · que una duración escrita en otro formato quede en blanco,
 *   · que un episodio sin audio pinte un reproductor mudo.
 *
 * Ninguna de las cuatro da error: dan una página que se ve bien y miente.
 */

/** Un feed como los que emite RSS.com, recortado pero con sus rarezas. */
const FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
     xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Conociendo la Palabra</title>
    <link>https://rss.com/podcasts/conociendo-la-palabra/</link>
    <description><![CDATA[<p>Estudio b&iacute;blico semanal de <b>La Casa de Dios</b>.</p>]]></description>
    <itunes:image href="https://media.rss.com/conociendo/cover.jpg"/>
    <item>
      <title><![CDATA[Efesios 2: salvos por gracia]]></title>
      <link>https://rss.com/podcasts/conociendo-la-palabra/1/</link>
      <description><![CDATA[<p>Primera parte.</p><p>Leemos el cap&iacute;tulo completo.</p><script>alert(1)</script>]]></description>
      <enclosure url="https://media.rss.com/conociendo/ef2.mp3" length="48210944" type="audio/mpeg"/>
      <guid isPermaLink="false">ef2-2026</guid>
      <pubDate>Mon, 07 Sep 2026 23:00:00 +0000</pubDate>
      <itunes:duration>1:02:30</itunes:duration>
      <itunes:episode>12</itunes:episode>
      <itunes:season>2</itunes:season>
    </item>
    <item>
      <title>Ropa &amp; comida: Mateo 6</title>
      <description>Sin adornos.</description>
      <enclosure url="https://media.rss.com/conociendo/mt6.mp3" type="audio/mpeg"/>
      <guid>mt6-2026</guid>
      <pubDate>Mon, 31 Aug 2026 23:00:00 +0000</pubDate>
      <itunes:duration>2715</itunes:duration>
    </item>
    <item>
      <title>Anuncio sin audio</title>
      <description>Todavía no está subido.</description>
      <guid>vacio</guid>
    </item>
  </channel>
</rss>`;

describe('analizar', () => {
  const feed = analizar(FEED);

  it('no confunde el título del programa con el del primer episodio', () => {
    // Es el error más silencioso de todos: `<title>` aparece dos veces y la
    // primera es la del canal. Si se buscara en todo el documento, la lista
    // entera empezaría por «Conociendo la Palabra».
    expect(feed.titulo).toBe('Conociendo la Palabra');
    expect(feed.episodios[0].titulo).toBe('Efesios 2: salvos por gracia');
  });

  it('tampoco confunde el enlace del programa con el del primer episodio', () => {
    // Mismo error que el anterior, en otra etiqueta: el botón «Ver los N
    // estudios» acabaría llevando a un episodio suelto.
    expect(feed.enlace).toBe('https://rss.com/podcasts/conociendo-la-palabra/');
    expect(feed.episodios[0].enlace).toBe('https://rss.com/podcasts/conociendo-la-palabra/1/');
  });

  it('descarta los episodios sin audio', () => {
    expect(feed.episodios).toHaveLength(2);
    expect(feed.episodios.map((e) => e.guid)).not.toContain('vacio');
  });

  it('deja la descripción en texto corrido, sin HTML ni scripts', () => {
    const resumen = feed.episodios[0].resumen;
    expect(resumen).not.toMatch(/</);
    expect(resumen).not.toContain('alert');
    expect(resumen).toContain('Primera parte.');
    expect(resumen).toContain('Leemos el capítulo completo.');
  });

  it('resuelve las entidades del título', () => {
    expect(feed.episodios[1].titulo).toBe('Ropa & comida: Mateo 6');
  });

  it('lee el audio, su tipo y la portada del programa', () => {
    expect(feed.episodios[0].audio).toBe('https://media.rss.com/conociendo/ef2.mp3');
    expect(feed.episodios[0].tipoMime).toBe('audio/mpeg');
    expect(feed.imagen).toBe('https://media.rss.com/conociendo/cover.jpg');
  });

  it('pasa la fecha a ISO y lee número y temporada', () => {
    expect(feed.episodios[0].fecha).toBe('2026-09-07T23:00:00.000Z');
    expect(feed.episodios[0].numero).toBe(12);
    expect(feed.episodios[0].temporada).toBe(2);
    // El segundo no los trae: han de quedar en null, no en 0 ni en NaN.
    expect(feed.episodios[1].numero).toBeNull();
    expect(feed.episodios[1].temporada).toBeNull();
  });

  it('aguanta un feed vacío o ilegible sin reventar', () => {
    expect(analizar('').episodios).toEqual([]);
    expect(analizar('<html><body>404</body></html>').episodios).toEqual([]);
  });
});

describe('duracionEnSegundos', () => {
  // Los tres formatos que admite la especificación de iTunes. Cada programa de
  // edición escribe el suyo, y el feed lo genera quien sube el audio.
  it('entiende los tres formatos', () => {
    expect(duracionEnSegundos('3600')).toBe(3600);
    expect(duracionEnSegundos('45:30')).toBe(2730);
    expect(duracionEnSegundos('1:02:30')).toBe(3750);
  });

  it('devuelve null cuando no se puede leer', () => {
    expect(duracionEnSegundos('')).toBeNull();
    expect(duracionEnSegundos('una hora')).toBeNull();
    expect(duracionEnSegundos('1:2:3:4')).toBeNull();
  });
});

describe('aTextoPlano', () => {
  it('convierte los cortes de HTML en saltos de línea, no en palabras pegadas', () => {
    expect(aTextoPlano('<p>Uno</p><p>Dos</p>')).toBe('Uno\nDos');
    expect(aTextoPlano('Uno<br>Dos')).toBe('Uno\nDos');
  });

  it('borra el contenido de script y style, no solo sus etiquetas', () => {
    expect(aTextoPlano('<style>p{color:red}</style>Hola')).toBe('Hola');
  });

  it('resuelve las entidades HTML del castellano', () => {
    // El editor de RSS.com codifica cada acento. Si esto falla, la página no da
    // ningún error: enseña «Efesios cap&iacute;tulo 2» en medio del párrafo.
    expect(aTextoPlano('Efesios cap&iacute;tulo 2, &iexcl;gracia!')).toBe(
      'Efesios capítulo 2, ¡gracia!',
    );
    expect(aTextoPlano('Ma&ntilde;ana&nbsp;a las 20:00')).toBe('Mañana a las 20:00');
  });

  it('deja intacta una entidad que no conoce, en vez de comérsela', () => {
    expect(aTextoPlano('Marca&trade; registrada')).toBe('Marca&trade; registrada');
  });
});

describe('recortar', () => {
  it('deja en paz lo que ya es corto', () => {
    expect(recortar('Efesios 2, primera parte.')).toBe('Efesios 2, primera parte.');
  });

  it('corta entre palabras, nunca a mitad de una', () => {
    const largo = 'palabra '.repeat(60).trim();
    const corto = recortar(largo, 50);
    expect(corto.endsWith('…')).toBe(true);
    expect(corto.length).toBeLessThanOrEqual(51);
    // Lo que importa: ninguna palabra partida. Cada trozo antes de los puntos
    // suspensivos tiene que ser una palabra entera.
    expect(
      corto
        .slice(0, -1)
        .trim()
        .split(' ')
        .every((p) => p === 'palabra'),
    ).toBe(true);
  });

  it('no deja puntuación colgando antes de los puntos suspensivos', () => {
    expect(recortar('Uno dos tres, cuatro cinco', 13)).toBe('Uno dos tres…');
  });

  it('corta en seco si no hay ningún espacio donde cortar', () => {
    // Una dirección larguísima sin espacios: mejor cortada que reventando la
    // tarjeta.
    const sinEspacios = 'a'.repeat(400);
    expect(recortar(sinEspacios, 100)).toHaveLength(101);
  });
});

describe('urlDelFeed', () => {
  const original = process.env.RSS_ESTUDIOS_URL;
  afterEach(() => {
    process.env.RSS_ESTUDIOS_URL = original;
  });

  it('null cuando no está configurada', () => {
    process.env.RSS_ESTUDIOS_URL = '';
    expect(urlDelFeed()).toBeNull();
  });

  it('rechaza http', () => {
    // Por http, cualquiera en la red del visitante podría reemplazar lo que el
    // sitio publica como enseñanza de la iglesia.
    process.env.RSS_ESTUDIOS_URL = 'http://media.rss.com/x/feed.xml';
    expect(urlDelFeed()).toBeNull();
  });

  it('acepta https', () => {
    process.env.RSS_ESTUDIOS_URL = ' https://media.rss.com/x/feed.xml ';
    expect(urlDelFeed()).toBe('https://media.rss.com/x/feed.xml');
  });
});
