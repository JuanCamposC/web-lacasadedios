import { describe, it, expect } from 'vitest';
import { jsonLd } from './jsonld';

describe('jsonLd', () => {
  it('un título con </script> no puede cerrar el bloque', () => {
    const salida = jsonLd({ headline: 'Culto</script><img src=x onerror=alert(1)>' });
    expect(salida).not.toContain('</script>');
    expect(salida).not.toContain('<');
  });

  it('sigue siendo JSON válido y con el mismo contenido', () => {
    const datos = { a: 'x<y>z&w', b: [1, 2] };
    expect(JSON.parse(jsonLd(datos))).toEqual(datos);
  });

  it('escapa los separadores de línea que rompen el análisis', () => {
    const sep = String.fromCharCode(0x2028);
    // El resultado lleva el TEXTO del escape, no el carácter.
    expect(jsonLd({ a: sep })).toBe(String.raw`{"a":"\u2028"}`);
  });
});
