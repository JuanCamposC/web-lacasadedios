/**
 * Datos de los templos de La Casa de Dios.
 * Fuente: información real del proyecto y de lacasadedios.cl.
 *
 * NOTA: los campos `phone` y `email` se dejan vacíos a propósito — los valores
 * anteriores eran placeholders (ej. "+56 9 1234 5678"). Complétalos con los
 * datos reales de cada templo cuando estén disponibles.
 */

export interface ServiceDay {
  day: string;
  /** clase de badge DaisyUI: primary | secondary | accent | neutral */
  tone: 'primary' | 'secondary' | 'accent' | 'neutral';
  services: string[];
}

export interface Leader {
  name: string;
  role: string;
  phone?: string;
  email?: string;
}

export interface Templo {
  slug: string;
  name: string;
  /** nombre corto para tarjetas y navegación */
  short: string;
  emoji: string;
  tagline: string;
  address: string;
  city: string;
  region: string;
  /** clase de badge para la región */
  regionTone: 'primary' | 'secondary' | 'accent';
  /** gradiente del hero con tokens del tema */
  heroGradient: string;
  /** true si es la iglesia matriz de la congregación */
  matriz?: boolean;
  mapEmbed: string;
  mapLink: string;
  coords: { lat: number; lng: number };
  schedule: ServiceDay[];
  leader: Leader;
}

