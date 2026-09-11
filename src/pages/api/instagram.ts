import type { APIRoute } from 'astro';
import { baseDeDatos } from '../../lib/base';
import { instagramPublicado } from '../../lib/datos';
import { urlMedio } from '../../lib/medios';
import { conSeguridad } from '../../lib/cabeceras';

export const prerender = false;

/**
 * Las fotos de Instagram que enseña la portada.
 *
 * ── POR QUÉ ES UN ENDPOINT Y NO PARTE DE LA PÁGINA ──────────────────────────
 * La portada es un archivo generado al compilar, y eso no es un detalle: es lo
 * que hace que `<Image />` sirva WebP de 12 kB en vez de los JPEG originales de
 * 211 kB. Armar la portada al servir para poder leer la base costaba más de un
 * mega en la página que más se visita (ver la nota en src/pages/index.astro).
 *
 * Así que se hace igual que con la transmisión en vivo: la página se pinta
 * entera y este pedazo se pide después. Mismo origen, sin claves en el
 * navegador, y `connect-src 'self'` sigue intacto.
 *
 * ── LO QUE SALE DE AQUÍ ─────────────────────────────────────────────────────
 * Solo lo publicado, y solo lo que ya se ve en pantalla: la dirección de la
 * foto, su texto alternativo y el enlace a la publicación. Ni borradores ni
 * claves de R2 —se devuelve la dirección pública ya armada, no la clave—.
 */
export const GET: APIRoute = async () => {
  let fotos: { src: string; alt: string; href: string | null }[] = [];

  try {
    fotos = (await instagramPublicado(await baseDeDatos()))
      .map((p) => ({ src: urlMedio(p.imagen_clave), alt: p.alt, href: p.enlace }))
      // Sin dominio de medios configurado `urlMedio` devuelve `null`, y una foto
      // sin dirección es un cuadro roto. Se descarta acá y la portada se queda
      // con las suyas.
      .filter((p): p is { src: string; alt: string; href: string | null } => Boolean(p.src));
  } catch {
    // Un fallo acá no puede romper nada: la portada ya tiene fotos pintadas y
    // el script no las toca si esto viene vacío.
    fotos = [];
  }

  return conSeguridad(
    new Response(JSON.stringify({ fotos }), {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        // Lo pide toda visita a la portada. Sin caché serían tantas consultas a
        // la base como visitas, para un dato que cambia cada varias semanas.
        // Ver la excepción en src/middleware.ts.
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
      },
    }),
  );
};
