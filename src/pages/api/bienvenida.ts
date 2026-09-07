import type { APIRoute } from 'astro';
import { crearTransporte } from '../../lib/smtp';
import { SITE, CONTACT } from '../../data/site';
import { resolverRemitente } from '../../lib/correo';
import { construirCorreo } from '../../lib/correo-plantilla';
import { crearSupabaseServicio } from '../../lib/supabaseAdmin';

export const prerender = false;

/**
 * Correo de bienvenida, justo después de confirmar la suscripción.
 *
 * POR QUÉ ES UN ENDPOINT Y NO PARTE DE /confirmar
 * Porque enviar un correo tarda entre uno y tres segundos, y esa página la
 * está mirando alguien que acaba de pulsar un botón. Se responde primero y la
 * página llama aquí después, sin que nadie espere.
 *
 * POR QUÉ NO HAY SESIÓN
 * Igual que en /baja y /confirmar: el token del enlace ES la credencial. Se
 * usa la clave de servicio porque `subscribers` no acepta lecturas con la clave
 * anónima.
 *
 * POR QUÉ NO SE PUEDE ABUSAR
 * Solo escribe a quien ya confirmó Y todavía no tiene bienvenida, y lo primero
 * que hace tras enviar es marcar `welcomed_at`. Cada dirección recibe una y
 * solo una, aunque alguien recargue la página veinte veces o acierte un token
 * al azar.
 */

const ES_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * La respuesta es siempre la misma hacia fuera.
 *
 * Si distinguiera «token desconocido» de «ya tenía bienvenida», el endpoint
 * serviría para comprobar desde fuera qué tokens existen. El motivo real va a
 * los registros del servidor, que es donde hace falta.
 */
function fin(motivo: string) {
  console.info(`[bienvenida] ${motivo}`);
  return json({ ok: true });
}

export const POST: APIRoute = async ({ request, url: reqUrl }) => {
  const body = await request.json().catch(() => ({}));
  const token = String(body?.t ?? '').trim();
  if (!ES_UUID.test(token)) return fin('token con formato inválido');

  const supabase = crearSupabaseServicio();
  if (!supabase) return fin('falta SUPABASE_SERVICE_ROLE_KEY');

  const { data: fila, error } = await supabase
    .from('subscribers')
    .select('email, pending, welcomed_at')
    .eq('token', token)
    .maybeSingle();

  if (error) {
    // La columna llega con la migración 0008. Sin ella no se manda nada, pero
    // la confirmación —que es lo que importa— ya ocurrió.
    const faltaColumna = /welcomed_at/i.test(error.message ?? '');
    return fin(faltaColumna ? 'falta la migración 0008' : `error de base: ${error.message}`);
  }
  if (!fila) return fin('token desconocido');
  if (fila.pending) return fin('la suscripción todavía no está confirmada');
  if (fila.welcomed_at) return fin('ya tenía bienvenida');

  const transporte = crearTransporte();
  if (!transporte) return fin('sin SMTP configurado');

  const remitente = resolverRemitente('BOLETIN_FROM');
  if (!remitente.ok) return fin(`remitente inválido: «${remitente.valor}»`);

  const base = process.env.SITE_URL || reqUrl.origin;
  const urlBaja = `${base}/baja?t=${encodeURIComponent(token)}`;

  const { html, texto } = construirCorreo({
    base,
    preencabezado: 'Ya estás en la lista. Esto es lo que vas a recibir.',
    eyebrow: 'Bienvenida',
    titulo: 'Ya estás dentro',
    bloques: [
      {
        tipo: 'parrafo',
        texto:
          'Gracias por confirmar. A partir de ahora te escribimos cuando publicamos una noticia, cuando hay un evento y cuando empieza una transmisión en vivo. Nada más: no mandamos correos por mandar.',
      },
      {
        tipo: 'parrafo',
        texto:
          'Si es la primera vez que nos escuchas, lo más útil es saber cuándo nos reunimos. Somos cuatro templos —Santiago Centro, San Miguel, Limache y Coya— y las puertas están abiertas.',
      },
      { tipo: 'boton', texto: 'Ver los horarios', url: `${base}/horarios` },
    ],
    pie: {
      texto: `Puedes salirte cuando quieras, sin dar explicaciones.`,
      enlace: { texto: 'Darte de baja', url: urlBaja },
    },
  });

  try {
    await transporte.sendMail({
      from: remitente.from,
      replyTo: CONTACT.email,
      to: fila.email,
      subject: `${SITE.name} — Bienvenido al boletín`,
      text: texto,
      html,
      headers: { 'List-Unsubscribe': `<${urlBaja}>` },
    });
  } catch (e) {
    // No se marca como enviada: así el siguiente intento puede reintentarlo.
    return fin(`el servidor de correo rechazó el envío: ${(e as Error).message}`);
  } finally {
    transporte.close();
  }

  const { error: errorMarca } = await supabase
    .from('subscribers')
    .update({ welcomed_at: new Date().toISOString() })
    .eq('token', token);
  if (errorMarca) console.error(`[bienvenida] no se pudo marcar: ${errorMarca.message}`);

  // La dirección no va a los registros: es un dato personal.
  return fin('enviada');
};
