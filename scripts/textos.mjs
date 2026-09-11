/**
 * Saca todos los textos del sitio a un archivo, ordenados y numerados.
 *
 * ── PARA QUÉ ────────────────────────────────────────────────────────────────
 * Para llevárselos al pastor y que los revise: en papel, en el correo, o donde
 * le acomode. Lo que se busca es aprobar las PALABRAS, así que sobra todo lo
 * demás — fotos, colores, botones de colores— y hace falta lo único que no se
 * puede perder: **saber dónde va cada texto**. Por eso cada uno lleva su página,
 * su número y qué es (título, párrafo, cita…).
 *
 * Con esa numeración, devolver correcciones es una línea: «2.4, cambiar
 * "comunidad" por "congregación"».
 *
 * ── DE DÓNDE SALEN ──────────────────────────────────────────────────────────
 * De las páginas ya compiladas, en `dist/client`. No de una copia escrita a
 * mano, que se desactualiza en cuanto alguien toca una frase, ni de los
 * archivos fuente, donde el texto está mezclado con el código y en un orden que
 * no es el que se lee.
 *
 * ── USO ─────────────────────────────────────────────────────────────────────
 *   npm run build
 *   node scripts/textos.mjs
 *
 * Sale `textos-del-sitio.txt`, que se abre en cualquier cosa y se imprime tal
 * cual. No hace falta servidor ni navegador.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/** En el orden en que se recorre el sitio, no en el del menú. */
const PAGINAS = [
  { archivo: 'dist/client/index.html', titulo: 'Inicio', ruta: '/' },
  {
    archivo: 'dist/client/sobre-nosotros/index.html',
    titulo: 'Sobre nosotros',
    ruta: '/sobre-nosotros',
  },
  { archivo: 'dist/client/horarios/index.html', titulo: 'Horarios', ruta: '/horarios' },
  { archivo: 'dist/client/templos/index.html', titulo: 'Nuestros templos', ruta: '/templos' },
  {
    archivo: 'dist/client/templos/santiago-centro/index.html',
    titulo: 'Templo Santiago Centro',
    ruta: '/templos/santiago-centro',
  },
  {
    archivo: 'dist/client/templos/san-miguel/index.html',
    titulo: 'Templo San Miguel',
    ruta: '/templos/san-miguel',
  },
  {
    archivo: 'dist/client/templos/limache/index.html',
    titulo: 'Templo Limache',
    ruta: '/templos/limache',
  },
  { archivo: 'dist/client/templos/coya/index.html', titulo: 'Templo Coya', ruta: '/templos/coya' },
  { archivo: 'dist/client/404.html', titulo: 'Si alguien se equivoca de dirección', ruta: '/404' },
];

/** Cómo se llama cada cosa en el documento, para que se entienda sin saber HTML. */
const NOMBRES = {
  h1: 'Título principal',
  h2: 'Título de sección',
  h3: 'Subtítulo',
  h4: 'Subtítulo menor',
  p: 'Párrafo',
  li: 'Punto de lista',
  blockquote: 'Cita',
  figcaption: 'Pie de foto',
  button: 'Botón',
  a: 'Botón',
  dt: 'Etiqueta',
  dd: 'Dato',
};

const ENTIDADES = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&aacute;': 'á',
  '&eacute;': 'é',
  '&iacute;': 'í',
  '&oacute;': 'ó',
  '&uacute;': 'ú',
  '&ntilde;': 'ñ',
  '&times;': '×',
  '&hellip;': '…',
  '&mdash;': '—',
  '&ndash;': '–',
};

/** Quita las etiquetas de dentro y deja el texto limpio en una sola línea. */
function limpiar(fragmento) {
  let t = fragmento.replace(/<[^>]*>/g, ' ');
  for (const [e, c] of Object.entries(ENTIDADES)) t = t.split(e).join(c);
  t = t.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
  return t.replace(/\s+/g, ' ').trim();
}

/**
 * El título y la descripción que se ven FUERA de la página: en la pestaña del
 * navegador y en los resultados de Google.
 *
 * Se incluyen porque son texto que alguien escribió y que nadie revisa nunca,
 * justamente porque no se ven al mirar la página. Son, además, lo primero que
 * lee quien busca la iglesia en Google, antes de decidir si entra.
 */
function metaDe(html) {
  const titulo = html.match(/<title>([\s\S]*?)<\/title>/i);
  const desc = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
  const salida = [];
  if (titulo) salida.push({ tipo: 'Título en la pestaña y en Google', texto: limpiar(titulo[1]) });
  if (desc) salida.push({ tipo: 'Descripción en Google', texto: limpiar(desc[1]) });
  return salida;
}

/**
 * Los textos de una página, en el orden en que se leen.
 *
 * Solo se mira lo de dentro de `<main>`: la navegación y el pie se repiten
 * iguales en las nueve páginas, y repetirlos nueve veces convertiría el
 * documento en algo que nadie termina de leer. Van una sola vez, al final.
 */
