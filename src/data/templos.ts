/**
 * Datos de los templos de La Casa de Dios.
 * Fuente: información real del proyecto y de lacasadedios.cl.
 */
import type { ImgKey } from '../assets/images';

// El contacto general vive en `site.ts`. Se reexporta para no romper imports.
export { CONTACT, hasPhone } from './site';

export interface ServiceDay {
  day: DayName;
  /** clave de tono; se traduce a clases estáticas en la vista */
  tone: Tone;
  /** cada servicio con el formato "HH:MM · Nombre" */
  services: string[];
}

export type Tone = 'primary' | 'secondary' | 'accent' | 'neutral';

export type DayName =
  | 'Domingo'
  | 'Lunes'
  | 'Martes'
  | 'Miércoles'
  | 'Jueves'
  | 'Viernes'
  | 'Sábado';

/** Orden litúrgico de la semana (domingo primero). */
export const DAYS: DayName[] = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
];

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
  /** clave de imagen (ver src/assets/images.ts) */
  image: ImgKey;
  tagline: string;
  address: string;
  city: string;
  region: string;
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
    image: 'auditorio',
    tagline: 'En el corazón de Santiago',
    address: 'Aldunate #1002, Santiago',
    city: 'Comuna de Santiago',
    region: 'Región Metropolitana',
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
    image: 'congregacion',
    tagline: 'Iglesia Matriz — Únete a nuestra comunidad',
    matriz: true,
    address: 'Santa Ester #623, San Miguel',
    city: 'Comuna de San Miguel',
    region: 'Región Metropolitana',
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
    image: 'adoracion',
    tagline: 'Sirviendo a la comunidad de Limache',
    address: 'El Espino #352, Limache',
    city: 'Comuna de Limache',
    region: 'Región de Valparaíso',
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
    image: 'comunidad',
    tagline: 'Una familia de fe en Coya',
    address: 'Pedro Aguirre Cerda #623, Coya',
    city: 'Comuna de Machalí',
    region: "Región del Libertador Bernardo O'Higgins",
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

/** Separa "20:00 · Estudio Bíblico" en hora y nombre. */
export function parseService(raw: string): { time: string; name: string } {
  const i = raw.indexOf('·');
  if (i === -1) return { time: '', name: raw.trim() };
  return { time: raw.slice(0, i).trim(), name: raw.slice(i + 1).trim() };
}

export interface WeekEntry {
  day: DayName;
  /** índice 0=domingo … 6=sábado, para resaltar "hoy" en el navegador */
  dayIndex: number;
  services: { time: string; name: string; templo: Templo }[];
}

/**
 * Todos los cultos de todos los templos, agrupados por día y ordenados por hora.
 * Es la base de la página /horarios.
 */
export function weekSchedule(): WeekEntry[] {
  return DAYS.map((day, dayIndex) => {
    const services = templos.flatMap((templo) =>
      (templo.schedule.find((s) => s.day === day)?.services ?? []).map((raw) => ({
        ...parseService(raw),
        templo,
      })),
    );
    services.sort((a, b) => a.time.localeCompare(b.time));
    return { day, dayIndex, services };
  }).filter((d) => d.services.length > 0);
}

export interface TimeSlot {
  time: string;
  /** Sedes que se reúnen a esa hora ese día. */
  sedes: Templo[];
  /** Nombres distintos de la reunión (a veces varían entre sedes). */
  names: string[];
}

/**
 * Agrupa las reuniones de un día por hora.
 *
 * Varias sedes coinciden a la misma hora —los lunes y jueves, tres templos a
 * las 20:00—, así que listarlas una por una repite el número tres veces. Es
 * más claro y más cierto decirlo al revés: a esta hora, estos templos.
 */
export function groupByTime(
  services: { time: string; name: string; templo: Templo }[],
): TimeSlot[] {
  const mapa = new Map<string, TimeSlot>();
  for (const s of services) {
    const slot = mapa.get(s.time) ?? { time: s.time, sedes: [], names: [] };
    slot.sedes.push(s.templo);
    if (!slot.names.includes(s.name)) slot.names.push(s.name);
    mapa.set(s.time, slot);
  }
  return [...mapa.values()].sort((a, b) => a.time.localeCompare(b.time));
}

/** Nº total de reuniones semanales en toda la congregación. */
export function totalServices(): number {
  return templos.reduce(
    (n, t) => n + t.schedule.reduce((m, s) => m + s.services.length, 0),
    0,
  );
}
