import type { APIRoute } from 'astro';
import { enviarCadaUno, envioConfigurado } from '../../lib/envio';
import { CONTACT, SITE } from '../../data/site';
import { resolverRemitente } from '../../lib/correo';
import { construirCorreo } from '../../lib/correo-plantilla';
import { baseDeDatos } from '../../lib/base';
import { ajustes } from '../../lib/datos';
import { confirmados, marcarVivoAvisado } from '../../lib/boletin';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Traduce el rechazo del servidor a un motivo que el panel sepa explicar.
 *
 * Sin esto, cualquier fallo caía en «el servidor rechazó los envíos», que es
 * cierto y no sirve de nada: manda a revisar cPanel cuando el problema puede
 * ser una variable de entorno. El caso real que lo motivó: CONTACT_FROM
 * apuntaba a una casilla que no existía y Exim rechazaba por verificación de
 * remitente, no por nada del hosting.
 */
function clasificar(mensaje: string): string {
  // Los patrones son los de Resend, no los del SMTP de antes: aquellos
  // —«sender verify», «535»— hablaban de Exim y ya no puede llegar ninguno.
  if (/not verified|domain.*verif|invalid.*from/i.test(mensaje)) {
    return 'remitente_inexistente';
  }
  if (/unauthorized|invalid.*api.?key|forbidden|401|403/i.test(mensaje)) return 'auth_invalida';
  if (/rate limit|too many|429|quota/i.test(mensaje)) return 'limite_proveedor';
  return 'send_error';
}

