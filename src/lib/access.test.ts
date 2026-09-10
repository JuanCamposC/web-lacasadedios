import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * La validación del token de Access es lo único que separa el panel de
 * cualquiera. Un `return true` de más acá no rompe ninguna página: solo abre
 * la puerta, en silencio.
 *
 * Por eso las pruebas no comprueban que un token bueno pase —eso es lo fácil—
 * sino que cada token malo se caiga por la razón correcta: firma ajena, emitido
 * para otra aplicación, vencido, sin firma.
 *
 * El módulo guarda las claves en memoria, así que cada prueba lo vuelve a
 * importar limpio con `resetModules`.
 */

const EQUIPO = 'lacasadedios.cloudflareaccess.com';
const AUD = 'c6d6fb65388b5b61c2e2b0e2f7f5d5f7410d1898bfe3a71158f98142f039b890';
const KID = 'clave-de-prueba';

let par: CryptoKeyPair;
let intruso: CryptoKeyPair;

const ALGORITMO = {
  name: 'RSASSA-PKCS1-v1_5',
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: 'SHA-256',
} as const;

function aB64url(datos: Uint8Array | string): string {
  const bytes = typeof datos === 'string' ? new TextEncoder().encode(datos) : datos;
  let binario = '';
  for (const b of bytes) binario += String.fromCharCode(b);
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Arma un JWT firmado con la clave que se le pase. */
async function firmar(
  carga: Record<string, unknown>,
  clave: CryptoKey = par.privateKey,
  cabecera: Record<string, unknown> = { alg: 'RS256', kid: KID },
): Promise<string> {
  const trozo = `${aB64url(JSON.stringify(cabecera))}.${aB64url(JSON.stringify(carga))}`;
  const firma = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    clave,
    new TextEncoder().encode(trozo),
  );
  return `${trozo}.${aB64url(new Uint8Array(firma))}`;
}

/** Una carga válida, a la que cada prueba le rompe una sola cosa. */
function cargaValida(cambios: Record<string, unknown> = {}) {
  const ahora = Math.floor(Date.now() / 1000);
  return {
    aud: [AUD],
    iss: `https://${EQUIPO}`,
    email: 'sistemas@lacasadedios.cl',
    sub: 'persona-123',
    iat: ahora,
    exp: ahora + 3600,
    ...cambios,
  };
}

/** Importa el módulo con las claves servidas desde una red fingida. */
async function moduloLimpio() {
  vi.resetModules();
  const jwk = await crypto.subtle.exportKey('jwk', par.publicKey);
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ keys: [{ ...jwk, kid: KID, alg: 'RS256', use: 'sig' }] })),
  );
  return import('./access');
}

