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
  { archivo: 'dist/client/index.html', titulo: 'Portada', ruta: '/' },
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
  { archivo: 'dist/client/404.html', titulo: 'Página no encontrada', ruta: '/404' },
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

const faltan = PAGINAS.filter((p) => !existsSync(p.archivo));
if (faltan.length === PAGINAS.length) {
  console.error('No encuentro las páginas compiladas. Corre primero:  npm run build');
  process.exit(1);
}

const hoy = new Intl.DateTimeFormat('es-CL', { dateStyle: 'long' }).format(new Date());
const ANCHO = 74;
const l = [];

l.push('='.repeat(ANCHO));
l.push('LA CASA DE DIOS · TEXTOS DEL SITIO WEB');
l.push('='.repeat(ANCHO));
l.push('');
l.push(`Generado el ${hoy}.`);
l.push('');
l.push(
  ajustar(
    'Estos son todos los textos que aparecen hoy en el sitio, en el orden en que se recorren. Cada uno lleva un número: para corregir algo basta con anotar ese número y lo que debería decir. Por ejemplo: «2.4 — cambiar comunidad por congregación».',
    ANCHO,
    '',
  ),
);
l.push('');
l.push(
  ajustar(
    'No están las fotos ni los botones de navegación: lo que se revisa acá son las palabras. Los eventos, las noticias y los videos tampoco, porque se cargan desde el panel y cambian solos.',
    ANCHO,
    '',
  ),
);
l.push('');

let numeroPagina = 0;
let total = 0;

for (const p of PAGINAS) {
  if (!existsSync(p.archivo)) continue;
  const textos = textosDe(readFileSync(p.archivo, 'utf8'));
  if (!textos.length) continue;

  numeroPagina++;
  l.push('');
  l.push('');
  l.push('─'.repeat(ANCHO));
  l.push(`${numeroPagina} · ${p.titulo.toUpperCase()}`);
  l.push(`   lacasadedios.cl${p.ruta === '/' ? '' : p.ruta}`);
  l.push('─'.repeat(ANCHO));

  const todos = [...metaDe(readFileSync(p.archivo, 'utf8')), ...textos];

  todos.forEach((t, i) => {
    const num = `${numeroPagina}.${i + 1}`;
    l.push('');
    l.push(`  ${num.padEnd(6)} ${t.tipo}`);
    l.push(`         ${ajustar(t.texto, ANCHO - 9, '         ')}`);
    total++;
  });
}

// ── La página de contacto ───────────────────────────────────────────────────
//
// No está en `dist` porque se arma al servir: tiene formulario y enseña el
// resultado del envío. Así que sus textos se leen del código.
//
// Es una lectura más pobre —salen los que están escritos literalmente, no los
// que vienen de un componente o de `src/data/site.ts`— y por eso el documento
// lo dice en vez de disimularlo. Dejarla fuera en silencio habría sido peor:
// alguien la echa de menos y no sabe si falta o si no tiene texto.
const contactoFuente = 'src/pages/contacto.astro';
if (existsSync(contactoFuente)) {
  const fuente = readFileSync(contactoFuente, 'utf8');
  const sueltos = [...fuente.matchAll(/<(h1|h2|h3|h4|p|label|button)\b[^>]*>([^<{}]{4,})</gi)]
    .map((m) => ({ tipo: NOMBRES[m[1].toLowerCase()] ?? 'Texto', texto: limpiar(m[2]) }))
    .filter((t) => t.texto);

  if (sueltos.length) {
    numeroPagina++;
    l.push('');
    l.push('');
    l.push('─'.repeat(ANCHO));
    l.push(`${numeroPagina} · CONTACTO`);
    l.push('   lacasadedios.cl/contacto');
    l.push('─'.repeat(ANCHO));
    l.push('');
    l.push(
      ajustar(
        'Esta página se arma al abrirla, así que sus textos se leyeron del código. Salen los que están escritos ahí directamente; los datos de la iglesia (dirección, teléfono, correo) y las etiquetas del formulario vienen de otro lado y se revisan aparte.',
        ANCHO - 2,
        '  ',
      )
        .split('\n')
        .map((x, i) => (i === 0 ? '  ' + x : x))
        .join('\n'),
    );

    sueltos.forEach((t, i) => {
      const num = `${numeroPagina}.${i + 1}`;
      l.push('');
      l.push(`  ${num.padEnd(6)} ${t.tipo}`);
      l.push(`         ${ajustar(t.texto, ANCHO - 9, '         ')}`);
      total++;
    });
  }
}

// ── El menú y el pie, una sola vez ──────────────────────────────────────────
// Se repiten iguales en las nueve páginas. Sacarlos en cada una habría hecho un
// documento nueve veces más largo que nadie termina de leer; dejarlos fuera
// habría escondido textos que se ven en TODAS las páginas, que es lo contrario.
const portada = readFileSync(PAGINAS[0].archivo, 'utf8');
const comunes = [
  ...textosDe(portada, 'nav', true).map((t) => ({ ...t, tipo: `Menú · ${t.tipo}` })),
  ...textosDe(portada, 'footer', true).map((t) => ({ ...t, tipo: `Pie · ${t.tipo}` })),
];

if (comunes.length) {
  numeroPagina++;
  l.push('');
  l.push('');
  l.push('─'.repeat(ANCHO));
  l.push(`${numeroPagina} · MENÚ Y PIE DE PÁGINA`);
  l.push('   Se ven igual en todas las páginas');
  l.push('─'.repeat(ANCHO));

  comunes.forEach((t, i) => {
    const num = `${numeroPagina}.${i + 1}`;
    l.push('');
    l.push(`  ${num.padEnd(6)} ${t.tipo}`);
    l.push(`         ${ajustar(t.texto, ANCHO - 9, '         ')}`);
    total++;
  });
}

l.push('');
l.push('');
l.push('─'.repeat(ANCHO));
l.push(`${total} textos en ${numeroPagina} secciones.`);
l.push('─'.repeat(ANCHO));
l.push('');

const salida = resolve('textos-del-sitio.txt');
writeFileSync(salida, l.join('\n'), 'utf8');
console.log(`Listo: ${salida}`);
console.log(`${total} textos en ${numeroPagina} páginas.`);
