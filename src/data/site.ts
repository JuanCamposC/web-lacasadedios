/**
 * Identidad, contacto y redes sociales del sitio.
 *
 * Punto único de verdad: ninguna página debe repetir una URL de red social,
 * un correo ni un teléfono. Si algo cambia, se cambia aquí.
 */

export const SITE = {
  name: 'La Casa de Dios',
  legalName: 'Iglesia Evangélica La Casa de Dios',
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
 * PENDIENTE: `phone` está vacío a propósito. El número que había era de
 * ejemplo y no debe publicarse. Al completarlo (junto con `phoneHref` en
 * formato +56XXXXXXXXX) aparece automáticamente en el pie, en la página de
 * contacto, en cada templo y en los datos estructurados.
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
    handle: '@jovenescasadedios._',
    href: 'https://instagram.com/jovenescasadedios._',
    icon: 'lucide:instagram',
  },
  {
    key: 'youtube',
    label: 'YouTube',
    handle: 'Conociendo la Palabra',
    href: 'https://www.youtube.com/@casadediosconociendolapalabrad',
    icon: 'lucide:youtube',
  },
];

/** Canal de YouTube — usado por /videos y /en-vivo. */
export const YOUTUBE_CHANNEL = SOCIAL.find((s) => s.key === 'youtube')!.href;