function textosDe(html, seccion = 'main', menu = false) {
  const main = html.match(new RegExp(`<${seccion}[^>]*>([\\s\\S]*?)</${seccion}>`, 'i'));
  if (!main) return [];

  const cuerpo = main[1]
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '');

  /**
   * En el cuerpo NO se miran los `span`: hay cientos, casi todos envolviendo un
   * trozo de una frase que ya sale entera por su párrafo.
   *
   * En el menú y el pie es al revés. Ahí cada enlace lleva su etiqueta y su
   * descripción en `span` separados dentro del mismo `<li>`, así que mirando el
   * `<li>` salía todo pegado: «Nosotros Quiénes somos Misión, visión y
   * valores». Mirando los `span` sale cada texto por su lado, que es lo que hay
   * que poder corregir.
   */
  const etiquetas = menu
    ? 'h1|h2|h3|h4|p|span|button'
    : 'h1|h2|h3|h4|p|li|blockquote|figcaption|dt|dd|button';
  const re = new RegExp(
    `<(${etiquetas})\\b[^>]*>([\\s\\S]*?)</\\1>|<a\\b([^>]*class="[^"]*btn[^"]*"[^>]*)>([\\s\\S]*?)</a>`,
    'gi',
  );

  const salida = [];
  let anterior = '';

  for (const m of cuerpo.matchAll(re)) {
    const etiqueta = (m[1] ?? 'a').toLowerCase();
    const texto = limpiar(m[2] ?? m[4] ?? '');

    // Vacíos, y el caso de un <p> que solo envuelve a otro: se repetiría.
    if (!texto || texto === anterior) continue;
    // Un contenedor que trae dentro todo lo que ya salió suelto.
    if (anterior && texto.includes(anterior) && texto.length > anterior.length * 2) continue;

    salida.push({ tipo: NOMBRES[etiqueta] ?? 'Texto', texto });
    anterior = texto;
  }

  return salida;
}

/** Parte un texto largo en líneas, para que se lea impreso. */
function ajustar(texto, ancho, sangria) {
  const palabras = texto.split(' ');
  const lineas = [];
  let linea = '';
  for (const p of palabras) {
    if ((linea + ' ' + p).trim().length > ancho) {
      lineas.push(linea.trim());
      linea = p;
    } else {
      linea += ' ' + p;
    }
  }
  if (linea.trim()) lineas.push(linea.trim());
  return lineas.map((l, i) => (i === 0 ? l : sangria + l)).join('\n');
}

// ── Armado del documento ────────────────────────────────────────────────────
//
// Escrito para que lo lea una persona mayor que no trabaja con computadores.
//
// Eso decidió cada detalle del formato: una sola numeración corrida —«el 47» se
// dice y se anota mucho mejor que «el 3.11»—, nada de jerga («título de
// sección», «punto de lista» no significan nada fuera de acá), líneas cortas
// para que el ojo no se pierda al volver, y espacio en blanco de sobra para
// escribir encima.
//
// Lo único que se marca es qué textos son botones: «Cómo llegar», suelto en una
// lista, no se entiende; sabiendo que es un botón, sí.

/** Qué es cada página, dicho como se lo explicarías a alguien. */
const QUE_ES = {
  '/': 'La primera pantalla, la que ve quien entra a la página.',
  '/sobre-nosotros': 'Quiénes somos, qué creemos y de dónde venimos.',
  '/horarios': 'Todas las reuniones de la semana, templo por templo.',
  '/templos': 'La lista de los cuatro templos.',
  '/templos/santiago-centro': 'La página del templo de Santiago Centro.',
  '/templos/san-miguel': 'La página del templo de San Miguel.',
  '/templos/limache': 'La página del templo de Limache.',
  '/templos/coya': 'La página del templo de Coya.',
  '/404': 'Lo que aparece si alguien escribe mal una dirección.',
};

const faltan = PAGINAS.filter((p) => !existsSync(p.archivo));
if (faltan.length === PAGINAS.length) {
  console.error('No encuentro las páginas compiladas. Corre primero:  npm run build');
  process.exit(1);
}

const hoy = new Intl.DateTimeFormat('es-CL', { dateStyle: 'long' }).format(new Date());
const ANCHO = 58; // Ancho del texto. Corto a propósito: se lee sin perder la línea.
const SANGRIA = '       '; // Donde empieza el texto, después del número.

const l = [];
let n = 0;

/** Un texto con su número, y sitio para escribir al lado. */
function apuntar(t) {
  n++;
  const marca = t.tipo === 'Botón' ? '   (botón)' : '';
  l.push('');
  l.push(`  ${String(n).padStart(3)}  ${ajustar(t.texto, ANCHO, SANGRIA)}${marca}`);
}

