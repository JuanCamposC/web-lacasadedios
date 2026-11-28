/**
 * Tema claro / oscuro / automático: un solo sitio donde vive la lógica.
 *
 * Estaba escrita dos veces —en el script inline de Layout.astro y otra vez en
 * Navigation.astro— con la misma normalización de valores copiada a mano en
 * ambos. Cambiar el nombre de un tema obligaba a acordarse de los dos.
 *
 * ── POR QUÉ HAY UN TERCER ESTADO ────────────────────────────────────────────
 * El interruptor era una casilla de dos posiciones, y eso dejaba un camino sin
 * vuelta: una vez tocado, no había forma de volver a «lo que diga el sistema».
 * Quien tiene el teléfono en oscuro de noche y en claro de día elegía una y se
 * quedaba con ella.
 *
 * Y había algo más gordo detrás. El tema oscuro está registrado en DaisyUI con
 * `--prefersdark`, que compila a esto:
 *
 *     @media (prefers-color-scheme: dark) { :root:not([data-theme]) { … } }
 *
 * O sea: solo se aplica cuando el atributo NO está. Y el atributo estaba
 * siempre —escrito en el <html> y reescrito por el script—, así que esa regla
 * no llegaba a usarse nunca. El sitio no seguía la preferencia del sistema de
 * nadie, aunque estuviera preparado para hacerlo.
 *
 * `auto` es, literalmente, quitar el atributo.
 *
 * ── QUÉ SIGUE IGUAL ─────────────────────────────────────────────────────────
 * Quien no ha elegido nada sigue viendo el tema CLARO, como hasta ahora. Hacer
 * que `auto` fuera lo de fábrica cambiaría el sitio de golpe a todo el que
 * tenga el sistema en oscuro, y esa es una decisión de la iglesia, no un
 * efecto secundario de arreglar el interruptor. Es una línea: cambiar
 * `TEMA_POR_DEFECTO`.
 */

export type Tema = 'church' | 'churchdark' | 'auto';

export const TEMA_POR_DEFECTO: Tema = 'church';
export const TEMA_OSCURO: Tema = 'churchdark';
export const TEMA_AUTO: Tema = 'auto';

/** El orden del botón: claro → oscuro → automático → claro. */
export const CICLO: Tema[] = [TEMA_POR_DEFECTO, TEMA_OSCURO, TEMA_AUTO];

/** Cómo se llama cada estado para quien usa el botón. */
export const NOMBRE_TEMA: Record<Tema, string> = {
  church: 'claro',
  churchdark: 'oscuro',
  auto: 'automático',
};

/**
 * Normaliza lo que haya guardado. `dark` es el nombre viejo: se traduce en vez
 * de descartarse para no cambiarle el tema a quien ya lo tenía elegido.
 */
export function normalizarTema(valor: string | null): Tema {
  if (valor === TEMA_AUTO) return TEMA_AUTO;
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

/** El siguiente del ciclo. */
export function siguienteTema(actual: Tema): Tema {
  const i = CICLO.indexOf(actual);
  return CICLO[(i + 1) % CICLO.length];
}

/**
 * Aplica el tema al documento.
 *
 * En `auto` se QUITA el atributo, que es lo único que deja actuar a la regla de
 * `prefers-color-scheme` que DaisyUI ya emite. Poner `data-theme="auto"` no
 * serviría: sería un tema que no existe y la página se quedaría sin ninguno.
 */
export function aplicarTema(tema: Tema) {
  if (tema === TEMA_AUTO) document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', tema);
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
  `(function(){try{var t=localStorage.getItem('theme');var r=document.documentElement;` +
  `if(t==='${TEMA_AUTO}'){r.removeAttribute('data-theme');}` +
  `else{r.setAttribute('data-theme',(t==='dark'||t==='${TEMA_OSCURO}')?'${TEMA_OSCURO}':'${TEMA_POR_DEFECTO}');}` +
  `}catch(e){}})();`;
