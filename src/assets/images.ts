// Mapa central de imágenes (stock temporal — ver img/CREDITS.md).
// Importadas como ImageMetadata para optimizarlas con el componente <Image />.
import heroWorship from './img/hero-worship.jpg';
import auditorio from './img/auditorio.jpg';
import congregacion from './img/congregacion.jpg';
import adoracion from './img/adoracion.jpg';
import cruzCielo from './img/cruz-cielo.jpg';
import eventoLuces from './img/evento-luces.jpg';
import manosAlzadas from './img/manos-alzadas.jpg';
import biblia from './img/biblia.jpg';
import comunidad from './img/comunidad.jpg';
import estudio from './img/estudio.jpg';
import camara from './img/camara.jpg';

export const IMG = {
  heroWorship,
  auditorio,
  congregacion,
  adoracion,
  cruzCielo,
  eventoLuces,
  manosAlzadas,
  biblia,
  comunidad,
  estudio,
  camara,
} as const;

export type ImgKey = keyof typeof IMG;
