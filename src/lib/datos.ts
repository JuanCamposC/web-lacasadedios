/**
 * Lecturas públicas contra D1.
 *
 * ── LA REGLA ────────────────────────────────────────────────────────────────
 * En Supabase, «solo se ve lo publicado» lo hacía cumplir Postgres con 25
 * políticas RLS. D1 no tiene RLS: si una consulta olvida `publicado = 1`, el
 * borrador se publica solo y nadie se entera.
 *
 * Por eso ninguna función de este archivo escribe ese filtro a mano. Todas
 * pasan por `publicados()`, que lo pone siempre. Para saltárselo habría que
 * escribir SQL fuera de acá, que es un acto deliberado y no un descuido.
 *
 * ── POR QUÉ TODO LLEVA TOPE ─────────────────────────────────────────────────
 * Los listados del sitio anterior no tenían límite: `/noticias` traía la tabla
 * entera y crecía para siempre. Con el ritmo de publicación medido, en dos años
 * esa sola página se habría comido la cuota de tráfico. Acá el tope es
 * obligatorio y tiene valor por omisión: pedir «todo» exige decirlo.
 *
 * ── LA BASE VA COMO PARÁMETRO ───────────────────────────────────────────────
 * Y no se importa desde `cloudflare:workers`. Dos razones: las páginas
 * prerenderizadas se compilan en Node, donde ese módulo no existe; y con la
 * base como argumento estas consultas se pueden probar con una falsa.
 */

/** Lo mínimo de D1 que este archivo usa. Permite probar con una base falsa. */
export interface Base {
  prepare(sql: string): {
    bind(...valores: unknown[]): {
      all<T>(): Promise<{ results: T[] }>;
      first<T>(): Promise<T | null>;
    };
  };
}

export interface Evento {
  id: string;
  titulo: string;
  slug: string | null;
  fecha: string;
  lugar: string | null;
  descripcion: string | null;
  imagen_clave: string | null;
  templo: string;
}

export interface Noticia {
  id: string;
  titulo: string;
  slug: string | null;
  bajada: string | null;
  cuerpo: string | null;
  imagen_clave: string | null;
  templo: string;
  publicado_en: string;
}

export interface Video {
  id: string;
  titulo: string;
  youtube_url: string;
  descripcion: string | null;
  templo: string;
  /** La usa el dato estructurado de YouTube como fecha de publicación. */
  creado_en: string;
}

export interface Estudio {
  id: string;
  titulo: string;
  slug: string | null;
  descripcion: string | null;
  predicador: string | null;
  serie: string | null;
  fecha: string;
  archivo_clave: string;
  tipo_mime: string;
  duracion_seg: number | null;
  bytes: number | null;
  templo: string;
}

export interface Ajustes {
  vivo_activo: number;
  vivo_url: string | null;
  vivo_titulo: string | null;
  vivo_url_avisada: string | null;
  aviso_activo: number;
  aviso_titulo: string | null;
  aviso_cuerpo: string | null;
  aviso_boton: string | null;
  aviso_boton_url: string | null;
  aviso_imagen_clave: string | null;
  aviso_desde: string | null;
  aviso_hasta: string | null;
  aviso_version: number;
  aviso_diseno: string;
  aviso_boton_pos: string;
  compartir_whatsapp: string | null;
}

/** Tope por omisión de cualquier listado. */
const TOPE = 24;
/** Tope máximo que se acepta, venga de donde venga. */
const TOPE_MAXIMO = 100;

export interface Filtro {
  /** Slug de templo. `undefined` trae todos; 'general' trae solo los generales. */
  templo?: string;
  limite?: number;
  desplazamiento?: number;
}

/**
 * Arma la parte común de toda lectura pública: el filtro de publicado, el de
 * templo si lo hay, y un tope siempre acotado.
 *
 * El tope se recorta aunque venga un número absurdo por la URL: sin esto,
 * `?limite=999999` sería una forma trivial de hacer que cada visita arrastre la
 * tabla entera.
 */
function publicados(filtro: Filtro = {}) {
  const condiciones = ['publicado = 1'];
  const valores: unknown[] = [];

  if (filtro.templo) {
    condiciones.push('templo = ?');
    valores.push(filtro.templo);
  }

  const limite = Math.min(Math.max(1, Math.trunc(filtro.limite ?? TOPE)), TOPE_MAXIMO);
  const desplazamiento = Math.max(0, Math.trunc(filtro.desplazamiento ?? 0));

  return { donde: condiciones.join(' and '), valores, limite, desplazamiento };
}

async function listar<T>(base: Base, sql: string, valores: unknown[]): Promise<T[]> {
  const { results } = await base
    .prepare(sql)
    .bind(...valores)
    .all<T>();
  return results ?? [];
}

