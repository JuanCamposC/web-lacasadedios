/**
 * Lectura del feed de podcast de RSS.com, que es donde viven los audios del
 * estudio bíblico.
 *
 * ── POR QUÉ NO HAY UNA BIBLIOTECA ACÁ ───────────────────────────────────────
 * En Cloudflare Workers no existe `DOMParser`, así que las bibliotecas de XML
 * pensadas para el navegador no sirven, y las de Node arrastran dependencias
 * que no corren en este runtime. Traer un analizador de XML completo para leer
 * un feed de podcast —un formato fijo, plano y que genera siempre la misma
 * herramienta— sería pagar mucho por muy poco.
 *
 * Lo que hay abajo es un lector deliberadamente estrecho: entiende RSS 2.0 con
 * la extensión de iTunes, que es exactamente lo que emite RSS.com. No pretende
 * ser un analizador de XML y no hay que usarlo como tal.
 *
 * ── QUÉ PASA SI RSS.COM NO RESPONDE ─────────────────────────────────────────
 * `leerFeed` devuelve `null` en vez de reventar. La página sabe qué hacer con
 * eso: enseña el resto —la introducción, los horarios, cómo participar— y avisa
 * de que los audios no cargaron. El fallo de un tercero no puede tumbar una
 * página que además lleva información de la que la gente depende para llegar a
 * una reunión.
 */

export interface Episodio {
  /** Identificador estable del feed; sirve de ancla en la página. */
  guid: string;
  titulo: string;
  /** Resumen en texto plano, ya sin etiquetas HTML. */
  resumen: string;
  /** Página del episodio en RSS.com, para quien quiera compartirlo. */
  enlace: string | null;
  /** Dirección del audio. Sin esto no se puede escuchar y el episodio se descarta. */
  audio: string;
  tipoMime: string;
  /** Duración en segundos, o `null` si el feed no la trae. */
  duracionSeg: number | null;
  /** Fecha de publicación en ISO-8601, o `null` si venía ilegible. */
  fecha: string | null;
  temporada: number | null;
  numero: number | null;
}

export interface Feed {
  titulo: string;
  descripcion: string;
  imagen: string | null;
  /** Página pública del programa en RSS.com, si el feed la declara. */
  enlace: string | null;
  episodios: Episodio[];
}

// ── Utilidades de texto ─────────────────────────────────────────────────────

/**
 * Entidades a resolver.
 *
 * Las cinco primeras son las de XML. Las demás son de HTML, y hacen falta
 * porque el editor de RSS.com guarda las descripciones como HTML —dentro de
 * CDATA— y codifica ahí cada vocal acentuada. Sin esta tabla, un resumen escrito
 * en castellano normal llega a la página como «Leemos el cap&iacute;tulo
 * completo», que es exactamente lo que se ve: el código, en crudo, en medio de
 * la frase.
 *
 * No están todas las de HTML y no hace falta: están las que aparecen al escribir
 * en castellano y las de puntuación que mete un editor de texto enriquecido al
 * teclear comillas o guiones.
 */
const ENTIDADES: Record<string, string> = {
  // XML
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  // Castellano
  aacute: 'á',
  eacute: 'é',
  iacute: 'í',
  oacute: 'ó',
  uacute: 'ú',
  Aacute: 'Á',
  Eacute: 'É',
  Iacute: 'Í',
  Oacute: 'Ó',
  Uacute: 'Ú',
  ntilde: 'ñ',
  Ntilde: 'Ñ',
  uuml: 'ü',
  Uuml: 'Ü',
  iquest: '¿',
  iexcl: '¡',
  ordf: 'ª',
  ordm: 'º',
  deg: '°',
  // Puntuación que meten los editores de texto enriquecido
  nbsp: ' ',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  laquo: '«',
  raquo: '»',
  ldquo: '“',
  rdquo: '”',
  lsquo: '‘',
  rsquo: '’',
  middot: '·',
};

