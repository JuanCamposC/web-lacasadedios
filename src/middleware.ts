import { defineMiddleware } from 'astro:middleware';
import { createServerSupabase, supabaseConfigured } from './lib/supabase';
import { conSeguridad } from './lib/cabeceras';
import { permitirPanel } from './lib/access';

// Rutas servidas bajo demanda. Las demás páginas son estáticas y no pasan por
// aquí en producción: las sirve el binding de assets sin tocar el Worker.
const SSR_PREFIXES = ['/admin', '/eventos', '/noticias', '/videos', '/en-vivo', '/api'];

/** Todo lo que hay debajo de /admin, más los endpoints que escriben. */
function esPanel(path: string): boolean {
  return path === '/admin' || path.startsWith('/admin/') || path.startsWith('/api/admin/');
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

  // ── Supabase, solo para lo que aún no migra ────────────────────────────────
  // Queda para los dos endpoints del boletín. Las páginas públicas y el panel
  // ya leen de D1. Cuando el boletín pase a D1, estas líneas se van.
  if (supabaseConfigured) {
    context.locals.supabase = createServerSupabase(context.cookies, context.request);
  }
  context.locals.user = null;

  const response = await next();

  // El panel y los endpoints no se guardan en ninguna caché. Las páginas de
  // contenido sí —cada una fija su propio `s-maxage`—, y sin esta marca una
  // respuesta con datos de sesión podría quedarse guardada en alguna capa
  // intermedia y servirse a otra persona.
  if (path.startsWith('/admin') || path.startsWith('/api')) {
    response.headers.set('Cache-Control', 'no-store, must-revalidate');
  }

  return conSeguridad(response);
});
