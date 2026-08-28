/**
 * Tema claro/oscuro: un solo sitio donde vive la lógica.
 *
 * Estaba escrita dos veces —en el script inline de Layout.astro y otra vez en
 * Navigation.astro— con la misma normalización de valores copiada a mano en
 * ambos. Cambiar el nombre de un tema obligaba a acordarse de los dos.
 */

export type Tema = 'church' | 'churchdark';

export const TEMA_POR_DEFECTO: Tema = 'church';
export const TEMA_OSCURO: Tema = 'churchdark';

/**
 * Normaliza lo que haya guardado. `dark` es el nombre viejo: se traduce en vez
 * de descartarse para no cambiarle el tema a quien ya lo tenía elegido.
 */
export function normalizarTema(valor: string | null): Tema {
  if (valor === 'dark' || valor === TEMA_OSCURO) return TEMA_OSCURO;
  return TEMA_POR_DEFECTO;
}

/** Lee el tema guardado. Devuelve el claro si el almacenamiento no está. */
export function temaGuardado(): Tema {
  try {
    return normalizarTema(localStorage.getItem('theme'));
  } catch {
    return TEMA_POR_DEFECTO;
  }
}

export function aplicarTema(tema: Tema) {
  document.documentElement.setAttribute('data-theme', tema);
}

export function guardarTema(tema: Tema) {
  aplicarTema(tema);
  try {
    localStorage.setItem('theme', tema);
  } catch {
    /* modo privado o almacenamiento lleno: el tema vale para esta página */
  }
}

/**
 * La misma lógica, pero como cadena para el `<script is:inline>` del layout.
 *
 * Ese script NO puede importar nada: tiene que ejecutarse antes del primer
 * fotograma para que la página no parpadee en claro antes de saltar a oscuro, y
 * un módulo llegaría tarde. Así que se duplica el comportamiento —no el
 * mantenimiento—: sale de este archivo y su hash para la CSP se calcula sobre
 * esta misma constante.
 */
export const SCRIPT_TEMA_INLINE =
  `(function(){try{var t=localStorage.getItem('theme');` +
  `document.documentElement.setAttribute('data-theme',` +
  `(t==='dark'||t==='${TEMA_OSCURO}')?'${TEMA_OSCURO}':'${TEMA_POR_DEFECTO}');` +
  `}catch(e){}})();`;