function desescapar(s: string): string {
  return (
    s
      // Primero las numéricas: `&#38;` es `&`, y resolverlas después dejaría
      // entidades a medio montar.
      .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
      .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
      // Una entidad desconocida se deja tal cual en vez de borrarla: es más
      // fácil ver «&trade;» en la página y añadirla arriba que preguntarse por
      // qué falta una palabra.
      .replace(/&([a-zA-Z]+);/g, (entera, nombre) => ENTIDADES[nombre] ?? entera)
  );
}

/** Escapa lo que en una expresión regular significaría otra cosa. */
const literal = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Saca el contenido de `<etiqueta>…</etiqueta>`, resolviendo CDATA. */
function etiqueta(xml: string, nombre: string): string {
  const m = new RegExp(
    `<${literal(nombre)}(?:\\s[^>]*)?>([\\s\\S]*?)</${literal(nombre)}>`,
    'i',
  ).exec(xml);
  if (!m) return '';
  const bruto = m[1].trim();
  const cdata = /^<!\[CDATA\[([\s\S]*?)\]\]>$/.exec(bruto);
  return cdata ? cdata[1].trim() : desescapar(bruto);
}

/** Saca un atributo de la primera aparición de una etiqueta. */
function atributo(xml: string, nombre: string, attr: string): string | null {
  const m = new RegExp(`<${literal(nombre)}\\s[^>]*${literal(attr)}\\s*=\\s*"([^"]*)"`, 'i').exec(
    xml,
  );
  return m ? desescapar(m[1]) : null;
}

/**
 * De la descripción —que en RSS.com viene con HTML dentro— a texto corrido.
 *
 * Se quitan por completo `<script>` y `<style>` CON su contenido antes de nada:
 * borrar solo las etiquetas dejaría el código JavaScript suelto como si fuera
 * prosa del episodio. No es un problema de seguridad (el resultado se imprime
 * como texto, nunca como HTML), pero sí sería un párrafo absurdo en la página.
 */
