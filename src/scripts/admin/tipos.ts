import type { SupabaseClient } from '@supabase/supabase-js';

export type Field = {
  name: string;
  label: string;
  type:
    | 'text'
    | 'url'
    | 'textarea'
    /** textarea con barra de formato y vista previa */
    | 'markdown'
    | 'datetime-local'
    | 'number'
    | 'checkbox'
    | 'image';
  required?: boolean;
  help?: string;
};

export type CrudConfig = {
  table: string;
  singular: string;
  /** plural en minúscula, para los textos de la interfaz */
  plural?: string;
  fields: Field[];
  orderBy: { column: string; ascending: boolean };
  titleField: string;
  subtitleField?: string;
  /**
   * Si se define, la lista se puede reordenar arrastrando y el nuevo orden se
   * guarda en esa columna. Sustituye al campo numérico «orden», que obligaba a
   * imaginarse los números en vez de ver el resultado.
   */
  orderable?: { column: string };
  /**
   * Si se define, ofrece avisar a los suscriptores cuando el contenido pasa a
   * publicado — tanto al crearlo como al encenderlo desde la lista.
   * `porItem` añade el identificador a la URL, para enlazar a la ficha en vez
   * de al listado (solo noticias tiene ficha propia).
   */
  notify?: { type: string; urlBase: string; porItem?: boolean };
};

export type Estado = 'todos' | 'publicados' | 'borradores';

export type Fila = Record<string, any>;

/**
 * Estado compartido entre los módulos del panel.
 *
 * Antes todo esto vivía en el cierre de una función de 880 líneas, y cada
 * pedazo veía las variables de los demás sin decirlo. Al separarlo en módulos
 * había que elegir entre pasar diez parámetros por función o pasar un contexto:
 * esto último deja explícito qué comparte cada parte y permite que TypeScript
 * compruebe el cableado.
 *
 * Las funciones cruzadas (`pintar`, `load`, `remove`…) se rellenan en el
 * orquestador una vez construidas todas las piezas: la lista necesita llamar al
 * formulario y el formulario a la lista, así que alguien tiene que cerrar el
 * círculo.
 */
export interface Contexto {
  config: CrudConfig;
  supabase: SupabaseClient;
  root: HTMLElement;

  /** Textos derivados del singular, con concordancia de género. */
  plural: string;
  articulo: string;
  creado: string;

  /** Campos detectados una sola vez a partir de la configuración. */
  campoImagen?: string;
  campoYoutube?: string;
  campoFecha?: string;

  form: HTMLFormElement;
  formCard: HTMLElement;
  listEl: HTMLElement;
  conteoEl: HTMLElement;
  buscarEl: HTMLInputElement;
  saveBtn: HTMLButtonElement;
  cancelBtn: HTMLButtonElement;
  formTitle: HTMLElement;
  dlgBorrar: HTMLDialogElement;
  dlgAvisar: HTMLDialogElement;
  avisoOrden: HTMLElement | null;

  filas: Fila[];
  editing: Fila | null;
  estado: Estado;
  /** Archivos ya reducidos, listos para subir, por nombre de campo. */
  imagenesListas: Map<string, Blob>;

  pintar: () => void;
  load: () => Promise<void>;
  resetForm: () => void;
  startEdit: (row: Fila) => void;
  remove: (id: string) => Promise<void>;
  togglePublicado: (id: string) => Promise<void>;
}
