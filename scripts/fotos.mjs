/**
 * Genera las fotos del sitio en WebP a varios anchos, dentro de public/fotos/.
 *
 * Corre solo antes de `npm run build` y `npm run dev` (ver `prebuild` y `predev`
 * en package.json). El porqué está en src/lib/fotos.mjs: en resumen, las
 * páginas que se arman al servir no pueden optimizar fotos en Cloudflare, así
 * que se dejan optimizadas de antemano.
 *
 * Solo rehace lo que cambió: si la variante existe y es más nueva que la foto
 * original, se salta. Así compilar dos veces seguidas no cuesta nada.
 *
 * Y borra lo que sobra: las variantes de fotos que ya no existen en
 * src/assets/img. Esta carpeta no está en el repositorio —la hace este
 * script—, pero sí se publica entera con el sitio, así que sin esta limpieza
 * cada foto renombrada o borrada deja para siempre sus cuatro WebP colgando en
 * producción. Pasó: quedaban ahí `cruz-cielo` y `hero-worship`, borradas del
 * repositorio semanas antes.
 *
 * Por último avisa de las fotos que no usa ninguna página. Las fotos se
 * reemplazan dejando el archivo con el nombre exacto del hueco (ver
 * src/assets/img/LEEME.txt), y un nombre mal escrito —«templo coya.jpg»,
 * «Templo-Coya.jpg»— no da ningún error: la página sigue mostrando la foto
 * vieja y no hay forma de notarlo hasta que alguien mira el sitio. Este aviso
 * es lo único que separa «la subí y no se ve» de «la subí con el nombre mal».
 */
import { mkdir, readdir, readFile, stat, unlink } from 'node:fs/promises';
import { join, parse } from 'node:path';
import sharp from 'sharp';
import { anchosDe, rutaFoto } from '../src/lib/fotos.mjs';

const ORIGEN = 'src/assets/img';
const DESTINO = 'public';
const MAPA = 'src/assets/images.ts';

await mkdir(join(DESTINO, 'fotos'), { recursive: true });

const archivos = (await readdir(ORIGEN)).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));

let hechas = 0;
let saltadas = 0;
/** Las variantes que TIENEN que existir al terminar. Todo lo demás, sobra. */
const esperadas = new Set();

for (const archivo of archivos) {
  const origen = join(ORIGEN, archivo);
  const nombre = parse(archivo).name;
  const { width } = await sharp(origen).metadata();
  if (!width) {
    console.warn(`  sin ancho legible, se salta: ${archivo}`);
    continue;
  }
  const modificado = (await stat(origen)).mtimeMs;

  for (const ancho of anchosDe(width)) {
    const destino = join(DESTINO, rutaFoto(nombre, ancho));
    esperadas.add(parse(destino).base);
    try {
      if ((await stat(destino)).mtimeMs >= modificado) {
        saltadas++;
        continue;
      }
    } catch {
      /* no existe todavía */
    }
    // Calidad 78: a estos tamaños no se distingue del original y pesa del
    // orden de una décima parte del JPEG.
    await sharp(origen).resize({ width: ancho }).webp({ quality: 78 }).toFile(destino);
    hechas++;
  }
}

let borradas = 0;
for (const archivo of await readdir(join(DESTINO, 'fotos'))) {
  if (esperadas.has(archivo)) continue;
  await unlink(join(DESTINO, 'fotos', archivo));
  borradas++;
}

console.log(
  `fotos: ${hechas} generadas, ${saltadas} ya estaban al día` +
    (borradas ? `, ${borradas} sobrantes borradas` : ''),
);

// ── ¿Alguna foto no la usa nadie? ───────────────────────────────────────────
// Los nombres válidos son los que importa el mapa de imágenes, sacados del
// propio archivo para que esta lista no se quede atrás cuando cambie.
const mapa = await readFile(MAPA, 'utf8');
const conocidas = new Set([...mapa.matchAll(/'\.\/img\/([^']+)'/g)].map((m) => m[1]));
const huerfanas = archivos.filter((f) => !conocidas.has(f));

if (huerfanas.length > 0) {
  console.warn('');
  console.warn('  ⚠ Estas fotos no las usa ninguna página del sitio:');
  for (const f of huerfanas) console.warn(`      ${f}`);
  console.warn('');
  console.warn('    Casi siempre es el nombre. Tiene que ser uno de estos, exacto,');
  console.warn('    en minúsculas y con la misma extensión:');
  console.warn('');
  for (const f of [...conocidas].sort()) console.warn(`      ${f}`);
  console.warn('');
  console.warn('    La lista completa, con qué se ve en cada hueco, está en');
  console.warn('    src/assets/img/LEEME.txt');
  console.warn('');
}