function titulo(texto, explicacion) {
  l.push('');
  l.push('');
  l.push('');
  l.push(`  ${'━'.repeat(ANCHO + 8)}`);
  l.push(`  ${texto}`);
  l.push(`  ${'━'.repeat(ANCHO + 8)}`);
  if (explicacion) {
    l.push('');
    l.push(`  ${explicacion}`);
  }
}

// ── Portada del documento ───────────────────────────────────────────────────

l.push('');
l.push('');
l.push('        LOS TEXTOS DE LA PÁGINA WEB');
l.push('        La Casa de Dios');
l.push('');
l.push(`        ${hoy}`);
l.push('');
l.push('');
l.push('');
l.push(
  `  ${ajustar('Acá están todas las palabras que aparecen en la página web, en el mismo orden en que se leen.', ANCHO + 8, '  ')}`,
);
l.push('');
l.push(
  `  ${ajustar('Cada texto tiene un número al lado. Si hay algo que cambiar, basta con anotar el número y lo que debería decir.', ANCHO + 8, '  ')}`,
);
l.push('');
l.push('        Por ejemplo:');
l.push('');
l.push('           47 — en vez de «comunidad», poner «congregación»');
l.push('');
l.push('');
l.push(
  `  ${ajustar('No están las fotos ni los colores: eso se ve en la página. Acá van solo las palabras.', ANCHO + 8, '  ')}`,
);

// ── Página por página ───────────────────────────────────────────────────────

let numeroPagina = 0;

for (const p of PAGINAS) {
  if (!existsSync(p.archivo)) continue;
  const html = readFileSync(p.archivo, 'utf8');
  const textos = textosDe(html);
  if (!textos.length) continue;

  numeroPagina++;
  titulo(`PÁGINA ${numeroPagina} — ${p.titulo.toUpperCase()}`, QUE_ES[p.ruta]);
  textos.forEach(apuntar);
}

// ── Contacto ────────────────────────────────────────────────────────────────

const contactoFuente = 'src/pages/contacto.astro';
if (existsSync(contactoFuente)) {
  const sueltos = [
    ...readFileSync(contactoFuente, 'utf8').matchAll(
      /<(h1|h2|h3|h4|p|label|button)\b[^>]*>([^<{}]{4,})</gi,
    ),
  ]
    .map((m) => ({ tipo: NOMBRES[m[1].toLowerCase()] ?? 'Texto', texto: limpiar(m[2]) }))
    .filter((t) => t.texto);

  if (sueltos.length) {
    numeroPagina++;
    titulo(
      `PÁGINA ${numeroPagina} — CONTACTO`,
      'El formulario para escribirle a la iglesia. La dirección, el\n  teléfono y el correo salen acá también, pero esos se revisan\n  aparte porque no son textos escritos: son datos.',
    );
    sueltos.forEach(apuntar);
  }
}

// ── El menú y el pie ────────────────────────────────────────────────────────

const portada = readFileSync(PAGINAS[0].archivo, 'utf8');
const comunes = [...textosDe(portada, 'nav', true), ...textosDe(portada, 'footer', true)];

if (comunes.length) {
  titulo(
    'EL MENÚ Y EL PIE DE PÁGINA',
    'Esto se ve igual en todas las páginas: arriba el menú para\n  moverse, y abajo del todo los datos de la iglesia.',
  );
  comunes.forEach(apuntar);
}

// ── Lo que sale en Google ───────────────────────────────────────────────────
//
// Va al final y aparte porque no se ve en la página: es lo que lee quien busca
// la iglesia en Google, antes de decidir si entra. Nadie lo revisa nunca,
// justamente porque no está a la vista.

const enGoogle = [];
for (const p of PAGINAS) {
  if (!existsSync(p.archivo)) continue;
  const m = metaDe(readFileSync(p.archivo, 'utf8'));
  if (m.length) enGoogle.push({ pagina: p.titulo, textos: m });
}

if (enGoogle.length) {
  titulo(
    'LO QUE APARECE EN GOOGLE',
    'Cuando alguien busca la iglesia en Google, ve esto antes de\n  entrar. No se ve dentro de la página, pero es lo primero que\n  lee la gente.',
  );
  for (const g of enGoogle) {
    l.push('');
    l.push(`  · ${g.pagina}`);
    g.textos.forEach(apuntar);
  }
}

l.push('');
l.push('');
l.push('');
l.push(`  ${'━'.repeat(ANCHO + 8)}`);
l.push(`  Son ${n} textos en total.`);
l.push(`  ${'━'.repeat(ANCHO + 8)}`);
l.push('');

const salida = resolve('textos-del-sitio.txt');
writeFileSync(salida, l.join('\n'), 'utf8');
console.log(`Listo: ${salida}`);
console.log(`${n} textos.`);
