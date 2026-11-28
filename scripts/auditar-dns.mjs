import { Resolver } from 'node:dns/promises';

/**
 * Compara la zona de Cloudflare contra la que hoy sirve Netexplora.
 *
 *   node scripts/auditar-dns.mjs
 *
 * Se pregunta DIRECTO a cada par de servidores autoritativos, no al resolutor
 * público: Cloudflare ya responde por la zona aunque el dominio todavía no la
 * use, y así se ve lo que pasará al cambiar los nameservers, no lo que pasa hoy.
 *
 * Dos diferencias son ESPERADAS y van marcadas como tales: el SPF y el DMARC
 * están corregidos a propósito. Todo lo demás tiene que coincidir.
 *
 * Sirve tres veces:
 *   · ANTES de cambiar los nameservers en NIC Chile — que es para lo que se
 *     escribió, y da luz verde o la niega.
 *   · DESPUÉS del cambio, para confirmar que nada se movió.
 *   · Al DAR DE BAJA Netexplora, para ver qué sigue colgando de esa IP.
 *
 * ── EN QUÉ FASE ESTÁ ESTE ARCHIVO ───────────────────────────────────────────
 * En la tercera, desde el 28 de noviembre de 2026, cuando la iglesia decidió
 * dejar vencer el servidor antiguo sin sacar copia. Tres comprobaciones están
 * DADAS VUELTA respecto de la versión original: los cinco nombres de cPanel, el
 * `ip4:` del SPF y el DKIM de cPanel ya NO deben estar, cuando antes lo
 * correcto era que siguieran. Cada una explica el porqué en su sitio.
 *
 * Devuelve 0 si todo cuadra y 1 si hay alguna falla, así que se puede encadenar.
 */
const D = 'lacasadedios.cl';
/**
 * La IP del servidor viejo, que se pasa por el entorno:
 *
 *   IP_ANTIGUA=1.2.3.4 node scripts/auditar-dns.mjs
 *
 * Estaba escrita aquí, y este repositorio es público: publicar la IP de origen
 * permite saltarse el proxy de Cloudflare y golpear al servidor directo. Sin la
 * variable, las comprobaciones que dependen de ella se saltan y el resto del
 * informe funciona igual.
 */
const IP_NETEXPLORA = (process.env.IP_ANTIGUA ?? '').trim();

const NS_VIEJO = 'ns308.netexplora.com';
const NS_NUEVO = 'barbara.ns.cloudflare.com';

const publico = new Resolver({ timeout: 5000, tries: 2 });
publico.setServers(['8.8.8.8']);

async function servidor(host) {
  const [ip] = await publico.resolve4(host);
  const r = new Resolver({ timeout: 6000, tries: 3 });
  r.setServers([ip]);
  return { host, ip, r };
}

const viejo = await servidor(NS_VIEJO);
const nuevo = await servidor(NS_NUEVO);

console.log(`Netexplora  ${viejo.host} (${viejo.ip})`);
console.log(`Cloudflare  ${nuevo.host} (${nuevo.ip})\n`);

const norm = (v) => {
  if (!v) return null;
  if (Array.isArray(v)) {
    return v
      .map((x) =>
        Array.isArray(x) ? x.join('') : typeof x === 'object' ? JSON.stringify(x) : String(x),
      )
      .sort()
      .join(' ;; ');
  }
  return String(v);
};

async function pedir({ r }, nombre, tipo) {
  const fn = {
    A: () => r.resolve4(nombre),
    CNAME: () => r.resolveCname(nombre),
    MX: () => r.resolveMx(nombre),
    TXT: () => r.resolveTxt(nombre),
    SRV: () => r.resolveSrv(nombre),
  }[tipo];
  try {
    const v = norm(await fn());
    // Los nombres de dominio no distinguen mayúsculas (RFC 4343): Netexplora
    // publica SMTP.GOOGLE.COM y Cloudflare lo normaliza a minúsculas, y es el
    // mismo registro. En TXT NO se puede bajar: el DKIM es base64 y ahí la
    // caja sí importa.
    return v && tipo !== 'TXT' ? v.toLowerCase() : v;
  } catch {
    return null;
  }
}

let errores = 0;
let avisos = 0;

const linea = (estado, texto, extra = '') => {
  console.log(`${estado.padEnd(6)} ${texto}${extra ? '\n       ' + extra : ''}`);
};