// ── Eventos ─────────────────────────────────────────────────────────────────

/**
 * Eventos publicados que aún no han pasado, del más próximo al más lejano.
 *
 * `fecha >= ?` con la hora actual y no con el día: un evento de las 19:00 sigue
 * siendo próximo a las 18:00, y deja de serlo a las 20:00. Comparar por día lo
 * dejaría anunciado toda la jornada siguiente.
 */
export function eventosProximos(base: Base, filtro: Filtro = {}): Promise<Evento[]> {
  const { donde, valores, limite, desplazamiento } = publicados(filtro);
  return listar<Evento>(
    base,
    `select id, titulo, slug, fecha, lugar, descripcion, imagen_clave, templo
       from eventos
      where ${donde} and fecha >= ?
      order by fecha asc
      limit ? offset ?`,
    [...valores, ahora(), limite, desplazamiento],
  );
}

/**
 * Eventos que ya pasaron, del más reciente hacia atrás.
 *
 * Va aparte de `eventosProximos` en vez de traerlo todo y partirlo en
 * JavaScript, que es lo que hacía la página antes. Con dos consultas acotadas,
 * un archivo de diez años de eventos no llega a viajar por la red para que el
 * navegador se quede con seis.
 */
export function eventosPasados(base: Base, filtro: Filtro = {}): Promise<Evento[]> {
  const { donde, valores, limite, desplazamiento } = publicados(filtro);
  return listar<Evento>(
    base,
    `select id, titulo, slug, fecha, lugar, descripcion, imagen_clave, templo
       from eventos
      where ${donde} and fecha < ?
      order by fecha desc
      limit ? offset ?`,
    [...valores, ahora(), limite, desplazamiento],
  );
}

export function eventoPorSlug(base: Base, slug: string): Promise<Evento | null> {
  return base
    .prepare(
      `select id, titulo, slug, fecha, lugar, descripcion, imagen_clave, templo
         from eventos where publicado = 1 and slug = ?`,
    )
    .bind(slug)
    .first<Evento>();
}

/**
 * Un evento por su identificador. Lo usa el archivo de calendario.
 *
 * Lleva `publicado = 1` como todo lo demás: un borrador tiene que dar 404
 * igual que un identificador inventado, o el enlace del calendario sería una
 * forma de espiar lo que aún no se anuncia.
 */
export function eventoPorId(base: Base, id: string): Promise<Evento | null> {
  return base
    .prepare(
      `select id, titulo, slug, fecha, lugar, descripcion, imagen_clave, templo
         from eventos where publicado = 1 and id = ?`,
    )
    .bind(id)
    .first<Evento>();
}

// ── Noticias ────────────────────────────────────────────────────────────────

/**
 * Noticias publicadas, de la más reciente a la más antigua.
 *
 * `publicado_en <= ?` permite dejar una noticia lista con fecha futura: se
 * publica sola cuando llega el momento, sin que nadie tenga que entrar al panel
 * un domingo por la mañana.
 */
export function noticiasPublicadas(base: Base, filtro: Filtro = {}): Promise<Noticia[]> {
  const { donde, valores, limite, desplazamiento } = publicados(filtro);
  return listar<Noticia>(
    base,
    `select id, titulo, slug, bajada, cuerpo, imagen_clave, templo, publicado_en
       from noticias
      where ${donde} and publicado_en <= ?
      order by publicado_en desc
      limit ? offset ?`,
    [...valores, ahora(), limite, desplazamiento],
  );
}

export function noticiaPorSlug(base: Base, slug: string): Promise<Noticia | null> {
  return base
    .prepare(
      `select id, titulo, slug, bajada, cuerpo, imagen_clave, templo, publicado_en
         from noticias
        where publicado = 1 and publicado_en <= ? and slug = ?`,
    )
    .bind(ahora(), slug)
    .first<Noticia>();
}

/** Una noticia por su identificador, para las direcciones antiguas sin slug. */
export function noticiaPorId(base: Base, id: string): Promise<Noticia | null> {
  return base
    .prepare(
      `select id, titulo, slug, bajada, cuerpo, imagen_clave, templo, publicado_en
         from noticias
        where publicado = 1 and publicado_en <= ? and id = ?`,
    )
    .bind(ahora(), id)
    .first<Noticia>();
}

/** Cuántas noticias hay en total, para poder paginar sin adivinar. */
export async function contarNoticias(base: Base, filtro: Filtro = {}): Promise<number> {
  const { donde, valores } = publicados(filtro);
  const fila = await base
    .prepare(`select count(*) as total from noticias where ${donde} and publicado_en <= ?`)
    .bind(...valores, ahora())
    .first<{ total: number }>();
  return fila?.total ?? 0;
}

