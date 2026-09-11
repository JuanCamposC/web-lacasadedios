/**
 * Los textos del estudio bíblico.
 *
 * ── PARA QUIÉN ES ESTE ARCHIVO ──────────────────────────────────────────────
 * Está aparte de la página a propósito: cambiar lo que dice el estudio no
 * debería obligar a abrir un archivo lleno de etiquetas. Acá solo hay frases.
 * Se cambian entre las comillas y listo.
 *
 * PENDIENTE DE REVISIÓN DEL PASTOR. Lo que sigue está escrito para que la
 * página se pueda ver y leer completa, no para quedarse. En particular `SERIE`
 * describe un recorrido genérico por los fundamentos de la fe; el estudio real
 * que se esté dando ahora lo tiene que decir él.
 */

export const ESTUDIO = {
  eyebrow: 'Conociendo la Palabra',
  titulo: 'Estudio bíblico',
  bajada: 'Cada lunes, en los cuatro templos, abrimos juntos la Palabra de Dios.',

  /**
   * Por qué el estudio importa, en tres párrafos.
   *
   * Es lo primero que lee quien nunca ha venido. La pregunta que responde no es
   * «qué día es» sino «esto para qué me sirve a mí».
   */
  introduccion: [
    'El estudio bíblico es el corazón de la semana en La Casa de Dios. No es una clase ni una conferencia: es la congregación sentada alrededor de un pasaje, leyéndolo despacio, preguntando lo que no se entiende y buscando juntos qué nos pide hoy.',
    'Creemos en la Palabra de Dios como máxima autoridad en nuestra fe y en nuestra práctica. Por eso no damos por sabido lo que dice: lo leemos, lo comparamos con el resto de la Escritura y lo llevamos a la vida de cada día, al trabajo, a la familia y a las decisiones que cuestan.',
    'No hace falta saber nada de antemano ni traer nada más que una Biblia —y si no la tienes, te prestamos una—. Vienen hermanos que llevan cuarenta años en la fe y personas que abren la Biblia por primera vez, y la conversación es la misma para todos.',
  ],

  /**
   * Lo que se está estudiando ahora.
   *
   * Si el feed de RSS.com trae una descripción del programa, la página usa esa
   * en vez de esta: así basta con escribirlo una vez, en RSS.com, y no hay dos
   * textos que puedan contradecirse. Esto es el respaldo.
   */
  serie: {
    titulo: 'Lo que estamos estudiando',
    texto:
      'Estamos recorriendo los fundamentos de la fe cristiana: quién es Dios, quién es Jesucristo y qué significa seguirle. Cada encuentro toma un pasaje completo, lo sitúa en su contexto y termina con una pregunta concreta para la semana. Los encuentros son independientes entre sí, así que se puede entrar en cualquier momento sin haber estado en los anteriores.',
  },

  /** Qué se encuentra quien llega por primera vez, en cuatro líneas. */
  queEsperar: [
    {
      icon: 'lucide:book-open',
      titulo: 'Un pasaje por encuentro',
      texto: 'Se lee completo y en voz alta antes de comentar nada.',
    },
    {
      icon: 'lucide:messages-square',
      titulo: 'Se pregunta',
      texto: 'No hay pregunta tonta ni obligación de hablar. Se puede solo escuchar.',
    },
    {
      icon: 'lucide:clock',
      titulo: 'Alrededor de una hora',
      texto: 'Empieza y termina a la hora, porque al día siguiente casi todos trabajan.',
    },
    {
      icon: 'lucide:headphones',
      titulo: 'Queda grabado',
      texto: 'Si no pudiste venir, el audio queda publicado para escucharlo después.',
    },
  ],

  /** Cómo se pide el enlace de Zoom, y por qué no está publicado. */
  zoom: {
    titulo: 'Participar por Zoom',
    texto:
      'En Santiago Centro, Limache y Coya el estudio se hace por Zoom. El enlace no se publica en internet: se solicita al pastor del templo más cercano, que lo hace llegar personalmente.',
    porQue:
      'Lo hacemos así para cuidar el encuentro. Un enlace abierto en la red permite que entre cualquiera a interrumpir, y en el estudio se comparten cosas personales y se ora por situaciones de familia. Escribir un mensaje toma un minuto y se responde el mismo día.',
  },

  /** Encabezado de la lista de audios. */
  audios: {
    titulo: 'Escucha los estudios',
    texto:
      'Cada estudio queda grabado y publicado acá. También se puede seguir desde Spotify, Apple Podcasts o cualquier aplicación de podcast buscando el nombre del programa.',
  },
} as const;
