import type { Base } from './datos';
import { almacen } from './base';

/**
 * Borrar del bucket los archivos que ya no usa nadie.
 *
 * ── EL PROBLEMA QUE RESUELVE ────────────────────────────────────────────────
 * Subir una imagen y borrar la fila que la usaba eran dos cosas sin relación:
 * la fila desaparecía de la base y el archivo se quedaba en R2 para siempre.
 * Nadie lo veía —no hay pantalla que liste el bucket entero— y no había forma
 * de saber cuáles sobraban, así que el bucket solo podía crecer. Con diez años
 * de noticias por delante, eso es una factura que llega sola.
 *
 * ── POR QUÉ NO SE BORRA A LA PRIMERA ────────────────────────────────────────
 * Porque una misma clave puede estar en más de una fila. El panel del aviso
 * emergente (src/pages/admin/aviso.astro) enseña una galería con lo ya subido
 * para poder REUTILIZAR la foto de un evento sin volver a subirla. Si al borrar
 * el evento se borrara su archivo, el aviso que lo estaba usando se quedaría
 * con un hueco, y el motivo sería imposible de adivinar desde el panel.
 *
 * Así que antes de borrar se pregunta a la base si alguien más la nombra. Es
 * una consulta por archivo y solo ocurre al borrar o reemplazar desde el panel;
 * el coste no se nota y la alternativa es romper algo en silencio.
 *
 * ── POR QUÉ NUNCA LANZA ─────────────────────────────────────────────────────
 * Quien borra una noticia quiere que la noticia desaparezca. Si R2 falla, el
 * fallo NO puede convertirse en «no se pudo borrar»: la fila ya no está y el
 * panel diría una mentira. El archivo suelto queda anotado en los registros y
 * se puede limpiar después; lo otro no se arregla.
 */

/**
 * Todas las columnas del sitio que guardan una clave de R2.
 *
 * Es la lista de sitios donde hay que mirar antes de borrar un archivo. Si
 * mañana una tabla nueva guarda archivos, tiene que aparecer acá o su imagen
 * se podrá borrar por debajo.
 */
const DONDE_SE_NOMBRAN: readonly { tabla: string; columna: string }[] = [
  { tabla: 'eventos', columna: 'imagen_clave' },
  { tabla: 'noticias', columna: 'imagen_clave' },
  { tabla: 'instagram', columna: 'imagen_clave' },
  { tabla: 'estudios', columna: 'archivo_clave' },
  { tabla: 'ajustes', columna: 'aviso_imagen_clave' },
];

/** ¿Queda alguna fila, en cualquier tabla, que siga apuntando a este archivo? */
export async function sigueEnUso(base: Base, clave: string): Promise<boolean> {
  const partes = DONDE_SE_NOMBRAN.map(
    ({ tabla, columna }) => `select 1 from ${tabla} where ${columna} = ?`,
  );
  const fila = await base
    .prepare(`${partes.join(' union all ')} limit 1`)
    .bind(...DONDE_SE_NOMBRAN.map(() => clave))
    .first();
  return fila !== null;
}

/**
 * Borra del bucket las claves que ya no nombra ninguna fila.
 *
 * Devuelve las que borró, para poder dejarlo dicho en los registros y para que
 * las pruebas puedan comprobarlo sin hablar con R2.
 */
export async function olvidarArchivos(
  base: Base,
  claves: readonly (string | null | undefined)[],
): Promise<string[]> {
  const candidatas = [
    ...new Set(claves.filter((c): c is string => typeof c === 'string' && c !== '')),
  ];
  if (candidatas.length === 0) return [];

  const borradas: string[] = [];
  try {
    const bucket = await almacen();
    for (const clave of candidatas) {
      if (await sigueEnUso(base, clave)) continue;
      await bucket.delete(clave);
      borradas.push(clave);
    }
  } catch (e) {
    // Ver el comentario de arriba: esto no puede tumbar el borrado de la fila.
    console.error(`[archivos] no se pudo limpiar el bucket: ${(e as Error).message}`);
  }

  if (borradas.length > 0) console.log(`[archivos] borradas de R2: ${borradas.join(', ')}`);
  return borradas;
}
