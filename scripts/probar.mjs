import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Lanza vitest desde la raíz del proyecto, con la letra de unidad en MAYÚSCULA.
 *
 * ── EL FALLO QUE ESTO EVITA ─────────────────────────────────────────────────
 * En Windows, `C:\proyecto` y `c:\proyecto` son la misma carpeta para el
 * sistema de archivos y DOS direcciones distintas para los módulos de
 * JavaScript, que se identifican por su URL. Si el intérprete resuelve unos
 * como `file:///C:/…` y otros como `file:///c:/…`, Node carga el mismo archivo
 * DOS VECES y cada copia tiene su propio estado.
 *
 * Vitest se rompe entero por eso. El estado del corredor lo guarda una copia y
 * el `describe` de cada prueba lo busca en la otra, que está vacía:
 *
 *     TypeError: Cannot read properties of undefined (reading 'config')
 *       at initSuite (vitest/dist/chunks/run.js)
 *       at src/lib/hora.test.ts:22:1
 *
 * Fallan las dieciocho suites a la vez, incluidas las que no se tocaron, y el
 * mensaje no menciona rutas ni mayúsculas por ningún lado. Cuesta una tarde
 * encontrarlo y treinta segundos si ya se sabe. Pasó el 28 de noviembre de
 * 2026 y se diagnosticó mirando el stack: la mitad de las líneas decían
 * `file:///C:/` y la otra mitad `file:///c:/`.
 *
 * ── DE DÓNDE SALE LA MINÚSCULA ──────────────────────────────────────────────
 * Del directorio desde el que se lanza. Según cómo se haya abierto la consola
 * —`cd /c/…` en Git Bash, un acceso directo, una sesión heredada— el shell
 * entrega la unidad en minúscula, y `process.cwd()` la arrastra. No es un
 * error de nadie y no se puede arreglar desde `vitest.config.ts`: para cuando
 * esa configuración se lee, los módulos ya se resolvieron.
 *
 * Lo único que lo arregla es fijar el directorio ANTES de arrancar, que es lo
 * que hace este archivo. Se resuelve desde su propia ubicación, así que da
 * igual desde dónde se llame.
 *
 * En Linux y macOS no hay letra de unidad: la expresión no calza con nada, la
 * ruta queda igual y esto es un `spawn` de más y nada peor.
 */
const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const normalizada = raiz.replace(/^([a-z]):/, (_, unidad) => `${unidad.toUpperCase()}:`);

// Lo que venga después de `npm test` se pasa tal cual: `npm test -- --watch`,
// un archivo suelto, `-t` para filtrar por nombre.
const argumentos = ['vitest', 'run', ...process.argv.slice(2)];

const hijo = spawn('npx', argumentos, {
  cwd: normalizada,
  stdio: 'inherit',
  // `shell: true` hace falta en Windows: `npx` es un .cmd y sin esto
  // `spawn` no lo encuentra.
  shell: true,
});

hijo.on('exit', (codigo, senal) => {
  // Se devuelve el código de vitest para que siga sirviendo en una cadena de
  // comandos: `npm test && npm run build`.
  if (senal) process.kill(process.pid, senal);
  else process.exit(codigo ?? 1);
});