export function aTextoPlano(html: string): string {
  return desescapar(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
      .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Recorta un texto a lo que cabe en una tarjeta, cortando entre palabras.
 *
 * Hace falta porque la descripción de un episodio no tiene tope y quien la
 * escribe suele meter ahí créditos, enlaces y avisos. Probando con un feed real,
 * cada tarjeta pasaba de una pantalla de alto y el reproductor —que es a lo que
 * viene la gente— quedaba fuera de la vista.
 *
 * Corta en el último espacio antes del límite, nunca a mitad de palabra, y
 * limpia la puntuación que quedaría colgando antes de los puntos suspensivos.
 * Lo completo sigue estando a un clic, en el enlace al episodio.
 */
export function recortar(texto: string, limite = 280): string {
  if (texto.length <= limite) return texto;
  const corte = texto.lastIndexOf(' ', limite);
  return texto.slice(0, corte > limite * 0.6 ? corte : limite).replace(/[\s.,;:—–-]+$/, '') + '…';
}

/**
 * `<itunes:duration>` en segundos.
 *
 * El formato no es uno solo: la especificación admite «3600», «45:30» y
 * «1:02:30», y cada programa de edición escribe el suyo. Se aceptan los tres
 * porque el feed lo genera quien sube el audio, no nosotros.
 */
export function duracionEnSegundos(bruto: string): number | null {
  const limpio = bruto.trim();
  if (!limpio) return null;
  if (/^\d+$/.test(limpio)) return Number(limpio);
  const partes = limpio.split(':');
  if (partes.length < 2 || partes.length > 3) return null;
  if (!partes.every((p) => /^\d+$/.test(p.trim()))) return null;
  return partes.reduce((total, p) => total * 60 + Number(p), 0);
}

/** RFC 822 (`Tue, 09 Sep 2026 12:00:00 +0000`) a ISO-8601, o `null`. */
function aIso(bruto: string): string | null {
  if (!bruto) return null;
  const t = Date.parse(bruto);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

const entero = (bruto: string): number | null =>
  /^\d+$/.test(bruto.trim()) ? Number(bruto) : null;

// ── Análisis del feed ───────────────────────────────────────────────────────

/**
 * Convierte el XML en episodios.
 *
 * Se exporta aparte de `leerFeed` para poder probarlo con XML de verdad sin
 * llamar a rss.com desde las pruebas.
 */
export function analizar(xml: string): Feed {
  // El `<channel>` lleva su propio `<title>` y su propia imagen, y cada `<item>`
  // lleva los suyos. Si se buscaran en todo el documento, el título del programa
  // ganaría al del primer episodio solo por estar antes.
  const primerItem = xml.indexOf('<item');
  const canal = primerItem >= 0 ? xml.slice(0, primerItem) : xml;

  const episodios: Episodio[] = [];
  for (const m of xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)) {
    const item = m[1];
    const audio = atributo(item, 'enclosure', 'url');
    // Sin audio no hay nada que escuchar. Se descarta en silencio en vez de
    // pintar una tarjeta con un reproductor que no suena.
    if (!audio) continue;

    const descripcion =
      etiqueta(item, 'itunes:summary') ||
      etiqueta(item, 'description') ||
      etiqueta(item, 'content:encoded');

    episodios.push({
      guid: etiqueta(item, 'guid') || audio,
      titulo: etiqueta(item, 'title') || 'Estudio sin título',
      resumen: recortar(aTextoPlano(descripcion)),
      enlace: etiqueta(item, 'link') || null,
      audio,
      tipoMime: atributo(item, 'enclosure', 'type') || 'audio/mpeg',
      duracionSeg: duracionEnSegundos(etiqueta(item, 'itunes:duration')),
      fecha: aIso(etiqueta(item, 'pubDate')),
      temporada: entero(etiqueta(item, 'itunes:season')),
      numero: entero(etiqueta(item, 'itunes:episode')),
    });
  }

  return {
    titulo: etiqueta(canal, 'title'),
    descripcion: aTextoPlano(etiqueta(canal, 'itunes:summary') || etiqueta(canal, 'description')),
    imagen: atributo(canal, 'itunes:image', 'href'),
    enlace: etiqueta(canal, 'link') || null,
    episodios,
  };
}

/** Dirección del feed, o `null` si todavía no está configurada. */
export function urlDelFeed(): string | null {
  const valor = (process.env.RSS_ESTUDIOS_URL ?? '').trim();
  if (!valor) return null;
  // Solo https. Por http, cualquiera en la red del visitante podría cambiar lo
  // que el sitio publica como enseñanza de la iglesia.
  return /^https:\/\//i.test(valor) ? valor : null;
}

/**
 * Trae el feed y lo convierte en episodios. `null` si no hay feed configurado,
 * si rss.com no responde o si lo que devuelve no se puede leer.
 *
 * ── SOBRE LA CACHÉ ──────────────────────────────────────────────────────────
 * `cacheTtl` hace que Cloudflare guarde la respuesta de rss.com en el borde. Sin
 * esto, cada visita sería un viaje a un servidor ajeno antes de poder responder,
 * y la velocidad del sitio pasaría a depender de la de ellos. Cinco minutos
 * sobran: un estudio se sube una vez por semana.
 */
export async function leerFeed(): Promise<Feed | null> {
  const url = urlDelFeed();
  if (!url) return null;

  try {
    const respuesta = await fetch(url, {
      headers: { accept: 'application/rss+xml, application/xml, text/xml' },
      cf: { cacheTtl: 300, cacheEverything: true },
    } as RequestInit);
    if (!respuesta.ok) return null;
    const feed = analizar(await respuesta.text());
    return feed.episodios.length > 0 ? feed : null;
  } catch {
    return null;
  }
}
