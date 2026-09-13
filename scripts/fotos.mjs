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
 */
import { mkdir, readdir, stat } from 'node:fs/promises';
import { join, parse } from 'node:path';
import sharp from 'sharp';
import { anchosDe, rutaFoto } from '../src/lib/fotos.mjs';

const ORIGEN = 'src/assets/img';
const DESTINO = 'public';

await mkdir(join(DESTINO, 'fotos'), { recursive: true });

const archivos = (await readdir(ORIGEN)).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));

let hechas = 0;
let saltadas = 0;

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

console.log(`fotos: ${hechas} generadas, ${saltadas} ya estaban al día`);
