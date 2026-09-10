import type { APIRoute } from 'astro';
import { almacen } from '../../../lib/base';
import { esRecurso } from '../../../lib/panel';

export const prerender = false;

/**
 * Sube un archivo a R2 y devuelve su CLAVE: `POST /api/admin/subir`.
 *
 * Devuelve la clave y no una dirección a propósito. En la base se guarda la
 * clave; la dirección la arma `urlMedio()` a partir del dominio del bucket. Si
 * mañana ese dominio cambia, se cambia una variable y no cada fila.
 *
 * ── LO QUE SE COMPRUEBA ─────────────────────────────────────────────────────
 * Quién puede subir lo decide el middleware (token de Access). Acá se cuida lo
 * demás:
 *
 *   · El tipo. Solo imágenes y audio, por lista blanca. Sin esto, el panel
 *     sería un alojamiento gratuito de cualquier cosa para quien tuviera acceso.
 *   · El tamaño. Un estudio de una hora ronda los 28 MB; el tope de 60 deja
 *     margen sin permitir que alguien llene los 10 GB gratuitos de una vez.
 *   · La clave. La arma el servidor con un UUID. El nombre que manda el
 *     navegador solo aporta la extensión, y ni siquiera esa se usa tal cual:
 *     sale del tipo declarado. Un nombre como `../../otro.txt` no puede
 *     escaparse de su carpeta porque nunca llega a formar parte de la ruta.
 */

const TIPOS: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/avif': 'avif',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/ogg': 'ogg',
  'audio/opus': 'opus',
};

const TOPE_BYTES = 60 * 1024 * 1024;

const json = (datos: unknown, status = 200) =>
  new Response(JSON.stringify(datos), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

export const POST: APIRoute = async ({ request, url }) => {
  const origen = request.headers.get('Origin');
  if (origen) {
    try {
      if (new URL(origen).host !== url.host) return json({ error: 'origen no permitido' }, 403);
    } catch {
      return json({ error: 'origen no permitido' }, 403);
    }
  }

  let formulario: FormData;
  try {
    formulario = await request.formData();
  } catch {
    return json({ error: 'se esperaba un formulario con un archivo' }, 400);
  }

  const archivo = formulario.get('archivo');
  if (!(archivo instanceof File)) return json({ error: 'falta el archivo' }, 400);

  const extension = TIPOS[archivo.type];
  if (!extension)
    return json({ error: `tipo no permitido: ${archivo.type || 'desconocido'}` }, 415);

  if (archivo.size > TOPE_BYTES) {
    return json(
      { error: `el archivo pesa más de ${Math.round(TOPE_BYTES / 1024 / 1024)} MB` },
      413,
    );
  }
  if (archivo.size === 0) return json({ error: 'el archivo está vacío' }, 400);

  // La carpeta sale del recurso, y solo si es uno conocido. Cualquier otra cosa
  // cae en `varios` en vez de crear carpetas a gusto de quien suba.
  const pedido = String(formulario.get('recurso') ?? '');
  const carpeta = esRecurso(pedido) ? pedido : 'varios';

  const hoy = new Date();
  const anio = hoy.getUTCFullYear();
  const mes = String(hoy.getUTCMonth() + 1).padStart(2, '0');
  const clave = `${carpeta}/${anio}/${mes}/${crypto.randomUUID()}.${extension}`;

  await (
    await almacen()
  ).put(clave, await archivo.arrayBuffer(), {
    httpMetadata: { contentType: archivo.type },
  });

  return json({ clave, bytes: archivo.size, tipo: archivo.type }, 201);
};
