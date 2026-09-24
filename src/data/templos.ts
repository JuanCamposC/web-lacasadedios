/**
 * Datos de los templos de La Casa de Dios.
 * Fuente: información real del proyecto y de lacasadedios.cl.
 *
 * LOS HORARIOS YA NO ESTÁN ACÁ. Viven en la tabla `reuniones` y se editan desde
 * /admin/horarios (ver d1/0003_reuniones.sql y src/lib/reuniones.ts). Los que
 * había escritos en este archivo se copiaron tal cual a esa tabla.
 */
import type { ImgKey } from '../assets/images';

// El contacto general vive en `site.ts`. Se reexporta para no romper imports.
export { CONTACT, hasPhone } from './site';

export interface Leader {
  name: string;
  role: string;
  phone?: string;
  /** Correo institucional de quien recibe los mensajes de este templo. */
  email?: string;
  /**
   * ¿Se publica ya el correo?
   *
   * Existe para no anunciar un buzón que todavía no se ha creado: una dirección
   * que rebota es peor que ninguna, porque quien escribe cree que su mensaje
   * llegó. Se enciende uno por uno.
   */
  emailListo?: boolean;
  /**
   * Una aclaración junto al correo, cuando lo recibe otra persona.
   *
   * Coya no tiene pastor propio: el correo de su ficha es el del Pastor Arturo
   * Salas. Sin la nota, quien escribe a Coya se sorprendería de que le conteste
   * alguien de San Miguel.
   */
  correoNota?: string;
}

/**
 * Cómo se participa en el estudio bíblico de un templo.
 *
 * `zoom` no lleva enlace, y es a propósito: el enlace se pide al pastor, que
 * decide a quién se lo entrega. Ver `src/pages/estudio-biblico.astro`.
 */
export type ModalidadEstudio = 'presencial' | 'zoom';

export interface Templo {
  slug: string;
  name: string;
  /** nombre corto para tarjetas y navegación */
  short: string;
  /** clave de imagen (ver src/assets/images.ts) */
  image: ImgKey;
  /**
   * Otra foto para las tarjetas pequeñas, cuando la de arriba no sirve ahí.
   *
   * La cabecera de la ficha es una franja ancha y baja, y pide una foto con
   * calle y contexto. Las tarjetas —la portada, el listado de templos y el
   * bloque de «otros templos»— son recuadros pequeños donde esa misma foto se
   * pierde: el edificio queda diminuto y no se reconoce cuál es.
   *
   * Quien no la define usa `image` en los dos sitios, que es lo normal. Se
   * agrega solo donde la diferencia se nota.
   */
  imageMini?: ImgKey;
  tagline: string;
  address: string;
  city: string;
  region: string;
  /** true si es la iglesia matriz de la congregación */
  matriz?: boolean;
  mapEmbed: string;
  mapLink: string;
  coords: { lat: number; lng: number };
  /**
   * El color que identifica al templo en los horarios.
   *
   * En el cartel de /horarios el templo iba en letra gris al final de cada
   * línea, y se pidió que se viera mucho más. Con un color fijo por templo, al
   * bajar la semana se reconoce «lo de San Miguel» sin leer.
   *
   * Dos tonos del mismo color: `fondo`, oscuro, para páginas claras (con letra
   * blanca), y `claro` para el cartel azul noche y el tema oscuro (con letra
   * azul noche). No se usan los colores del tema porque primario, secundario y
   * neutro son tres azules casi iguales: pintados así, los cuatro templos no se
   * distinguían. Ver `.distintivo` en global.css.
   */
  color: { fondo: string; claro: string };
  /** Cómo se participa en el estudio bíblico de este templo. */
  estudio: ModalidadEstudio;
  leader: Leader;
}

/**
 * Mapa incrustado a partir de una búsqueda.
 *
 * Limache y San Miguel están dados de alta en Google Maps como «La Casa de
 * Dios» en su dirección. Buscando por el nombre y la dirección, el mapa abre la
 * ficha de la iglesia —con su nombre, fotos y reseñas— y no un punto anónimo en
 * la calle. Comprobado: las dos búsquedas devuelven la ficha correcta.
 *
 * Es la dirección final de Google y no `maps?q=…&output=embed`, que redirige
 * aquí: la redirección sale con `X-Frame-Options: SAMEORIGIN` y hay navegadores
 * que la cortan dentro de un iframe.
 */
const mapaDe = (busqueda: string) =>
  `https://www.google.com/maps/embed?origin=mfe&pb=!1m2!2m1!1s${encodeURIComponent(busqueda).replace(/%20/g, '+')}`;