/** Tiene que responder lo mismo en los dos lados. */
async function igual(nombre, tipo, etiqueta = `${tipo} ${nombre}`) {
  const [a, b] = await Promise.all([pedir(viejo, nombre, tipo), pedir(nuevo, nombre, tipo)]);
  if (a === b) {
    linea(a === null ? 'vacío' : 'OK', etiqueta);
    return true;
  }
  errores++;
  linea('FALLA', etiqueta, `Netexplora: ${a}\n       Cloudflare: ${b}`);
  return false;
}

/** No debe existir en Cloudflare (se dejó fuera a propósito). */
async function ausente(nombre, tipo, motivo) {
  const b = await pedir(nuevo, nombre, tipo);
  if (b === null) {
    linea('OK', `sin ${tipo} ${nombre}`, motivo);
  } else {
    avisos++;
    linea('SOBRA', `${tipo} ${nombre}`, `${b}\n       ${motivo}`);
  }
}

// Desde el 10 de septiembre de 2026 el sitio ya NO debe apuntar a Netexplora:
// el raíz y www los sirve el Worker de la página de construcción, con las IP
// anycast de Cloudflare. Antes de esa fecha este bloque comprobaba lo contrario
// —que las dos zonas dieran la misma IP—, y tenía sentido entonces.
console.log('── Sitio web (lo sirve el Worker) ────────────────────────────────');
for (const n of [D, `www.${D}`]) {
  const ip = await pedir(nuevo, n, 'A');
  if (!ip) {
    errores++;
    linea('FALLA', `${n} no resuelve`);
  } else if (IP_NETEXPLORA && ip.includes(IP_NETEXPLORA)) {
    errores++;
    linea('FALLA', `${n} sigue apuntando a Netexplora`, ip);
  } else {
    linea('OK', `${n} → Cloudflare`, ip);
  }
}

/*
 * `mail` era un CNAME al dominio raíz. Al pasar el raíz a ser dominio
 * personalizado de un Worker, dejó de resolver: Cloudflare sintetiza la
 * respuesta para ese hostname exacto, y un CNAME que apunta ahí no hereda esa
 * dirección — se queda sin A y con `100::` en AAAA, que es la dirección de
 * descarte del RFC 6666.
 *
 * No rompe nada: el correo entra y sale por el MX, que es `smtp.google.com`, y
 * ya no quedan casillas en cPanel que pudieran usar ese nombre como servidor.
 * Se avisa, no se falla, porque es válido dejarlo así o borrarlo.
 */
{
  const ip = await pedir(nuevo, `mail.${D}`, 'A');
  if (!ip) linea('OK', 'sin mail', 'borrado el 2026-09-10; el correo va por el MX');
  else if (IP_NETEXPLORA && ip === IP_NETEXPLORA) linea('OK', 'mail → servidor antiguo');
  else {
    avisos++;
    linea('AVISO', 'mail resuelve a algo inesperado', ip);
  }
}

/*
 * ── EL CPANEL YA NO DEBE ESTAR ───────────────────────────────────────────────
 * Esta comprobación está DADA VUELTA desde el 28 de noviembre de 2026.
 *
 * Mientras duró la migración lo correcto era que estos cinco nombres siguieran
 * apuntando a Netexplora: el correo viejo y el acceso al panel de hosting
 * dependían de ellos, y que faltaran era la falla. La iglesia decidió dejar
 * vencer el servidor antiguo y no sacar copia, así que ahora es al revés: cada
 * uno que siga en pie es un nombre del dominio apuntando a una máquina que ya
 * no se controla.
 *
 * No es teórico. Cuando el proveedor reasigne esa IP a otro cliente,
 * `webmail.lacasadedios.cl` seguirá resolviendo —a la máquina de un
 * desconocido— y seguirá pareciendo de la iglesia.
 */
console.log('\n── cPanel (tiene que estar BORRADO) ──────────────────────────────');
for (const n of ['webmail', 'cpanel', 'whm', 'webdisk', 'ftp']) {
  const b = await pedir(nuevo, `${n}.${D}`, 'A');
  if (!b) linea('OK', `${n} borrado`);
  else if (IP_NETEXPLORA && b === IP_NETEXPLORA) {
    errores++;
    linea('FALLA', `${n} sigue apuntando al servidor antiguo`, b);
  } else {
    avisos++;
    linea('AVISO', `${n} resuelve a algo inesperado`, b);
  }
}

