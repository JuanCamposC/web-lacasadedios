import { SITE } from '../data/site';

/**
 * Plantilla única para todos los correos que manda el sitio.
 *
 * POR QUÉ EXISTE
 * Había tres correos escritos a mano —confirmación de alta, aviso a
 * suscriptores y mensaje del formulario— con tres maquetas distintas, grises
 * que no están en la paleta (#64748b, #f1f5f9, #e2e8f0) y `font-size:.8rem`,
 * que el Outlook de escritorio ignora porque su motor es el de Word y no
 * entiende `rem`. Aquí se decide una vez.
 *
 * EL CORREO NO ES UNA PÁGINA WEB. Estas seis reglas no son manías:
 *
 *  1. TABLAS, no `div` con flex ni grid. Outlook de escritorio maqueta con el
 *     motor de Word, que no conoce ninguno de los dos.
 *  2. ESTILOS EN LÍNEA. Gmail descarta la etiqueta `<style>` en varios
 *     contextos, y siempre al reenviar. Lo que no va en el atributo `style` se
 *     pierde.
 *  3. PÍXELES, nunca `rem` ni `em`. Mismo motivo que arriba.
 *  4. NADA DE SVG. Gmail lo borra entero. El logotipo va en PNG, con dirección
 *     absoluta, y con el texto alternativo en blanco para que la banda oscura
 *     siga leyéndose cuando el cliente bloquea las imágenes, que es lo normal
 *     la primera vez que alguien recibe un correo nuestro.
 *  5. 600 PX de ancho, el estándar que todos los clientes respetan. El bloque
 *     condicional `mso` es la única forma de fijarlo en Outlook sin romper el
 *     resto.
 *  6. VERSIÓN EN TEXTO PLANO SIEMPRE. Un correo que solo trae HTML puntúa peor
 *     en los filtros de spam. Por eso `construirCorreo` devuelve las dos: se
 *     escriben del mismo contenido, así que no pueden desincronizarse.
 *  7. EL MODO OSCURO NO SE PUEDE PROHIBIR. Gmail en el teléfono invierte
 *     colores sin preguntar y no hay declaración que se lo impida; Apple Mail y
 *     Outlook.com sí hacen caso. Por eso hay tres capas: `color-scheme: only
 *     light`, una consulta `prefers-color-scheme` con `!important` —compite
 *     contra estilos en línea, que si no ganan siempre— y los atributos
 *     `data-ogsc`/`data-ogsb` de Outlook.com.
 *
 *     Y por eso el logotipo lleva el azul INCRUSTADO en los píxeles
 *     (`logo-correo.png`, generado por scripts/logo-correo.mjs): ningún cliente
 *     invierte el contenido de una imagen. Si la banda se aclara, la placa
 *     azul con las letras blancas sigue ahí. Es la única defensa que no depende
 *     de que el cliente colabore.
 *
 * La tipografía del sitio no se puede usar: las fuentes web no cargan en
 * ningún cliente serio. Se conserva la PAREJA, que es lo que se reconoce —
 * Georgia donde el sitio pone Fraunces (las dos con serifa) y Arial donde pone
 * Archivo (las dos de palo seco).
 */

// ── Paleta ───────────────────────────────────────────────────────────────────
// Los mismos valores de src/styles/global.css. `TINTA_SUAVE` es el único que no
// sale de ahí: el sitio apaga el texto secundario con transparencia y en correo
// no hay transparencia fiable, así que se calcula un tono sólido equivalente.
// Da 7,4:1 sobre el papel hondo y 9,0:1 sobre el papel: cumple AA de sobra.
const NOCHE = '#0a1730';
const AZUL = '#23448f';
const BRONCE = '#7d5518';
const PAPEL = '#fcfaf7';
const PAPEL_HONDO = '#ece4d6';
const TINTA = '#17202e';
const TINTA_SUAVE = '#3d4757';

