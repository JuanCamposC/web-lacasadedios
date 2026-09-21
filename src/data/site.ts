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
    handle: '@joveneslacasadedios',
    href: 'https://instagram.com/joveneslacasadedios',
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

export interface PostInstagram {
  /** Clave de `src/assets/images.ts`. */
  img: ImgKey;
  /** Dirección de la publicación en Instagram. */
  href: string;
  /** Qué se ve en la foto, para quien no puede verla. */
  alt: string;
}

/**
 * Las fotos de Instagram que salen en la portada.
 *
 * ── POR QUÉ ESTÁN ESCRITAS A MANO Y NO SE TRAEN DE INSTAGRAM ────────────────
 * Mostrar el muro de verdad obliga a cargar código de Meta en la página, abrir
 * la política de seguridad que hoy bloquea todo lo externo, y hacer que cada
 * visitante —incluido quien solo busca la dirección de un templo— quede
 * fichado por Meta antes de encontrarla. Cuatro fotos elegidas cuestan un rato
 * cada tantas semanas y no le cobran eso a nadie.
 *
 * ── CÓMO SE CAMBIAN ─────────────────────────────────────────────────────────
 * 1. Guardar la foto en `src/assets/img/` y añadirla a `images.ts`.
 * 2. Copiar la dirección de la publicación desde Instagram («Copiar enlace»).
 * 3. Cambiar la línea de abajo.
 *
 * PENDIENTE: las fotos son de banco de imágenes, como el resto del sitio (ver
 * `src/assets/img/CREDITS.md`), y los enlaces apuntan al perfil y no a una
 * publicación concreta, porque todavía no se han elegido las publicaciones. Se
 * ve exactamente como se verá; lo que falta es el contenido real.
 */
export const INSTAGRAM_POSTS: PostInstagram[] = [
  { img: 'congregacion', href: INSTAGRAM.href, alt: 'La congregación reunida en el templo' },
  { img: 'manosAlzadas', href: INSTAGRAM.href, alt: 'Manos alzadas durante la alabanza' },
  { img: 'estudio', href: INSTAGRAM.href, alt: 'Biblia y cuaderno abiertos durante el estudio' },
  { img: 'comunidad', href: INSTAGRAM.href, alt: 'Hermanos compartiendo después de la reunión' },
];
