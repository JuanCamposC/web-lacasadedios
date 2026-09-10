import type { Base } from './datos';

/**
 * Acceso a las bindings de Cloudflare (D1, R2) desde el código del sitio.
 *
 * ── POR QUÉ NO `Astro.locals.runtime.env` ───────────────────────────────────
 * Porque ya no existe. Astro v6 lo quitó y lo dejó como un accesor que lanza:
 *
 *   «Astro.locals.runtime.env has been removed in Astro v6.
 *    Use 'import { env } from "cloudflare:workers"' instead.»
 *
 * La trampa es que `Object.keys(locals.runtime)` SÍ devuelve `env`, así que
 * mirar las claves hace creer que está. Solo al leerla se descubre. Queda
 * anotado porque es justo el tipo de cosa que se comprueba mal.
 *
 * ── POR QUÉ EL IMPORT ES DINÁMICO ───────────────────────────────────────────
 * `cloudflare:workers` solo existe dentro del runtime de Cloudflare, y las
 * páginas estáticas se prerenderizan en Node (ver `prerenderEnvironment` en
 * astro.config.mjs). Con un import normal arriba del archivo, cualquier página
 * prerenderizada que importara este módulo rompería la compilación aunque
 * nunca llegara a consultar nada. Dentro de la función, solo se resuelve
 * cuando de verdad se pide, que es siempre en una ruta dinámica.
 */

interface Bindings {
  DB?: Base;
  MEDIOS?: R2Bucket;
}

/** Mínimo de R2 que el sitio usa. Evita arrastrar los tipos globales de Workers,
 *  que pisan los del DOM y rompen todo el código de navegador. */
export interface R2Bucket {
  get(clave: string): Promise<unknown | null>;
  put(clave: string, valor: ArrayBuffer | ReadableStream, opciones?: unknown): Promise<unknown>;
  delete(clave: string): Promise<void>;
  list(opciones?: unknown): Promise<unknown>;
}

async function bindings(): Promise<Bindings> {
  const modulo = (await import('cloudflare:workers')) as { env?: Bindings };
  return modulo.env ?? {};
}

/**
 * La base de datos, o un error claro.
 *
 * Se prefiere lanzar antes que devolver `undefined` y que la página muestre un
 * listado vacío: una sección vacía parece contenido que falta y nadie la
 * investiga; un error se ve y se arregla.
 */
export async function baseDeDatos(): Promise<Base> {
  const { DB } = await bindings();
  if (!DB) throw new Error('Falta la binding D1 «DB». Revisa d1_databases en wrangler.jsonc.');
  return DB;
}

/** El bucket de archivos, o un error claro. */
export async function almacen(): Promise<R2Bucket> {
  const { MEDIOS } = await bindings();
  if (!MEDIOS) throw new Error('Falta la binding R2 «MEDIOS». Revisa r2_buckets en wrangler.jsonc.');
  return MEDIOS;
}
