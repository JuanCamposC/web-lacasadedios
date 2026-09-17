import { defineMiddleware } from 'astro:middleware';
import { conSeguridad } from './lib/cabeceras';
import { permitirPanel } from './lib/access';

// Rutas servidas bajo demanda. Las demás páginas son estáticas y no pasan por
// aquí en producción: las sirve el binding de assets sin tocar el Worker.
const SSR_PREFIXES = ['/admin', '/eventos', '/noticias', '/videos', '/en-vivo', '/api'];

/**
 * Todo lo que hay debajo de /admin, más los endpoints que escriben.
 *
 * `/api/notify` está en la lista y no es un detalle: escribe a TODA la lista
 * de suscriptores. Vive fuera de /api/admin por su ruta, así que antes caía en
 * la rama de abajo —que deja pasar sin identidad— y el único motivo por el que
 * no se podía usar desde fuera era que Access cubre el host entero del sitio de
 * pruebas. El día que Access se limite a /admin, esa dirección habría quedado
 * abierta a internet.
 */
function esPanel(path: string): boolean {
  return (
    path === '/admin' ||
    path.startsWith('/admin/') ||
    path.startsWith('/api/admin/') ||
    path === '/api/notify'
  );
}

export const onRequest = defineMiddleware(async (context, next) => {
  const path = context.url.pathname;
  const isSSR = SSR_PREFIXES.some((p) => path === p || path.startsWith(p + '/'));

  // Las cabeceras de seguridad van en TODA respuesta que salga de aquí. En
  // Cloudflare, `public/_headers` solo cubre lo estático: lo que arma el Worker
  // sale sin nada si no se le pone acá. Ver src/lib/cabeceras.ts.
  if (!isSSR) return conSeguridad(await next());

  // ── La puerta del panel ────────────────────────────────────────────────────
  //
  // Ya no hay pantalla de login: quien autentica es Cloudflare Access, en el
  // borde, y aquí solo se verifica la firma de su token. Por eso desapareció
  // todo lo que había antes —contraseña de Supabase, segundo factor TOTP,
  // redirección a /admin/login—: eso lo pone ahora Google a través de Access.
  //
  // Se responde 403 y no una redirección, porque no hay adónde redirigir. Si
  // Access está bien puesto delante, esta rama no se alcanza nunca: Access
  // corta antes de que la petición llegue al Worker. Existe para el caso en que
  // NO lo esté, que es justo cuando hace falta.
  if (esPanel(path)) {
    const acceso = await permitirPanel(context.request, context.url);
    if (!acceso.permitido) {
      return conSeguridad(
        new Response(
          'Este panel requiere iniciar sesión con una cuenta de la iglesia.\n' +
            'Si estás viendo esto, Cloudflare Access no está protegiendo esta dirección.',
          { status: 403, headers: { 'content-type': 'text/plain; charset=utf-8' } },
        ),
      );
    }
    context.locals.identidad = acceso.identidad;
    context.locals.motivoAcceso = acceso.motivo;
  } else {
    context.locals.identidad = null;
    context.locals.motivoAcceso = 'denegado';
  }

  const response = await next();

  // El panel y los endpoints no se guardan en ninguna caché. Las páginas de
  // contenido sí —cada una fija su propio `s-maxage`—, y sin esta marca una
  // respuesta con datos de sesión podría quedarse guardada en alguna capa
  // intermedia y servirse a otra persona.
  //
  // `/api/estado` y `/api/instagram` son las excepciones, y son deliberadas:
  // los pide el navegador desde páginas estáticas —el primero en todas, para
  // saber si hay transmisión en vivo; el segundo en la portada, para las fotos
  // de Instagram—, no llevan ni sesión ni nada sin publicar, y sin caché serían
  // tantas consultas a la base como visitas. Cada uno fija su propio `s-maxage`
  // y esta línea se lo estropearía: `set` pisa, no añade.
  const publicos = ['/api/estado', '/api/instagram'];
  if (!publicos.includes(path) && (path.startsWith('/admin') || path.startsWith('/api'))) {
    response.headers.set('Cache-Control', 'no-store, must-revalidate');
  }

  return conSeguridad(response);
});
