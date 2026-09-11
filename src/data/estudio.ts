/**
 * Los textos del estudio bíblico.
 *
 * ── PARA QUIÉN ES ESTE ARCHIVO ──────────────────────────────────────────────
 * Está aparte de la página a propósito: cambiar lo que dice el estudio no
 * debería obligar a abrir un archivo lleno de etiquetas. Acá solo hay frases.
 * Se cambian entre las comillas y listo.
 *
 * ── POR QUÉ EL NOMBRE Y LA DESCRIPCIÓN NO SALEN DEL FEED ────────────────────
 * Antes la página tomaba el título y la descripción de RSS.com, para no
 * escribirlos dos veces. Duró lo que tardó en haber un feed de verdad: el
 * programa está registrado como «Instituto Bíblico» a secas y su descripción
 * traía una falta de ortografía, y las dos cosas aparecieron tal cual en la web
 * de la iglesia sin que nadie las hubiera aprobado.
 *
 * Así que mandan estos textos. Lo que RSS.com diga sigue importando —es lo que
 * ve quien llega por Spotify o Apple Podcasts—, pero eso se arregla allá.
 *
 * PENDIENTE DE REVISIÓN DEL PASTOR: `introduccion`, `serie` y `queEsperar`.
 */

export const ESTUDIO = {
  eyebrow: 'Conociendo la Palabra',
  titulo: 'Estudio bíblico',
  bajada: 'Todos los lunes, en los cuatro templos, abrimos juntos la Palabra de Dios.',

  /** El nombre del programa, tal como debe leerse. */
  programa: 'Instituto Bíblico Bet-El',

  /** Cuándo se reúne. Uno solo porque los cuatro templos coinciden. */
  cuando: 'Todos los lunes',

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

  /** Lo que se está estudiando ahora. */
  serie: {
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

  /** Cómo se participa, resumido. Los detalles de cada templo están en su página. */
  participar: {
    presencial: 'En San Miguel el estudio es presencial. No hace falta avisar ni inscribirse.',
    zoom: 'En Santiago Centro, Limache y Coya es por Zoom. El enlace no se publica: se pide al pastor del templo, que lo hace llegar personalmente.',
    /**
     * Por qué el enlace no está publicado.
     *
     * Va escrito en la página y no solo en el código: quien lo lee entiende que
     * es cuidado y no burocracia, y así nadie «ayuda» pegando el enlace en un
     * grupo de WhatsApp.
     */
    porQue:
      'Un enlace abierto en internet permite que entre cualquiera a interrumpir, y en el estudio se comparten cosas personales y se ora por situaciones de familia.',
  },

  /** Encabezado de la lista de audios. */
  audios: {
    titulo: 'Audios y recursos',
    texto:
      'Cada estudio queda grabado y publicado acá. También se puede seguir desde Spotify, Apple Podcasts o cualquier aplicación de podcast buscando el nombre del programa.',
  },
} as const;
