/**
 * Identidad, contacto y redes sociales del sitio.
 *
 * Punto único de verdad: ninguna página debe repetir una URL de red social,
 * un correo ni un teléfono. Si algo cambia, se cambia aquí.
 */
import type { ImgKey } from '../assets/images';

export const SITE = {
  name: 'La Casa de Dios',
  legalName: 'Iglesia La Casa de Dios',
  tagline: 'Iglesia Cristiana',
  claim: 'La Palabra de Dios es el fundamento de todo lo que hacemos.',
  intro: 'Comunidad de fe cristiana con templos en Santiago, San Miguel, Limache y Coya.',
  verse: {
    text: 'Porque donde están dos o tres congregados en mi nombre, allí estoy yo en medio de ellos.',
    ref: 'Mateo 18:20',
  },
} as const;

/**
 * Contacto general de la iglesia.
 *
 * ── EL TELÉFONO SE QUEDA VACÍO, Y ES UNA DECISIÓN ───────────────────────────
 * Dejó de ser un pendiente el 28 de noviembre de 2026: la iglesia no quiere
 * publicar un número. El contacto es por correo y por el formulario.
 *
 * La maquinaria para publicarlo se queda escrita, porque no cuesta nada y
 * porque la decisión puede cambiar: basta rellenar `phone` y `phoneHref` —en
 * formato +56XXXXXXXXX— y el número aparece solo en el pie, en la página de
 * contacto, en cada templo y en los datos estructurados. Nada más que tocar.
 */
export const CONTACT = {
  email: 'contacto@lacasadedios.cl',
  phone: '',
  phoneHref: '',
};

/** ¿Hay teléfono publicable? Se usa para no renderizar enlaces vacíos. */
export const hasPhone = Boolean(CONTACT.phone && CONTACT.phoneHref);

export interface SocialLink {
  key: string;
  label: string;
  handle: string;
  href: string;
  icon: string;
}

export const SOCIAL: SocialLink[] = [
  {
    key: 'instagram',
    label: 'Instagram',
    // La cuenta OFICIAL de la iglesia, la misma marca que en YouTube.
    //
    // Hasta el 29 de octubre de 2026 esto apuntaba a @joveneslacasadedios, que
    // es la cuenta de los JÓVENES, no la de la iglesia. Esa otra sigue en uso y
    // es la que enlaza /jovenes. Los nombres se parecen tanto que conviene
    // tenerlo escrito:
    //
    //   @lacasadedioscl        la iglesia      → acá, el pie y /contacto
    //   @joveneslacasadedios   los jóvenes     → el enlace de /jovenes
    //   @jovenescasadedios._   nombre viejo de la de jóvenes, ya sin uso
    handle: '@lacasadedioscl',
    href: 'https://instagram.com/lacasadedioscl',
    icon: 'lucide:instagram',
  },
  {
    key: 'youtube',
    label: 'YouTube',
    handle: '@lacasadedioscl',
    href: 'https://www.youtube.com/@lacasadedioscl',
    icon: 'lucide:youtube',
  },
];

/** Canal de YouTube — usado por /videos y /en-vivo. */
export const YOUTUBE_CHANNEL = SOCIAL.find((s) => s.key === 'youtube')!.href;

/** Cuenta de Instagram — la portada le da un bloque propio. */
export const INSTAGRAM = SOCIAL.find((s) => s.key === 'instagram')!;
