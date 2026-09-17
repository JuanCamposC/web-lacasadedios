import { describe, it, expect } from 'vitest';
import { ipDe } from './ip';

const con = (headers: Record<string, string>) => new Request('https://x.cl', { headers });

describe('ipDe', () => {
  it('prefiere la cabecera que pone Cloudflare, que no se puede falsear', () => {
    // La de abajo es la que mandaría quien quiere saltarse el freno.
    expect(ipDe(con({ 'cf-connecting-ip': '1.2.3.4', 'x-forwarded-for': '9.9.9.9' }))).toBe(
      '1.2.3.4',
    );
  });

  it('sin Cloudflare, toma la primera de x-forwarded-for', () => {
    expect(ipDe(con({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }))).toBe('1.2.3.4');
  });

  it('sin ninguna cabecera no inventa una dirección', () => {
    expect(ipDe(con({}))).toBe('desconocida');
  });
});