console.log('\n── Correo ────────────────────────────────────────────────────────');
await igual(D, 'MX');
await igual(`google._domainkey.${D}`, 'TXT', 'DKIM de Google');
/*
 * El DKIM de cPanel firma correo que ya no sale de ahí: el MX es de Google y
 * quien firma de verdad es `google._domainkey`. Dejarlo no rompe nada hoy, pero
 * es una llave publicada de una cerradura que se regala. Se avisa y no se
 * falla: borrarlo es ordenado, no urgente.
 */
{
  const dk = await pedir(nuevo, `default._domainkey.${D}`, 'TXT');
  if (!dk) linea('OK', 'DKIM de cPanel borrado');
  else {
    avisos++;
    linea('AVISO', 'queda el DKIM de cPanel', 'ya no firma nada: el correo sale por Google');
  }
}

// SPF: uno solo, y el corregido.
{
  const txts = (await pedir(nuevo, D, 'TXT')) ?? '';
  const spf = txts.split(' ;; ').filter((t) => t.startsWith('v=spf1'));
  if (spf.length !== 1) {
    errores++;
    linea('FALLA', `SPF: hay ${spf.length} registros, tiene que haber 1`, spf.join('\n       '));
  } else if (!spf[0].includes('include:_spf.google.com')) {
    errores++;
    linea('FALLA', 'SPF no autoriza a Google', spf[0]);
  } else if (IP_NETEXPLORA && spf[0].includes(`ip4:${IP_NETEXPLORA}`)) {
    /*
     * El servidor viejo sigue autorizado a enviar correo como la iglesia.
     *
     * Mientras el hosting fuera nuestro daba igual. Al darlo de baja, esa
     * dirección vuelve al proveedor y se la asignan a otro cliente — que podrá
     * mandar correo que PASE el SPF de lacasadedios.cl. Hay que quitarlo antes
     * de soltar el hosting, no después.
     */
    errores++;
    linea('FALLA', 'el SPF todavía autoriza al servidor antiguo', spf[0]);
  } else {
    linea('OK', 'SPF único y sin el servidor antiguo', spf[0]);
  }

  const verif = txts.split(' ;; ').filter((t) => t.startsWith('google-site-verification='));
  if (verif.length === 1) linea('OK', 'verificación de Google presente');
  else {
    errores++;
    linea('FALLA', `verificación de Google: ${verif.length} registros`);
  }
}

// DMARC: uno solo, y con rua.
{
  const txts = (await pedir(nuevo, `_dmarc.${D}`, 'TXT')) ?? '';
  const d = txts.split(' ;; ').filter((t) => t.startsWith('v=DMARC1'));
  if (d.length !== 1) {
    errores++;
    linea('FALLA', `DMARC: hay ${d.length} registros, tiene que haber 1`, d.join('\n       '));
  } else if (!d[0].includes('rua=')) {
    avisos++;
    linea('AVISO', 'DMARC sin rua: nadie recibirá los informes', d[0]);
  } else {
    linea('OK', 'DMARC único y con rua', d[0]);
  }
}

console.log('\n── Lo que NO debe estar ──────────────────────────────────────────');
await ausente(`autodiscover.${D}`, 'A', 'mandaba a Outlook al servidor equivocado');
await ausente(`autoconfig.${D}`, 'A', 'lo mismo, por la vía antigua');
// `_acme-challenge` ya NO se comprueba: al conectar el dominio al Worker,
// Cloudflare publica ahí sus propios tokens para emitir el certificado. Verlo
// es señal de que el certificado está en trámite, no de basura heredada.
await ausente(`_autodiscover._tcp.${D}`, 'SRV', 'autodescubrimiento de cPanel');
for (const s of ['_caldav._tcp', '_caldavs._tcp', '_carddav._tcp', '_carddavs._tcp']) {
  await ausente(`${s}.${D}`, 'SRV', 'calendario/contactos de cPanel');
}

console.log('\n──────────────────────────────────────────────────────────────────');
if (errores === 0 && avisos === 0) {
  console.log('TODO VERDE. La zona responde como corresponde.');
} else {
  console.log(`${errores} falla(s) y ${avisos} aviso(s). Revisa antes de seguir adelante.`);
}
process.exit(errores === 0 ? 0 : 1);