export const templos: Templo[] = [
  {
    slug: 'santiago-centro',
    name: 'Templo Santiago Centro',
    short: 'Santiago Centro',
    emoji: '🌆',
    tagline: 'En el corazón de Santiago',
    address: 'Aldunate #1002, Santiago',
    city: 'Comuna de Santiago',
    region: 'Región Metropolitana',
    regionTone: 'primary',
    heroGradient: 'from-primary/15 via-base-100 to-secondary/15',
    mapEmbed:
      'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3328.6373709541012!2d-70.6543518!3d-33.45875300000001!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x9662c511b52ee251%3A0x8664e86607630908!2sAldunate%201002%2C%208330983%20Santiago%2C%20Regi%C3%B3n%20Metropolitana!5e0!3m2!1ses!2scl!4v1771262117981!5m2!1ses!2scl',
    mapLink: 'https://maps.app.goo.gl/tfczT4jykWNNUKwC6',
    coords: { lat: -33.458753, lng: -70.6543518 },
    schedule: [
      { day: 'Domingo', tone: 'primary', services: ['11:00 · Culto General'] },
      { day: 'Lunes', tone: 'accent', services: ['20:00 · Estudio Bíblico'] },
      { day: 'Jueves', tone: 'neutral', services: ['20:00 · Culto General'] },
    ],
    leader: { name: 'Pastor Manuel Silva Salas', role: 'Pastor' },
  },
  {
    slug: 'san-miguel',
    name: 'Templo San Miguel',
    short: 'San Miguel',
    emoji: '🏛️',
    tagline: 'Iglesia Matriz — Únete a nuestra comunidad',
    matriz: true,
    address: 'Santa Ester #623, San Miguel',
    city: 'Comuna de San Miguel',
    region: 'Región Metropolitana',
    regionTone: 'secondary',
    heroGradient: 'from-secondary/15 via-base-100 to-accent/15',
    mapEmbed:
      'https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d6654.282422153114!2d-70.642289!3d-33.497703!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x9662dbc22648bd85%3A0x299ae248a4c10e5!2sLa%20Casa%20de%20Dios!5e0!3m2!1ses!2scl!4v1771263375995!5m2!1ses!2scl',
    mapLink: 'https://maps.app.goo.gl/GfSjQ3v7yJURcXU26',
    coords: { lat: -33.497703, lng: -70.642289 },
    schedule: [
      { day: 'Domingo', tone: 'primary', services: ['10:30 · Culto General', '19:00 · Culto General'] },
      { day: 'Lunes', tone: 'secondary', services: ['20:00 · Estudio Bíblico'] },
      { day: 'Martes', tone: 'accent', services: ['20:00 · Discipulado'] },
      { day: 'Jueves', tone: 'neutral', services: ['20:00 · Reunión General'] },
      { day: 'Sábado', tone: 'accent', services: ['17:30 · Reunión de Jóvenes'] },
    ],
    leader: { name: 'Pastor Arturo Salas Olguín', role: 'Pastor' },
  },
  {
    slug: 'limache',
    name: 'Templo Limache',
    short: 'Limache',
    emoji: '🏘️',
    tagline: 'Sirviendo a la comunidad de Limache',
    address: 'El Espino #352, Limache',
    city: 'Comuna de Limache',
    region: 'Región de Valparaíso',
    regionTone: 'primary',
    heroGradient: 'from-primary/15 via-base-100 to-accent/15',
    mapEmbed:
      'https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d6691.570331957979!2d-71.262398!3d-33.009439!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x9689d447746777f3%3A0x3694a4f7e329f1d1!2sEl%20Espino%20352%2C%202240599%20Limache%2C%20Valpara%C3%ADso!5e0!3m2!1ses!2scl!4v1771263852661!5m2!1ses!2scl',
    mapLink: 'https://maps.app.goo.gl/N8GFkvGRdPNp3aiu5',
    coords: { lat: -33.009439, lng: -71.262398 },
    schedule: [
      { day: 'Sábado', tone: 'primary', services: ['19:00 · Culto General'] },
      { day: 'Lunes', tone: 'neutral', services: ['20:00 · Estudio Bíblico'] },
      { day: 'Miércoles', tone: 'secondary', services: ['20:00 · Reunión de Jóvenes y Preadolescentes'] },
      { day: 'Jueves', tone: 'accent', services: ['20:00 · Culto General'] },
    ],
    leader: { name: 'Pastor Alberto Gutiérrez Plaza', role: 'Pastor' },
  },
  {
    slug: 'coya',
    name: 'Templo Coya',
    short: 'Coya',
    emoji: '⛰️',
    tagline: 'Una familia de fe en Coya',
    address: 'Pedro Aguirre Cerda #623, Coya',
    city: 'Comuna de Machalí',
    region: "Región del Libertador Bernardo O'Higgins",
    regionTone: 'accent',
    heroGradient: 'from-accent/15 via-base-100 to-primary/15',
    mapEmbed:
      "https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d3299.7453213108574!2d-70.528772!3d-34.203983!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x9663517e65647063%3A0xdb02756c3ccb4607!2sC.%20Pedro%20Aguirre%20Cerda%20623%2C%20Coya%2C%20Machal%C3%AD%2C%20O'Higgins!5e0!3m2!1ses!2scl!4v1771264305348!5m2!1ses!2scl",
    mapLink: 'https://maps.app.goo.gl/ZKd69AjzgSLTLzk59',
    coords: { lat: -34.203983, lng: -70.528772 },
    schedule: [
      { day: 'Sábado', tone: 'primary', services: ['19:00 · Culto General'] },
      { day: 'Lunes', tone: 'secondary', services: ['20:00 · Estudio Bíblico'] },
      { day: 'Miércoles', tone: 'accent', services: ['20:00 · Culto General'] },
    ],
    leader: { name: 'Hermano Juan Enrique Plaza Morales', role: 'Obrero a cargo' },
  },
];

export function getTemplo(slug: string): Templo | undefined {
  return templos.find((t) => t.slug === slug);
}

/** Devuelve el templo anterior y siguiente (circular) para la navegación. */
export function getSiblings(slug: string): { prev: Templo; next: Templo } {
  const i = templos.findIndex((t) => t.slug === slug);
  const prev = templos[(i - 1 + templos.length) % templos.length];
  const next = templos[(i + 1) % templos.length];
  return { prev, next };
}