const SERIFA = "Georgia, 'Times New Roman', Times, serif";
const PALO = "Arial, 'Helvetica Neue', Helvetica, sans-serif";

/**
 * Escapa para HTML.
 *
 * Incluye comillas, que las versiones anteriores no escapaban: los valores
 * viajan también dentro de atributos (`href`), y ahí una comilla suelta cierra
 * el atributo antes de tiempo.
 */
export function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export type Bloque =
  /** Texto corriente. */
  | { tipo: 'parrafo'; texto: string }
  /** Lo que el correo viene a decir: el título de la noticia, el del culto. */
  | { tipo: 'destacado'; texto: string }
  /** La acción. Uno por correo: dos botones es ninguno. */
  | { tipo: 'boton'; texto: string; url: string }
  /** Pares dato/valor, para el correo interno del formulario. */
  | { tipo: 'ficha'; filas: [string, string][] }
  /** Texto ajeno reproducido tal cual, con sus saltos de línea. */
  | { tipo: 'cita'; texto: string }
  /** Imagen de la noticia o del evento. Dirección absoluta y accesible sin sesión. */
  | { tipo: 'imagen'; url: string; alt: string };

export interface Correo {
  /** Dirección absoluta del sitio, para el logotipo. Sin barra final. */
  base: string;
  /**
   * La línea que se lee en la bandeja debajo del asunto. Si no se pone, el
   * cliente muestra el principio del HTML, que suele ser basura.
   */
  preencabezado: string;
  /** Rótulo pequeño en bronce sobre el título. */
  eyebrow?: string;
  titulo: string;
  bloques: Bloque[];
  /** Letra pequeña del pie: aviso legal, baja del boletín. */
  pie?: { texto: string; enlace?: { texto: string; url: string } };
}

// ── Bloques en HTML ──────────────────────────────────────────────────────────

function parrafoHtml(texto: string): string {
  return `<p class="txt" style="margin:0 0 16px;font-family:${PALO};font-size:16px;line-height:25px;color:${TINTA}">${esc(texto)}</p>`;
}

function destacadoHtml(texto: string): string {
  return `<p class="tit" style="margin:0 0 20px;font-family:${SERIFA};font-size:21px;line-height:29px;color:${NOCHE}">${esc(texto)}</p>`;
}

/**
 * Botón «a prueba de balas»: el color va en el atributo `bgcolor` de la celda
 * —Outlook ignora `background` en CSS— y el relleno, en el enlace. Escrito de
 * otra forma, en Outlook sale un texto azul suelto sin ningún botón detrás.
 */
function botonHtml(texto: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 20px">
      <tr>
        <td class="cta" bgcolor="${AZUL}" style="border-radius:6px;background-color:${AZUL}">
          <a href="${esc(url)}" style="display:inline-block;padding:13px 28px;font-family:${PALO};font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none">${esc(texto)}</a>
        </td>
      </tr>
    </table>`;
}

function fichaHtml(filas: [string, string][]): string {
  const cuerpo = filas
    .map(
      ([k, v]) =>
        `<tr>
          <td class="suave" style="padding:7px 16px 7px 0;font-family:${PALO};font-size:14px;color:${TINTA_SUAVE};white-space:nowrap;vertical-align:top">${esc(k)}</td>
          <td class="txt" style="padding:7px 0;font-family:${PALO};font-size:15px;font-weight:bold;color:${TINTA};vertical-align:top">${esc(v)}</td>
        </tr>`,
    )
    .join('');
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 20px">${cuerpo}</table>`;
}

