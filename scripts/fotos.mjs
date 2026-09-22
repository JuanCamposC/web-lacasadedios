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
 */
import { mkdir, readdir, stat, unlink } from 'node:fs/promises';
import { join, parse } from 'node:path';
import sharp from 'sharp';
import { anchosDe, rutaFoto } from '../src/lib/fotos.mjs';

const ORIGEN = 'src/assets/img';
const DESTINO = 'public';

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
