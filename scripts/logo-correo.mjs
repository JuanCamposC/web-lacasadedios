/**
 * Genera public/marca/logo-correo.png: el logotipo blanco con el azul noche ya
 * incrustado.
 *
 *   node scripts/logo-correo.mjs
 *
 * POR QUÉ NO BASTA CON EL LOGOTIPO TRANSPARENTE
 * Gmail, Outlook.com y Apple Mail invierten colores en modo oscuro, y no hay
 * forma de impedírselo a todos. Si el azul de la banda se aclara, un logotipo
 * blanco encima desaparece.
 *
 * Lo que NINGÚN cliente toca son los píxeles de una imagen. Con el fondo
 * incrustado, la placa se ve igual pase lo que pase con el resto del correo: en
 * el peor caso queda un rectángulo azul sobre claro, que se lee perfectamente.
 *
 * Se genera y se versiona una sola vez; solo hay que volver a correrlo si
 * cambia el logotipo o el azul.
 */
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const raiz = new URL('../', import.meta.url);

const AZUL_NOCHE = { r: 10, g: 23, b: 48, alpha: 1 };

// Se dibuja al doble para que no se vea borroso en pantallas de retina; en el
// correo se muestra a 240 × 72.
const ESCALA = 2;
const ANCHO = 240 * ESCALA;
const ALTO = 72 * ESCALA;
const ANCHO_LOGO = 176 * ESCALA;

const logo = await sharp(fileURLToPath(new URL('public/marca/logo-blanco.png', raiz)))
  .resize({ width: ANCHO_LOGO })
  .toBuffer();

const { height: altoLogo } = await sharp(logo).metadata();

await sharp({
  create: { width: ANCHO, height: ALTO, channels: 4, background: AZUL_NOCHE },
})
  .composite([
    {
      input: logo,
      left: Math.round((ANCHO - ANCHO_LOGO) / 2),
      top: Math.round((ALTO - altoLogo) / 2),
    },
  ])
  .png({ compressionLevel: 9 })
  .toFile(fileURLToPath(new URL('public/marca/logo-correo.png', raiz)));

console.log(`public/marca/logo-correo.png — ${ANCHO}×${ALTO} (se muestra a 240×72)`);
