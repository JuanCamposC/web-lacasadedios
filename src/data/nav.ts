/**
 * Arquitectura de navegación del sitio público.
 * La usan `Navigation.astro` (cabecera) y `Footer.astro` (pie).
 */
import { templos } from './templos';

export interface NavLink {
  href: string;
  label: string;
  /** Descripción corta para los menús desplegables. */
  desc?: string;
  icon?: string;
  /**
   * Solo se enseña mientras hay transmisión encendida en el panel.
   *
   * Se pinta oculto y lo destapa el navegador al preguntar a /api/estado (ver
   * Layout.astro). Un enlace a «En vivo» cuando no hay nada en vivo lleva a una
   * página vacía, y eso se lee como que la iglesia dejó de transmitir.
   */
  soloEnVivo?: boolean;
}

export interface NavGroup {
  label: string;
  icon?: string;
  /** Prefijos de ruta que marcan el grupo como activo. */
  match: string[];
  items: NavLink[];
}

export type NavEntry = NavLink | NavGroup;

export const isGroup = (e: NavEntry): e is NavGroup => 'items' in e;

const sedes: NavLink[] = templos.map((t) => ({
  href: `/templos/${t.slug}`,
  label: t.short,
  desc: t.address,
  icon: 'lucide:map-pin',
}));

/** Menú principal de la cabecera. */
export const MAIN_NAV: NavEntry[] = [
  { href: '/', label: 'Inicio' },
  {
    label: 'Nosotros',
    match: ['/sobre-nosotros'],
    items: [
      {
        href: '/sobre-nosotros',
        label: 'Quiénes somos',
        desc: 'Misión, visión y valores',
        icon: 'lucide:users',
      },
      {
        href: '/sobre-nosotros#historia',
        label: 'Historia',
        desc: 'Cómo nació la congregación',
        icon: 'lucide:book-marked',
      },
      {
        href: '/sobre-nosotros#liderazgo',
        label: 'Pastores y líderes',
        desc: 'Quiénes sirven en cada templo',
        icon: 'lucide:user-round',
      },
      {
        href: '/sobre-nosotros#fe',
        label: 'Declaración de fe',
        desc: 'Lo que creemos',
        icon: 'lucide:book-open',
      },
    ],
  },
  {
    label: 'Templos',
    match: ['/templos', '/horarios'],
    items: [
      {
        href: '/templos',
        label: 'Todos los templos',
        desc: 'Las cuatro comunidades',
        icon: 'lucide:church',
      },
      {
        href: '/horarios',
        label: 'Horarios de reuniones',
        desc: 'Todas las reuniones de la semana',
        icon: 'lucide:clock',
      },
      ...sedes,
    ],
  },
  // El estudio bíblico va suelto en la barra y no dentro de un desplegable, y
  // va antes que Eventos y Noticias: es la actividad semanal que la iglesia
  // quiere que se vea, no una novedad que pasa. Escondido bajo «Nosotros» o
  // junto a Videos tendría el peso de un enlace de archivo.
  { href: '/estudio-biblico', label: 'Instituto Bíblico' },
  /*
   * ── POR QUÉ ESTOS CUATRO SE AGRUPARON ───────────────────────────────────
   * Eventos, Noticias, Videos y En vivo estaban sueltos en la barra. Con ellos
   * eran ocho entradas más dos desplegables, y eso obligaba a enseñar el menú
   * solo desde 1280 px: por debajo no cabía. El resultado era que en un
   * portátil de 13 pulgadas, en una ventana sin maximizar o en un iPad en
   * horizontal, TODA la navegación quedaba escondida en la hamburguesa.
   *
   * Juntos caben desde 1024. Y no es un grupo de conveniencia: los cuatro son
   * lo que la congregación publica —lo que pasó, lo que viene y lo que se
   * grabó—, frente a lo que la iglesia ES (Nosotros), DÓNDE está (Templos) y lo
   * que ENSEÑA cada semana (el Instituto).
   */
  {
    label: 'Comunidad',
    match: ['/eventos', '/noticias', '/videos', '/en-vivo'],
    items: [
      {
        href: '/eventos',
        label: 'Eventos',
        desc: 'Lo que viene, con fecha',
        icon: 'lucide:calendar-days',
      },
      {
        href: '/noticias',
        label: 'Noticias',
        desc: 'Avisos y novedades',
        icon: 'lucide:newspaper',
      },
      {
        href: '/videos',
        label: 'Videos',
        desc: 'Prédicas y transmisiones anteriores',
        icon: 'lucide:youtube',
      },
      {
        href: '/en-vivo',
        label: 'En vivo',
        desc: 'La reunión, ahora mismo',
        icon: 'lucide:radio',
        soloEnVivo: true,
      },
    ],
  },
];

/**
 * Enlaces del pie.
 *
 * Eran catorce en tres columnas. El diseño de Figma (nodo 23:50) deja cinco en
 * una fila y no se pierde nada: la barra de arriba sigue llevando a todo, y un
 * mapa del sitio repetido al pie es de las cosas que menos se tocan.
 *
 * El quinto del diseño decía «Comunidad», que no es ninguna página. Queda
 * Horarios, que es lo que de verdad se busca en la web de una iglesia.
 */
export const FOOTER_NAV: NavLink[] = [
  { href: '/', label: 'Inicio' },
  { href: '/sobre-nosotros', label: 'Nosotros' },
  { href: '/templos', label: 'Templos' },
  { href: '/horarios', label: 'Horarios' },
  { href: '/estudio-biblico', label: 'Instituto Bíblico' },
  { href: '/noticias', label: 'Noticias' },
];

/** ¿La ruta actual corresponde a esta entrada? */
export function isActive(entry: NavEntry, pathname: string): boolean {
  if (isGroup(entry)) {
    return entry.match.some((m) => pathname === m || pathname.startsWith(m + '/'));
  }
  if (entry.href === '/') return pathname === '/';
  return pathname === entry.href || pathname.startsWith(entry.href + '/');
}
