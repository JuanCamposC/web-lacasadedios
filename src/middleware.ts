import { defineMiddleware } from 'astro:middleware';
import { createServerSupabase, supabaseConfigured } from './lib/supabase';

// Rutas servidas bajo demanda que usan Supabase. Las demás páginas son
// estáticas y NO deben tocar el cliente (evita leer headers en prerender).
const SSR_PREFIXES = ['/admin', '/eventos', '/noticias', '/videos'];

export const onRequest = defineMiddleware(async (context, next) => {
  const path = context.url.pathname;
  const needsSupabase =
    supabaseConfigured &&
    SSR_PREFIXES.some((p) => path === p || path.startsWith(p + '/'));

  if (!needsSupabase) return next();

  const supabase = createServerSupabase(context.cookies, context.request);
  context.locals.supabase = supabase;
  context.locals.user = null;

  // Protege el panel (excepto la página de login).
  if (path.startsWith('/admin') && path !== '/admin/login') {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return context.redirect('/admin/login');
    context.locals.user = user;
  }

  return next();
});