// ── Videos ──────────────────────────────────────────────────────────────────

export function videosPublicados(base: Base, filtro: Filtro = {}): Promise<Video[]> {
  const { donde, valores, limite, desplazamiento } = publicados(filtro);
  return listar<Video>(
    base,
    `select id, titulo, youtube_url, descripcion, templo, creado_en
       from videos
      where ${donde}
      order by orden asc, creado_en desc
      limit ? offset ?`,
    [...valores, limite, desplazamiento],
  );
}

// ── Estudios en audio ───────────────────────────────────────────────────────

export function estudiosPublicados(base: Base, filtro: Filtro = {}): Promise<Estudio[]> {
  const { donde, valores, limite, desplazamiento } = publicados(filtro);
  return listar<Estudio>(
    base,
    `select id, titulo, slug, descripcion, predicador, serie, fecha,
            archivo_clave, tipo_mime, duracion_seg, bytes, templo
       from estudios
      where ${donde} and fecha <= ?
      order by fecha desc
      limit ? offset ?`,
    [...valores, ahora(), limite, desplazamiento],
  );
}

export function estudioPorSlug(base: Base, slug: string): Promise<Estudio | null> {
  return base
    .prepare(
      `select id, titulo, slug, descripcion, predicador, serie, fecha,
              archivo_clave, tipo_mime, duracion_seg, bytes, templo
         from estudios where publicado = 1 and fecha <= ? and slug = ?`,
    )
    .bind(ahora(), slug)
    .first<Estudio>();
}

/**
 * Las series que existen, con cuántos estudios tiene cada una.
 *
 * Lleva el mismo `fecha <= ?` que `estudiosPublicados`, y no es un adorno: sin
 * él la serie anunciaba «Fundamentos (2)» contando un estudio programado para
 * más adelante, y al entrar aparecía uno solo. Cualquier consulta que CUENTE
 * tiene que filtrar exactamente igual que la que LISTA, o el número miente.
 */
export function seriesDeEstudios(base: Base): Promise<{ serie: string; total: number }[]> {
  return listar<{ serie: string; total: number }>(
    base,
    `select serie, count(*) as total
       from estudios
      where publicado = 1 and fecha <= ? and serie is not null and serie <> ''
      group by serie
      order by max(fecha) desc`,
    [ahora()],
  );
}

// ── Instagram ───────────────────────────────────────────────────────────────

export interface PostIg {
  id: string;
  imagen_clave: string;
  alt: string;
  enlace: string | null;
}

/**
 * Las fotos de Instagram de la portada, en su orden.
 *
 * El tope es del que llama y no de la tabla: la portada pide cuatro porque la
 * rejilla es de cuatro, y pedir «todas» para quedarse con cuatro sería traer de
 * la base lo que no se va a enseñar.
 */
export function instagramPublicado(base: Base, limite = 4): Promise<PostIg[]> {
  return listar<PostIg>(
    base,
    `select id, imagen_clave, alt, enlace
       from instagram
      where publicado = 1
      order by orden asc, creado_en desc
      limit ?`,
    [limite],
  );
}

// ── Ajustes ─────────────────────────────────────────────────────────────────

export function ajustes(base: Base): Promise<Ajustes | null> {
  return base
    .prepare(
      `select vivo_activo, vivo_url, vivo_titulo, vivo_url_avisada,
              aviso_activo, aviso_titulo, aviso_cuerpo, aviso_boton, aviso_boton_url,
              aviso_imagen_clave, aviso_desde, aviso_hasta, aviso_version,
              aviso_diseno, aviso_boton_pos, compartir_whatsapp
         from ajustes where id = 1`,
    )
    .bind()
    .first<Ajustes>();
}

/**
 * ¿Toca mostrar el aviso emergente ahora mismo?
 *
 * La ventana se comprueba acá y no en la consulta porque el aviso es una sola
 * fila que ya se leyó: volver a la base solo para comparar dos fechas sería un
 * viaje a Norteamérica de más.
 */
export function avisoVigente(a: Ajustes | null, ahoraIso: string = ahora()): boolean {
  if (!a || a.aviso_activo !== 1) return false;
  if (a.aviso_desde && ahoraIso < a.aviso_desde) return false;
  if (a.aviso_hasta && ahoraIso > a.aviso_hasta) return false;
  return true;
}

/** Momento actual en el mismo formato que guarda la base: ISO-8601 UTC. */
export function ahora(): string {
  return new Date().toISOString().slice(0, 19) + 'Z';
}
