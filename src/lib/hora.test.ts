import { describe, it, expect } from 'vitest';
import {
  deChileAIso,
  deIsoAChile,
  desfaseChile,
  fechaLarga,
  horaCorta,
  horaDeTermino,
  minutosEntre,
} from './hora';

/**
 * Lo que se vigila acá es el error que ya ocurrió: se escribieron las 19:00 y
 * la web publicó otra hora.
 *
 * Ninguna de estas pruebas comprueba que «Intl funcione». Comprueban la regla
 * del proyecto: **lo que se escribe es hora de Chile y lo que se lee también**,
 * corra donde corra. Da igual el huso de la máquina que ejecute las pruebas,
 * porque en ningún sitio se usa el huso local.
 */

describe('desfaseChile', () => {
  it('conoce el horario de verano y el de invierno', () => {
    // Chile adelanta la hora en primavera austral. En septiembre va a −3; en
    // pleno invierno, a −4. Los números NO están escritos a mano en el código:
    // salen de Intl, y esta prueba es la que avisaría si dejaran de salir.
    expect(desfaseChile(new Date('2026-09-26T22:00:00Z'))).toBe(-180);
    expect(desfaseChile(new Date('2026-07-15T12:00:00Z'))).toBe(-240);
  });
});

describe('deChileAIso', () => {
  it('las 19:00 escritas en el panel son las 19:00 en Chile', () => {
    // EL CASO QUE FALLABA. Antes esto dependía del reloj del navegador de quien
    // administra: desde Santiago guardaba 22:00Z y desde un portátil en UTC
    // guardaba 19:00Z, y la web mostraba cosas distintas.
    expect(deChileAIso('2026-09-26T19:00')).toBe('2026-09-26T22:00:00.000Z');
  });

  it('también en invierno, cuando el desfase es otro', () => {
    expect(deChileAIso('2026-07-15T19:00')).toBe('2026-07-15T23:00:00.000Z');
  });

  it('ida y vuelta sin que la hora se corra', () => {
    // Abrir un evento para editarlo y guardarlo sin tocar nada NO puede moverlo.
    for (const escrito of [
      '2026-01-05T08:30',
      '2026-06-30T23:45',
      '2026-09-26T19:00',
      '2026-12-24T00:00',
    ]) {
      expect(deIsoAChile(deChileAIso(escrito)!)).toBe(escrito);
    }
  });

  it('devuelve null si el texto no sirve, en vez de inventar una fecha', () => {
    expect(deChileAIso('')).toBeNull();
    expect(deChileAIso('mañana a las ocho')).toBeNull();
    expect(deChileAIso('26-09-2026 19:00')).toBeNull();
  });
});

describe('deIsoAChile', () => {
  it('trae el instante guardado de vuelta a hora de Chile', () => {
    expect(deIsoAChile('2026-09-26T22:00:00.000Z')).toBe('2026-09-26T19:00');
  });

  it('cadena vacía si la fecha guardada es ilegible', () => {
    expect(deIsoAChile('no es una fecha')).toBe('');
  });
});

describe('formatos', () => {
  it('el reloj es de 24 horas, como el resto del sitio', () => {
    // `es-CL` va en 12 horas por configuración, así que sin pedirlo esto decía
    // «7:00 p. m.» mientras el cartel de horarios escribe «20:00». Dos formas
    // de decir la misma hora en la misma página obligan a traducir.
    expect(horaCorta('2026-09-26T22:00:00.000Z')).not.toMatch(/m\./);
    expect(horaCorta('2026-09-26T14:30:00.000Z')).toBe('11:30');
  });

  it('muestran hora de Chile, no la del servidor', () => {
    // El Worker corre en UTC. Sin fijar el huso, esto diría «22:00» y «27 de
    // septiembre»: un día de más y tres horas de más.
    const instante = '2026-09-26T22:00:00.000Z';
    expect(horaCorta(instante)).toBe('19:00');
    expect(fechaLarga(instante)).toContain('26 de septiembre');
  });

  it('un evento de madrugada no se adelanta un día', () => {
    // 02:00Z del día 27 son las 23:00 del 26 en Chile. Es el caso en que
    // olvidar el huso cambia la FECHA y no solo la hora.
    const instante = '2026-09-27T02:00:00.000Z';
    expect(fechaLarga(instante)).toContain('26 de septiembre');
    expect(horaCorta(instante)).toBe('23:00');
  });
});

