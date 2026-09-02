import { templos } from './templos';

/**
 * Etiqueta de templo para noticias, eventos y videos.
 *
 * POR QUÉ ESTÁ AQUÍ Y NO EN LA BASE
 * La lista se deriva de `templos`, así que abrir una sede nueva la añade sola
 * al desplegable del panel y a los filtros del sitio, sin migración y sin dos
 * listas que se desincronicen. La columna en Supabase guarda el `slug` como
 * texto libre a propósito, por lo mismo.
 */

/** Comodín: contenido que vale para todos los templos. */
export const ETIQUETA_GENERAL = 'general';

export interface Etiqueta {
  value: string;
  label: string;
}

export const etiquetas: Etiqueta[] = [
  { value: ETIQUETA_GENERAL, label: 'General' },
  ...templos.map((t) => ({ value: t.slug, label: t.short })),
];

/** Nombre visible de una etiqueta guardada. Cae en «General» si no la conoce. */
export function nombreEtiqueta(valor: string | null | undefined): string {
  return etiquetas.find((e) => e.value === valor)?.label ?? 'General';
}

/**
 * ¿Vale este contenido para el templo elegido?
 *
 * Lo etiquetado como «General» aparece SIEMPRE, también al filtrar por una
 * sede: es contenido que la iglesia publicó para todos, y esconderlo al elegir
 * Limache daría la impresión de que en Limache no pasa nada.
 */
export function coincide(etiqueta: string | null | undefined, filtro: string): boolean {
  if (filtro === 'all') return true;
  const e = etiqueta ?? ETIQUETA_GENERAL;
  return e === filtro || e === ETIQUETA_GENERAL;
}
