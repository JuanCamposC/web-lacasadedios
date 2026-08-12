/**
 * Genera la imagen social (Open Graph) del sitio: public/og-image.png, 1200×630.
 *
 *   node scripts/og-image.mjs
 *
 * Se genera y se versiona una sola vez; solo hay que volver a correrlo si cambia
 * el logo o la paleta. Usa la misma identidad que el sitio: azul noche, filete
 * de bronce y trama de papel pautado.
 *
 * El logo se convierte a silueta blanca usando su propio canal alfa (en vez de
 * invertir colores, que rompería si el archivo tuviera color).
 */
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const raiz = new URL('../', import.meta.url);
const W = 1200;
const H = 630;

const AZUL_NOCHE = '#0a1730';
const AZUL_ALTO = '#142a4f';
const BRONCE = '#c8994f';

const fondo = `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="cielo" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%"  stop-color="${AZUL_ALTO}"/>
      <stop offset="100%" stop-color="${AZUL_NOCHE}"/>
    </linearGradient>
    <pattern id="trama" width="56" height="56" patternUnits="userSpaceOnUse">
      <path d="M56 0 L0 0 0 56" fill="none" stroke="#ffffff" stroke-opacity="0.04" stroke-width="1"/>
    </pattern>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#cielo)"/>
  <rect width="${W}" height="${H}" fill="url(#trama)"/>

  <!-- Filete de bronce arriba y abajo: la costura de la identidad -->
  <rect x="0" y="0"        width="${W}" height="6" fill="${BRONCE}"/>
  <rect x="0" y="${H - 6}" width="${W}" height="6" fill="${BRONCE}" fill-opacity="0.55"/>

  <!-- Marca de agua del cartel: cabecera de bronce y filas de ancho variable,
       para que se lea como un tablero de horarios y no como un esqueleto. -->
  <g transform="translate(${W - 340}, 132)">
    <rect x="0" y="0" width="268" height="366" rx="6" fill="#ffffff" fill-opacity="0.05"/>
    <rect x="0" y="0" width="268" height="34" rx="6" fill="${BRONCE}" fill-opacity="0.22"/>
    ${[
      [56, 34],
      [110, 34],
      [164, 34],
      [218, 34],
      [272, 34],
    ]
      .map(
        ([y, w], i) => `<g opacity="0.13">
      <rect x="18" y="${y}" width="${w}" height="20" rx="3" fill="#ffffff"/>
      <rect x="66" y="${y}" width="${[132, 74, 74, 96, 110][i]}" height="20" rx="3" fill="#ffffff"/>
    </g>`,
      )
      .join('\n    ')}
    <rect x="0" y="332" width="268" height="34" rx="6" fill="#ffffff" fill-opacity="0.04"/>
  </g>
</svg>`;

const texto = `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <text x="96" y="392" fill="#ffffff" fill-opacity="0.92"
        font-family="Georgia, 'Times New Roman', serif" font-size="42">
    San Miguel · Santiago Centro
  </text>
  <text x="96" y="446" fill="#ffffff" fill-opacity="0.92"
        font-family="Georgia, 'Times New Roman', serif" font-size="42">
    Limache · Coya
  </text>
  <text x="96" y="520" fill="${BRONCE}" letter-spacing="6"
        font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="bold">
    IGLESIA EVANGÉLICA · LACASADEDIOS.CL
  </text>
</svg>`;

// Logo en silueta blanca a partir de su canal alfa.
const logoPath = fileURLToPath(new URL('public/logo.png', raiz));
const ANCHO_LOGO = 460;

const logoRedim = sharp(logoPath).resize({ width: ANCHO_LOGO }).ensureAlpha();
const { width: lw, height: lh } = await logoRedim.metadata();
const alfa = await logoRedim.clone().extractChannel('alpha').toBuffer();

const logoBlanco = await sharp({
  create: { width: lw, height: lh, channels: 3, background: '#ffffff' },
})
  .joinChannel(alfa)
  .png()
  .toBuffer();

const salida = fileURLToPath(new URL('public/og-image.png', raiz));

await sharp(Buffer.from(fondo))
  .composite([
    { input: logoBlanco, left: 96, top: 180 },
    { input: Buffer.from(texto), left: 0, top: 0 },
  ])
  .png({ compressionLevel: 9 })
  .toFile(salida);

const { size } = await sharp(salida).metadata();
console.log(`\n  ✓ public/og-image.png — ${W}×${H}, ${Math.round((size ?? 0) / 1024)} kB\n`);
