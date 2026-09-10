/**
 * Identidad de Cloudflare Access, verificada de verdad.
 *
 * Access pone en cada petición la cabecera `Cf-Access-Jwt-Assertion` con un
 * token firmado que dice quién entró. También pone
 * `Cf-Access-Authenticated-User-Email`, que es cómoda y NO se usa acá.
 *
 * POR QUÉ NO BASTA LA CABECERA DEL CORREO
 * La documentación de Cloudflare es explícita: «Validation of the header alone
 * is not sufficient — the JWT and signature must be confirmed to avoid identity
 * spoofing». Una cabecera es texto que cualquiera puede escribir; lo único que
 * no se puede falsificar es la firma. Así que se comprueba la firma, y el
 * correo se lee de DENTRO del token, no de la cabecera de al lado.
 *
 * QUÉ SE COMPRUEBA, Y POR QUÉ CADA COSA
 *   · La firma, contra las claves públicas del equipo. Sin esto, nada más vale.
 *   · `aud` — para qué aplicación se emitió. Sin esta comprobación, un token de
 *     CUALQUIER otra aplicación de Access de la misma cuenta abriría el panel.
 *     Es el error silencioso más fácil de cometer acá.
 *   · `iss` — quién lo emitió. Tiene que ser nuestro dominio de equipo.
 *   · `exp` y `nbf` — que esté vigente.
 *
 * FALLA CERRADA: cualquier duda —falta configuración, no hay token, la firma no
 * cuadra, expiró— devuelve `null`. Nunca deja pasar por omisión.
 */

/** Lo poco que necesitamos saber de quien entró. */
export interface Identidad {
  correo: string;
  /** Identificador estable de la persona dentro de Access. */
  sujeto: string;
}

interface Cabecera {
  alg?: string;
  kid?: string;
}

interface Carga {
  aud?: string | string[];
  iss?: string;
  email?: string;
  sub?: string;
  exp?: number;
  nbf?: number;
}

/** Margen para relojes que no coinciden, en segundos. */
const HOLGURA = 60;

/**
 * Las claves se guardan en memoria del isolate. Cloudflare las rota, así que
 * hay un plazo; y si aparece un `kid` que no está guardado, se vuelven a pedir
 * en el momento en vez de esperar a que venza el plazo. Eso cubre la rotación
 * sin dejar a nadie fuera y sin pedir las claves en cada petición.
 */
const PLAZO_MS = 60 * 60 * 1000;
let guardadas: { claves: Map<string, CryptoKey>; vence: number } | null = null;

function b64url(texto: string): Uint8Array {
  const base = texto.replace(/-/g, '+').replace(/_/g, '/');
  const relleno = base + '='.repeat((4 - (base.length % 4)) % 4);
  const binario = atob(relleno);
  const salida = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) salida[i] = binario.charCodeAt(i);
  return salida;
}

function json<T>(parte: string): T | null {
  try {
    return JSON.parse(new TextDecoder().decode(b64url(parte))) as T;
  } catch {
    return null;
  }
}

async function pedirClaves(equipo: string): Promise<Map<string, CryptoKey>> {
  const respuesta = await fetch(`https://${equipo}/cdn-cgi/access/certs`);
  if (!respuesta.ok) throw new Error(`certs respondió ${respuesta.status}`);
  const { keys } = (await respuesta.json()) as { keys?: (JsonWebKey & { kid?: string })[] };

  const mapa = new Map<string, CryptoKey>();
  for (const jwk of keys ?? []) {
    if (!jwk.kid) continue;
    mapa.set(
      jwk.kid,
      await crypto.subtle.importKey(
        'jwk',
        jwk,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['verify'],
      ),
    );
  }
  return mapa;
}

async function clavePara(equipo: string, kid: string): Promise<CryptoKey | null> {
  const ahora = Date.now();
  if (!guardadas || guardadas.vence < ahora) {
    guardadas = { claves: await pedirClaves(equipo), vence: ahora + PLAZO_MS };
  }
  const encontrada = guardadas.claves.get(kid);
  if (encontrada) return encontrada;

  // `kid` desconocido: probablemente rotaron. Se piden una vez más antes de
  // rendirse, aunque el plazo no haya vencido.
  guardadas = { claves: await pedirClaves(equipo), vence: ahora + PLAZO_MS };
  return guardadas.claves.get(kid) ?? null;
}

/**
 * Verifica el token de Access y devuelve quién entró, o `null`.
 *
 * `equipo` es el dominio del equipo (`lacasadedios.cloudflareaccess.com`) y
 * `aud` el Application Audience Tag de la aplicación que protege el panel.
 */
export async function verificarToken(
  token: string,
  equipo: string,
  aud: string,
): Promise<Identidad | null> {
  if (!token || !equipo || !aud) return null;

  const partes = token.split('.');
  if (partes.length !== 3) return null;

  const cabecera = json<Cabecera>(partes[0]);
  const carga = json<Carga>(partes[1]);
  if (!cabecera || !carga) return null;

  // Solo RS256, que es lo que firma Access.
  //
  // La defensa de verdad contra la confusión de algoritmos no es esta línea:
  // es que más abajo se verifica SIEMPRE con `RSASSA-PKCS1-v1_5`, fijo en el
  // código, sin mirar lo que diga la cabecera. Un token con `alg: "none"` o
  // `alg: "HS256"` se cae ahí igual. Esta comprobación se queda porque deja
  // escrito qué se acepta, pero no sostiene nada por sí sola —se comprobó
  // quitándola: ninguna prueba falla—.
  if (cabecera.alg !== 'RS256' || !cabecera.kid) return null;

  let clave: CryptoKey | null;
  try {
    clave = await clavePara(equipo, cabecera.kid);
  } catch {
    // Si no se pueden pedir las claves, no se deja pasar a nadie.
    return null;
  }
  if (!clave) return null;

  const firmado = new TextEncoder().encode(`${partes[0]}.${partes[1]}`);
  const firma = b64url(partes[2]);
  const valida = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', clave, firma, firmado);
  if (!valida) return null;

  // ── El token está firmado. Ahora, si es PARA NOSOTROS y está vigente. ──
  const audiencias = Array.isArray(carga.aud) ? carga.aud : carga.aud ? [carga.aud] : [];
  if (!audiencias.includes(aud)) return null;

  if (carga.iss !== `https://${equipo}`) return null;

  const ahora = Math.floor(Date.now() / 1000);
  if (typeof carga.exp !== 'number' || carga.exp + HOLGURA < ahora) return null;
  if (typeof carga.nbf === 'number' && carga.nbf - HOLGURA > ahora) return null;

  if (!carga.email || !carga.sub) return null;
  return { correo: carga.email, sujeto: carga.sub };
}

/**
 * Lo que usa el middleware: saca el token de la petición y lo verifica.
 *
 * Devuelve `null` si no hay cabecera —o sea, si la petición no pasó por
 * Access—, lo que también cubre el caso de que alguien alcance el Worker por
 * una ruta sin proteger.
 */
export async function identidadDeAccess(request: Request): Promise<Identidad | null> {
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) return null;
  return verificarToken(token, process.env.ACCESS_TEAM_DOMAIN ?? '', process.env.ACCESS_AUD ?? '');
}
