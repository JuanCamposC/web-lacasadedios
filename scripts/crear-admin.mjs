/**
 * Crea el primer usuario del panel de administración.
 *
 * No existe ninguna credencial guardada en este repositorio: los usuarios viven
 * en Supabase Auth y solo puede crearlos quien tenga acceso al proyecto. Este
 * script es el atajo para hacerlo sin entrar al panel de Supabase.
 *
 * Uso (la clave secreta NO se guarda en ningún archivo):
 *
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... node scripts/crear-admin.mjs correo@lacasadedios.cl "unaClaveLarga"
 *
 * En PowerShell:
 *
 *   $env:SUPABASE_SERVICE_ROLE_KEY="eyJ..."
 *   node scripts/crear-admin.mjs correo@lacasadedios.cl "unaClaveLarga"
 *
 * La clave secreta se saca de: Supabase → Project Settings → API → service_role.
 * Es una clave de administrador total: no la subas al repositorio ni la pegues
 * en un chat. Una vez creado el usuario, ya no la necesitas.
 */
import { readFileSync } from 'node:fs';

const [email, password] = process.argv.slice(2);
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

function salir(msg) {
  console.error(`\n  ✗ ${msg}\n`);
  process.exit(1);
}

if (!email || !password) salir('Uso: node scripts/crear-admin.mjs <correo> <contraseña>');
if (!service) salir('Falta la variable de entorno SUPABASE_SERVICE_ROLE_KEY.');
if (password.length < 10) salir('Usa una contraseña de al menos 10 caracteres.');

// Lee la URL del proyecto desde .env para no pedirla de nuevo.
let url = process.env.PUBLIC_SUPABASE_URL;
if (!url) {
  try {
    const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
    url = env.match(/^PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]?.trim();
  } catch {
    /* sin .env: se pedirá por variable de entorno */
  }
}
if (!url) salir('No se encontró PUBLIC_SUPABASE_URL (ni en .env ni en el entorno).');

const res = await fetch(`${url}/auth/v1/admin/users`, {
  method: 'POST',
  headers: {
    apikey: service,
    Authorization: `Bearer ${service}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ email, password, email_confirm: true }),
});

const data = await res.json().catch(() => ({}));

if (!res.ok) {
  salir(`Supabase respondió ${res.status}: ${data.msg ?? data.error_description ?? JSON.stringify(data)}`);
}

console.log(`\n  ✓ Usuario creado: ${data.email}`);

// Crear la cuenta ya no basta: las políticas RLS dejaron de mirar si estás
// autenticado y miran si estás en `public.admins` (ver la migración
// «ADMINISTRADORES EXPLÍCITOS» en supabase/schema.sql). Sin esta fila, la
// persona entra al panel pero no puede publicar ni editar nada.
const alta = await fetch(`${url}/rest/v1/admins`, {
  method: 'POST',
  headers: {
    apikey: service,
    Authorization: `Bearer ${service}`,
    'Content-Type': 'application/json',
    Prefer: 'resolution=ignore-duplicates,return=minimal',
  },
  body: JSON.stringify({ user_id: data.id, email: data.email }),
});

if (!alta.ok) {
  const detalle = await alta.text().catch(() => '');
  const faltaTabla = alta.status === 404 || /admins/i.test(detalle);
  console.error(`\n  ✗ La cuenta existe, pero NO se pudo inscribir en public.admins.`);
  console.error(
    faltaTabla
      ? `    Falta correr la migración «ADMINISTRADORES EXPLÍCITOS» de supabase/schema.sql.`
      : `    Supabase respondió ${alta.status}: ${detalle.slice(0, 200)}`,
  );
  console.error(`    Hasta arreglarlo, esa cuenta entra al panel pero no puede editar nada.\n`);
  process.exit(1);
}

console.log(`  ✓ Inscrito en public.admins (necesario para poder editar).`);
console.log(`\n    Entra en /admin/login con ese correo y la contraseña que elegiste.`);
console.log(`    Activa la verificación en dos pasos desde /admin/seguridad.`);
console.log(`    Cambia la contraseña desde Supabase si la compartiste con alguien.\n`);
