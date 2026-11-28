import { describe, it, expect } from 'vitest';
import {
  casillasDe,
  columnaDe,
  comoParametro,
  enPalabras,
  fechaDeEvento,
  instanteDeCierre,
  mesAnterior,
  mesDe,
  mesSiguiente,
  primerInstante,
  reunionesEnFecha,
} from './calendario';
import type { FilaReunion } from './reuniones';

/**
 * El calendario es aritmética de fechas, y la aritmética de fechas falla en
 * silencio: un mes que empieza en domingo, un febrero bisiesto, un evento a las
 * 23:00 que en UTC ya es mañana. Nada de eso da un error; da una rejilla
 * corrida un día, que nadie nota hasta que alguien llega a un templo cerrado.
 *
 * Estas pruebas se escribieron DESPUÉS del código, el 28 de noviembre de 2026,
 * cuando volvió a funcionar `npm test`. El calendario había salido a
 * producción verificado solo en el navegador.
 */

describe('mesDe', () => {
  it('lee el mes de la dirección', () => {
    expect(mesDe('2026-12', '2026-11-28')).toEqual({ anio: 2026, mes: 12 });
  });

  it('cae en el mes de hoy si no viene nada', () => {
    expect(mesDe(null, '2026-11-28')).toEqual({ anio: 2026, mes: 11 });
    expect(mesDe('', '2026-11-28')).toEqual({ anio: 2026, mes: 11 });
  });

  /**
   * «2026-13» calza con el formato y no existe. Sin comprobar el rango, `Date`
   * lo convertiría en silencio en enero de 2027 y la rejilla saltaría de año.
   */
  it('rechaza un mes que no existe en vez de saltar al año siguiente', () => {
    expect(mesDe('2026-13', '2026-11-28')).toEqual({ anio: 2026, mes: 11 });
    expect(mesDe('2026-00', '2026-11-28')).toEqual({ anio: 2026, mes: 11 });
  });

  it('rechaza lo que no es una fecha', () => {
    expect(mesDe('hola', '2026-11-28')).toEqual({ anio: 2026, mes: 11 });
    expect(mesDe('2026-1', '2026-11-28')).toEqual({ anio: 2026, mes: 11 });
  });
});

describe('moverse entre meses', () => {
  it('cruza el año hacia atrás', () => {
    expect(mesAnterior({ anio: 2027, mes: 1 })).toEqual({ anio: 2026, mes: 12 });
  });

  it('cruza el año hacia adelante', () => {
    expect(mesSiguiente({ anio: 2026, mes: 12 })).toEqual({ anio: 2027, mes: 1 });
  });

  it('escribe el mes como lo lee la dirección', () => {
    expect(comoParametro({ anio: 2027, mes: 3 })).toBe('2027-03');
  });

  it('lo dice en castellano y en minúscula', () => {
    expect(enPalabras({ anio: 2026, mes: 12 })).toBe('diciembre de 2026');
  });
});

describe('columnaDe', () => {
  /**
   * La base guarda los días como `Date.getDay()`, con el domingo en 0. La
   * rejilla empieza el lunes. Si esta conversión se equivoca, cada reunión
   * sale un día corrida.
   */
  it('pone el lunes primero y el domingo al final', () => {
    expect(columnaDe(1)).toBe(0); // lunes
    expect(columnaDe(6)).toBe(5); // sábado
    expect(columnaDe(0)).toBe(6); // domingo
  });
});

describe('casillasDe', () => {
  /** Propiedades que tiene que cumplir CUALQUIER mes. */
  function comprobarForma(anio: number, mes: number, diasDelMes: number) {
    const c = casillasDe({ anio, mes });
    expect(c.length % 7).toBe(0);
    expect(c[0].dia).toBe(1); // empieza en lunes
    expect(c[c.length - 1].dia).toBe(0); // termina en domingo
    expect(c.filter((x) => x.delMes)).toHaveLength(diasDelMes);
    // Los días del mes van seguidos y en orden: 1, 2, 3…
    expect(c.filter((x) => x.delMes).map((x) => x.numero)).toEqual(
      Array.from({ length: diasDelMes }, (_, i) => i + 1),
    );
    return c;
  }

  it('diciembre de 2026 empieza en martes: un día de relleno delante', () => {
    const c = comprobarForma(2026, 12, 31);
    expect(c[0]).toMatchObject({ fecha: '2026-11-30', delMes: false });
    expect(c[1]).toMatchObject({ fecha: '2026-12-01', numero: 1, delMes: true });
    expect(c).toHaveLength(35); // cinco semanas justas
  });

  /**
   * Un mes que empieza en lunes y tiene 28 días cabe en cuatro semanas exactas,
   * sin un solo día de relleno. Es el caso que pone a prueba el recorte de las
   * semanas vacías del final: sin él quedarían dos filas en blanco abajo.
   */
  it('febrero de 2027 empieza en lunes y cabe en cuatro semanas, sin relleno', () => {
    const c = comprobarForma(2027, 2, 28);
    expect(c).toHaveLength(28);
    expect(c.every((x) => x.delMes)).toBe(true);
  });

  /** El peor caso: empieza en domingo, seis días de relleno delante. */
  it('agosto de 2027 empieza en domingo y necesita seis semanas', () => {
    const c = comprobarForma(2027, 8, 31);
    expect(c.slice(0, 6).every((x) => !x.delMes)).toBe(true);
    expect(c[6]).toMatchObject({ fecha: '2027-08-01', dia: 0 });
    expect(c).toHaveLength(42);
  });

  it('febrero de 2028 es bisiesto y trae el 29', () => {
    const c = comprobarForma(2028, 2, 29);
    expect(c.some((x) => x.fecha === '2028-02-29' && x.delMes)).toBe(true);
  });

  it('el relleno de atrás es del mes anterior, también cruzando el año', () => {
    // Enero de 2026 empieza en jueves: lunes 29, martes 30, miércoles 31 de dic.
    const c = casillasDe({ anio: 2026, mes: 1 });
    expect(c.slice(0, 3).map((x) => x.fecha)).toEqual(['2025-12-29', '2025-12-30', '2025-12-31']);
    expect(c[3].fecha).toBe('2026-01-01');
  });
});

