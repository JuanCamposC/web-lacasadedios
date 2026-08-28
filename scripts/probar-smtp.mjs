/**
 * Comprueba el envío por SMTP y dice EXACTAMENTE qué contesta el servidor.
 *
 * POR QUÉ EXISTE
 * Cuando el aviso a suscriptores falla, el panel solo puede decir «el servidor
 * de correo rechazó los envíos»: el detalle no viaja al navegador a propósito.
 * Queda en los registros de Vercel, pero para saber si el problema es la
 * contraseña, el límite del hosting o que bloquean la IP desde la que se envía,
 * conviene poder preguntárselo al servidor directamente y desde donde quieras.
 *
 * Uso — autenticar y nada más (no envía ningún correo):
 *
 *   node scripts/probar-smtp.mjs
 *
 * Uso — además, mandar un correo de prueba:
 *
 *   node scripts/probar-smtp.mjs contacto@lacasadedios.cl
 *
 * Lee SMTP_HOST, SMTP_PORT, SMTP_USER y SMTP_PASS del entorno, y si no están,
 * del archivo .env. En PowerShell:
 *
 *   $env:SMTP_PASS="..."; node scripts/probar-smtp.mjs
 *
 * SI FUNCIONA AQUÍ PERO NO EN PRODUCCIÓN, el problema no son las credenciales
 * sino desde dónde se conecta: el hosting está bloqueando la IP de Vercel.
 */
import { readFileSync } from 'node:fs';
import nodemailer from 'nodemailer';

const destino = process.argv[2];

// Variables del entorno; lo que falte se busca en .env.
const env = { ...leerEnv(), ...soloDefinidas(process.env) };

function leerEnv() {
  try {
    const texto = readFileSync(new URL('../.env', import.meta.url), 'utf8');
    return Object.fromEntries(
      texto
        .split(/\r?\n/)
        .map((l) => l.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/))
        .filter(Boolean)
        .map((m) => [m[1], m[2].trim().replace(/^(['"])([\s\S]*)\1$/, '$2')]),
    );
  } catch {
    return {};
  }
}

function soloDefinidas(o) {
  return Object.fromEntries(
    ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'CONTACT_FROM']
      .filter((k) => o[k])
      .map((k) => [k, o[k]]),
  );
}

function salir(msg) {
  console.error(`\n  ✗ ${msg}\n`);
  process.exit(1);
}

const host = env.SMTP_HOST;
const user = env.SMTP_USER;
const pass = env.SMTP_PASS;
const port = Number(env.SMTP_PORT) || 465;

if (!host || !user || !pass)
  salir('Faltan SMTP_HOST, SMTP_USER o SMTP_PASS (ni en el entorno ni en .env).');

console.log(`\n  Servidor  ${host}:${port} (${port === 465 ? 'TLS directo' : 'STARTTLS'})`);
console.log(`  Casilla   ${user}`);
console.log(
  `  Clave     ${pass.length} caracteres${/\s/.test(pass) ? '  ⚠ contiene espacios' : ''}`,
);

const transporte = nodemailer.createTransport({
  host,
  port,
  secure: port === 465,
  requireTLS: port !== 465,
  auth: { user, pass },
});

/** Traduce lo que suele contestar un Exim de cPanel. */
function pista(e) {
  const t = `${e.responseCode ?? ''} ${e.response ?? e.message ?? ''}`;
  if (/535|authentication|autenticaci/i.test(t))
    return 'La contraseña no es correcta, o el usuario no es la dirección completa con arroba.';
  if (/max emails|exceeded|hour/i.test(t))
    return 'Se topó el límite de correos por hora de la cuenta. Se ve y se sube en cPanel.';
  if (/ETIMEDOUT|ECONNREFUSED|ECONNRESET|EHOSTUNREACH/i.test(`${e.code} ${t}`))
    return 'No se llegó a hablar con el servidor: cortafuegos, IP bloqueada o puerto cerrado.';
  if (/relay|not permitted|sender/i.test(t))
    return 'El servidor no acepta ese remitente. Debe coincidir con la casilla autenticada.';
  if (/spam|blocked|blacklist/i.test(t))
    return 'El servidor bloqueó el envío por sus reglas antispam. Hay que preguntarle al hosting.';
  return null;
}

function contar(e) {
  console.error(`\n  ✗ ${e.message}`);
  if (e.code) console.error(`    código:    ${e.code}`);
  if (e.responseCode) console.error(`    respuesta: ${e.responseCode}`);
  if (e.response) console.error(`    servidor:  ${String(e.response).trim()}`);
  const p = pista(e);
  if (p) console.error(`\n  → ${p}`);
  console.error('');
  process.exit(1);
}

try {
  await transporte.verify();
  console.log('\n  ✓ Conecta y autentica correctamente.');
} catch (e) {
  contar(e);
}

if (!destino) {
  console.log('\n  No se envió ningún correo. Pasa una dirección para probar el envío:');
  console.log(`    node scripts/probar-smtp.mjs ${user}\n`);
  transporte.close();
  process.exit(0);
}

try {
  const info = await transporte.sendMail({
    from: env.CONTACT_FROM || user,
    to: destino,
    subject: 'Prueba de envío — La Casa de Dios',
    text: 'Si lees esto, el envío por SMTP funciona.',
  });
  console.log(`  ✓ Enviado a ${destino}`);
  console.log(`    aceptados: ${info.accepted?.join(', ') || '—'}`);
  if (info.rejected?.length) console.log(`    rechazados: ${info.rejected.join(', ')}`);
  console.log(`    respuesta: ${String(info.response ?? '').trim()}\n`);
} catch (e) {
  contar(e);
} finally {
  transporte.close();
}
