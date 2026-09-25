import type { APIRoute } from 'astro';
import { baseDeDatos } from '../../lib/base';
import { ajustes, avisoVigente } from '../../lib/datos';
import { urlMedio } from '../../lib/medios';
import { conSeguridad } from '../../lib/cabeceras';

export const prerender = false;

/**
 * Lo único que el navegador necesita saber en vivo: si hay transmisión y si
 * toca enseñar el aviso emergente.
 *
 * ── POR QUÉ EXISTE ──────────────────────────────────────────────────────────
 * La portada, los horarios y las páginas de templos son estáticas: se generan
 * al compilar y se sirven como archivos. Eso es lo que las hace rápidas, y
 * también lo que impide que sepan si AHORA MISMO hay una reunión en vivo. Así que ese
 * pedazo se pide desde el navegador, después de pintar.
 *
 * Antes se pedía directamente a Supabase con la clave pública, lo que obligaba
 * a llevar esa clave —y el dominio de la base— dentro del HTML de cada página, y
 * a abrir `connect-src` a un tercero en la política de seguridad. Ahora la
 * consulta se queda en casa: mismo origen, sin claves en el navegador, y la CSP
 * vuelve a ser `'self'`.
 *
 * ── LO QUE NO SALE DE AQUÍ ──────────────────────────────────────────────────
 * Ni suscriptores, ni borradores, ni nada sin publicar. Se devuelven los campos
 * del aviso y de la transmisión, que son exactamente los que ya se enseñan en
 * pantalla. La ventana de fechas del aviso se resuelve en el servidor: si no
 * toca mostrarlo, el texto NO viaja, porque mandarlo y esconderlo con CSS sería
 * publicarlo igual.
 */
export const GET: APIRoute = async () => {
  const vacio = { vivo: { activo: false, url: null, titulo: null }, aviso: null };

  let cuerpo: unknown = vacio;
  try {
    const a = await ajustes(await baseDeDatos());

    cuerpo = {
      vivo: {
        activo: a?.vivo_activo === 1,
        url: a?.vivo_url ?? null,
        titulo: a?.vivo_titulo ?? null,
      },
      aviso: avisoVigente(a)
        ? {
            titulo: a!.aviso_titulo,
            cuerpo: a!.aviso_cuerpo,
            boton: a!.aviso_boton,
            botonUrl: a!.aviso_boton_url,
            imagen: urlMedio(a!.aviso_imagen_clave),
            imagenAlt: a!.aviso_imagen_alt,
            version: a!.aviso_version,
            diseno: a!.aviso_diseno,
            botonPos: a!.aviso_boton_pos,
          }
        : null,
    };
  } catch (e) {
    // Un fallo acá NO puede romper la página: lo que se pierde es una pastilla
    // de «en vivo» y un aviso emergente. Se responde el estado apagado —que es
    // el que deja el sitio como si nada— y el motivo queda en los registros.
    console.error(`[estado] ${(e as Error).message}`);
  }

  return conSeguridad(
    new Response(JSON.stringify(cuerpo), {
      headers: {
        'Content-Type': 'application/json',
        // Un minuto en la caché del borde. Es lo mismo que usan las páginas de
        // contenido, y acota el coste de que esto se pida una vez por visita.
        // Más tiempo retrasaría el aviso de una transmisión que ya empezó.
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=600',
      },
    }),
  );
};