export const POST: APIRoute = async ({ request, locals, url: reqUrl }) => {
  // Quien autentica es Cloudflare Access, en el borde; el middleware verifica
  // la firma del token antes de llegar acá (ver src/lib/access.ts).
  //
  // ── POR QUÉ SE VUELVE A COMPROBAR ACÁ ──────────────────────────────────────
  // Porque el comentario que había en este sitio decía «no se sirve si el
  // middleware no dejó identidad» y eso no era verdad: la comprobación no
  // existía. Este endpoint le escribe a TODA la lista de suscriptores desde el
  // dominio de la iglesia; que esté protegido no puede depender de que otro
  // archivo acierte con una lista de prefijos, ni de dónde se dibuje mañana la
  // política de Cloudflare Access.
  const identidad = locals.identidad;
  if (!identidad) return json({ ok: false, reason: 'no_autorizado' }, 403);

  // Y el mismo cerrojo que el resto del panel: una cookie de Access la manda
  // el navegador sola, también cuando quien pide es otro sitio. Sin esto, una
  // página cualquiera podría hacer que el navegador de alguien del equipo
  // —con su sesión abierta— le escribiera a toda la lista.
  const origen = request.headers.get('Origin');
  if (origen) {
    try {
      if (new URL(origen).host !== reqUrl.host) {
        return json({ ok: false, reason: 'origen_no_permitido' }, 403);
      }
    } catch {
      return json({ ok: false, reason: 'origen_no_permitido' }, 403);
    }
  }

  // `db` y no `base`: más abajo `base` ya es la dirección del sitio.
  let db;
  try {
    db = await baseDeDatos();
  } catch (e) {
    console.error(`[notify] ${(e as Error).message}`);
    return json({ ok: false, reason: 'db_error' });
  }

  const body = await request.json().catch(() => ({}));
  const type = String(body?.type ?? '');
  const title = String(body?.title ?? '').trim();
  const url = String(body?.url ?? '').trim();
  if (!title) return json({ ok: false, reason: 'bad_request' }, 400);

  /**
   * Prueba: el correo sale igual, pero solo a quien lo pide.
   *
   * No toca la lista ni deja marcada la transmisión como avisada, así que se
   * puede repetir. Es la única forma de ver el correo de verdad —en el móvil,
   * en Gmail, con las imágenes bloqueadas— antes de mandárselo a todo el mundo.
   */
  const esPrueba = body?.prueba === true;

  // El extracto y la imagen son opcionales: los videos no tienen imagen y una
  // noticia puede ir sin bajada.
  const extracto = String(body?.excerpt ?? '')
    .trim()
    .slice(0, 400);
  const imagenCruda = String(body?.image ?? '').trim();
  // Solo https y solo si es una dirección de verdad. Una ruta relativa o un
  // `data:` no se ven en ningún cliente de correo, y dejarlos pasar da un
  // correo roto en vez de un correo sin imagen.
  const imagen = /^https:\/\/[^\s"'<>]+$/i.test(imagenCruda) ? imagenCruda : '';

  const esVivo = type === 'vivo';

  /**
   * La transmisión tiene dos reglas que las publicaciones no tienen.
   *
   * PRIMERA: el enlace no se toma del cuerpo de la petición sino de la tabla.
   * Es la única fuente que sabe qué se está emitiendo de verdad.
   *
   * SEGUNDA: no se avisa dos veces de la misma transmisión. Sin esto, corregir
   * una errata en el título y volver a guardar le escribiría otra vez a toda la
   * lista. Cuando empiece la siguiente el enlace cambiará, dejará de coincidir,
   * y el aviso sale solo: no hay nada que acordarse de reiniciar.
   */
  let marcaVivo = '';
  if (esVivo && !esPrueba) {
    let aj;
    try {
      aj = await ajustes(db);
    } catch (e) {
      console.error(`[notify] ${(e as Error).message}`);
      return json({ ok: false, reason: 'db_error' });
    }
    if (aj?.vivo_activo !== 1) return json({ ok: false, reason: 'no_en_vivo' });

    marcaVivo = aj.vivo_url ?? '';
    if (marcaVivo && marcaVivo === aj.vivo_url_avisada) {
      // No es un fallo: es la protección funcionando.
      return json({ ok: true, sent: 0, reason: 'ya_avisado' });
    }
  }

  if (!envioConfigurado()) return json({ ok: false, reason: 'no_email_provider' });

  // En la prueba el único destinatario es quien la pidió, con un token
  // inventado: el enlace de baja tiene que aparecer en el correo —es lo que se
  // va a revisar— pero no debe dar de baja a nadie de verdad al pulsarlo.
  let destinatarios: { correo: string; token: string }[];

  if (esPrueba) {
    // La prueba va a quien la pidió, y eso sale del token de Access. Si no hay
    // identidad —panel abierto a propósito, o desarrollo local— no hay a quién
    // mandarla: se dice, en vez de mandarla a la lista por descuido.
    if (!identidad?.correo) return json({ ok: false, reason: 'sin_correo_admin' });
    destinatarios = [{ correo: identidad.correo, token: 'prueba' }];
  } else {
    // `confirmados()` filtra SIEMPRE por quien confirmó desde su propia bandeja.
    // Escribir a los pendientes sería escribir a direcciones que nadie verificó,
    // que es justo lo que dispara las quejas de spam y arrastra la reputación
    // del dominio. Ver src/lib/boletin.ts.
    try {
      destinatarios = await confirmados(db);
    } catch (e) {
      console.error(`[notify] ${(e as Error).message}`);
      return json({ ok: false, reason: 'db_error' });
    }

    destinatarios = destinatarios.filter((s) => s.correo && s.token);
    if (!destinatarios.length) return json({ ok: true, sent: 0 });
  }

  // El rótulo de arriba dice de qué va el correo en dos palabras; el título es
  // el del contenido. Antes iban juntos en una frase («Publicamos una nueva
  // noticia:») y el título quedaba de segundón.
  const rotulo = esVivo
    ? 'En vivo ahora'
    : type === 'evento'
      ? 'Nuevo evento'
      : type === 'noticia'
        ? 'Nueva noticia'
        : type === 'video'
          ? 'Nuevo video'
          : 'Novedad';

  // La transmisión no se «publica», está pasando. El correo lo dice así, y el
  // botón lleva a verla en vez de a leerla.
  const entradilla = esVivo
    ? 'Estamos transmitiendo en este momento. Acompáñanos desde donde estés.'
    : 'Acabamos de publicarlo en el sitio.';
  const textoBoton = esVivo ? 'Ver la transmisión' : 'Verlo en el sitio';
  const base0 = esVivo ? `${SITE.name} — En vivo ahora: ${title}` : `${SITE.name} — ${title}`;
  const asunto = esPrueba ? `[PRUEBA] ${base0}` : base0;

  // El boletín sale de su propia casilla, para que una queja de spam no
  // arrastre a los correos del formulario de contacto. Ver resolverRemitente.
  const remitente = resolverRemitente('BOLETIN_FROM');
  if (!remitente.ok) {
    // El valor de la variable se registra, no se responde: esto mismo ya se
    // corrigió en /api/suscribir —«llegó a repetir el contenido literal de una
    // variable de entorno mal pegada»— y acá había quedado igual que antes.
    console.error(
      `[notify] BOLETIN_FROM/CONTACT_FROM mal escrito: «${remitente.valor}». Debe ser «correo@dominio.cl» o «Nombre <correo@dominio.cl>».`,
    );
    return json({ ok: false, reason: 'from_invalido' });
  }
  const from = remitente.from;
  const base = process.env.SITE_URL || reqUrl.origin;
  const link = url || base;

  // La respuesta va a la casilla de contacto: quien conteste un boletín espera
  // que lo lea una persona, no la casilla desde la que sale el envío masivo.
  const responderA = CONTACT.email;

  // Se arma por destinatario porque cada uno lleva SU enlace de baja.
  const cuerpo = (urlBaja: string) =>
    construirCorreo({
      base,
      preencabezado: extracto || (esVivo ? entradilla : `${rotulo}: ${title}`),
      eyebrow: rotulo,
      titulo: title,
      bloques: [
        // La imagen va antes del texto: es lo que hace que se lea lo demás.
        ...(imagen ? [{ tipo: 'imagen' as const, url: imagen, alt: title }] : []),
        { tipo: 'parrafo', texto: extracto || entradilla },
        { tipo: 'boton', texto: textoBoton, url: link },
      ],
      pie: {
        texto: `Recibes este correo porque te suscribiste al boletín de ${SITE.name}.`,
        enlace: { texto: 'Darte de baja', url: urlBaja },
      },
    });

  // Un correo por persona, nunca copia oculta: cada uno lleva su propio enlace
  // de baja, y sin esa salida los proveedores penalizan.
  //
  // Un rechazo individual NO aborta el resto. Eso ya se sufrió con un envío por
  // lotes anterior, donde un solo destinatario malo dejaba sin aviso a toda la
  // lista que venía detrás. Resend tiene su propio endpoint de lote y NO se usa
  // por exactamente esa razón: valida el lote entero. Ver src/lib/envio.ts.
  //
  // La concurrencia la pone `enviarCadaUno`, no este código: el `pool` de
  // nodemailer que antes encolaba de tres en tres ya no existe, y sin freno
  // una lista larga se respondería a sí misma con 429.
  const mensajes = destinatarios.map((s) => {
    const urlBaja = `${base}/baja?t=${encodeURIComponent(s.token)}`;
    const { html, texto } = cuerpo(urlBaja);
    return {
      from,
      replyTo: responderA,
      to: s.correo,
      subject: asunto,
      text: texto,
      html,
      headers: {
        // Cabecera estándar: pone el botón «Cancelar suscripción» en Gmail y
        // Outlook, y es lo que miran para no marcar el envío como spam.
        //
        // A propósito SIN `List-Unsubscribe-Post`: la baja en un clic exige que
        // la URL acepte POST sin cabecera Origin, y Astro lo bloquea por
        // protección CSRF. Desactivar esa protección en todo el sitio por una
        // lista de decenas de personas no compensa; así el botón igual aparece
        // y abre la página de baja.
        'List-Unsubscribe': `<${urlBaja}>`,
      },
    };
  });

  // La dirección no va a los registros: es un dato personal. Basta con saber
  // cuántos fallaron y con qué motivo los rechazaron.
  const { enviados, fallidos, primerFallo } = await enviarCadaUno(mensajes, (motivo) =>
    console.error(`[notify] destinatario rechazado: ${motivo}`),
  );

  // Que no saliera NI UNO es un fallo; que fallen algunos, un aviso.
  if (!enviados && fallidos) {
    return json({ ok: false, reason: clasificar(primerFallo), sent: 0, fallidos });
  }

  // La transmisión se marca DESPUÉS de enviar y solo si salió alguno: si el
  // envío falla entero, el siguiente intento debe volver a intentarlo. Una
  // prueba nunca marca nada: para eso es una prueba.
  if (esVivo && !esPrueba && enviados && marcaVivo) {
    try {
      await marcarVivoAvisado(db, marcaVivo);
    } catch (e) {
      // No se le devuelve al panel: los correos YA salieron, y decir que falló
      // invitaría a reintentar y a escribir dos veces. Queda en los registros.
      console.error(`[notify] no se pudo marcar la transmisión avisada: ${(e as Error).message}`);
    }
  }

  return json({ ok: true, sent: enviados, fallidos, prueba: esPrueba });
};
