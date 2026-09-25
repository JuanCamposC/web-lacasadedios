/**
 * El envío del formulario de contacto, sin depender de quién lo pida.
 *
 * Vive fuera del endpoint porque ahora hay DOS puertas a lo mismo:
 *
 *   · `/api/contacto` — la que usa el navegador con JavaScript, y responde JSON.
 *   · `/contacto` — la que usa el formulario cuando NO hay JavaScript. Esa
 *     necesita volver a dibujar la página con lo que la persona escribió; antes
 *     redirigía a `?enviado=0` y el mensaje entero se perdía.
 *
 * Con la lógica acá, las dos hacen exactamente lo mismo y no hay una versión
 * buena y otra olvidada.
 */
import { crearTransporte } from './envio';
import { CONTACT } from '../data/site';
import { templos } from '../data/templos';
import { conNombre, resolverRemitente } from './correo';
import { construirCorreo } from './correo-plantilla';
import { baseDeDatos } from './base';
import { registrarIntento } from './boletin';
import { ipDe } from './ip';

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);

/**
 * Cuántos mensajes admite una misma IP por hora.
 *
 * El señuelo y el umbral de tiempo de más abajo frenan a un robot de
 * formularios, no a un bucle de `curl`: ese no ejecuta JavaScript, así que no
 * rellena el campo del reloj y la trampa temporal se le desactiva sola. Sin un
 * tope, cada petición que pase dispara un envío, y unas miles agotan la cuota
 * mensual de correo —y con ella la confirmación del boletín, que sale por el
 * mismo proveedor—.
 *
 * Cinco por hora: nadie escribe seis mensajes distintos a su iglesia en una
 * hora, y quien lo necesite tiene el correo directo en la misma página.
 */
const LIMITE = 5;
const VENTANA_MIN = 60;

/**
 * Topes de largo, por si quien envía no es el formulario.
 *
 * Los `maxlength` los pone el navegador y no valen nada para quien manda la
 * petición a mano. Sin esto, el asunto —que va al título del correo— y el
 * mensaje pueden tener megabytes.
 */
const TOPES = { nombre: 100, email: 254, telefono: 40, asunto: 150, mensaje: 4000 };

/** Lee el cuerpo venga como formulario (sin JS) o como JSON. */
export async function readBody(request: Request): Promise<Record<string, string>> {
  const type = request.headers.get('content-type') ?? '';
  if (type.includes('application/json')) {
    const raw = await request.json().catch(() => ({}));
    return Object.fromEntries(Object.entries(raw ?? {}).map(([k, v]) => [k, String(v ?? '')]));
  }
  const form = await request.formData();
  return Object.fromEntries(
    Array.from(form.entries()).map(([k, v]) => [k, typeof v === 'string' ? v : '']),
  );
}

/** Lo que la persona escribió, ya recortado a los topes. */
/** Los campos del formulario. Es un Record para poder volcarlo al formulario. */
export interface Mensaje extends Record<string, string> {
  nombre: string;
  email: string;
  telefono: string;
  templo: string;
  asunto: string;
  mensaje: string;
}

export interface Resultado {
  ok: boolean;
  /** Por qué no se pudo, para traducirlo a una frase. */
  reason?: string;
  /** Código que corresponde cuando la respuesta es JSON. */
  status?: number;
  /** Los valores ya limpios, para volver a pintar el formulario. */
  valores: Mensaje;
}

