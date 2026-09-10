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
 *   · Antes de cancelar Netexplora, para ver qué sigue dependiendo de esa IP.
 *
 * Devuelve 0 si todo cuadra y 1 si hay alguna falla, así que se puede encadenar.
 */
const D = 'lacasadedios.cl';
const IP_NETEXPLORA = '190.113.1.162';

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
  } else if (ip.includes(IP_NETEXPLORA)) {
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
  else if (ip === IP_NETEXPLORA) linea('OK', `mail → ${IP_NETEXPLORA}`);
  else {
    avisos++;
    linea('AVISO', 'mail resuelve a algo inesperado', ip);
  }
}

console.log('\n── cPanel (hasta cancelar Netexplora) ────────────────────────────');
for (const n of ['webmail', 'cpanel', 'whm', 'webdisk', 'ftp']) {
  const b = await pedir(nuevo, `${n}.${D}`, 'A');
  if (b === IP_NETEXPLORA) linea('OK', `${n} → ${IP_NETEXPLORA}`);
  else {
    errores++;
    linea('FALLA', `${n}`, `Cloudflare responde: ${b}`);
  }
}

console.log('\n── Correo ────────────────────────────────────────────────────────');
await igual(D, 'MX');
await igual(`google._domainkey.${D}`, 'TXT', 'DKIM de Google');
await igual(`default._domainkey.${D}`, 'TXT', 'DKIM de cPanel');

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
  } else {
    linea('OK', 'SPF único y corregido', spf[0]);
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
