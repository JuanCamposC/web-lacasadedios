import { describe, it, expect } from 'vitest';
import {
  hoyEnChile,
  porDia,
  vigente,
  enPie,
  proximaReunion,
  momentoEnChile,
  proximaFecha,
  tocaMarca,
  reglaEnPalabras,
  proximaVezConMarca,
  fechaEnPalabras,
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
  marca: null,
  marca_regla: null,
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

describe('proximaReunion · en curso', () => {
  const r = (id: string, dia: number, hora: string, estado: FilaReunion['estado'] = 'normal') =>
    vigente(
      { ...base, id, dia, hora, estado, aviso: estado === 'normal' ? null : 'Aviso' },
      '2026-01-01',
    );
  const semana = [r('jue', 4, '20:00'), r('dom', 0, '11:00')];

  it('media hora después de empezar, la reunión está EN CURSO', () => {
    const p = proximaReunion(semana, { dia: 4, minutos: 20 * 60 + 30 });
    expect(p.enCurso?.id).toBe('jue');
    expect(p.llevaMinutos).toBe(30);
  });

  it('pasadas las dos horas ya no está en curso', () => {
    const p = proximaReunion(semana, { dia: 4, minutos: 22 * 60 + 1 });
    expect(p.enCurso).toBeNull();
  });

  it('antes de empezar no hay nada en curso', () => {
    expect(proximaReunion(semana, { dia: 4, minutos: 19 * 60 }).enCurso).toBeNull();
  });

  it('mientras una está en curso, la próxima sigue siendo la siguiente', () => {
    // Las dos cosas a la vez: «esto está pasando» y «lo que viene después».
    const p = proximaReunion(semana, { dia: 4, minutos: 20 * 60 + 30 });
    expect(p.enCurso?.id).toBe('jue');
    expect(p.reunion?.id).toBe('dom');
  });

  it('una suspendida nunca está en curso', () => {
    const p = proximaReunion([r('jue', 4, '20:00', 'suspendida'), r('dom', 0, '11:00')], {
      dia: 4,
      minutos: 20 * 60 + 30,
    });
    expect(p.enCurso).toBeNull();
  });

  it('una que empezó anoche y cruzó la medianoche sigue en curso', () => {
    // El caso que rompe una resta ingenua: son las 00:30 del lunes y la
    // reunión empezó el domingo a las 23:00.
    const p = proximaReunion([r('dom', 0, '23:00')], { dia: 1, minutos: 30 });
    expect(p.enCurso?.id).toBe('dom');
    expect(p.llevaMinutos).toBe(90);
  });
});

/**
 * La regla de las marcas: lo que se repite solo, sin que nadie se acuerde.
 *
 * Estas pruebas son el motivo de que la regla viva acá y no en una consulta: se
 * puede recorrer tres años de calendario en milisegundos y comprobar que «el
 * primer domingo de los meses pares» cae donde tiene que caer, incluidos los
 * meses que empiezan en domingo, que son los que rompen la intuición.
 */
describe('proximaFecha', () => {
  it('cuenta HOY como la próxima vez', () => {
    // 4 de octubre de 2026 es domingo.
    expect(proximaFecha(0, '2026-10-04')).toBe('2026-10-04');
  });

  it('salta al día que viene dentro de la misma semana', () => {
    // Viernes 2 → sábado 3.
    expect(proximaFecha(6, '2026-10-02')).toBe('2026-10-03');
  });

  it('da la vuelta al cambiar de mes', () => {
    // Lunes 28 de septiembre → domingo 4 de octubre.
    expect(proximaFecha(0, '2026-09-28')).toBe('2026-10-04');
  });
});

describe('tocaMarca', () => {
  it('«primer-par» es el primer día del mes en meses pares', () => {
    expect(tocaMarca('primer-par', '2026-10-04')).toBe(true); // 1er domingo de octubre
    expect(tocaMarca('primer-par', '2026-10-03')).toBe(true); // 1er sábado de octubre
    expect(tocaMarca('primer-par', '2026-10-11')).toBe(false); // 2º domingo
    expect(tocaMarca('primer-par', '2026-11-01')).toBe(false); // noviembre es impar
  });

  it('un día 8 nunca es el primero de su semana', () => {
    // El límite exacto: en siete días consecutivos cada día de la semana sale
    // una vez, así que «del 1 al 7» y «el primero» son lo mismo.
    expect(tocaMarca('primer', '2026-08-07')).toBe(true);
    expect(tocaMarca('primer', '2026-08-08')).toBe(false);
  });

  it('acierta cuando el mes empieza en domingo', () => {
    // Agosto de 2027 empieza en domingo: el 1 es el primer domingo y el 7 el
    // primer sábado. Son fines de semana distintos, y es a propósito.
    expect(tocaMarca('primer', '2027-08-01')).toBe(true);
    expect(tocaMarca('primer', '2027-08-07')).toBe(true);
    expect(tocaMarca('primer', '2027-08-08')).toBe(false);
  });

  it('«ultimo» cubre los últimos siete días, con mes corto o largo', () => {
    expect(tocaMarca('ultimo', '2026-10-25')).toBe(true); // domingo, quedan 6 días
    expect(tocaMarca('ultimo', '2026-10-18')).toBe(false);
    expect(tocaMarca('ultimo', '2027-02-22')).toBe(true); // febrero de 28
    expect(tocaMarca('ultimo', '2027-02-21')).toBe(false);
  });

  it('sin regla, o con una inventada, no toca nunca', () => {
    expect(tocaMarca(null, '2026-10-04')).toBe(false);
    expect(tocaMarca('cuando-sea', '2026-10-04')).toBe(false);
  });

  /**
   * La comprobación que de verdad vale: durante tres años, cada regla tiene que
   * tocar una vez por mes y ni una más.
   */
  it('toca exactamente una vez al mes, tres años seguidos', () => {
    for (const [regla, meses] of [
      ['primer', 36],
      ['primer-par', 18],
      ['primer-impar', 18],
      ['ultimo', 36],
    ] as const) {
      for (const dia of [0, 6]) {
        const veces = new Map<string, number>();
        const d = new Date(Date.UTC(2026, 0, 1));
        while (d.getUTCFullYear() < 2029) {
          const fecha = d.toISOString().slice(0, 10);
          if (d.getUTCDay() === dia && tocaMarca(regla, fecha)) {
            const mes = fecha.slice(0, 7);
            veces.set(mes, (veces.get(mes) ?? 0) + 1);
          }
          d.setUTCDate(d.getUTCDate() + 1);
        }
        expect(veces.size, `${regla}, día ${dia}: meses con marca`).toBe(meses);
        expect([...veces.values()].every((n) => n === 1), `${regla}, día ${dia}`).toBe(true);
      }
    }
  });
});

describe('vigente con marca', () => {
  const base = {
    id: 'x',
    templo: 'santiago-centro',
    dia: 0,
    hora: '11:00',
    nombre: 'Reunión General',
    estado: 'normal' as const,
    aviso: null,
    aviso_hasta: null,
    marca: 'Santa Cena',
    marca_regla: 'primer-par',
  };

  it('se anuncia desde los días previos', () => {
    // Viernes 2 de octubre: el domingo que viene es el 4, primer domingo de un
    // mes par. La marca tiene que verse YA, no el mismo domingo.
    expect(vigente(base, '2026-10-02').marca).toBe('Santa Cena');
  });

  it('sigue puesta todo el día de la reunión', () => {
    expect(vigente(base, '2026-10-04').marca).toBe('Santa Cena');
  });

  it('se va sola al día siguiente', () => {
    expect(vigente(base, '2026-10-05').marca).toBe(null);
  });

  it('una reunión suspendida no anuncia Santa Cena', () => {
    const suspendida = { ...base, estado: 'suspendida' as const, aviso: 'Por el feriado' };
    expect(vigente(suspendida, '2026-10-02').marca).toBe(null);
  });

  it('sin regla no se enseña, aunque haya texto', () => {
    expect(vigente({ ...base, marca_regla: null }, '2026-10-02').marca).toBe(null);
  });
});

describe('reglaEnPalabras', () => {
  it('lo dice con el día de la reunión', () => {
    expect(reglaEnPalabras('primer-par', 0)).toBe('el primer domingo de los meses pares');
    expect(reglaEnPalabras('primer-par', 6)).toBe('el primer sábado de los meses pares');
    expect(reglaEnPalabras('ultimo', 4)).toBe('el último jueves de cada mes');
    expect(reglaEnPalabras(null, 0)).toBe('nunca');
  });
});

describe('proximaVezConMarca', () => {
  it('encuentra la Santa Cena de este fin de semana', () => {
    // Viernes 2 de octubre de 2026. Santiago se reúne el domingo (0).
    expect(proximaVezConMarca(0, 'primer-par', '2026-10-02')).toBe('2026-10-04');
    // Limache y Coya, el sábado (6).
    expect(proximaVezConMarca(6, 'primer-par', '2026-10-02')).toBe('2026-10-03');
  });

  it('salta al siguiente mes par cuando el de este ya pasó', () => {
    // El 5 de octubre ya pasó el primer domingo: toca el de diciembre.
    expect(proximaVezConMarca(0, 'primer-par', '2026-10-05')).toBe('2026-12-06');
  });

  it('sin regla no hay próxima vez', () => {
    expect(proximaVezConMarca(0, null, '2026-10-02')).toBe(null);
  });

  it('nunca se queda dando vueltas', () => {
    // Las cuatro reglas tienen que resolver desde cualquier día del año.
    for (const regla of ['siempre', 'primer', 'primer-par', 'primer-impar', 'ultimo']) {
      for (let dia = 0; dia < 7; dia++) {
        expect(proximaVezConMarca(dia, regla, '2026-10-02')).not.toBe(null);
      }
    }
  });
});

describe('fechaEnPalabras', () => {
  it('no corre la fecha un día al pasar por el huso de Chile', () => {
    expect(fechaEnPalabras('2026-10-04')).toContain('4 de octubre de 2026');
    expect(fechaEnPalabras('2026-10-04')).toContain('domingo');
  });
});
