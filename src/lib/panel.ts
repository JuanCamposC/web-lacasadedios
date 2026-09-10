import type { Base } from './datos';

/**
 * Lecturas y escrituras del panel.
 *
 * ── POR QUÉ ESTÁ SEPARADO DE datos.ts ───────────────────────────────────────
 * Porque aquí NO se filtra por `publicado`. El panel tiene que ver los
 * borradores; eso es lo que hace. Si estas consultas vivieran junto a las
 * públicas, tarde o temprano alguien importaría la de al lado por descuido y
 * los borradores saldrían al sitio.
 *
 * Con dos módulos, el import lo dice en voz alta: `from './datos'` es lo que ve
 * el visitante, `from './panel'` es lo que ve quien administra. Nada de este
 * archivo debe importarse desde una página pública.
 *
 * ── LO QUE REEMPLAZA A RLS ──────────────────────────────────────────────────
 * En Supabase, el navegador escribía directo en la base y Postgres decidía qué
 * podía tocar. En D1 no hay nada de eso: el navegador no puede hablar con la
 * base, así que toda escritura pasa por el Worker, y el Worker solo acepta
 * **columnas de una lista blanca**. Un campo que no esté en `COLUMNAS` se
 * descarta en silencio, venga de donde venga.
 *
 * Eso importa más de lo que parece: sin lista blanca, un formulario manipulado
 * podría mandar `{"publicado": 1}` a una tabla donde no toca, o peor, nombres
 * de columna inventados que se concatenarían al SQL.
 */

/** Las tablas que el panel puede tocar, y qué columnas de cada una. */
const COLUMNAS = {
  eventos: [
    'titulo',
    'slug',
    'fecha',
    'lugar',
    'descripcion',
    'imagen_clave',
    'templo',
    'publicado',
  ],
  noticias: [
    'titulo',
    'slug',
    'bajada',
    'cuerpo',
    'imagen_clave',
    'templo',
    'publicado',
    'publicado_en',
  ],
  videos: ['titulo', 'youtube_url', 'descripcion', 'templo', 'publicado', 'orden'],
  estudios: [
    'titulo',
    'slug',
    'descripcion',
    'predicador',
    'serie',
    'fecha',
    'archivo_clave',
    'tipo_mime',
    'duracion_seg',
    'bytes',
    'templo',
    'publicado',
  ],
} as const;

export type Recurso = keyof typeof COLUMNAS;

/** Cómo se ordena cada tabla en el listado del panel. */
const ORDEN: Record<Recurso, string> = {
  eventos: 'fecha desc',
  noticias: 'publicado_en desc',
  videos: 'orden asc, creado_en desc',
  estudios: 'fecha desc',
};

/** ¿Es un nombre de recurso válido? Se comprueba antes de tocar nada. */
export function esRecurso(valor: unknown): valor is Recurso {
  return typeof valor === 'string' && Object.hasOwn(COLUMNAS, valor);
}

/** Momento actual en el formato de la base. */
function ahora(): string {
  return new Date().toISOString().slice(0, 19) + 'Z';
}

/**
 * Deja pasar solo las columnas permitidas y normaliza los valores.
 *
 * Las conversiones no son adorno: el formulario manda cadenas y casillas de
 * verificación, y SQLite no tiene booleanos. Una cadena vacía se guarda como
 * `null` y no como `''`, porque `''` haría que un `slug` vacío chocara con
 * otro `slug` vacío en el índice único.
 */
function limpiar(recurso: Recurso, datos: Record<string, unknown>) {
  const permitidas = COLUMNAS[recurso] as readonly string[];
  const campos: string[] = [];
  const valores: unknown[] = [];

  for (const columna of permitidas) {
    if (!Object.hasOwn(datos, columna)) continue;
    const bruto = datos[columna];
    let valor: unknown;

    if (columna === 'publicado') {
      valor = bruto === true || bruto === 1 || bruto === '1' || bruto === 'on' ? 1 : 0;
    } else if (columna === 'orden' || columna === 'duracion_seg' || columna === 'bytes') {
      const n = Number(bruto);
      valor = Number.isFinite(n) ? Math.trunc(n) : null;
    } else if (typeof bruto === 'string') {
      const recortado = bruto.trim();
      valor = recortado === '' ? null : recortado;
    } else {
      valor = bruto ?? null;
    }

    campos.push(columna);
    valores.push(valor);
  }

  return { campos, valores };
}

