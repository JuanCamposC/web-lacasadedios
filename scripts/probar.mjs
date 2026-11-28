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

/*
 * vitest se lanza con el propio Node y su archivo de entrada, no con `npx`.
 *
 * La primera versión de esto usaba `spawn('npx', …, { shell: true })`, porque
 * en Windows `npx` es un `.cmd` y sin shell no se encuentra. Funcionaba, pero
 * Node avisaba en cada ejecución (DEP0190): con `shell: true` los argumentos
 * se PEGAN en una cadena de texto sin escapar. Un archivo de prueba con un
 * espacio en el nombre se partía en dos, y cualquier carácter que la shell
 * interprete —`&`, `|`, `>`— se ejecutaba en vez de pasarse.
 *
 * Así no hay shell en medio: `process.execPath` es el mismo Node que corre este
 * archivo, y los argumentos viajan como lista, tal cual, sin interpretar nada.
 * Funciona igual en los tres sistemas y no depende de que `npx` esté en el PATH.
 */
const vitest = resolve(normalizada, 'node_modules', 'vitest', 'vitest.mjs');

/*
 * Lo que venga después de `npm test` se pasa tal cual: un archivo suelto, `-t`
 * para filtrar por nombre.
 *
 * Con una excepción: `--watch`. La versión anterior mandaba siempre `vitest run`
 * y le añadía detrás lo que viniera, así que `npm run test:watch` terminaba en
 * `vitest run --watch`, que se contradice: `run` es «una vez y salir». Si se
 * pide mirar, se llama a `vitest` sin subcomando, que es su modo de vigilancia.
 */
const pedidos = process.argv.slice(2);
const mirar = pedidos.includes('--watch') || pedidos.includes('-w');
const argumentos = mirar
  ? pedidos.filter((a) => a !== '--watch' && a !== '-w')
  : ['run', ...pedidos];

const hijo = spawn(process.execPath, [vitest, ...argumentos], {
  cwd: normalizada,
  stdio: 'inherit',
});

hijo.on('exit', (codigo, senal) => {
  // Se devuelve el código de vitest para que siga sirviendo en una cadena de
  // comandos: `npm test && npm run build`.
  if (senal) process.kill(process.pid, senal);
  else process.exit(codigo ?? 1);
});
