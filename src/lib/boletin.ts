/**
 * El boletín, sobre D1.
 *
 * ── POR QUÉ ES UN MÓDULO APARTE ─────────────────────────────────────────────
 * Por la misma razón que `datos.ts` y `panel.ts` están separados: el límite
 * entre módulos es lo que sustituye a las políticas RLS que había en Supabase.
 * Acá vive TODO lo que toca direcciones de correo de personas, y nada más. Si
 * un día hay que auditar quién puede leer la lista, se audita un archivo.
 *
 * ── LA REGLA QUE NO SE ROMPE ────────────────────────────────────────────────
 * A quien no ha confirmado NO se le escribe. `pendiente = 1` significa que
 * alguien escribió esa dirección en un formulario; solo cuando esa persona
 * pulsa el enlace de su propia bandeja pasa a `0`. Escribir a los pendientes
 * sería escribir a direcciones que nadie verificó, que es exactamente lo que
 * dispara las quejas de spam y hunde la reputación del dominio.
 *
 * Por eso `confirmados()` filtra siempre, igual que `datos.ts` filtra siempre
 * por `publicado = 1`.
 *
 * ── EL TOKEN ES LA CREDENCIAL ───────────────────────────────────────────────
 * Confirmar y darse de baja no tienen sesión: el token del enlace es lo único
 * que se presenta. Por eso cada operación busca POR TOKEN y actúa sobre esa
 * fila y ninguna otra — nunca se busca por correo, que es adivinable.
 */
import type { Base } from './datos';
import { ahora } from './datos';

export interface Suscriptor {
  id: string;
  correo: string;
  token: string;
  pendiente: number;
  confirmado_en: string | null;
  bienvenido_en: string | null;
  creado_en: string;
}

/**
 * Freno por IP: cuántos intentos de esta `accion` se han hecho desde esta
 * dirección en la ventana. Devuelve los PREVIOS y apunta el actual.
 *
 * `accion` separa las cuentas: las altas al boletín y los envíos del
 * formulario de contacto usan el mismo mecanismo y la misma tabla, pero quien
 * escribe un mensaje no debe gastar el cupo de quien se suscribe.
 *
 * ── POR QUÉ EN LA BASE Y NO EN MEMORIA ──────────────────────────────────────
 * Cada isolate de Workers tiene su propia memoria y se recicla sin avisar: un
 * contador en una variable se reinicia solo, y bastaría con reintentar hasta
 * caer en un isolate nuevo para saltárselo.
 *
 * ── LO QUE ESTO NO ES ───────────────────────────────────────────────────────
 * No es atómico. En Supabase era una función `security definer` que contaba e
 * insertaba en una sola sentencia; acá son dos viajes, y dos peticiones
 * simultáneas pueden leer la misma cuenta y colarse las dos. Se acepta a
 * propósito: esto frena el goteo de un script, no a un atacante decidido, y la
 * defensa de verdad es que sin confirmar desde la bandeja no se recibe nada.
 * Prometer atomicidad aquí sería mentir sobre lo que protege.
 *
 * De paso borra lo viejo, para que la tabla no crezca sin fin.
 */
export async function registrarIntento(
  base: Base,
  ip: string,
  ventanaMin: number,
  accion = 'alta',
): Promise<number> {
  const desde = new Date(Date.now() - ventanaMin * 60_000).toISOString().slice(0, 19) + 'Z';

  const fila = await base
    .prepare(
      'select count(*) as n from intentos_alta where accion = ? and ip = ? and intentado_en >= ?',
    )
    .bind(accion, ip, desde)
    .first<{ n: number }>();

  // El borrado de lo viejo no filtra por acción a propósito: la tabla se limpia
  // entera, la pidan desde donde la pidan.
  await base.prepare('delete from intentos_alta where intentado_en < ?').bind(desde).first();
  await base
    .prepare('insert into intentos_alta (ip, intentado_en, accion) values (?, ?, ?)')
    .bind(ip, ahora(), accion)
    .first();

  return fila?.n ?? 0;
}

export type Alta = { estado: 'nuevo'; token: string } | { estado: 'ya_estaba' };

/**
 * Da de alta una dirección, pendiente de confirmar.
 *
 * `on conflict do nothing ... returning` resuelve en una sola sentencia lo que
 * antes era capturar el código de error 23505 de Postgres: si no vuelve fila,
 * la dirección ya estaba. Sin carrera posible y sin leer antes de escribir.
 *
 * Hacia fuera, quien llama debe responder lo MISMO en los dos casos: si un alta
 * nueva y una repetida se distinguieran, cualquiera podría comprobar desde el
 * formulario si una dirección está en la lista.
 */
