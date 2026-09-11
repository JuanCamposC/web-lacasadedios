import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { conNombre, resolverRemitente } from './correo';

/**
 * El remitente es la variable que más veces ha roto el correo en este
 * proyecto: una vez por comillas de copiar y pegar, otra por apuntar a una
 * casilla que no existía. Aquí se fija la cadena de respaldo, que es lo que
 * decide desde qué dirección sale cada cosa.
 */

const ORIGINAL = { ...process.env };

beforeEach(() => {
  delete process.env.CONTACT_FROM;
  delete process.env.BOLETIN_FROM;
});

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe('resolverRemitente', () => {
  // ANTES el suelo era `SMTP_USER`, la cuenta con la que se autenticaba el
  // envío, porque muchos servidores rechazan un `From` que no coincide con
  // quien abrió la sesión. Con Resend no hay sesión que coincidir: lo que exige
  // es que el dominio esté verificado. Esa variable ya no existe.
  it('sin nada configurado usa la casilla de contacto del sitio', () => {
    const r = resolverRemitente();
    expect(r.ok && r.from).toBe('La Casa de Dios <contacto@lacasadedios.cl>');
    expect(r.ok && r.porDefecto).toBe(true);
  });

  // El error real: pegar el valor en Vercel con las comillas incluidas. Quedan
  // DENTRO del valor y el servidor rechaza el envío entero sin dar una pista.
  it('quita las comillas de copiar y pegar', () => {
    process.env.CONTACT_FROM = '"La Casa de Dios <hola@lacasadedios.cl>"';
    const r = resolverRemitente();
    expect(r.ok && r.from).toBe('La Casa de Dios <hola@lacasadedios.cl>');
  });

  it('devuelve el valor exacto cuando no es un remitente válido', () => {
    process.env.CONTACT_FROM = 'no es un correo';
    const r = resolverRemitente();
    expect(r.ok).toBe(false);
    expect(!r.ok && r.valor).toBe('no es un correo');
  });

  describe('casilla propia del boletín', () => {
    it('la usa cuando está puesta', () => {
      process.env.CONTACT_FROM = 'contacto@lacasadedios.cl';
      process.env.BOLETIN_FROM = 'boletin@lacasadedios.cl';
      expect(resolverRemitente('BOLETIN_FROM')).toMatchObject({
        ok: true,
        from: 'boletin@lacasadedios.cl',
      });
    });

    // Lo que hace que separar las casillas sea opcional: si no se configura, el
    // boletín sigue saliendo por donde salía.
    it('cae en CONTACT_FROM si no está puesta', () => {
      process.env.CONTACT_FROM = 'contacto@lacasadedios.cl';
      expect(resolverRemitente('BOLETIN_FROM')).toMatchObject({
        ok: true,
        from: 'contacto@lacasadedios.cl',
      });
    });

    it('y en la casilla de contacto si tampoco hay CONTACT_FROM', () => {
      expect(resolverRemitente('BOLETIN_FROM')).toMatchObject({ ok: true, porDefecto: true });
    });

    // Al revés NO: el formulario de contacto nunca debe salir por la casilla
    // del boletín, que es la que puede acabar con mala reputación.
    it('el contacto no hereda la casilla del boletín', () => {
      process.env.BOLETIN_FROM = 'boletin@lacasadedios.cl';
      const r = resolverRemitente('CONTACT_FROM');
      expect(r.ok && r.from).not.toContain('boletin@');
    });
  });
});

/**
 * `conNombre` mete en una cabecera `From` un texto que escribió un desconocido
 * en un formulario público. Lo que se prueba acá es justamente que no pueda
 * hacer nada con eso: la dirección tiene que seguir siendo la de la iglesia
 * pase lo que pase.
 */
describe('conNombre', () => {
  const DE = 'La Casa de Dios <formulario@lacasadedios.cl>';

  it('cambia el nombre y conserva la dirección', () => {
    expect(conNombre(DE, 'Juan Pérez')).toBe('Juan Pérez <formulario@lacasadedios.cl>');
  });

  it('funciona con un remitente sin nombre', () => {
    expect(conNombre('formulario@lacasadedios.cl', 'Ana')).toBe('Ana <formulario@lacasadedios.cl>');
  });

  // El ataque que motiva toda la limpieza: llamarse como una dirección para que
  // el correo parezca salir de otra parte llevando el sello de la iglesia.
  it('no deja colar otra dirección en el nombre', () => {
    const r = conNombre(DE, 'Banco <cobros@estafa.cl>');
    expect(r).toBe('Banco cobros@estafa.cl <formulario@lacasadedios.cl>');
    expect(r.match(/</g)).toHaveLength(1);
    expect(r.endsWith('<formulario@lacasadedios.cl>')).toBe(true);
  });

  it('quita saltos de línea, comillas y separadores de destinatario', () => {
    const r = conNombre(DE, 'Ana"\r\nBcc: otro@ajeno.cl, tercero@ajeno.cl; cuarto@ajeno.cl');
    expect(r).not.toMatch(/[\r\n"',;]/);
    expect(r.endsWith('<formulario@lacasadedios.cl>')).toBe(true);
  });

  it('recorta un nombre kilométrico', () => {
    const r = conNombre(DE, 'a'.repeat(500));
    expect(r.length).toBeLessThan(100);
    expect(r.endsWith('<formulario@lacasadedios.cl>')).toBe(true);
  });

  // Un nombre vacío dejaría `<direccion@...>` sin nada delante, que se ve peor
  // que el remitente de siempre.
  it('sin nombre utilizable devuelve el remitente tal cual', () => {
    expect(conNombre(DE, '   ')).toBe(DE);
    expect(conNombre(DE, '<<>>')).toBe(DE);
  });
});
