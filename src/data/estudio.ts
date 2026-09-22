/**
 * Los textos del estudio bíblico.
 *
 * ── PARA QUIÉN ES ESTE ARCHIVO ──────────────────────────────────────────────
 * Está aparte de la página a propósito: cambiar lo que dice el estudio no
 * debería obligar a abrir un archivo lleno de etiquetas. Acá solo hay frases.
 * Se cambian entre las comillas y listo.
 *
 * ── QUÉ SALE DE ACÁ Y QUÉ DE RSS.COM ────────────────────────────────────────
 * El NOMBRE del programa sale de acá: en RSS.com está registrado como
 * «Instituto Bíblico» a secas, y el nombre de verdad es «Instituto Bíblico
 * Bet-El».
 *
 * La DESCRIPCIÓN de lo que se está estudiando sale de RSS.com, y solo de ahí.
 * Así se pidió: quien sube los audios la escribe una vez y la página la enseña
 * tal cual, sin un texto de respaldo inventado que pudiera quedar a la vista.
 *
 * PENDIENTE DE REVISIÓN DEL PASTOR: `introduccion` y `queEsperar`.
 */

export const ESTUDIO = {
  eyebrow: 'Conociendo la Palabra',

  /**
   * El nombre propio, que es como se llama de verdad.
   *
   * Antes el título decía «Estudio bíblico» y el nombre real vivía en un
   * campo aparte, así que el sitio hablaba de dos cosas que eran una sola.
   * Ahora el nombre manda, y «estudio bíblico» queda como lo que es: la
   * descripción de lo que se hace ahí.
   */
  titulo: 'Instituto Bíblico Bet-El',
  /** Para cuando el nombre entero no cabe: menú, migas, botones. */
  corto: 'Instituto Bíblico',
  bajada:
    'El estudio bíblico de La Casa de Dios: todos los lunes, en los cuatro templos, abrimos juntos la Palabra de Dios.',

  /** @deprecated Usa `titulo`. Se conserva para no romper importaciones. */
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

  /** Qué se encuentra quien llega por primera vez, en cuatro líneas. */
  queEsperar: [
    {
      icon: 'lucide:book-open',
      titulo: 'Un libro completo por semestre',
      texto: 'Cada semestre se estudia un libro de la Biblia de principio a fin.',
    },
    {
      icon: 'lucide:messages-square',
      titulo: 'Se puede preguntar',
      texto: 'Durante el estudio hay espacio para hacer preguntas.',
    },
    {
      icon: 'lucide:headphones',
      titulo: 'Queda grabado',
      texto: 'Si no pudiste venir, el audio queda publicado para escucharlo después.',
    },
  ],

  /** Cómo se participa, resumido. Los detalles de cada templo están en su página. */
  participar: {
    /*
     * Estos dos textos NO repiten lo que ya dice la tarjeta.
     *
     * La etiqueta de arriba dice «Presencial» o «Por Zoom», el título dice de
     * qué templos hablamos y la línea del horario dice cuándo. Antes cada texto
     * empezaba repitiendo las tres cosas —«En San Miguel el estudio es
     * presencial», «En Santiago Centro, Limache y Coya es por Zoom»—, así que
     * la tarjeta decía lo mismo tres veces antes de llegar a lo único que la
     * persona no podía adivinar: si hay que avisar, y cómo se consigue el
     * enlace. Eso es lo que queda.
     */
    presencial: 'No hace falta avisar ni inscribirse: se llega y se entra.',
    zoom: 'El enlace no se publica: se pide al pastor del templo, que lo hace llegar personalmente.',
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
    texto: 'Cada estudio queda grabado y publicado acá, para escucharlo cuando quieras.',
  },
} as const;