/** Enlace que abre la misma búsqueda en la aplicación de mapas del teléfono. */
const enlaceMapaDe = (busqueda: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(busqueda)}`;

export const templos: Templo[] = [
  {
    slug: 'santiago-centro',
    name: 'Templo Santiago Centro',
    short: 'Santiago Centro',
    image: 'temploSantiagoCentro',
    tagline: 'En el corazón de Santiago',
    address: 'Aldunate #1002, Santiago',
    city: 'Comuna de Santiago',
    region: 'Región Metropolitana',
    mapEmbed:
      'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3328.6373709541012!2d-70.6543518!3d-33.45875300000001!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x9662c511b52ee251%3A0x8664e86607630908!2sAldunate%201002%2C%208330983%20Santiago%2C%20Regi%C3%B3n%20Metropolitana!5e0!3m2!1ses!2scl!4v1771262117981!5m2!1ses!2scl',
    mapLink: 'https://maps.app.goo.gl/tfczT4jykWNNUKwC6',
    coords: { lat: -33.458753, lng: -70.6543518 },
    color: { fondo: '#7d5518', claro: '#d9ae63' },
    estudio: 'zoom',
    leader: {
      name: 'Pastor Manuel Silva Salas',
      role: 'Pastor',
      email: 'manuelsilva.pastor@lacasadedios.cl',
      emailListo: true,
    },
  },
  {
    slug: 'san-miguel',
    name: 'Templo San Miguel',
    short: 'San Miguel',
    image: 'temploSanMiguel',
    tagline: 'Iglesia Matriz — Únete a nuestra comunidad',
    matriz: true,
    address: 'Santa Ester #623, San Miguel',
    city: 'Comuna de San Miguel',
    region: 'Región Metropolitana',
    mapEmbed: mapaDe('La Casa de Dios San Miguel, Santa Ester 623, San Miguel'),
    mapLink: enlaceMapaDe('La Casa de Dios, Santa Ester 623, San Miguel'),
    coords: { lat: -33.497703, lng: -70.642289 },
    color: { fondo: '#23448f', claro: '#8aa9e8' },
    // El único templo donde el estudio bíblico es presencial.
    estudio: 'presencial',
    leader: {
      name: 'Pastor Arturo Salas Olguín',
      role: 'Pastor',
      email: 'arturosalas.pastor@lacasadedios.cl',
      emailListo: true,
    },
  },
  {
    slug: 'limache',
    name: 'Templo Limache',
    short: 'Limache',
    image: 'temploLimache',
    tagline: 'Sirviendo a la comunidad de Limache',
    address: 'El Espino #352, Limache',
    city: 'Comuna de Limache',
    region: 'Región de Valparaíso',
    mapEmbed: mapaDe('La Casa de Dios Limache, El Espino 352, Limache'),
    mapLink: enlaceMapaDe('La Casa de Dios Limache, El Espino 352, Limache'),
    coords: { lat: -33.009439, lng: -71.262398 },
    color: { fondo: '#2f6b4f', claro: '#86c7a3' },
    estudio: 'zoom',
    leader: {
      name: 'Pastor Alberto Gutiérrez Plaza',
      role: 'Pastor',
      email: 'albertogutierrez.pastor@lacasadedios.cl',
      emailListo: true,
    },
  },
  {
    slug: 'coya',
    name: 'Templo Coya',
    short: 'Coya',
    image: 'temploCoya',
    imageMini: 'temploCoyaMini',
    tagline: 'Una familia de fe en Coya',
    address: 'Av. Pedro Aguirre Cerda #623, Coya',
    city: 'Comuna de Machalí',
    region: "Región del Libertador Bernardo O'Higgins",
    mapEmbed:
      "https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d3299.7453213108574!2d-70.5289121!3d-34.2037633!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x9663517e667e1d15%3A0x8a014999532b3d5c!2sAv.%20Pedro%20Aguirre%20Cerda%20623%2C%20Coya%2C%20Machal%C3%AD%2C%20O'Higgins!5e0!3m2!1ses!2scl!4v1771264305348!5m2!1ses!2scl",
    mapLink: 'https://maps.app.goo.gl/JUZ38bpu8CWoGrgR8',
    coords: { lat: -34.2037633, lng: -70.5289121 },
    color: { fondo: '#8a3b3b', claro: '#e3a0a0' },
    estudio: 'zoom',
    leader: {
      name: 'Hermano Juan Enrique Plaza Morales',
      role: 'Obrero a cargo',
      email: 'arturosalas.pastor@lacasadedios.cl',
      emailListo: true,
      correoNota: 'Los correos de Coya los recibe el Pastor Arturo Salas.',
    },
  },
];

export function getTemplo(slug: string): Templo | undefined {
  return templos.find((t) => t.slug === slug);
}

/**
 * El correo de un líder, o `null` si todavía no se publica.
 *
 * Toda la web pasa por acá para pintar una dirección personal: un solo sitio
 * donde se decide. Ver `Leader.emailListo`.
 */
export function correoDe(leader: Leader): string | null {
  return leader.emailListo && leader.email ? leader.email : null;
}

/** «Pastor a cargo» u «Hermano a cargo», según el rol. */
export const cargoDe = (leader: Leader) =>
  leader.role.startsWith('Obrero') ? 'Hermano a cargo' : 'Pastor a cargo';

/** Devuelve el templo anterior y siguiente (circular) para la navegación. */
export function getSiblings(slug: string): { prev: Templo; next: Templo } {
  const i = templos.findIndex((t) => t.slug === slug);
  const prev = templos[(i - 1 + templos.length) % templos.length];
  const next = templos[(i + 1) % templos.length];
  return { prev, next };
}

/**
 * Las variables de color del distintivo de un templo, para un atributo `style`.
 *
 * Van como variables CSS y no como clases porque son valores de datos, no del
 * tema: añadir un quinto templo es añadir sus dos colores acá, sin tocar CSS.
 */
export const estiloDistintivo = (t: Templo) =>
  `--d-fondo:${t.color.fondo};--d-claro:${t.color.claro}`;
