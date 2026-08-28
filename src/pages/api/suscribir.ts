/**
 * Alta al boletín con doble opt-in.
 *
 * POR QUÉ EXISTE
 * Antes el navegador insertaba directamente en `subscribers` con la clave
 * anónima, amparado en una política `for insert with check (true)`. Como esa
 * clave es pública por diseño, cualquiera podía llenar la tabla o suscribir a
 * terceros a su nombre. La política ya no existe (ver la migración «ALTA DEL
 * BOLETÍN CON DOBLE OPT-IN» en supabase/schema.sql) y esta es la única vía de
 * escritura: valida el correo, frena por IP y deja la fila en `pending` hasta
 * que la persona confirme desde su bandeja.
 */
import type { APIRoute } from 'astro';
import { Resend } from 'resend';
import { SITE } from '../../data/site';
import { resolverRemitente } from '../../lib/correo';
import { crearSupabaseServicio } from '../../lib/supabaseAdmin';

export const prerender = false;

/** Altas permitidas por IP dentro de la ventana. */
const LIMITE = 5;
const VENTANA_MIN = 60;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

/**
 * Un solo sitio por donde salen los fallos.
 *
 * El detalle NO viaja al navegador: se escribe en los registros de la función.
 * Devolverlo era cómodo para diagnosticar, pero este endpoint es público y sin
 * autenticar, así que cualquiera podía leer estado interno del servidor: llegó a
 * repetir el contenido literal de una variable de entorno mal pegada. Al
 * navegador le basta el motivo —el pie ya traduce cada uno a una frase—; el
 * detalle lo necesita quien mantiene el sitio, y ese mira los registros.
 */
function fallo(reason: string, detalle: string, status = 200) {
  console.error(`[suscribir] ${reason}: ${detalle}`);
  return json({ ok: false, reason }, status);
}

function esc(s: unknown) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Validación de formato, no de existencia. Deliberadamente más estricta que el
 * `type="email"` del navegador —sin espacios, un solo arroba, TLD de dos letras
 * o más— pero sin pretender cubrir el RFC entero: quien pase de aquí todavía
 * tiene que confirmar desde su bandeja, que es la comprobación de verdad.
 */
const CORREO = /^[^\s@,;<>()[\]\\]+@[^\s@.]+(\.[^\s@.]+)*\.[a-z]{2,}$/i;

function correoValido(email: string): boolean {
  return email.length <= 254 && CORREO.test(email);
}

/**
 * IP del visitante. En Vercel llega en `x-forwarded-for`, donde el primer
 * elemento es el cliente real y el resto son los proxies intermedios.
 */
function ipDe(request: Request): string {
  const xff = request.headers.get('x-forwarded-for') ?? '';
  const primera = xff.split(',')[0]?.trim();
  return primera || request.headers.get('x-real-ip')?.trim() || 'desconocida';
}

