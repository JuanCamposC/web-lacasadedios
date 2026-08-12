/**
 * Historia de la congregación.
 *
 * IMPORTANTE — datos por completar:
 * Los párrafos de abajo solo afirman lo que consta en el sitio actual (que la
 * iglesia matriz está en San Miguel y que hay cuatro templos). No se inventan
 * fechas, fundadores ni hitos.
 *
 * Cuando la iglesia entregue la información real, agrega los hitos a `hitos`
 * y la línea de tiempo aparece sola en /sobre-nosotros#historia. Mientras el
 * arreglo esté vacío, la sección muestra solo el relato y no queda un hueco.
 */
import type { ImgKey } from '../assets/images';

export interface Hito {
  /** Año o rango: "1998", "2004–2006", "Hoy" */
  year: string;
  title: string;
  text: string;
  /** Templo relacionado, si corresponde (slug). */
  templo?: string;
}

export const HISTORIA = {
  eyebrow: 'Nuestro camino',
  title: 'Historia',
  lead: 'Una congregación que creció desde San Miguel hacia el resto del país.',

  parrafos: [
    'La Casa de Dios es una congregación evangélica chilena cuya iglesia matriz se encuentra en San Miguel. Desde allí la comunidad se ha extendido a Santiago Centro, Limache y Coya, donde hoy funcionan templos con vida propia, cultos semanales y equipos de servicio.',
    'A lo largo de los años el fundamento se ha mantenido igual: la Palabra de Dios como máxima autoridad en la fe y en la práctica. Cada templo sostiene cultos generales, estudios bíblicos, discipulado y reuniones de jóvenes, sirviendo a su barrio y acompañando a las familias que lo componen.',
  ],

  imagen: 'biblia' as ImgKey,

  /**
   * Línea de tiempo. Vacía hasta contar con las fechas reales.
   * Ejemplo del formato esperado:
   *   { year: '1998', title: 'Nace la congregación', text: 'Primeras reuniones en San Miguel.', templo: 'san-miguel' },
   */
  hitos: [] as Hito[],
};
