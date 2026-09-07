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
  | { tipo: 'cita'; texto: string };

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
  return `<p style="margin:0 0 16px;font-family:${PALO};font-size:16px;line-height:25px;color:${TINTA}">${esc(texto)}</p>`;
}

function destacadoHtml(texto: string): string {
  return `<p style="margin:0 0 20px;font-family:${SERIFA};font-size:21px;line-height:29px;color:${NOCHE}">${esc(texto)}</p>`;
}

/**
 * Botón «a prueba de balas»: el color va en el atributo `bgcolor` de la celda
 * —Outlook ignora `background` en CSS— y el relleno, en el enlace. Escrito de
 * otra forma, en Outlook sale un texto azul suelto sin ningún botón detrás.
 */
function botonHtml(texto: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 20px">
      <tr>
        <td bgcolor="${AZUL}" style="border-radius:6px">
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
          <td style="padding:7px 16px 7px 0;font-family:${PALO};font-size:14px;color:${TINTA_SUAVE};white-space:nowrap;vertical-align:top">${esc(k)}</td>
          <td style="padding:7px 0;font-family:${PALO};font-size:15px;font-weight:bold;color:${TINTA};vertical-align:top">${esc(v)}</td>
        </tr>`,
    )
    .join('');
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 20px">${cuerpo}</table>`;
}

function citaHtml(texto: string): string {
  // El filete a la izquierda es el mismo recurso que `.cita` en el sitio.
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 20px">
      <tr>
        <td bgcolor="${BRONCE}" width="3" style="width:3px;font-size:0;line-height:0">&nbsp;</td>
        <td bgcolor="${PAPEL_HONDO}" style="padding:16px 18px;font-family:${PALO};font-size:15px;line-height:24px;color:${TINTA};white-space:pre-wrap">${esc(texto)}</td>
      </tr>
    </table>`;
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
  }
}

// ── Armado ───────────────────────────────────────────────────────────────────

export function construirCorreo(c: Correo): { html: string; texto: string } {
  const sitio = c.base.replace(/\/+$/, '');

  const eyebrowHtml = c.eyebrow
    ? `<p style="margin:0 0 10px;font-family:${PALO};font-size:12px;font-weight:bold;letter-spacing:1.6px;text-transform:uppercase;color:${BRONCE}">${esc(c.eyebrow)}</p>`
    : '';

  const pieHtml = c.pie
    ? `<p style="margin:0;font-family:${PALO};font-size:13px;line-height:20px;color:${TINTA_SUAVE}">${esc(c.pie.texto)}${
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
            <td bgcolor="${NOCHE}" align="center" style="padding:30px 32px">
              <a href="${esc(sitio)}" style="text-decoration:none">
                <img src="${esc(sitio)}/marca/logo-blanco.png" width="176" height="40" alt="${esc(SITE.name)}" style="display:block;border:0;width:176px;height:40px;font-family:${SERIFA};font-size:20px;color:#ffffff">
              </a>
            </td>
          </tr>
          <tr>
            <td bgcolor="${BRONCE}" style="height:3px;font-size:0;line-height:0">&nbsp;</td>
          </tr>
          <tr>
            <td bgcolor="${PAPEL}" style="padding:32px">
              ${eyebrowHtml}
              <h1 style="margin:0 0 18px;font-family:${SERIFA};font-size:27px;line-height:34px;font-weight:normal;color:${NOCHE}">${esc(c.titulo)}</h1>
              ${c.bloques.map(bloqueHtml).join('\n              ')}
            </td>
          </tr>
          <tr>
            <td bgcolor="${PAPEL_HONDO}" style="padding:22px 32px 26px">
              ${pieHtml}
              <p style="margin:${c.pie ? '14px' : '0'} 0 0;font-family:${PALO};font-size:13px;line-height:20px;color:${TINTA_SUAVE}">
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
