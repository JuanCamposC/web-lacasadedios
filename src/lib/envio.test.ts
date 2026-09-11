import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { crearTransporte, enviarCadaUno, envioConfigurado, type Mensaje } from './envio';

/**
 * El envío es de las cosas que fallan en silencio: nadie se entera de que el
 * correo de confirmación no salió, porque quien lo espera no sabe que existía.
 *
 * Lo que más se vigila acá es la traducción de nombres. `replyTo` de nodemailer
 * se llama `reply_to` en Resend, y mandarlo mal no da error: la API ignora el
 * campo desconocido y el correo sale sin dirección de respuesta.
 */

const ORIGINAL = { ...process.env };

function fingirRespuesta(estado: number, cuerpo: unknown) {
  return vi.fn(async () =>
    estado === 200
      ? Response.json(cuerpo)
      : new Response(JSON.stringify(cuerpo), { status: estado }),
  );
}

const mensaje: Mensaje = {
  from: 'La Casa de Dios <contacto@lacasadedios.cl>',
  to: 'alguien@ejemplo.cl',
  subject: 'Hola',
  text: 'texto',
  html: '<p>texto</p>',
};

beforeEach(() => {
  process.env.RESEND_API_KEY = 're_clave_de_prueba';
});

afterEach(() => {
  process.env = { ...ORIGINAL };
  vi.unstubAllGlobals();
});

describe('envioConfigurado', () => {
  it('es falso sin clave, y sin clave no se devuelve enviador', () => {
    delete process.env.RESEND_API_KEY;
    expect(envioConfigurado()).toBe(false);
    // Devolver null y no un objeto que falla al usarse es lo que permite a las
    // rutas distinguir «no hay proveedor» de «el envío falló».
    expect(crearTransporte()).toBeNull();
  });

  it('una clave de solo espacios cuenta como no configurada', () => {
    process.env.RESEND_API_KEY = '   ';
    expect(envioConfigurado()).toBe(false);
  });
});

describe('sendMail', () => {
  it('manda la clave como Bearer y habla con el endpoint de Resend', async () => {
    const fetchFalso = fingirRespuesta(200, { id: 'abc' });
    vi.stubGlobal('fetch', fetchFalso);

    await crearTransporte()!.sendMail(mensaje);

    const [url, opciones] = fetchFalso.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect(opciones.method).toBe('POST');
    expect((opciones.headers as Record<string, string>).authorization).toBe(
      'Bearer re_clave_de_prueba',
    );
  });

  it('traduce replyTo a reply_to', async () => {
    // El campo que Resend ignoraría en silencio si se mandara con el nombre de
    // nodemailer: el correo saldría sin dirección de respuesta y nadie lo vería
    // hasta que alguien contestara al vacío.
    const fetchFalso = fingirRespuesta(200, { id: 'abc' });
    vi.stubGlobal('fetch', fetchFalso);

    await crearTransporte()!.sendMail({ ...mensaje, replyTo: 'quien@escribio.cl' });

    const cuerpo = JSON.parse((fetchFalso.mock.calls[0][1] as RequestInit).body as string);
    expect(cuerpo.reply_to).toBe('quien@escribio.cl');
    expect(cuerpo.replyTo).toBeUndefined();
  });

  it('conserva las cabeceras propias, como List-Unsubscribe', async () => {
    const fetchFalso = fingirRespuesta(200, { id: 'abc' });
    vi.stubGlobal('fetch', fetchFalso);

    await crearTransporte()!.sendMail({
      ...mensaje,
      headers: { 'List-Unsubscribe': '<https://lacasadedios.cl/baja?t=x>' },
    });

    const cuerpo = JSON.parse((fetchFalso.mock.calls[0][1] as RequestInit).body as string);
    expect(cuerpo.headers['List-Unsubscribe']).toBe('<https://lacasadedios.cl/baja?t=x>');
  });

  it('no manda campos vacíos', async () => {
    const fetchFalso = fingirRespuesta(200, { id: 'abc' });
    vi.stubGlobal('fetch', fetchFalso);

    await crearTransporte()!.sendMail({ from: 'a@b.cl', to: 'c@d.cl', subject: 'x' });

    const cuerpo = JSON.parse((fetchFalso.mock.calls[0][1] as RequestInit).body as string);
    expect(Object.keys(cuerpo).sort()).toEqual(['from', 'subject', 'to']);
  });

  it('lanza con el motivo que da Resend, no con un número', async () => {
    // «error 422» manda a nadie a ninguna parte; el mensaje de Resend dice qué
    // arreglar, y es lo que acaba viendo quien administra.
    vi.stubGlobal(
      'fetch',
      fingirRespuesta(422, { message: 'The lacasadedios.cl domain is not verified' }),
    );

    await expect(crearTransporte()!.sendMail(mensaje)).rejects.toThrow(/domain is not verified/);
  });

  it('sobrevive a una respuesta de error que no sea JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('502 Bad Gateway', { status: 502 })),
    );
    await expect(crearTransporte()!.sendMail(mensaje)).rejects.toThrow(/502/);
  });
});

describe('enviarCadaUno', () => {
  const lista = (n: number): Mensaje[] =>
    Array.from({ length: n }, (_, i) => ({ ...mensaje, to: `persona${i}@ejemplo.cl` }));

  it('manda un correo por persona, nunca uno con todos dentro', async () => {
    const fetchFalso = fingirRespuesta(200, { id: 'abc' });
    vi.stubGlobal('fetch', fetchFalso);

    const r = await enviarCadaUno(lista(12));
    expect(fetchFalso).toHaveBeenCalledTimes(12);
    expect(r.enviados).toBe(12);
    expect(r.fallidos).toBe(0);
  });

  it('un rechazo individual NO deja sin correo al resto', async () => {
    // Es el fallo que motivó abandonar el envío por lotes en su día, y la razón
    // de no usar el endpoint de lote de Resend aunque exista.
    let vuelta = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        vuelta++;
        return vuelta === 2
          ? new Response(JSON.stringify({ message: 'dirección inválida' }), { status: 422 })
          : Response.json({ id: 'abc' });
      }),
    );

    const r = await enviarCadaUno(lista(5));
    expect(r.enviados).toBe(4);
    expect(r.fallidos).toBe(1);
    expect(r.primerFallo).toMatch(/inválida/);
  });

  it('avisa de cada fallo sin exponer la dirección', async () => {
    const motivos: string[] = [];
    vi.stubGlobal('fetch', fingirRespuesta(422, { message: 'rechazado' }));

    await enviarCadaUno(lista(3), (motivo) => motivos.push(motivo));
    expect(motivos).toHaveLength(3);
    expect(motivos.every((m) => !m.includes('@'))).toBe(true);
  });

  it('no envía de golpe: respeta el freno de concurrencia', async () => {
    // Resend admite diez peticiones por segundo. Sin freno, `Promise.all` con
    // una lista larga se respondería a sí misma con 429.
    let enVuelo = 0;
    let maximo = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        enVuelo++;
        maximo = Math.max(maximo, enVuelo);
        await new Promise((r) => setTimeout(r, 5));
        enVuelo--;
        return Response.json({ id: 'abc' });
      }),
    );

    await enviarCadaUno(lista(20));
    expect(maximo).toBeLessThanOrEqual(5);
  });

  it('sin clave configurada no finge que envió', async () => {
    delete process.env.RESEND_API_KEY;
    const r = await enviarCadaUno(lista(3));
    expect(r.enviados).toBe(0);
    expect(r.fallidos).toBe(3);
    expect(r.primerFallo).toMatch(/RESEND_API_KEY/);
  });
});