/** Todo lo que hay en una tabla, borradores incluidos. Solo para el panel. */
export async function listarTodo<T>(base: Base, recurso: Recurso): Promise<T[]> {
  const { results } = await base
    .prepare(`select * from ${recurso} order by ${ORDEN[recurso]}`)
    .bind()
    .all<T>();
  return results ?? [];
}

export function unaFila<T>(base: Base, recurso: Recurso, id: string): Promise<T | null> {
  return base.prepare(`select * from ${recurso} where id = ?`).bind(id).first<T>();
}

/**
 * Crea una fila y devuelve su id.
 *
 * El id lo genera el Worker y no la base: así se conoce antes de insertar, y
 * se puede devolver al navegador sin una segunda consulta.
 */
export async function crear(
  base: Base,
  recurso: Recurso,
  datos: Record<string, unknown>,
): Promise<string> {
  const { campos, valores } = limpiar(recurso, datos);
  const id = crypto.randomUUID();

  const columnas = ['id', ...campos];
  const marcas = columnas.map(() => '?');

  await base
    .prepare(`insert into ${recurso} (${columnas.join(', ')}) values (${marcas.join(', ')})`)
    .bind(id, ...valores)
    .first();

  return id;
}

/**
 * Actualiza una fila. Devuelve `false` si no había nada que actualizar.
 *
 * `actualizado_en` se pone acá y no con un disparador de la base: SQLite los
 * admite, pero un disparador es lógica escondida en un sitio donde nadie la
 * busca cuando algo no cuadra.
 */
export async function actualizar(
  base: Base,
  recurso: Recurso,
  id: string,
  datos: Record<string, unknown>,
): Promise<boolean> {
  const { campos, valores } = limpiar(recurso, datos);
  if (campos.length === 0) return false;

  const asignaciones = campos.map((c) => `${c} = ?`);
  // `videos` no tiene columna de modificación; las otras tres sí.
  if (recurso !== 'videos') asignaciones.push('actualizado_en = ?');
  const extra = recurso !== 'videos' ? [ahora()] : [];

  await base
    .prepare(`update ${recurso} set ${asignaciones.join(', ')} where id = ?`)
    .bind(...valores, ...extra, id)
    .first();

  return true;
}

export async function borrar(base: Base, recurso: Recurso, id: string): Promise<void> {
  await base.prepare(`delete from ${recurso} where id = ?`).bind(id).first();
}

/**
 * Reordena los videos según el orden en que llegan los identificadores.
 *
 * Va de uno en uno en vez de con un `case when` gigante: son unas pocas filas,
 * se hace al soltar el ratón, y el SQL se lee.
 */
export async function reordenar(base: Base, ids: string[]): Promise<void> {
  for (const [i, id] of ids.entries()) {
    await base.prepare('update videos set orden = ? where id = ?').bind(i, id).first();
  }
}

// ── Ajustes ─────────────────────────────────────────────────────────────────

/** Las columnas de `ajustes` que el panel puede cambiar. */
const AJUSTES = [
  'vivo_activo',
  'vivo_url',
  'vivo_titulo',
  'vivo_url_avisada',
  'aviso_activo',
  'aviso_titulo',
  'aviso_cuerpo',
  'aviso_boton',
  'aviso_boton_url',
  'aviso_imagen_clave',
  'aviso_desde',
  'aviso_hasta',
  'aviso_version',
  'aviso_diseno',
  'aviso_boton_pos',
  'compartir_whatsapp',
] as const;

const BANDERAS = new Set(['vivo_activo', 'aviso_activo']);

export async function guardarAjustes(base: Base, datos: Record<string, unknown>): Promise<boolean> {
  const campos: string[] = [];
  const valores: unknown[] = [];

  for (const columna of AJUSTES) {
    if (!Object.hasOwn(datos, columna)) continue;
    const bruto = datos[columna];

    if (BANDERAS.has(columna)) {
      valores.push(bruto === true || bruto === 1 || bruto === '1' || bruto === 'on' ? 1 : 0);
    } else if (columna === 'aviso_version') {
      const n = Number(bruto);
      valores.push(Number.isFinite(n) ? Math.trunc(n) : 1);
    } else if (typeof bruto === 'string') {
      const recortado = bruto.trim();
      valores.push(recortado === '' ? null : recortado);
    } else {
      valores.push(bruto ?? null);
    }
    campos.push(columna);
  }

  if (campos.length === 0) return false;

  await base
    .prepare(
      `update ajustes set ${campos.map((c) => `${c} = ?`).join(', ')}, actualizado_en = ?
        where id = 1`,
    )
    .bind(...valores, ahora())
    .first();

  return true;
}
