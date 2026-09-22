/**
 * Mapa central de imágenes del sitio.
 *
 * ── EL NOMBRE DEL ARCHIVO ES EL HUECO QUE OCUPA ─────────────────────────────
 *
 * `nosotros-portada.jpg` es la franja de arriba de /sobre-nosotros, y nada
 * más. Eso permite reemplazar una foto sin tocar código ni saber Astro: se
 * deja el archivo con ese nombre en `src/assets/img/` y listo.
 *
 * Antes los nombres describían lo que se veía —`congregacion.jpg`— y la misma
 * imagen servía para cuatro sitios a la vez: el templo de San Miguel, la
 * portada de «Nosotros», el cierre de «Horarios» y una foto del Instagram.
 * Mientras fueran de banco daba igual; con fotos reales no: la foto del templo
 * de Coya no puede ser la portada de «Contacto». Por eso hoy hay un archivo
 * por hueco, aunque varios sean todavía copias del mismo original.
 *
 * Los nombres NO llevan un tema al final a propósito: si se llamara
 * `nosotros-portada-congregacion.jpg`, reemplazarla exigiría acertar esa
 * última palabra, y una foto con el nombre casi correcto no entra y no avisa.
 *
 * Las de banco están marcadas en img/CREDITS.md. Cada vez que una real
 * reemplace a una de banco, hay que borrar su fila de ese archivo.
 *
 * ── DOS COPIAS IGUALES SE SIRVEN COMO UN SOLO ARCHIVO ───────────────────────
 *
 * Mientras varias de estas sigan siendo la misma foto de banco, Astro las
 * detecta idénticas y publica UNA sola, con el nombre de cualquiera de ellas.
 * Por eso hoy la portada de /sobre-nosotros se sirve desde un archivo llamado
 * «instagram-1»: es la misma imagen, byte a byte. No es un error y no hay nada
 * que arreglar; en cuanto una foto real reemplace a la de banco deja de ser
 * idéntica y pasa a tener su propio archivo, con su nombre.
 *
 * Se importan como `ImageMetadata` para que `<Image />` las optimice.
 */
import inicioPortada from './img/inicio-portada.jpg';
import inicioMosaico from './img/inicio-mosaico.jpg';
import inicioEstudio from './img/inicio-estudio.jpg';

import nosotrosPortada from './img/nosotros-portada.jpg';
import nosotrosHistoria from './img/nosotros-historia.jpg';
import nosotrosCierre from './img/nosotros-cierre.jpg';

import templosPortada from './img/templos-portada.jpg';
import templosCierre from './img/templos-cierre.jpg';

import horariosPortada from './img/horarios-portada.jpg';
import horariosCierre from './img/horarios-cierre.jpg';

import eventosPortada from './img/eventos-portada.jpg';
import eventosCierre from './img/eventos-cierre.jpg';

import noticiasPortada from './img/noticias-portada.jpg';
import noticiasCierre from './img/noticias-cierre.jpg';

import videosPortada from './img/videos-portada.jpg';
import videosCierre from './img/videos-cierre.jpg';

import estudioPortada from './img/estudio-portada.jpg';
import estudioCierre from './img/estudio-cierre.jpg';

import contactoPortada from './img/contacto-portada.jpg';
import envivoPortada from './img/envivo-portada.jpg';

import temploSantiagoCentro from './img/templo-santiago-centro.jpg';
import temploSanMiguel from './img/templo-san-miguel.jpg';
import temploLimache from './img/templo-limache.jpg';
import temploCoya from './img/templo-coya.jpg';

import instagram1 from './img/instagram-1.jpg';
import instagram2 from './img/instagram-2.jpg';
import instagram3 from './img/instagram-3.jpg';
import instagram4 from './img/instagram-4.jpg';

export const IMG = {
  // Página de inicio.
  inicioPortada,
  inicioMosaico,
  inicioEstudio,

  // Portadas y bandas de cierre de cada página.
  nosotrosPortada,
  nosotrosHistoria,
  nosotrosCierre,
  templosPortada,
  templosCierre,
  horariosPortada,
  horariosCierre,
  eventosPortada,
  eventosCierre,
  noticiasPortada,
  noticiasCierre,
  videosPortada,
  videosCierre,
  estudioPortada,
  estudioCierre,
  contactoPortada,
  envivoPortada,

  // Los cuatro templos.
  temploSantiagoCentro,
  temploSanMiguel,
  temploLimache,
  temploCoya,

  // El mosaico de Instagram de la portada.
  instagram1,
  instagram2,
  instagram3,
  instagram4,
} as const;

export type ImgKey = keyof typeof IMG;