export const POST: APIRoute = async ({ request, url: reqUrl }) => {
  // El formato se valida antes que nada: una petición malformada se rechaza
  // igual esté o no configurado el servidor, y sin gastar una consulta.
  const body = await request.json().catch(() => ({}) as Record<string, unknown>);
  const email = String((body as any)?.email ?? '')
    .trim()
    .toLowerCase();

  if (!correoValido(email)) return json({ ok: false, reason: 'correo_invalido' }, 400);

  const supabase = crearSupabaseServicio();
  if (!supabase) {
    // Sin la clave de servicio no se puede escribir: la tabla ya no acepta la
    // clave anónima. Se registra cuál falta en vez de dejar un 500 mudo.
    return fallo('sin_configurar', 'Falta SUPABASE_SERVICE_ROLE_KEY en el entorno del servidor.');
  }

  // ── Freno por IP ──────────────────────────────────────────────────────────
  // La cuenta vive en la base y no en memoria del proceso: en serverless cada
  // instancia tendría su propio contador y bastaría con reintentar hasta caer
  // en una nueva para saltárselo.
  const { data: previos, error: errorFreno } = await supabase.rpc('registrar_intento_alta', {
    p_ip: ipDe(request),
    p_ventana: `${VENTANA_MIN} minutes`,
  });

  if (errorFreno) {
    const faltaMigracion = /registrar_intento_alta|subscribe_attempts/i.test(
      errorFreno.message ?? '',
    );
    return fallo(faltaMigracion ? 'falta_migracion' : 'db_error', errorFreno.message);
  }

  if (typeof previos === 'number' && previos >= LIMITE) {
    return json({ ok: false, reason: 'demasiados_intentos' }, 429);
  }

  // ── Alta ──────────────────────────────────────────────────────────────────
  const { data: fila, error } = await supabase
    .from('subscribers')
    .insert({ email })
    .select('token, pending')
    .single();

  if (error) {
    // 23505 = correo ya presente. Al navegador se le responde lo mismo que a un
    // alta nueva: distinguirlas permitiría comprobar desde fuera quién está en
    // la lista. En los registros sí se separan —sin la dirección, que es un dato
    // personal— porque si no, un «dice que lo envió y no llega» es indistinguible
    // de un fallo de entrega.
    if (error.code === '23505') {
      console.info('[suscribir] ya_estaba: la dirección ya figuraba, no se envía correo');
      return json({ ok: true, estado: 'ya_estaba' });
    }

    const faltaMigracion = /pending|confirmed_at/i.test(error.message ?? '');
    return fallo(faltaMigracion ? 'falta_migracion' : 'db_error', error.message);
  }

  // ── Correo de confirmación ────────────────────────────────────────────────
  const apiKey = process.env.RESEND_API_KEY;
  const remitente = resolverRemitente();

  // Los dos fallos van por separado y no en una disyunción: `remitente.valor`
  // solo existe en la rama de error del tipo, y agrupándolos TypeScript no
  // puede estrecharlo. Es lo que hacía que el mensaje dijera «undefined».
  //
  // En ambos casos la fila queda pendiente a propósito: confirmar es lo que da
  // permiso para escribir a esa persona, y sin correo saliente no hay permiso.
  if (!apiKey) {
    return fallo(
      'sin_proveedor_correo',
      'Falta RESEND_API_KEY: el alta quedó pendiente de confirmar.',
    );
  }

  if (!remitente.ok) {
    return fallo(
      'from_invalido',
      `CONTACT_FROM = «${remitente.valor}». Debe ser «correo@dominio.cl» o «Nombre <correo@dominio.cl>», sin comillas.`,
    );
  }

  const base = process.env.SITE_URL || reqUrl.origin;
  const enlace = `${base}/confirmar?t=${encodeURIComponent(String(fila.token))}`;

  const html = `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:auto;color:#17202e">
    <h2 style="color:#14295c;margin:0 0 4px">${esc(SITE.name)}</h2>
    <p style="color:#64748b;margin:0 0 20px">Confirma tu suscripción al boletín</p>
    <p style="margin:0 0 20px">Alguien —esperamos que tú— dejó este correo para recibir nuestras novedades. Confírmalo con el botón y quedas dentro.</p>
    <p><a href="${esc(enlace)}" style="display:inline-block;background:#14295c;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Confirmar mi suscripción</a></p>
    <p style="color:#64748b;font-size:.8rem;margin-top:28px;border-top:1px solid #e2e8f0;padding-top:14px">
      Si no fuiste tú, no hagas nada: sin confirmar no te llegará ningún boletín.
    </p>
  </div>`;

  try {
    const resend = new Resend(apiKey);
    const { error: errorEnvio } = await resend.emails.send({
      from: remitente.from,
      to: email,
      subject: `${SITE.name} — Confirma tu suscripción`,
      html,
    });

    if (errorEnvio) {
      return fallo('send_error', (errorEnvio as any)?.message ?? String(errorEnvio));
    }
  } catch (e) {
    return fallo('send_error', (e as Error).message);
  }

  console.info('[suscribir] confirmacion_enviada: Resend aceptó el envío');
  return json({ ok: true, estado: 'confirmacion_enviada' });
};