export async function procesarContacto(
  request: Request,
  body: Record<string, string>,
): Promise<Resultado> {
  // Anti-bot: campo señuelo + envío sospechosamente rápido.
  // Se responde "ok" a propósito para no darle pistas al bot.
  const enviadoEn = Number(body._t || 0);
  if (body.website || (enviadoEn > 0 && Date.now() - enviadoEn < 2500)) {
    // Al señuelo se le responde que todo fue bien: decirle que se le ve el
    // truco solo sirve para que lo arreglen.
    return {
      ok: true,
      valores: { nombre: '', email: '', telefono: '', templo: '', asunto: '', mensaje: '' },
    };
  }

  const nombre = (body.nombre ?? '').trim().slice(0, TOPES.nombre);
  const email = (body.email ?? '').trim().slice(0, TOPES.email);
  const telefono = (body.telefono ?? '').trim().slice(0, TOPES.telefono);
  // El templo se COMPARA contra la lista y no se usa tal cual: sube al asunto
  // del correo, y un formulario manipulado no tiene por qué decidir qué texto
  // aparece ahí. Lo que no calce es una consulta general.
  const temploElegido = templos.find((t) => t.short === (body.templo ?? '').trim());
  const templo = temploElegido?.short ?? '';
  const asunto = (body.asunto ?? '').trim().slice(0, TOPES.asunto);
  const mensaje = (body.mensaje ?? '').trim().slice(0, TOPES.mensaje);

  // Lo que la persona escribió, ya limpio: viaja de vuelta para volver a
  // pintar el formulario sin que se pierda nada.
  const valores: Mensaje = { nombre, email, telefono, templo, asunto, mensaje };

  if (!nombre || !isEmail(email) || !asunto || mensaje.length < 10) {
    return { ok: false, reason: 'invalid', status: 400, valores };
  }

  // ── Freno por IP ──────────────────────────────────────────────────────────
  // Si la base no responde, el mensaje se manda igual. Es deliberado: quien
  // escribe a su iglesia no puede quedarse sin poder hacerlo porque falle una
  // consulta que solo existe para contar. Esto protege la cuota de correo, no
  // un dato.
  try {
    const previos = await registrarIntento(
      await baseDeDatos(),
      ipDe(request),
      VENTANA_MIN,
      'contacto',
      LIMITE,
    );
    if (previos >= LIMITE) {
      return { ok: false, reason: 'demasiados_intentos', status: 429, valores };
    }
  } catch (e) {
    console.error(`[contacto] freno: ${(e as Error).message}`);
  }

  const transporte = crearTransporte();
  if (!transporte) {
    // Sin proveedor de correo no se finge un envío exitoso: se le dice a la
    // persona que escriba directamente.
    return { ok: false, reason: 'no_email_provider', status: 200, valores };
  }

  const remitente = resolverRemitente();
  if (!remitente.ok) return { ok: false, reason: 'from_invalido', status: 500, valores };
  // El aviso sale con el nombre de quien escribió, no con el de la iglesia.
  //
  // Sin esto, el correo salía de `contacto@` y llegaba a `contacto@` —la misma
  // dirección en los dos extremos—, y Gmail lo rotulaba «yo»: en la bandeja no
  // se distinguía un mensaje de otro. La dirección la sigue poniendo
  // CONTACT_FROM; acá solo cambia el nombre visible, y `conNombre` se encarga
  // de que un nombre malicioso no pueda colar otra dirección.
  const from = conNombre(remitente.from, `${nombre} (formulario web)`);
  // El asunto sube a título del correo, así que aquí no se repite.
  const filas: [string, string][] = [
    ['Nombre', nombre],
    ['Correo', email],
    ['Teléfono', telefono || '—'],
    ['Templo', templo || 'Consulta general'],
  ];

  const { html, texto } = construirCorreo({
    base: process.env.SITE_URL || new URL(request.url).origin,
    preencabezado: `${nombre} escribió desde el formulario: ${asunto}`,
    eyebrow: 'Formulario de contacto',
    titulo: asunto,
    bloques: [
      { tipo: 'ficha', filas },
      { tipo: 'cita', texto: mensaje },
    ],
    pie: { texto: `Responde a este correo para contestarle directamente a ${nombre}.` },
  });

  try {
    await transporte.sendMail({
      from,
      to: CONTACT.email,
      replyTo: email,
      // Lo primero que se lee en la bandeja es a qué templo va: «Contacto Coya»,
      // «Contacto San Miguel», «Contacto general». Así quien reparte los
      // correos sabe a quién reenviarlo sin abrirlo.
      subject: `Contacto ${templo || 'general'} · ${asunto} · ${nombre}`,
      text: texto,
      html,
    });

    return { ok: true, valores };
  } catch {
    // nodemailer lanza: aquí caen tanto el rechazo del servidor como que no
    // se pueda ni conectar. La persona ve el mismo mensaje en los dos casos.
    return { ok: false, reason: 'send_error', status: 502, valores };
  } finally {
    transporte.close();
  }
}
