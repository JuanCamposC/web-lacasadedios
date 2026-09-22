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

/**
 * El sitio vive en `lacasadedios.cl`, sin `www`.
 *
 * `www` se reclama igual y se redirige acá, en vez de con una regla del panel
 * de Cloudflare: así la decisión vive en el repositorio, junto a las canónicas
 * que apuntan al dominio sin `www`, y no en un sitio donde nadie la busca.
 *
 * 301 y no 302: el cambio es definitivo y así los buscadores trasladan lo que
 * ya tuvieran indexado.
 *
 * CUBRE TODO EL SITIO MENOS LA PORTADA. Las páginas ya compiladas —hoy la
 * portada y la de error— las sirve Cloudflare desde el almacén de archivos sin
 * pasar por aquí, así que www.lacasadedios.cl/ devuelve la portada con un 200
 * en vez de redirigir. No es un descuido, es que desde el código no se alcanza:
 *
 *   · public/_redirects no sirve: rechaza dominios en el origen (100324).
 *   · `run_worker_first` tampoco: el adaptador comprueba si hay un archivo
 *     compilado ANTES de montar el middleware (utils/handler.js), así que
 *     seguiría sin llegar aquí.
 *   · Hacer la portada dinámica sí funcionaría, y cuesta más de un mega por
 *     visita en fotos sin optimizar (el porqué, arriba del todo en
 *     src/pages/index.astro).
 *
 * Se deja así. El daño es pequeño: la portada en www lleva su canónica al
 * dominio sin www, que es lo que miran los buscadores, y en cuanto la persona
 * pincha cualquier enlace esta función la trae al dominio bueno. Cerrarlo del
 * todo pide una regla de redirección en el panel de Cloudflare, fuera del
 * repositorio.
 */
function redirigirWww(url: URL): Response | null {
  if (!url.hostname.startsWith('www.')) return null;
  const destino = new URL(url);
  destino.hostname = url.hostname.slice(4);
  return Response.redirect(destino.toString(), 301);
}

export const onRequest = defineMiddleware(async (context, next) => {
  const path = context.url.pathname;

  const aSinWww = redirigirWww(context.url);
  if (aSinWww) return aSinWww;
  const isSSR = SSR_PREFIXES.some((p) => path === p || path.startsWith(p + '/'));

  // Las cabeceras de seguridad van en TODA respuesta que salga de aquí. En
  // Cloudflare, `public/_headers` solo cubre lo estático: lo que arma el Worker
  // sale sin nada si no se le pone acá. Ver src/lib/cabeceras.ts.
  if (!isSSR) return conSeguridad(await next(), context.url);

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
        context.url,
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

  return conSeguridad(response, context.url);
});
