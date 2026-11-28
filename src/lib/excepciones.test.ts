import { describe, it, expect } from 'vitest';
import {
  enFecha,
  finDeSemana,
  semanaConExcepciones,
  type Excepcion,
  type FilaReunion,
} from './reuniones';
import { reunionesEnFecha } from './calendario';
import { construirIcs, enlaceGoogleCalendar } from './ics';

/**
 * Los cambios de un día (d1/0016), con los casos reales de diciembre de 2026
 * que obligaron a crearlos: San Miguel suspende el jueves 24 y nada más que el
 * 24; Limache pasa la Reunión General al miércoles y el miércoles deja de ser
 * de Jóvenes.
 */

const fila = (extra: Partial<FilaReunion>): FilaReunion => ({
  id: 'r',
  templo: 'san-miguel',
  dia: 4,
  hora: '20:00',
  nombre: 'Reunión General',
  estado: 'normal',
  aviso: null,
  aviso_hasta: null,
  hora_aviso: null,
  marca: null,
  marca_regla: null,
  ...extra,
});

const exc = (extra: Partial<Excepcion>): Excepcion => ({
  id: 'e',
  reunion_id: 'r',
  fecha: '2026-12-24',
  estado: 'suspendida',
  hora: null,
  nombre: null,
  aviso: null,
  ...extra,
});

describe('enFecha', () => {
  const jueves = fila({});
  const navidad = exc({ aviso: 'Reunión en familia, en cada casa' });

  it('suspende la reunión en su fecha…', () => {
    const r = enFecha(jueves, '2026-12-24', [navidad]);
    expect(r.estado).toBe('suspendida');
    expect(r.aviso).toBe('Reunión en familia, en cada casa');
  });

  /** El fallo que esto arregla: con `aviso_hasta` caían también el 3, 10 y 17. */
  it('…y en ninguna otra', () => {
    for (const fecha of ['2026-12-03', '2026-12-10', '2026-12-17', '2026-12-31']) {
      expect(enFecha(jueves, fecha, [navidad]).estado).toBe('normal');
    }
  });

  it('no se aplica a otra reunión del mismo día', () => {
    const otra = fila({ id: 'otra' });
    expect(enFecha(otra, '2026-12-24', [navidad]).estado).toBe('normal');
  });

  it('cambia la hora y deja la de siempre a mano', () => {
    const sabado = fila({ id: 's', dia: 6, hora: '19:00' });
    const r = enFecha(sabado, '2026-12-05', [
      exc({ reunion_id: 's', fecha: '2026-12-05', estado: 'cambiada', hora: '20:00' }),
    ]);
    expect(r.estado).toBe('cambiada');
    expect(r.hora).toBe('20:00');
    expect(r.horaHabitual).toBe('19:00');
  });

  it('cambia el nombre sin tocar la hora', () => {
    const miercoles = fila({ id: 'm', dia: 3, nombre: 'Reunión de Jóvenes y Preadolescentes' });
    const r = enFecha(miercoles, '2026-12-23', [
      exc({ reunion_id: 'm', fecha: '2026-12-23', estado: 'cambiada', nombre: 'Reunión General' }),
    ]);
    expect(r.nombre).toBe('Reunión General');
    expect(r.hora).toBe('20:00');
    expect(r.horaHabitual).toBeNull();
  });

  it('una suspendida no lleva hora nueva aunque se haya escrito', () => {
    const r = enFecha(jueves, '2026-12-24', [exc({ hora: '18:00' })]);
    expect(r.hora).toBe('20:00');
    expect(r.horaHabitual).toBeNull();
  });

  /** La Santa Cena de Limache del 5 de diciembre se celebra a las 20:00. */
  it('conserva la marca de la fecha cuando solo cambia la hora', () => {
    const sabado = fila({
      id: 's',
      dia: 6,
      hora: '19:00',
      marca: 'Santa Cena',
      marca_regla: 'primer-par',
    });
    const r = enFecha(sabado, '2026-12-05', [
      exc({ reunion_id: 's', fecha: '2026-12-05', estado: 'cambiada', hora: '20:00' }),
    ]);
    expect(r.marca).toBe('Santa Cena');
  });

  it('una suspendida no anuncia su marca', () => {
    const domingo = fila({ dia: 0, marca: 'Santa Cena', marca_regla: 'siempre' });
    const r = enFecha(domingo, '2026-12-20', [exc({ fecha: '2026-12-20' })]);
    expect(r.marca).toBeNull();
  });

  it('gana a un aviso con fecha de término que cubre el mismo día', () => {
    const cambiada = fila({
      estado: 'cambiada',
      hora_aviso: '19:00',
      aviso_hasta: '2026-12-31',
    });
    const r = enFecha(cambiada, '2026-12-24', [navidad]);
    expect(r.estado).toBe('suspendida');
    expect(r.hora).toBe('20:00');
  });
});

