import { describe, it, expect } from 'vitest';
import { hoyEnChile, porDia, vigente, enPie, type FilaReunion } from './reuniones';

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
