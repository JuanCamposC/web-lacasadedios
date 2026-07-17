// Mapa central de imágenes (stock temporal — ver img/CREDITS.md).
// Importadas como ImageMetadata para optimizarlas con el componente <Image />.
import heroVitral from './img/hero-vitral.jpg';
import adoracion from './img/adoracion.jpg';
import cruzCielo from './img/cruz-cielo.jpg';
import nave from './img/nave.jpg';
import eventoLuces from './img/evento-luces.jpg';
import manosAlzadas from './img/manos-alzadas.jpg';
import biblia from './img/biblia.jpg';
import comunidad from './img/comunidad.jpg';
import estudio from './img/estudio.jpg';
import camara from './img/camara.jpg';

export const IMG = {
  heroVitral,
  adoracion,
  cruzCielo,
  nave,
  eventoLuces,
  manosAlzadas,
  biblia,
  comunidad,
  estudio,
  camara,
} as const;

export type ImgKey = keyof typeof IMG;