function citaHtml(texto: string): string {
  // El filete a la izquierda es el mismo recurso que `.cita` en el sitio.
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 20px">
      <tr>
        <td class="filete" bgcolor="${BRONCE}" width="3" style="width:3px;font-size:0;line-height:0;background-color:${BRONCE}">&nbsp;</td>
        <td class="pie txt" bgcolor="${PAPEL_HONDO}" style="padding:16px 18px;background-color:${PAPEL_HONDO};font-family:${PALO};font-size:15px;line-height:24px;color:${TINTA};white-space:pre-wrap">${esc(texto)}</td>
      </tr>
    </table>`;
}

/**
 * 536 px = los 600 del correo menos los 32 de relleno a cada lado.
 *
 * El atributo `width` no es decorativo: Outlook no entiende `max-width` y sin
 * él estira la imagen a su tamaño original, que en una foto de noticia puede
 * ser de 2000 px y rompe la maqueta entera. El `height:auto` del estilo
 * conserva la proporción en todo lo demás.
 */
function imagenHtml(url: string, alt: string): string {
  return `<img src="${esc(url)}" width="536" alt="${esc(alt)}" style="display:block;width:100%;max-width:536px;height:auto;border:0;margin:0 0 20px;font-family:${PALO};font-size:14px;color:${TINTA_SUAVE}">`;
}

function bloqueHtml(b: Bloque): string {
  switch (b.tipo) {
    case 'parrafo':
      return parrafoHtml(b.texto);
    case 'destacado':
      return destacadoHtml(b.texto);
    case 'boton':
      return botonHtml(b.texto, b.url);
    case 'ficha':
      return fichaHtml(b.filas);
    case 'cita':
      return citaHtml(b.texto);
    case 'imagen':
      return imagenHtml(b.url, b.alt);
  }
}

// ── Bloques en texto plano ───────────────────────────────────────────────────

function bloqueTexto(b: Bloque): string {
  switch (b.tipo) {
    case 'parrafo':
      return b.texto;
    case 'destacado':
      return b.texto.toUpperCase();
    case 'boton':
      // El enlace desnudo: en texto plano no hay botón que valga.
      return `${b.texto}:\n${b.url}`;
    case 'ficha':
      return b.filas.map(([k, v]) => `${k}: ${v}`).join('\n');
    case 'cita':
      return b.texto
        .split('\n')
        .map((l) => `> ${l}`)
        .join('\n');
    // En texto plano la imagen no existe. Se omite en vez de dejar una
    // dirección suelta que nadie va a pegar en el navegador.
    case 'imagen':
      return '';
  }
}

// ── Armado ───────────────────────────────────────────────────────────────────

export function construirCorreo(c: Correo): { html: string; texto: string } {
  const sitio = c.base.replace(/\/+$/, '');

  const eyebrowHtml = c.eyebrow
    ? `<p class="oro" style="margin:0 0 10px;font-family:${PALO};font-size:12px;font-weight:bold;letter-spacing:1.6px;text-transform:uppercase;color:${BRONCE}">${esc(c.eyebrow)}</p>`
    : '';

  const pieHtml = c.pie
    ? `<p class="suave" style="margin:0;font-family:${PALO};font-size:13px;line-height:20px;color:${TINTA_SUAVE}">${esc(c.pie.texto)}${
        c.pie.enlace
          ? ` <a href="${esc(c.pie.enlace.url)}" style="color:${TINTA_SUAVE};text-decoration:underline">${esc(c.pie.enlace.texto)}</a>.`
          : ''
      }</p>`
    : '';

  // Los caracteres invisibles rellenan la vista previa: sin ellos, Gmail
  // completa la línea con el principio del cuerpo del correo.
  const relleno = '&nbsp;&zwnj;'.repeat(60);

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(c.titulo)}</title>
<style>
  /* Modo oscuro. Tres capas, porque ningún cliente respeta las tres.
     La defensa de verdad NO está aquí: está en que el logotipo lleve el azul
     incrustado en los píxeles (ver logo-correo.png). Esto es el refuerzo. */
  :root { color-scheme: only light; supported-color-schemes: only light; }

  /* Apple Mail y Outlook.com sí miran la consulta. Va con !important porque
     compite contra estilos en línea, que de otro modo ganan siempre. */
  @media (prefers-color-scheme: dark) {
    .banda  { background-color: ${NOCHE} !important; }
    .filete { background-color: ${BRONCE} !important; }
    .cuerpo { background-color: ${PAPEL} !important; }
    .pie    { background-color: ${PAPEL_HONDO} !important; }
    .tit    { color: ${NOCHE} !important; }
    .txt    { color: ${TINTA} !important; }
    .suave  { color: ${TINTA_SUAVE} !important; }
    .oro    { color: ${BRONCE} !important; }
    .cta    { background-color: ${AZUL} !important; }
    .cta a  { color: #ffffff !important; }
  }

  /* Outlook.com marca con estos atributos lo que ha cambiado por su cuenta. */
  [data-ogsb] .cuerpo { background-color: ${PAPEL} !important; }
  [data-ogsb] .pie    { background-color: ${PAPEL_HONDO} !important; }
  [data-ogsc] .tit    { color: ${NOCHE} !important; }
  [data-ogsc] .txt    { color: ${TINTA} !important; }
  [data-ogsc] .suave  { color: ${TINTA_SUAVE} !important; }
  [data-ogsc] .oro    { color: ${BRONCE} !important; }
</style>
</head>
<body style="margin:0;padding:0;background-color:${PAPEL_HONDO};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:${PAPEL_HONDO}">${esc(c.preencabezado)}${relleno}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${PAPEL_HONDO}">
  <tr>
    <td align="center" style="padding:24px 12px">
      <!--[if mso]><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600"><tr><td><![endif]-->
      <div style="max-width:600px;margin:0 auto">

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td class="banda" bgcolor="${NOCHE}" align="center" style="padding:24px 32px;background-color:${NOCHE}">
              <a href="${esc(sitio)}" style="text-decoration:none">
                <img src="${esc(sitio)}/marca/logo-correo.png" width="240" height="72" alt="${esc(SITE.name)}" style="display:block;border:0;width:240px;height:72px;font-family:${SERIFA};font-size:20px;color:#ffffff">
              </a>
            </td>
          </tr>
          <tr>
            <td class="filete" bgcolor="${BRONCE}" style="height:3px;font-size:0;line-height:0;background-color:${BRONCE}">&nbsp;</td>
          </tr>
          <tr>
            <td class="cuerpo" bgcolor="${PAPEL}" style="padding:32px;background-color:${PAPEL}">
              ${eyebrowHtml}
              <h1 class="tit" style="margin:0 0 18px;font-family:${SERIFA};font-size:27px;line-height:34px;font-weight:normal;color:${NOCHE}">${esc(c.titulo)}</h1>
              ${c.bloques.map(bloqueHtml).join('\n              ')}
            </td>
          </tr>
          <tr>
            <td class="pie" bgcolor="${PAPEL_HONDO}" style="padding:22px 32px 26px;background-color:${PAPEL_HONDO}">
              ${pieHtml}
              <p class="suave" style="margin:${c.pie ? '14px' : '0'} 0 0;font-family:${PALO};font-size:13px;line-height:20px;color:${TINTA_SUAVE}">
                ${esc(SITE.legalName)}<br>
                <a href="${esc(sitio)}" style="color:${TINTA_SUAVE};text-decoration:underline">${esc(sitio.replace(/^https?:\/\//, ''))}</a>
              </p>
            </td>
          </tr>
        </table>

      </div>
      <!--[if mso]></td></tr></table><![endif]-->
    </td>
  </tr>
</table>
</body>
</html>`;

  const texto = [
    SITE.name.toUpperCase(),
    '',
    c.eyebrow ? c.eyebrow.toUpperCase() : null,
    c.titulo,
    '',
    c.bloques.map(bloqueTexto).join('\n\n'),
    '',
    '—'.repeat(40),
    c.pie ? `${c.pie.texto}${c.pie.enlace ? ` ${c.pie.enlace.url}` : ''}` : null,
    SITE.legalName,
    sitio,
  ]
    .filter((l) => l !== null)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');

  return { html, texto };
}
