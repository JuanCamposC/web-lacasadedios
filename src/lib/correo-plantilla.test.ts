import { describe, it, expect } from 'vitest';
import { construirCorreo, esc } from './correo-plantilla';

/**
 * Lo que se prueba aquí no es que el correo «se vea bien» —eso no lo puede
 * decir una prueba— sino las tres cosas que ya han fallado antes en este
 * proyecto y que nadie nota hasta que el correo está en la bandeja de alguien:
 * unidades que Outlook ignora, texto ajeno que se cuela sin escapar, y la
 * versión en texto plano que se olvida y desincroniza.
 */

const base = 'https://lacasadedios.cl';

const minimo = {
  base,
  preencabezado: 'Vista previa',
  titulo: 'Culto de aniversario',
  bloques: [{ tipo: 'parrafo' as const, texto: 'Nos vemos el domingo.' }],
};

describe('construirCorreo', () => {
  it('devuelve las dos versiones', () => {
    const { html, texto } = construirCorreo(minimo);
    expect(html).toContain('<!doctype html>');
    expect(texto).toContain('Culto de aniversario');
    expect(texto).not.toContain('<');
  });

  // El motor de Outlook de escritorio es el de Word: no entiende `rem` ni `em`
  // y deja el texto al tamaño por defecto. Era el fallo de las plantillas que
  // había antes (`font-size:.8rem`).
  it('no usa ninguna unidad que Outlook ignore', () => {
    const { html } = construirCorreo({
      ...minimo,
      eyebrow: 'Novedad',
      bloques: [
        { tipo: 'destacado', texto: 'Título' },
        { tipo: 'boton', texto: 'Ver', url: base },
        { tipo: 'ficha', filas: [['Nombre', 'Ana']] },
        { tipo: 'cita', texto: 'Hola' },
      ],
      pie: { texto: 'Pie', enlace: { texto: 'Baja', url: base + '/baja' } },
    });
    expect(html).not.toMatch(/font-size:\s*[\d.]+r?em/);
    expect(html).not.toMatch(/[\d.]+rem/);
  });

  // Sin esto el cliente rellena la línea de vista previa con lo primero que
  // encuentre en el HTML.
  it('incluye el preencabezado antes del contenido', () => {
    const { html } = construirCorreo({ ...minimo, preencabezado: 'Confirma tu suscripción' });
    expect(html.indexOf('Confirma tu suscripción')).toBeLessThan(html.indexOf('<table'));
  });

  it('el botón lleva el color en bgcolor, no solo en CSS', () => {
    const { html } = construirCorreo({
      ...minimo,
      bloques: [{ tipo: 'boton', texto: 'Confirmar', url: base + '/confirmar' }],
    });
    // Outlook ignora `background` en CSS; sin el atributo no hay botón.
    expect(html).toMatch(/<td bgcolor="#23448f"/);
    expect(html).toContain('/confirmar');
  });

  it('el texto plano conserva la dirección del botón', () => {
    const { texto } = construirCorreo({
      ...minimo,
      bloques: [{ tipo: 'boton', texto: 'Confirmar', url: base + '/confirmar?t=abc' }],
    });
    expect(texto).toContain('https://lacasadedios.cl/confirmar?t=abc');
  });

  // El mensaje del formulario de contacto lo escribe un desconocido y termina
  // dentro del HTML de un correo que lee la iglesia.
  it('escapa el contenido ajeno', () => {
    const { html } = construirCorreo({
      ...minimo,
      titulo: '<script>alert(1)</script>',
      bloques: [{ tipo: 'cita', texto: '<img src=x onerror=alert(1)>' }],
    });
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;script&gt;');
  });

  it('no deja escapar una comilla dentro de un atributo', () => {
    const { html } = construirCorreo({
      ...minimo,
      bloques: [{ tipo: 'boton', texto: 'Ver', url: 'https://x.cl/"><b>' }],
    });
    expect(html).not.toContain('"><b>');
    expect(html).toContain('&quot;');
  });

  it('quita la barra final de la dirección del sitio', () => {
    const { html } = construirCorreo({ ...minimo, base: base + '/' });
    expect(html).toContain(`${base}/marca/logo-blanco.png`);
    expect(html).not.toContain('//marca/');
  });

  it('el logotipo va en PNG: Gmail borra los SVG', () => {
    const { html } = construirCorreo(minimo);
    expect(html).toContain('.png');
    expect(html).not.toContain('.svg');
  });
});

describe('esc', () => {
  it('escapa los cinco caracteres que rompen el marcado', () => {
    expect(esc(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;');
  });

  it('trata null y undefined como cadena vacía', () => {
    expect(esc(null)).toBe('');
    expect(esc(undefined)).toBe('');
  });
});
