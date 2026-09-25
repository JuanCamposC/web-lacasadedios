/**
 * Un respaldo de la base, comprimido, con limpieza de los viejos.
 *
 *     npm run respaldo
 *
 * ── QUÉ RESPALDA Y QUÉ NO ───────────────────────────────────────────────────
 * La base entera: noticias, eventos, videos, reuniones, enlaces, estudios,
 * ajustes y la lista de suscriptores. Es lo único que no se puede reconstruir:
 * el sitio está en Git y las imágenes y los audios están en R2, que guarda tres
 * copias de cada archivo en sitios distintos.
 *
 * ── DÓNDE SE GUARDA, Y POR QUÉ NO EN EL REPOSITORIO ─────────────────────────
 * En una carpeta de la casa del usuario, FUERA del proyecto. No es una
 * preferencia: el repositorio es público y el volcado trae los correos de los
 * suscriptores y lo que la gente escribió por el formulario. Guardándolo fuera,
 * no hay forma de subirlo por descuido con un `git add -A`.
 *
 * Se puede cambiar con la variable RESPALDOS_DIR, por ejemplo a una carpeta
 * sincronizada con Drive, que es la única forma de que el respaldo sobreviva a
 * que se muera el computador.
 *
 * ── POR QUÉ NO SE HACE UNA BOLA DE NIEVE ────────────────────────────────────
 * Dos cosas. La primera es el tamaño: el volcado completo ocupa 17 kB y
 * comprimido no llega a 4, así que cien respaldos son menos de medio megabyte.
 * La base de una iglesia con cuatro templos no crece como una tienda.
 *
 * La segunda es que se borran los intermedios. Se conservan:
 *
 *   · todos los de los últimos 14 días   (para deshacer un error reciente)
 *   · el primero de cada mes, 12 meses   (para volver a «como estaba en mayo»)
 *   · el primero de cada año, siempre    (memoria, y cuesta 4 kB al año)
 *
 * Lo que se pierde al borrar un intermedio es poder volver a un martes de hace
 * ocho meses, que no le sirve a nadie. Lo que se gana es que la carpeta no haya
 * que mirarla nunca.
 */
import { execSync } from 'node:child_process';
import { gzipSync, gunzipSync } from 'node:zlib';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync, statSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = 'lacasadedios';
const CARPETA = process.env.RESPALDOS_DIR || join(homedir(), 'respaldos-lacasadedios');
const DIAS_ENTEROS = 14;
const MESES = 12;

const hoy = new Date().toISOString().slice(0, 10);
const kb = (n) => `${(n / 1024).toFixed(1)} kB`;

mkdirSync(CARPETA, { recursive: true });

/* ── 1. Exportar ─────────────────────────────────────────────────────────── */
const crudo = join(tmpdir(), `${BASE}-${hoy}.sql`);
console.log(`Exportando ${BASE} desde Cloudflare…`);

// `execSync` y no `execFileSync`: en Windows, Node 20 en adelante se niega a
// lanzar un `.cmd` directamente y responde EINVAL. Con la shell de por medio
// funciona igual en los tres sistemas. La ruta va entre comillas porque la
// carpeta temporal de Windows lleva el nombre del usuario y puede traer
// espacios.
execSync(`npx wrangler d1 export ${BASE} --remote --output "${crudo}"`, {
  stdio: ['ignore', 'ignore', 'inherit'],
});

const sql = readFileSync(crudo);
const destino = join(CARPETA, `${BASE}-${hoy}.sql.gz`);
// Nivel 9: son kilobytes, el tiempo de compresión no se nota y esto se guarda
// durante años.
writeFileSync(destino, gzipSync(sql, { level: 9 }));
unlinkSync(crudo);

console.log(`   ${destino}`);
console.log(`   ${kb(sql.length)} de SQL → ${kb(statSync(destino).size)} comprimidos`);

/* ── 2. Comprobar que se puede leer ──────────────────────────────────────── */
// Un respaldo que no se ha abierto nunca no es un respaldo. Se comprueba que el
// archivo descomprime y que trae las tablas que tiene que traer; si no, mejor
// enterarse ahora que el día que haga falta.
const leido = gunzipSync(readFileSync(destino)).toString('utf8');
const faltan = ['noticias', 'eventos', 'suscriptores', 'ajustes', 'reuniones', 'estudios'].filter(
  (t) => !leido.includes(`CREATE TABLE ${t}`),
);
if (faltan.length > 0) {
  console.error(`   ⚠  El respaldo NO trae estas tablas: ${faltan.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log('   Comprobado: descomprime y trae las tablas.');
}

/* ── 3. Limpiar los intermedios ──────────────────────────────────────────── */
const archivos = readdirSync(CARPETA)
  .filter((f) => new RegExp(`^${BASE}-\\d{4}-\\d{2}-\\d{2}\\.sql\\.gz$`).test(f))
  .sort();

const fechaDe = (f) => f.slice(BASE.length + 1, BASE.length + 11);
const haceDias = (dias) => new Date(Date.now() - dias * 86400_000).toISOString().slice(0, 10);
const recientes = haceDias(DIAS_ENTEROS);
const mesLimite = haceDias(MESES * 31).slice(0, 7);

// El primero de cada mes y de cada año que existe en la carpeta. «Primero» es el
// primero que HAY, no el día 1: si el mes empezó sin respaldos, el que valga es
// el del día 9.
const primeroDe = new Map();
for (const f of archivos) {
  for (const clave of [fechaDe(f).slice(0, 7), fechaDe(f).slice(0, 4)]) {
    if (!primeroDe.has(clave)) primeroDe.set(clave, f);
  }
}

const sobran = archivos.filter((f) => {
  const fecha = fechaDe(f);
  if (fecha >= recientes) return false; // de los últimos días, todos
  if (primeroDe.get(fecha.slice(0, 4)) === f) return false; // el primero del año, siempre
  // El primero de cada mes, mientras el mes entre en la ventana de 12.
  if (fecha.slice(0, 7) >= mesLimite && primeroDe.get(fecha.slice(0, 7)) === f) return false;
  return true;
});

for (const f of sobran) unlinkSync(join(CARPETA, f));

const quedan = archivos.length - sobran.length;
const cuenta = quedan === 1 ? 'queda 1 respaldo' : `quedan ${quedan} respaldos`;
console.log();
console.log(
  sobran.length > 0
    ? `Borrados ${sobran.length} intermedios; ${cuenta} en la carpeta.`
    : `Nada que limpiar: ${cuenta} en la carpeta.`,
);