describe('semanaConExcepciones', () => {
  const jueves = fila({});

  it('aplica el cambio cuando su fecha es la próxima vez que toca', () => {
    // Lunes 21: el jueves que viene es el 24.
    const [r] = semanaConExcepciones([jueves], '2026-12-21', [exc({})]);
    expect(r.estado).toBe('suspendida');
  });

  it('no lo aplica antes de su semana', () => {
    // Lunes 14: el próximo jueves es el 17, no el 24.
    const [r] = semanaConExcepciones([jueves], '2026-12-14', [exc({})]);
    expect(r.estado).toBe('normal');
  });

  it('sin excepción respeta el aviso de la fila como siempre', () => {
    const conAviso = fila({ estado: 'suspendida', aviso_hasta: '2026-12-15' });
    // Lunes 14: el aviso llega hasta el martes 15, y se sigue viendo.
    const [r] = semanaConExcepciones([conAviso], '2026-12-14', []);
    expect(r.estado).toBe('suspendida');
  });

  it('la semana va de hoy a hoy + 6', () => {
    expect(finDeSemana('2026-12-28')).toBe('2027-01-03');
  });
});

describe('reunionesEnFecha con excepciones', () => {
  it('pinta el cambio en el calendario en su día', () => {
    const [r] = reunionesEnFecha([fila({})], '2026-12-24', [exc({})], '2026-11-28');
    expect(r.estado).toBe('suspendida');
  });

  /**
   * Un aviso de la fila significa «desde AHORA». Pintarlo en un jueves que ya
   * pasó sería decir que ese día no hubo reunión, y sí la hubo.
   */
  it('no pinta el aviso de la fila en días pasados', () => {
    const suspendida = fila({ estado: 'suspendida', aviso_hasta: '2026-12-03' });
    const [antes] = reunionesEnFecha([suspendida], '2026-11-19', [], '2026-11-28');
    const [despues] = reunionesEnFecha([suspendida], '2026-12-03', [], '2026-11-28');
    expect(antes.estado).toBe('normal');
    expect(despues.estado).toBe('suspendida');
  });

  it('sí pinta un cambio de un día aunque sea pasado: eso sí ocurrió', () => {
    const [r] = reunionesEnFecha(
      [fila({})],
      '2026-11-19',
      [exc({ fecha: '2026-11-19' })],
      '2026-11-28',
    );
    expect(r.estado).toBe('suspendida');
  });
});

describe('evento de día completo', () => {
  // 9 de enero de 2027, guardado a mediodía de Chile (15:00 UTC en verano).
  const bautismo = {
    id: 'b',
    titulo: 'Salida congregacional y bautismo',
    inicio: '2027-01-09T15:00:00Z',
    url: 'https://lacasadedios.cl/eventos?e=b',
    todoElDia: true,
  };

  it('el .ics lo agenda como día completo, sin hora', () => {
    const ics = construirIcs(bautismo, new Date('2026-11-28T00:00:00Z'));
    expect(ics).toContain('DTSTART;VALUE=DATE:20270109');
    expect(ics).toContain('DTEND;VALUE=DATE:20270110');
    expect(ics).not.toMatch(/DTSTART:\d/);
  });

  it('Google recibe las dos fechas sin hora, terminando al día siguiente', () => {
    const url = new URL(enlaceGoogleCalendar(bautismo));
    expect(url.searchParams.get('dates')).toBe('20270109/20270110');
  });

  /** Guardado a las 23:30 de Chile, en UTC ya es el 10: el día es el de Chile. */
  it('toma el día de Chile, no el de UTC', () => {
    const tarde = { ...bautismo, inicio: '2027-01-10T02:30:00Z' };
    expect(construirIcs(tarde)).toContain('DTSTART;VALUE=DATE:20270109');
  });

  it('sin la marca sigue agendándose con hora', () => {
    const ics = construirIcs({ ...bautismo, todoElDia: false });
    expect(ics).toContain('DTSTART:20270109T150000Z');
  });
});
