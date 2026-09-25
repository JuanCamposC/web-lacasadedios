import type { APIRoute } from 'astro';
import { baseDeDatos } from '../../../lib/base';
import { ajustes } from '../../../lib/datos';
import { guardarAjustes, DatoInvalido } from '../../../lib/panel';
import { olvidarArchivos } from '../../../lib/archivos';

export const prerender = false;

/**
 * La fila única de ajustes: transmisión en vivo y aviso emergente.
 *
 *   GET   devuelve la fila
 *   PUT   guarda solo las columnas permitidas (ver src/lib/panel.ts)
 *
 * Se lee con `ajustes()` de datos.ts, la misma función que usan las páginas
 * públicas, porque acá no hay nada que ocultar: la fila es una sola y no tiene
 * concepto de borrador.
 */
const json = (datos: unknown, status = 200) =>
  new Response(JSON.stringify(datos), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

export const GET: APIRoute = async () => json({ ajustes: await ajustes(await baseDeDatos()) });

export const PUT: APIRoute = async ({ request, url }) => {
  const origen = request.headers.get('Origin');
  if (origen) {
    try {
      if (new URL(origen).host !== url.host) return json({ error: 'origen no permitido' }, 403);
    } catch {
      return json({ error: 'origen no permitido' }, 403);
    }
  }

  let datos: Record<string, unknown>;
  try {
    datos = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: 'cuerpo ilegible' }, 400);
  }

  const base = await baseDeDatos();

  /* ── La imagen que deja de usar el aviso ────────────────────────────────
     El aviso emergente es UNA fila que nunca se borra, así que cada cartel
     nuevo dejaba el anterior en el bucket para siempre. Acá se apunta cuál
     era la imagen antes de guardar; al final se suelta si ya no la nombra
     nadie más.

     «Nadie más» importa: la galería del panel permite REUTILIZAR la foto de
     un evento, y en ese caso la comprobación de src/lib/archivos.ts la deja
     donde está. Lo que se borra es el cartel que se subió para el aviso y
     que ya nadie enseña; eso deja de aparecer en la galería, que es justo lo
     que se quería. */
  let avisoAnterior: string | null = null;
  if (Object.hasOwn(datos, 'aviso_imagen_clave')) {
    const antes = await ajustes(base);
    const vieja = antes?.aviso_imagen_clave ?? null;
    // La misma clave de vuelta significa que el cartel no se tocó.
    if (vieja && datos.aviso_imagen_clave !== vieja) avisoAnterior = vieja;
  }

  let hecho: boolean;
  try {
    hecho = await guardarAjustes(base, datos);
  } catch (e) {
    // Un enlace mal escrito es culpa de quien lo pegó, no una caída: se
    // responde 400 con la frase que el panel sabe enseñar.
    if (e instanceof DatoInvalido) return json({ error: e.message }, 400);
    throw e;
  }
  if (!hecho) return json({ error: 'no hay nada que guardar' }, 400);

  await olvidarArchivos(base, [avisoAnterior]);
  return json({ ok: true });
};