export async function altaSuscriptor(base: Base, correo: string): Promise<Alta> {
  const token = crypto.randomUUID();
  const fila = await base
    .prepare(
      `insert into suscriptores (id, correo, token, pendiente, creado_en)
       values (?, ?, ?, 1, ?)
       on conflict(correo) do nothing
       returning token`,
    )
    .bind(crypto.randomUUID(), correo, token, ahora())
    .first<{ token: string }>();

  return fila ? { estado: 'nuevo', token: fila.token } : { estado: 'ya_estaba' };
}

/**
 * Confirma una suscripción a partir del token del correo.
 *
 * La condición `pendiente = 1` hace que confirmar dos veces no toque la fecha:
 * quien reenvía el enlace a un amigo, o pulsa dos veces, no reescribe nada.
 * Devuelve `true` solo si esta llamada fue la que confirmó.
 */
export async function confirmarSuscriptor(base: Base, token: string): Promise<boolean> {
  const fila = await base
    .prepare(
      `update suscriptores set pendiente = 0, confirmado_en = ?
        where token = ? and pendiente = 1
        returning id`,
    )
    .bind(ahora(), token)
    .first<{ id: string }>();
  return fila !== null;
}

/**
 * Baja definitiva. Se BORRA la fila, no se marca.
 *
 * Guardar a quien se fue sería guardar un dato personal de alguien que acaba de
 * pedir que dejes de tenerlo. Y como el correo es único, si vuelve a
 * suscribirse el alta funciona sin tropezar con una fila fantasma.
 */
export async function bajaSuscriptor(base: Base, token: string): Promise<boolean> {
  const fila = await base
    .prepare('delete from suscriptores where token = ? returning id')
    .bind(token)
    .first<{ id: string }>();
  return fila !== null;
}

/** Quien ya confirmó. Es la ÚNICA lista a la que se le escribe. */
export async function confirmados(base: Base): Promise<{ correo: string; token: string }[]> {
  const { results } = await base
    .prepare('select correo, token from suscriptores where pendiente = 0 order by creado_en')
    .bind()
    .all<{ correo: string; token: string }>();
  return results;
}

/** Una suscripción por su token, para decidir si toca mandar la bienvenida. */
export function porToken(base: Base, token: string): Promise<Suscriptor | null> {
  return base
    .prepare(
      'select id, correo, token, pendiente, confirmado_en, bienvenido_en, creado_en from suscriptores where token = ?',
    )
    .bind(token)
    .first<Suscriptor>();
}

/**
 * Marca que la bienvenida ya salió.
 *
 * Es lo que impide mandarla dos veces por recargar la página de confirmación.
 * Se llama DESPUÉS de enviar y no antes: si el envío falla, la marca no se pone
 * y el siguiente intento puede reintentarlo.
 */
export async function marcarBienvenido(base: Base, token: string): Promise<void> {
  await base
    .prepare('update suscriptores set bienvenido_en = ? where token = ?')
    .bind(ahora(), token)
    .first();
}

/**
 * La lista completa para el panel, con los pendientes incluidos.
 *
 * Acá SÍ aparecen los pendientes, a propósito: quien administra necesita ver
 * que alguien se apuntó y no ha confirmado —es la explicación de la mitad de
 * los «me suscribí y no me llega nada»—. Lo que no puede pasar es que esa
 * lista se use para enviar, y por eso `confirmados()` es una función distinta
 * y no un parámetro de esta.
 */
export async function listarSuscriptores(base: Base): Promise<Suscriptor[]> {
  const { results } = await base
    .prepare(
      'select id, correo, token, pendiente, confirmado_en, bienvenido_en, creado_en from suscriptores order by creado_en desc',
    )
    .bind()
    .all<Suscriptor>();
  return results;
}

/**
 * Marca una transmisión como ya avisada, para no escribir dos veces por lo
 * mismo. Cuando empiece la siguiente el enlace cambiará, dejará de coincidir, y
 * el aviso vuelve a salir solo: no hay nada que acordarse de reiniciar.
 */
export async function marcarVivoAvisado(base: Base, url: string): Promise<void> {
  await base.prepare('update ajustes set vivo_url_avisada = ? where id = 1').bind(url).first();
}
