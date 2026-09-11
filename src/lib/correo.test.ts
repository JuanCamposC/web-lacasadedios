import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolverRemitente } from './correo';

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
