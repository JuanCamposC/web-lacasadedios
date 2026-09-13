import { describe, it, expect } from 'vitest';
import {
  hoyEnChile,
  porDia,
  vigente,
  enPie,
  proximaReunion,
  momentoEnChile,
  type FilaReunion,
} from './reuniones';

const base: FilaReunion = {
  id: 'r1',
  templo: 'coya',
  dia: 4,
  hora: '20:00',
  nombre: 'Culto General',
  estado: 'normal',
  aviso: null,
  aviso_hasta: null,
};

describe('vigente', () => {
  it('una suspensión con fecha se ve hasta ese día inclusive', () => {
    const fila = {
      ...base,
      estado: 'suspendida' as const,
      aviso: 'Por feriado',
      aviso_hasta: '2026-09-17',
    };
    expect(vigente(fila, '2026-09-17').estado).toBe('suspendida');
    expect(vigente(fila, '2026-09-17').aviso).toBe('Por feriado');
  });

  it('al día siguiente la reunión vuelve SOLA a la normalidad', () => {
    // El caso que esto evita: se suspende la reunión de esta semana, nadie la
    // vuelve a encender, y durante meses la web dice que no hay culto.
    const fila = {
      ...base,
      estado: 'suspendida' as const,
      aviso: 'Por feriado',
      aviso_hasta: '2026-09-17',
    };
    const r = vigente(fila, '2026-09-18');
    expect(r.estado).toBe('normal');
    expect(r.aviso).toBeNull();
  });

  it('sin fecha, el aviso dura hasta que alguien lo quite', () => {
    const fila = { ...base, estado: 'cambiada' as const, aviso: 'Ahora a las 19:00' };
    expect(vigente(fila, '2030-01-01').estado).toBe('cambiada');
  });

  it('una reunión normal no arrastra un aviso viejo', () => {
    const fila = { ...base, aviso: 'Se suspende por el 18' };
    expect(vigente(fila, '2026-09-10').aviso).toBeNull();
  });

  it('un aviso en blanco no se enseña como aviso', () => {
    const fila = { ...base, estado: 'suspendida' as const, aviso: '   ' };
    expect(vigente(fila, '2026-09-10').aviso).toBeNull();
  });
});

describe('porDia', () => {
  it('va de domingo a sábado, sin días vacíos, cada día por hora', () => {
    const r = (dia: number, hora: string) =>
      vigente({ ...base, id: `${dia}-${hora}`, dia, hora }, '2026-01-01');
    const semana = porDia([r(6, '19:00'), r(0, '19:00'), r(0, '10:30'), r(1, '20:00')]);
    expect(semana.map((d) => d.nombre)).toEqual(['Domingo', 'Lunes', 'Sábado']);
    expect(semana[0].reuniones.map((x) => x.hora)).toEqual(['10:30', '19:00']);
  });
});

describe('enPie', () => {
  it('no cuenta las suspendidas', () => {
    const lista = [
      vigente(base, '2026-01-01'),
      vigente({ ...base, id: 'r2', estado: 'suspendida' }, '2026-01-01'),
      vigente({ ...base, id: 'r3', estado: 'cambiada' }, '2026-01-01'),
    ];
    expect(enPie(lista)).toBe(2);
  });
});

describe('hoyEnChile', () => {
  it('pasada la medianoche en UTC, en Chile sigue siendo el día anterior', () => {
    // 02:00 UTC del 18 son las 23:00 del 17 en Santiago. Si esto usara la
    // fecha UTC, una suspensión «hasta el 17» se apagaría tres horas antes de
    // que termine el día en la iglesia.
    expect(hoyEnChile(new Date('2026-09-18T02:00:00Z'))).toBe('2026-09-17');
  });
});

describe('proximaReunion', () => {
  const r = (id: string, dia: number, hora: string, estado: FilaReunion['estado'] = 'normal') =>
    vigente(
      { ...base, id, dia, hora, estado, aviso: estado === 'normal' ? null : 'Aviso' },
      '2026-01-01',
    );
  // Jueves 20:00 y domingo 11:00.
  const semana = [r('jue', 4, '20:00'), r('dom', 0, '11:00')];

  it('una reunión de más tarde hoy es «Hoy»', () => {
    const p = proximaReunion(semana, { dia: 4, minutos: 18 * 60 });
    expect(p.reunion?.id).toBe('jue');
    expect(p.cuando).toBe('Hoy');
  });

  it('una que empieza justo ahora sigue siendo la próxima', () => {
    expect(proximaReunion(semana, { dia: 4, minutos: 20 * 60 }).reunion?.id).toBe('jue');
  });

  it('pasada la hora, salta a la siguiente y da la vuelta a la semana', () => {
    const p = proximaReunion(semana, { dia: 4, minutos: 20 * 60 + 1 });
    expect(p.reunion?.id).toBe('dom');
    expect(p.cuando).toBe('Domingo');
  });

  it('el sábado de noche, el domingo por la mañana es «Mañana»', () => {
    expect(proximaReunion(semana, { dia: 6, minutos: 23 * 60 }).cuando).toBe('Mañana');
  });

  it('la misma reunión, ya pasada hoy, se anuncia por su día y no como «Hoy»', () => {
    const p = proximaReunion([r('jue', 4, '20:00')], { dia: 4, minutos: 21 * 60 });
    expect(p.cuando).toBe('Jueves');
  });

  it('una suspendida no es la próxima, pero se informa', () => {
    const p = proximaReunion([r('jue', 4, '20:00', 'suspendida'), r('dom', 0, '11:00')], {
      dia: 4,
      minutos: 18 * 60,
    });
    expect(p.reunion?.id).toBe('dom');
    expect(p.suspendidas.map((x) => x.id)).toEqual(['jue']);
  });

  it('una suspendida DESPUÉS de la próxima no se menciona todavía', () => {
    const p = proximaReunion([r('jue', 4, '20:00'), r('dom', 0, '11:00', 'suspendida')], {
      dia: 4,
      minutos: 18 * 60,
    });
    expect(p.suspendidas).toEqual([]);
  });

  it('sin reuniones que se hagan, no inventa ninguna', () => {
    expect(
      proximaReunion([r('jue', 4, '20:00', 'suspendida')], { dia: 1, minutos: 0 }).reunion,
    ).toBeNull();
    expect(proximaReunion([], { dia: 1, minutos: 0 }).reunion).toBeNull();
  });
});

describe('momentoEnChile', () => {
  it('usa el reloj de Santiago y no el UTC', () => {
    // Viernes 02:30 UTC = jueves 23:30 en Chile (invierno, UTC−4).
    expect(momentoEnChile(new Date('2026-07-17T03:30:00Z'))).toEqual({
      dia: 4,
      minutos: 23 * 60 + 30,
    });
  });
});
