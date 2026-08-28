/**
 * Genera los iconos de pestaña a partir del isotipo azul de la marca.
 *
 *   node scripts/favicons.mjs
 *
 * El isotipo es más alto que ancho (480 × 792), así que se escala por la altura
 * y se centra en un lienzo cuadrado. Se deja un 6 % de margen: pegado al borde
 * el navegador lo recorta visualmente contra el borde de la pestaña.
 *
 * apple-touch-icon va sobre BLANCO a propósito: iOS aplana la transparencia
 * contra negro, y el azul de la marca sobre negro queda ilegible.
 */
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';

const ORIGEN = 'public/marca/isotipo-azul.png';
const DESTINO = 'public';
const MARGEN = 0.06;

/** Isotipo centrado en un cuadrado de `lado` px. `fondo` null = transparente. */
async function cuadrado(lado, fondo) {
  const alto = Math.round(lado * (1 - MARGEN * 2));
  const marca = await sharp(ORIGEN)
    .resize({ height: alto, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  return sharp({
    create: {
      width: lado,
      height: lado,
      channels: 4,
      background: fondo ?? { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: marca, gravity: 'centre' }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/**
 * Envuelve un PNG en un contenedor .ico. El formato admite entradas PNG desde
 * Vista, así que basta con la cabecera de 6 bytes y una entrada de 16.
 */
function ico(png, lado) {
  const cabecera = Buffer.alloc(6);
  cabecera.writeUInt16LE(0, 0); // reservado
  cabecera.writeUInt16LE(1, 2); // 1 = icono
  cabecera.writeUInt16LE(1, 4); // una sola imagen

  const entrada = Buffer.alloc(16);
  entrada.writeUInt8(lado === 256 ? 0 : lado, 0); // ancho (0 significa 256)
  entrada.writeUInt8(lado === 256 ? 0 : lado, 1); // alto
  entrada.writeUInt8(0, 2); // colores de paleta
  entrada.writeUInt8(0, 3); // reservado
  entrada.writeUInt16LE(1, 4); // planos
  entrada.writeUInt16LE(32, 6); // bits por píxel
  entrada.writeUInt32LE(png.length, 8); // tamaño de los datos
  entrada.writeUInt32LE(22, 12); // desplazamiento

  return Buffer.concat([cabecera, entrada, png]);
}

const salidas = [
  ['favicon-32.png', 32, null],
  ['favicon-192.png', 192, null],
  ['apple-touch-icon.png', 180, { r: 255, g: 255, b: 255, alpha: 1 }],
];

for (const [nombre, lado, fondo] of salidas) {
  const png = await cuadrado(lado, fondo);
  await fs.writeFile(path.join(DESTINO, nombre), png);
  console.log(`  ${nombre.padEnd(22)} ${lado}×${lado}  ${(png.length / 1024).toFixed(1)} kB`);
}

const png32 = await cuadrado(32, null);
await fs.writeFile(path.join(DESTINO, 'favicon.ico'), ico(png32, 32));
console.log(`  favicon.ico            32×32  ${((22 + png32.length) / 1024).toFixed(1)} kB`);