describe('fechaDeEvento', () => {
  /**
   * El caso que el calendario existe para no equivocar. En diciembre Chile va
   * a UTC−3, así que la Vigilia de las 23:00 del 30 se guarda como las 02:00
   * del día 1 en UTC. Tomando la fecha del instante sin más, la vigilia
   * aparecería en el día equivocado — y en otro MES.
   */
  it('pone en su día de Chile un evento que en UTC ya es mañana', () => {
    expect(fechaDeEvento('2026-12-01T02:00:00Z')).toBe('2026-11-30');
  });

  it('y en invierno, con Chile a UTC−4, igual', () => {
    // 1 de julio 02:00 UTC = 30 de junio 22:00 en Chile.
    expect(fechaDeEvento('2026-07-01T02:00:00Z')).toBe('2026-06-30');
  });

  it('a mediodía no hay duda posible', () => {
    expect(fechaDeEvento('2026-12-15T15:00:00Z')).toBe('2026-12-15');
  });
});

describe('el tramo que se le pide a la base', () => {
  const dic = { anio: 2026, mes: 12 };

  /**
   * Los extremos se ensanchan un día por cada lado a propósito: así no hace
   * falta saber si Chile va a UTC−3 o −4 ese mes. Lo que sobra lo descarta la
   * rejilla. Lo que NO puede pasar es quedarse corto.
   */
  it('incluye un evento a las 00:30 del día 1 en Chile', () => {
    const evento = '2026-12-01T03:30:00Z'; // 00:30 en Chile
    expect(evento >= primerInstante(dic)).toBe(true);
    expect(evento < instanteDeCierre(dic)).toBe(true);
  });

  it('incluye un evento a las 23:30 del día 31 en Chile', () => {
    const evento = '2027-01-01T02:30:00Z'; // 23:30 del 31 en Chile
    expect(evento >= primerInstante(dic)).toBe(true);
    expect(evento < instanteDeCierre(dic)).toBe(true);
  });

  it('el cierre no se come el mes siguiente entero', () => {
    expect(instanteDeCierre(dic) < '2027-01-03T00:00:00Z').toBe(true);
  });
});

describe('reunionesEnFecha', () => {
  const jueves: FilaReunion = {
    id: 'r1',
    templo: 'san-miguel',
    dia: 4,
    hora: '20:00',
    nombre: 'Reunión General',
    estado: 'suspendida',
    aviso: 'Suspendida por las fiestas',
    aviso_hasta: '2026-12-26',
    hora_aviso: null,
    marca: null,
    marca_regla: null,
  };
  const domingo: FilaReunion = {
    ...jueves,
    id: 'r2',
    dia: 0,
    hora: '11:00',
    estado: 'normal',
    aviso: null,
    aviso_hasta: null,
    marca: 'Santa Cena',
    marca_regla: 'primer',
  };

  it('solo trae las del día de la semana que toca', () => {
    expect(reunionesEnFecha([jueves, domingo], '2026-12-24')).toHaveLength(1); // jueves
    expect(reunionesEnFecha([jueves, domingo], '2026-12-23')).toHaveLength(0); // miércoles
  });

  /**
   * Lo que hace honesto el calendario: el estado de cada reunión es el de SU
   * día, no el de hoy. Pintar el patrón semanal a secas habría mentido en los
   * días que importan.
   */
  it('una suspendida hasta el 26 sale suspendida el 24…', () => {
    const [r] = reunionesEnFecha([jueves], '2026-12-24');
    expect(r.estado).toBe('suspendida');
    expect(r.aviso).toBe('Suspendida por las fiestas');
  });

  it('…y normal el 31, cuando el aviso ya caducó', () => {
    const [r] = reunionesEnFecha([jueves], '2026-12-31');
    expect(r.estado).toBe('normal');
    expect(r.aviso).toBeNull();
  });

  it('la Santa Cena sale el primer domingo y no el segundo', () => {
    expect(reunionesEnFecha([domingo], '2026-12-06')[0].marca).toBe('Santa Cena');
    expect(reunionesEnFecha([domingo], '2026-12-13')[0].marca).toBeNull();
  });
});
