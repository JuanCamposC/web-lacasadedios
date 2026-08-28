import { defineMiddleware } from 'astro:middleware';
import { createServerSupabase, supabaseConfigured } from './lib/supabase';

// Rutas servidas bajo demanda que usan Supabase. Las demás páginas son
// estáticas y NO deben tocar el cliente (evita leer headers en prerender).
const SSR_PREFIXES = ['/admin', '/eventos', '/noticias', '/videos', '/en-vivo', '/api'];

export const onRequest = defineMiddleware(async (context, next) => {
  const path = context.url.pathname;
  const isSSR = SSR_PREFIXES.some((p) => path === p || path.startsWith(p + '/'));
  if (!isSSR) return next();

  const isProtectedAdmin = path.startsWith('/admin') && path !== '/admin/login';

  // Sin configuración de Supabase: no intentes usarlo (evita 500). El admin
  // se manda al login, que mostrará el aviso de configuración pendiente.
  if (!supabaseConfigured) {
    if (isProtectedAdmin) return context.redirect('/admin/login');
    return next();
  }

  const supabase = createServerSupabase(context.cookies, context.request);
  context.locals.supabase = supabase;
  context.locals.user = null;

  const sinCache = path.startsWith('/admin') || path.startsWith('/api');

  // Protege el panel (excepto la página de login).
  if (isProtectedAdmin) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return context.redirect('/admin/login');
    context.locals.user = user;

    // ── Segundo factor ──────────────────────────────────────────────────────
    // `getAuthenticatorAssuranceLevel` devuelve dónde está la sesión ahora y
    // hasta dónde PUEDE llegar. Que `nextLevel` sea aal2 significa que esta
    // persona tiene un factor TOTP verificado; si `currentLevel` sigue en aal1,
    // entró solo con la contraseña y le falta el código.
    //
    // La comprobación es sobre el par, no sobre `currentLevel` a secas: quien
    // todavía no ha dado de alta un factor tiene nextLevel aal1 y debe poder
    // entrar igual, o el panel quedaría cerrado para todos al activar TOTP.
    //
    // Cuesta una segunda ida a Supabase por petición: la función llama a
    // `getUser` por dentro y ya se llamó arriba. Se asume a cambio de leer el
    // nivel con la API documentada; deducirlo a mano exigiría decodificar el
    // JWT por nuestra cuenta, que es justo donde se cuelan los errores.
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal && aal.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') {
      return context.redirect('/admin/login?mfa=1');
    }
  }

  const response = await next();

  // El panel y los endpoints no se guardan en ninguna caché. Las páginas de
  // contenido sí —cada una fija su propio `s-maxage`—, y sin esta marca una
  // respuesta con datos de sesión podría quedarse guardada en alguna capa
  // intermedia y servirse a otra persona.
  //
  // vercel.json lo repite a nivel de CDN, a propósito: aquí se protege la
  // respuesta de la función, allí cualquier cosa servida bajo esas rutas.
  if (sinCache) {
    response.headers.set('Cache-Control', 'no-store, must-revalidate');
  }

  return response;
});