/**
 * La duración de un evento, preguntada como «¿a qué hora termina?».
 *
 * La columna guarda MINUTOS y el panel preguntaba por minutos: la ayuda decía
 * literalmente «Un congreso de 9:00 a 18:00 son 540», o sea le pedía una
 * multiplicación a quien carga un evento desde el teléfono. Ahora el formulario
 * pregunta la hora y la cuenta la hace esto.
 *
 * Se prueba porque es la única cuenta nueva del panel cuyo resultado no se ve
 * en pantalla hasta que el evento ya está publicado: si se equivocara, el sitio
 * anunciaría una hora de término inventada y nadie lo notaría al guardar.
 */
describe('minutosEntre', () => {
  it('el congreso de 09:00 a 18:00 son nueve horas', () => {
    expect(minutosEntre('2026-11-07T09:00', '18:00')).toBe(540);
  });

  it('cuenta los minutos sueltos', () => {
    expect(minutosEntre('2026-11-07T19:30', '21:45')).toBe(135);
  });

  /**
   * Una vigilia de 22:00 a 01:00 dura TRES horas, no menos veintiuna.
   *
   * Sin esta vuelta, la resta daría -1260 y la base lo rechazaría por su
   * `check`; y pedirle a quien la carga que escriba la fecha del día siguiente
   * sería devolverle la cuenta que este campo venía a quitarle.
   */
  it('entiende que pasada la medianoche es el día siguiente', () => {
    expect(minutosEntre('2026-12-31T22:00', '01:00')).toBe(180);
  });

  /**
   * Nulo y no cero: en esta columna nulo significa «la duración de siempre», y
   * cero no existe —lo rechaza el `check` de la migración 0012 con un mensaje
   * que no le dice nada a nadie—.
   */
  it('la misma hora de inicio y de término es «la de siempre»', () => {
    expect(minutosEntre('2026-11-07T09:00', '09:00')).toBeNull();
  });

  it('sin hora de término no hay duración', () => {
    expect(minutosEntre('2026-11-07T09:00', '')).toBeNull();
  });

  it('sin fecha de inicio tampoco', () => {
    expect(minutosEntre('', '18:00')).toBeNull();
  });

  it('rechaza una hora imposible en vez de inventar un número', () => {
    expect(minutosEntre('2026-11-07T09:00', '25:00')).toBeNull();
    expect(minutosEntre('2026-11-07T09:00', '18:70')).toBeNull();
    expect(minutosEntre('2026-11-07T09:00', '8pm')).toBeNull();
  });
});

/** La cuenta inversa: lo que el formulario enseña al abrir un evento guardado. */
describe('horaDeTermino', () => {
  it('devuelve la hora a la que termina, en hora de Chile', () => {
    // El evento guardado está en UTC; 12:00Z son las 09:00 en Santiago.
    expect(horaDeTermino('2026-11-07T12:00:00Z', 540)).toBe('18:00');
  });

  it('da la vuelta exacta de minutosEntre', () => {
    const inicio = '2026-11-07T12:00:00Z';
    const minutos = minutosEntre(deIsoAChile(inicio), '18:00');
    expect(horaDeTermino(inicio, minutos)).toBe('18:00');
  });

  it('sin duración no enseña nada, en vez de enseñar la hora de inicio', () => {
    expect(horaDeTermino('2026-11-07T12:00:00Z', null)).toBe('');
    expect(horaDeTermino('2026-11-07T12:00:00Z', 0)).toBe('');
    expect(horaDeTermino(null, 540)).toBe('');
  });
});
