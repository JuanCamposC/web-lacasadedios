/**
 * Genera el PDF de revisión del sitio, sin pasar por el diálogo de impresión.
 *
 * ── POR QUÉ EXISTE ──────────────────────────────────────────────────────────
 * Imprimir desde el navegador a mano tiene dos trampas que no avisan:
 *
 *   · «Gráficos de fondo» viene APAGADO por defecto en Chrome y en Edge. Con él
 *     apagado, el navegador borra las fotos de fondo y cambia el texto claro
 *     sobre oscuro por texto oscuro sobre blanco. Un hero sale como una hoja en
 *     blanco. (El CSS ya pide `print-color-adjust: exact`, pero esto lo fija
 *     por si alguien imprime desde otro sitio.)
 *   · Los márgenes y el tamaño de hoja cambian según lo último que se imprimió.
 *
 * Acá se fijan las dos cosas y el resultado es siempre el mismo.
 *
 * ── USO ─────────────────────────────────────────────────────────────────────
 *   1. npm run build
 *   2. npx wrangler dev          (en otra terminal)
 *   3. node scripts/pdf-revision.mjs
 *
 * Sale `revision.pdf` en la raíz del proyecto. Con `--url` se puede apuntar a
 * otro sitio:
 *   node scripts/pdf-revision.mjs --url https://pruebas.lacasadedios.cl/imprimir
 *
 * OJO con esa dirección: está detrás de Cloudflare Access, así que el navegador
 * sin sesión traerá la pantalla de login y no el sitio. Para el PDF, apunta al
 * servidor local.
 */
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

const ejecutar = promisify(execFile);

/**
 * Dónde suele estar un navegador Chromium en Windows, macOS y Linux.
 * Se usa el que ya esté instalado en vez de descargar uno: Playwright y
 * Puppeteer se traen su propio Chrome de 300 MB, y para hacer un PDF una vez al
 * mes eso no compensa.
 */
const CANDIDATOS = [
  process.env.CHROME_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);

function buscarNavegador() {
  const encontrado = CANDIDATOS.find((r) => existsSync(r));
  if (!encontrado) {
    console.error(
      'No encontré Chrome ni Edge.\n' +
        'Si tienes uno instalado en otro sitio, dime cuál:\n' +
        '  CHROME_PATH="C:/ruta/al/chrome.exe" node scripts/pdf-revision.mjs',
    );
    process.exit(1);
  }
  return encontrado;
}

function argumento(nombre, porDefecto) {
  const i = process.argv.indexOf(`--${nombre}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : porDefecto;
}

const url = argumento('url', 'http://127.0.0.1:8787/imprimir');
const salida = resolve(argumento('salida', 'revision.pdf'));
const navegador = buscarNavegador();

console.log(`Navegador: ${navegador}`);
console.log(`Leyendo:   ${url}`);

try {
  await ejecutar(
    navegador,
    [
      '--headless=new',
      '--disable-gpu',
      // Sin esto salen la fecha y la dirección en cada esquina de cada hoja,
      // que en un documento para revisar solo estorban.
      '--no-pdf-header-footer',
      // El sitio se maqueta pensando en pantallas anchas: con el ancho por
      // defecto del headless saldría la versión de móvil, que no es la que se
      // va a revisar.
      '--window-size=1280,2000',
      `--print-to-pdf=${salida}`,
      url,
    ],
    { timeout: 120_000 },
  );
} catch (e) {
  console.error(`\nFalló al generar el PDF: ${e.message}`);
  console.error('\n¿Está corriendo el servidor? En otra terminal:  npx wrangler dev');
  process.exit(1);
}

if (!existsSync(salida)) {
  console.error('El navegador terminó sin errores pero no escribió el archivo.');
  process.exit(1);
}

console.log(`\nListo: ${salida}`);
