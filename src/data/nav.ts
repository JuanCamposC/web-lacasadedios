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
      { href: '/sobre-nosotros', label: 'Quiénes somos', desc: 'Misión, visión y valores', icon: 'lucide:users' },
      { href: '/sobre-nosotros#historia', label: 'Historia', desc: 'Cómo nació la congregación', icon: 'lucide:book-marked' },
      { href: '/sobre-nosotros#liderazgo', label: 'Pastores y líderes', desc: 'Quiénes sirven en cada templo', icon: 'lucide:user-round' },
      { href: '/sobre-nosotros#fe', label: 'Declaración de fe', desc: 'Lo que creemos', icon: 'lucide:book-open' },
    ],
  },
  {
    label: 'Templos',
    match: ['/templos', '/horarios'],
    items: [
      { href: '/templos', label: 'Todos los templos', desc: 'Las cuatro comunidades', icon: 'lucide:church' },
      { href: '/horarios', label: 'Horarios de cultos', desc: 'Todas las reuniones de la semana', icon: 'lucide:clock' },
      ...sedes,
    ],
  },
  { href: '/eventos', label: 'Eventos' },
  { href: '/noticias', label: 'Noticias' },
  { href: '/videos', label: 'Videos' },
  { href: '/en-vivo', label: 'En vivo' },
];

/** Columnas del pie de página. */
export const FOOTER_NAV: { title: string; items: NavLink[] }[] = [
  {
    title: 'La iglesia',
    items: [
      { href: '/sobre-nosotros', label: 'Quiénes somos' },
      { href: '/sobre-nosotros#historia', label: 'Historia' },
      { href: '/sobre-nosotros#liderazgo', label: 'Pastores y líderes' },
      { href: '/sobre-nosotros#fe', label: 'Declaración de fe' },
    ],
  },
  {
    title: 'Templos',
    items: [
      { href: '/templos', label: 'Todos los templos' },
      { href: '/horarios', label: 'Horarios de cultos' },
      ...sedes.map(({ href, label }) => ({ href, label })),
    ],
  },
  {
    title: 'Comunidad',
    items: [
      { href: '/eventos', label: 'Eventos' },
      { href: '/noticias', label: 'Noticias' },
      { href: '/videos', label: 'Videos' },
      { href: '/en-vivo', label: 'En vivo' },
      { href: '/contacto', label: 'Contacto' },
    ],
  },
];

/** ¿La ruta actual corresponde a esta entrada? */
export function isActive(entry: NavEntry, pathname: string): boolean {
  if (isGroup(entry)) {
    return entry.match.some((m) => pathname === m || pathname.startsWith(m + '/'));
  }
  if (entry.href === '/') return pathname === '/';
  return pathname === entry.href || pathname.startsWith(entry.href + '/');
}