beforeEach(async () => {
  par = (await crypto.subtle.generateKey(ALGORITMO, true, ['sign', 'verify'])) as CryptoKeyPair;
  intruso = (await crypto.subtle.generateKey(ALGORITMO, true, ['sign', 'verify'])) as CryptoKeyPair;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('verificarToken', () => {
  it('acepta un token bien firmado y devuelve el correo de dentro', async () => {
    const { verificarToken } = await moduloLimpio();
    const identidad = await verificarToken(await firmar(cargaValida()), EQUIPO, AUD);
    expect(identidad).toEqual({ correo: 'sistemas@lacasadedios.cl', sujeto: 'persona-123' });
  });

  it('rechaza un token firmado con otra clave', async () => {
    const { verificarToken } = await moduloLimpio();
    const token = await firmar(cargaValida(), intruso.privateKey);
    expect(await verificarToken(token, EQUIPO, AUD)).toBeNull();
  });

  it('rechaza un token emitido para OTRA aplicación de Access', async () => {
    // El fallo más silencioso posible: la firma es auténtica, la persona existe
    // y entró de verdad… a otra aplicación de la misma cuenta.
    const { verificarToken } = await moduloLimpio();
    const token = await firmar(cargaValida({ aud: ['aud-de-otra-aplicacion'] }));
    expect(await verificarToken(token, EQUIPO, AUD)).toBeNull();
  });

  it('rechaza un token de otro emisor', async () => {
    const { verificarToken } = await moduloLimpio();
    const token = await firmar(cargaValida({ iss: 'https://otro-equipo.cloudflareaccess.com' }));
    expect(await verificarToken(token, EQUIPO, AUD)).toBeNull();
  });

  it('rechaza un token vencido', async () => {
    const { verificarToken } = await moduloLimpio();
    const ahora = Math.floor(Date.now() / 1000);
    const token = await firmar(cargaValida({ exp: ahora - 3600 }));
    expect(await verificarToken(token, EQUIPO, AUD)).toBeNull();
  });

  it('rechaza un token que todavía no entra en vigor', async () => {
    const { verificarToken } = await moduloLimpio();
    const ahora = Math.floor(Date.now() / 1000);
    const token = await firmar(cargaValida({ nbf: ahora + 3600 }));
    expect(await verificarToken(token, EQUIPO, AUD)).toBeNull();
  });

  it('rechaza `alg: none`, la puerta trasera clásica de JWT', async () => {
    const { verificarToken } = await moduloLimpio();
    const trozo = `${aB64url(JSON.stringify({ alg: 'none' }))}.${aB64url(
      JSON.stringify(cargaValida()),
    )}`;
    expect(await verificarToken(`${trozo}.`, EQUIPO, AUD)).toBeNull();
  });

  it('rechaza un token con la cabecera manipulada', async () => {
    // Cambiarle el `alg` a un token auténtico no sirve de nada: la cabecera va
    // dentro de lo firmado, así que tocarla invalida la firma.
    //
    // NOTA HONESTA: esta prueba y la de arriba pasan igual aunque se borre la
    // comprobación de `alg` del módulo —lo comprobé quitándola—, porque quien
    // las atrapa es la verificación de firma. No es un descuido: el módulo FIJA
    // el algoritmo de verificación en vez de leerlo de la cabecera, que es
    // justo la defensa recomendada contra la confusión de algoritmos. Con ese
    // diseño, la comprobación de `alg` es un cinturón sobre los tirantes y no
    // se puede probar por separado. Se deja porque hace explícito lo que se
    // acepta, no porque sostenga nada sola.
    const { verificarToken } = await moduloLimpio();
    const autentico = await firmar(cargaValida());
    const [, carga, firma] = autentico.split('.');
    const manipulado = `${aB64url(JSON.stringify({ alg: 'HS256', kid: KID }))}.${carga}.${firma}`;
    expect(await verificarToken(manipulado, EQUIPO, AUD)).toBeNull();
  });

  it('rechaza un token sin correo', async () => {
    const { verificarToken } = await moduloLimpio();
    const token = await firmar(cargaValida({ email: undefined }));
    expect(await verificarToken(token, EQUIPO, AUD)).toBeNull();
  });

  it('rechaza cualquier cosa que no sea un token', async () => {
    const { verificarToken } = await moduloLimpio();
    for (const basura of ['', 'no-es-un-token', 'a.b', 'a.b.c.d', '...']) {
      expect(await verificarToken(basura, EQUIPO, AUD)).toBeNull();
    }
  });

  it('falla cerrado si no está configurado el equipo o la audiencia', async () => {
    const { verificarToken } = await moduloLimpio();
    const token = await firmar(cargaValida());
    expect(await verificarToken(token, '', AUD)).toBeNull();
    expect(await verificarToken(token, EQUIPO, '')).toBeNull();
  });

  it('falla cerrado si no se pueden pedir las claves públicas', async () => {
    vi.resetModules();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('no', { status: 500 })),
    );
    const { verificarToken } = await import('./access');
    const token = await firmar(cargaValida());
    expect(await verificarToken(token, EQUIPO, AUD)).toBeNull();
  });

  it('vuelve a pedir las claves si aparece un kid desconocido', async () => {
    // Cloudflare rota las claves. Sin esta segunda petición, todo el equipo
    // quedaría fuera hasta que venciera el plazo guardado.
    vi.resetModules();
    const jwk = await crypto.subtle.exportKey('jwk', par.publicKey);
    let vuelta = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        vuelta++;
        // La primera vez devuelve una clave con otro identificador.
        return Response.json({
          keys: [{ ...jwk, kid: vuelta === 1 ? 'clave-vieja' : KID, alg: 'RS256', use: 'sig' }],
        });
      }),
    );
    const { verificarToken } = await import('./access');
    const identidad = await verificarToken(await firmar(cargaValida()), EQUIPO, AUD);
    expect(vuelta).toBe(2);
    expect(identidad?.correo).toBe('sistemas@lacasadedios.cl');
  });
});

describe('identidadDeAccess', () => {
  it('devuelve null si la petición no trae la cabecera de Access', async () => {
    const { identidadDeAccess } = await moduloLimpio();
    expect(await identidadDeAccess(new Request('https://lacasadedios.cl/admin'))).toBeNull();
  });

  it('NO se fía de la cabecera del correo, solo del token firmado', async () => {
    // Cualquiera puede escribir esta cabecera. Si el módulo la mirara, bastaría
    // con ponerla a mano para entrar al panel.
    const { identidadDeAccess } = await moduloLimpio();
    const peticion = new Request('https://lacasadedios.cl/admin', {
      headers: { 'Cf-Access-Authenticated-User-Email': 'intruso@ejemplo.cl' },
    });
    expect(await identidadDeAccess(peticion)).toBeNull();
  });
});
