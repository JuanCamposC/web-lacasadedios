/**
 * Los enlaces de /jovenes: de qué plataforma es cada uno.
 *
 * El panel no pide icono ni plataforma: se deducen de la dirección. Es un campo
 * menos que llenar y, sobre todo, uno menos que se pueda llenar mal —un icono
 * de Spotify en un enlace de YouTube—.
 *
 * Los iconos son de Lucide, el único juego instalado. Lucide no dibuja marcas
 * de música, así que Spotify y Apple Music llevan una nota musical y se
 * distinguen por su nombre y su color.
 */

export interface Plataforma {
  nombre: string;
  icono: string;
  /** Color de la marca, para el acento del botón. */
  color: string;
}

const PLATAFORMAS: { hosts: string[]; plataforma: Plataforma }[] = [
  {
    hosts: ['open.spotify.com', 'spotify.com', 'spotify.link'],
    plataforma: { nombre: 'Spotify', icono: 'lucide:music', color: '#1aa34a' },
  },
  {
    hosts: ['music.apple.com'],
    plataforma: { nombre: 'Apple Music', icono: 'lucide:music', color: '#fa586a' },
  },
  {
    // Va antes que YouTube: `music.youtube.com` también termina en youtube.com.
    hosts: ['music.youtube.com'],
    plataforma: { nombre: 'YouTube Music', icono: 'lucide:youtube', color: '#ff4e45' },
  },
  {
    hosts: ['youtube.com', 'youtu.be'],
    plataforma: { nombre: 'YouTube', icono: 'lucide:youtube', color: '#ff4e45' },
  },
  {
    hosts: ['instagram.com'],
    plataforma: { nombre: 'Instagram', icono: 'lucide:instagram', color: '#e1306c' },
  },
  {
    hosts: ['wa.me', 'whatsapp.com'],
    plataforma: { nombre: 'WhatsApp', icono: 'lucide:message-circle', color: '#25d366' },
  },
  {
    hosts: ['tiktok.com'],
    plataforma: { nombre: 'TikTok', icono: 'lucide:music-2', color: '#111827' },
  },
  {
    hosts: ['facebook.com', 'fb.me'],
    plataforma: { nombre: 'Facebook', icono: 'lucide:facebook', color: '#4f8df5' },
  },
  {
    hosts: ['forms.gle', 'docs.google.com'],
    plataforma: { nombre: 'Formulario', icono: 'lucide:clipboard-list', color: '#a78bfa' },
  },
];

const GENERICA: Plataforma = { nombre: '', icono: 'lucide:link', color: '#7c3aed' };

/**
 * La plataforma de una dirección, o la genérica si no se reconoce.
 *
 * Se compara el dominio entero o su final con punto delante: `spotify.com.evil`
 * no es Spotify, y `notinstagram.com` tampoco es Instagram.
 */
export function plataformaDe(url: string): Plataforma {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return GENERICA;
  }
  const hallada = PLATAFORMAS.find(({ hosts }) =>
    hosts.some((h) => host === h || host.endsWith(`.${h}`)),
  );
  return hallada?.plataforma ?? GENERICA;
}

/**
 * ¿Se puede poner esta dirección en un botón público?
 *
 * La base ya rechaza lo que no empiece por http (ver d1/0004_enlaces.sql). Esto
 * es la segunda llave, del lado de la página: si una fila vieja o una migración
 * futura se saltara esa comprobación, un `javascript:` no llegaría a un botón.
 */
export function esEnlaceSeguro(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
}
