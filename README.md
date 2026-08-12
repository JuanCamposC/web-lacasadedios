# La Casa de Dios — Sitio web

Sitio institucional de la iglesia **La Casa de Dios**: templos (Santiago Centro,
San Miguel, Limache y Coya), horarios de culto, historia, declaración de fe,
contacto, y secciones de **eventos, noticias y videos** gestionables desde un
panel con login.

Construido con **Astro 7** (SSR en Vercel), **Tailwind CSS 4** + **DaisyUI 5** (temas
`church` claro y `churchdark` oscuro), **astro-icon** (Lucide) y **Supabase** (base de
datos + auth + storage). Diseño cinematográfico: heros con foto, movimiento en scroll
(`src/scripts/reveal.ts`) e imágenes optimizadas con `<Image>`. Las fotos son de stock
temporal (ver `src/assets/img/CREDITS.md`), reemplazables por fotografía real.

## 🧞 Comandos

| Comando           | Acción                                       |
| :---------------- | :------------------------------------------- |
| `npm install`     | Instala dependencias                         |
| `npm run dev`     | Servidor local en `localhost:4321`           |
| `npm run build`   | Compila el sitio                             |

## 🗺️ Mapa del sitio

| Ruta | Qué es | Render |
| :--- | :--- | :--- |
| `/` | Portada: hero, quiénes somos, templos, horarios, redes | estático |
| `/sobre-nosotros` | Misión y visión · **Historia** · Valores · Liderazgo · **Pastores y líderes** · **Declaración de fe** · Sacramentos | estático |
| `/templos` | Listado de las cuatro sedes con dirección, líder y resumen de horarios | estático |
| `/templos/{sede}` | Ficha de cada templo: mapa, horarios, pastor a cargo | estático |
| `/horarios` | Todas las reuniones de la semana, con filtro por sede y marca de «hoy» | estático |
| `/contacto` | Formulario + datos de contacto + direcciones | **SSR** |
| `/eventos` | Próximos eventos y eventos anteriores | **SSR** |
| `/noticias` | Listado con noticia destacada | **SSR** |
| `/noticias/{slug}` | Noticia completa, compartir y «sigue leyendo» | **SSR** |
| `/videos` | Prédicas embebidas de YouTube | **SSR** |
| `/en-vivo` | Transmisión en vivo + días de reunión | **SSR** |
| `/404` | Página no encontrada con atajos | estático |
| `/admin/*` | Panel de administración | **SSR** protegido |

## 📁 Estructura

```text
src/
├── components/
│   ├── Navigation · Footer          Cabecera y pie (leen src/data/nav.ts)
│   ├── PageHero · SectionHeading    Encabezados
│   ├── TemploCard · ScheduleList    Piezas de templos y horarios
│   ├── CtaBand · EmptyState         Bandas de cierre y estados vacíos
│   ├── Breadcrumbs · Reveal         Migas de pan y animación en scroll
│   ├── ContactForm                  Formulario de contacto
│   └── TemploPage                   Plantilla de la ficha de cada sede
├── data/
│   ├── site.ts       ★ Identidad, contacto y redes sociales
│   ├── nav.ts        ★ Arquitectura de navegación (cabecera y pie)
│   ├── templos.ts    ★ Sedes, horarios y utilidades (weekSchedule, parseService)
│   └── historia.ts   ★ Relato e hitos de la historia
├── layouts/          Layout (público) y AdminLayout (panel)
├── lib/supabase.ts   Clientes Supabase (browser/server) + tipos
├── middleware.ts     Protege /admin y expone el cliente en rutas SSR
├── scripts/          reveal.ts (scroll + contadores), adminCrud.ts
├── styles/global.css Temas DaisyUI + sistema de diseño (.panel, .section, .prose-lcd…)
└── pages/            Ver el mapa del sitio de arriba
```

## ✏️ Dónde se edita cada cosa

| Quiero cambiar… | Archivo |
| :--- | :--- |
| Correo, teléfono, redes sociales | [`src/data/site.ts`](src/data/site.ts) |
| Direcciones, horarios, pastores, mapas | [`src/data/templos.ts`](src/data/templos.ts) |
| Menú de la cabecera y columnas del pie | [`src/data/nav.ts`](src/data/nav.ts) |
| Historia de la congregación | [`src/data/historia.ts`](src/data/historia.ts) |
| Colores, tipografía, superficies | [`src/styles/global.css`](src/styles/global.css) |
| Eventos, noticias, videos, «en vivo» | El panel **`/admin`** |

## 🎨 Identidad visual

### De dónde sale

La paleta y la tipografía salen del mundo de la congregación, no del catálogo
del framework: el azul de los estandartes y las fachadas pintadas de la
tradición evangélica chilena, el bronce de los instrumentos y las letras, el
muro encalado bajo tubo fluorescente, y el azul de la noche del culto de tarde.

| | | |
| :--- | :--- | :--- |
| `azul-vivo` | `#23448F` | primario: enlaces, botones y tintes |
| `azul-estandarte` | `#14295C` | secundario: superficies serias |
| `azul-noche` | `#0A1730` | bandas oscuras y el cartel |
| `bronce` | `#7D5518` | acento **solo** estructural, nunca relleno |
| `boletin` | `#FCFAF7` | base clara: papel, no blanco de pantalla |
| `papel-hondo` | `#ECE4D6` | superficie secundaria |
| `tinta` | `#17202E` | texto |

**Tres correcciones que costaron una vuelta** — vale la pena no repetirlas:

1. **El azul primario no puede ser el más oscuro.** El estandarte (`#14295C`)
   es tan oscuro que sobre fondo claro no se distingue de la tinta: los enlaces
   dejaban de parecer enlaces. Queda de superficie; lo interactivo lo hace el
   azul vivo.
2. **Papel, no pantalla.** La base era `#FFFFFF` con una secundaria un 3 % más
   oscura: las bandas no se separaban y el conjunto salía frío. Ahora la base es
   papel de boletín y la secundaria un 20 % más marcada. La calidez no viene de
   bajar el color, sino de que la tinta azul caiga sobre papel tibio.
3. **El bronce tenía que ser legible.** `#A9752A` daba 3,99:1 sobre blanco —
   reprobaba AA para texto normal, y de ahí buena parte del aire apagado.

Sobre las bandas oscuras, `.section-dark` y `.cartel` **redefinen las variables
del tema** (`--color-accent`, `--color-primary`…) en vez de pelear con las
utilidades: así `text-accent` o `btn-primary` se aclaran solos ahí dentro.

Todos los pares de color pasan WCAG AA. El script que lo comprueba está en el
historial de esta sección; si tocas la paleta, vuelve a medir.

### Tres voces tipográficas

| Rol | Familia | Dónde |
| :--- | :--- | :--- |
| Display | **Fraunces Variable** (eje `opsz`) | `h1`, `h2`, `.font-display`, `.versiculo` |
| Cuerpo | **Archivo Variable** | todo lo demás, incluidos `h3`/`h4` y `.card-title` |
| Datos | **Archivo Narrow Variable** | `.font-data`, `.eyebrow`, horas, cifras e iniciales |

El display se usa **con restricción**: si apareciera también en cada título de
tarjeta, dejaría de significar algo. Los números y las iniciales van en la voz
de datos, no en la de titulares. Solo se carga el romano de cada familia; por
eso el versículo no va en cursiva — la cursiva sintética arruina un serif.

> **No declares `font-variation-settings` en el display.** Fraunces trae eje de
> tamaño óptico: a 4 rem dibuja letras de alto contraste y a 1,5 rem letras de
> texto, y el navegador lo modula solo. Fijar cualquier eje ahí congela también
> el óptico, y los titulares grandes salen pesados y romos — que es exactamente
> como se veían sobre fondo claro. Por lo mismo, `.font-display` fija el peso
> (550) y **no** se le agrega `font-bold`.

### El cartel

El elemento firma. Es el tablero de horarios que la iglesia cuelga en la puerta
del templo, traducido a pantalla: gobierna el hero de la portada y toda la
página `/horarios`. No es adorno — «¿a qué hora se reúnen?» es la pregunta que
más recibe una iglesia. El día de hoy se enciende en el navegador; sin
JavaScript el cartel se ve completo igual, solo no enciende.

Vive en [`Cartel.astro`](src/components/Cartel.astro) y en las clases
`.cartel-*` de `global.css`. Las horas se agrupan por franja
(`groupByTime` en `templos.ts`): si tres templos se reúnen a las 20:00, se dice
una vez «20:00» y se nombran los tres.

### Movimiento

**Un solo momento orquestado**: el cartel se arma fila por fila al cargar y la
fila de hoy enciende al final. Se quitaron el Ken Burns de cada hero, el
flotado y el gradiente animado — efectos dispersos que competían entre sí.
Queda además la entrada por scroll (`[data-reveal]`). Todo respeta
`prefers-reduced-motion`.

### Clases compartidas

- `.section` / `.section-sm` — ritmo vertical responsive (`4rem` móvil, `6rem` desktop).
- `.wrap` / `.wrap-narrow` — contenedores de `72rem` y `48rem`.
- `.panel` / `.panel-sm` / `.panel-lift` / `.panel-invert` — superficies.
- `.eyebrow` · `.versiculo` · `.font-data` — voces tipográficas.
- `.prose-lcd` — cuerpo de texto largo (noticias, historia).
- `.skip-link` y foco visible global — accesibilidad por teclado.
- `.clamp-2/3/4` — recorte de texto por líneas.

### Dos trampas que ya nos mordieron

> **Capas de CSS.** Todo lo propio va dentro de `@layer base` o
> `@layer components`. Fuera de capa, el CSS gana a **cualquier** utilidad de
> Tailwind: `font-normal` no podría corregir el peso de `.font-display`, ni
> `max-w-xl` el ancho de `.wrap`.

> **Clases dinámicas.** Tailwind rastrea el código fuente como texto, así que
> `badge-${tone}` o `text-${tone}` **no** generan CSS. Los tonos se traducen con
> mapas de clases literales (ver `ScheduleList.astro` y `SectionHeading.astro`).

## ⚡ Librerías: qué se usa y qué se descartó

El sitio prioriza SEO y Core Web Vitals, y su público está mayormente en Android
de gama media. Cada kilobyte de JavaScript compite con eso, así que la lista es
corta a propósito.

| | Peso | Por qué |
| :--- | :--- | :--- |
| ✅ **Astro ClientRouter** (`astro:transitions`) | **0 kB extra** | Transiciones de vista nativas: navegación sin recarga, con continuidad visual. Es el mayor salto de dinamismo y no cuesta nada — ya viene en Astro. |
| ✅ **@formkit/auto-animate** | ~2 kB | Solo en el panel: las listas se animan al crear, borrar o filtrar. |
| ✅ **SortableJS** | ~45 kB, solo panel | Reordenar videos arrastrando, con soporte táctil. Sustituye al campo numérico «orden». |
| ✅ **marked** | **0 kB en el cliente** | Convierte el Markdown de las noticias a HTML **en el servidor**. El visitante no descarga nada. |
| ❌ EasyMDE / TipTap / Quill | 250 kB+ | Un editor completo monta su propia superficie de escritura, y en el teléfono el teclado se comporta peor que en un `<textarea>` nativo. Aquí se administra desde el teléfono, así que pesa más que las funciones extra. |
| ❌ GSAP + ScrollTrigger | ~33 kB | Es excelente para escenas ancladas al scroll y morphing de SVG; nada de eso es lo que este sitio necesita, y el costo cae justo sobre la métrica que queremos cuidar. |
| ❌ Motion / Motion One | ~5 kB | `src/scripts/reveal.ts` hace lo mismo con IntersectionObserver + CSS en ~1 kB. Cambiarlo por una librería 5× más pesada sería una pérdida neta. |
| ❌ AOS | ~6 kB | Hace menos que lo que ya hay. |

**Consecuencia importante:** con `<ClientRouter />` los módulos se evalúan una
sola vez. Todo script que dependa del DOM debe colgarse de `astro:page-load`
(que también dispara en la carga inicial) y ser idempotente — mira el patrón
`dataset.listo` en `ContactForm.astro`, `Footer.astro` y `Cartel.astro`.

## 🔐 Panel de administración

Sitio y panel comparten identidad: la barra lateral usa el mismo azul noche del
cartel, y las placas, filetes y tipografías son las mismas.

- **`/admin`** — tablero: estado de la transmisión en vivo, cifras con reparto
  entre publicados y borradores, últimos contenidos cargados y accesos rápidos.
- **`/admin/eventos` · `/noticias` · `/videos`** — mismo motor
  ([`adminCrud.ts`](src/scripts/adminCrud.ts)): buscador, filtro por estado,
  tarjetas con miniatura, **interruptor de publicación en la propia lista** y
  formulario lateral fijo. Además:
  - **Reordenar arrastrando** (`orderable` en la configuración). El arrastre se
    bloquea si hay un filtro o una búsqueda puestos: con la lista incompleta,
    las posiciones que no se ven quedarían mal calculadas.
  - **Cuerpo con formato** (`type: 'markdown'`): negrita, cursiva, subtítulo,
    lista, cita y enlace, con vista previa y atajos Ctrl+B / I / K. Se guarda
    como texto y se convierte a HTML en el servidor.
  - **Imágenes**: se arrastran encima, se ven antes de guardar y **se reducen a
    1600 px en el navegador** antes de subirlas — una foto de teléfono de 6 MB
    llega al almacenamiento pesando unos cientos de kB.
  - Borrado con diálogo que **nombra lo que se va a borrar**, y Ctrl+S para
    guardar.

> **Seguridad del Markdown.** El texto se escapa *antes* de interpretarlo, así
> que un `<script>` pegado en el panel llega al lector como texto literal. Solo
> existen las etiquetas que genera el propio Markdown, y los enlaces con
> esquema no permitido (`javascript:`, `data:`) se descartan. Ver
> [`src/lib/markdown.ts`](src/lib/markdown.ts).
- **`/admin/en-vivo`** — el interruptor que enciende la transmisión en todo el
  sitio, con vista previa de estado.
- **`/admin/suscriptores`** — listado y copia de correos en un clic.

### Cómo entrar la primera vez

**No hay credenciales guardadas en este repositorio ni las puede haber**: los
usuarios viven en Supabase Auth. Dos caminos:

1. **Desde Supabase** — *Authentication → Users → Add user*, con «Auto confirm
   user» activado.
2. **Desde la terminal**, con la clave `service_role` (*Project Settings → API*):

   ```bash
   SUPABASE_SERVICE_ROLE_KEY=eyJ... node scripts/crear-admin.mjs correo@lacasadedios.cl "unaClaveLarga"
   ```

   La clave secreta no se guarda en ningún archivo y solo se necesita esa vez.
   Es una llave de administrador total: no la subas al repositorio.

El registro público está desactivado: solo entra quien se cree a mano.

## 🛠️ Scripts

| Comando | Qué hace |
| :--- | :--- |
| `node scripts/crear-admin.mjs <correo> <clave>` | Crea un usuario del panel (requiere `SUPABASE_SERVICE_ROLE_KEY`). |
| `node scripts/og-image.mjs` | Regenera `public/og-image.png` (1200×630). Solo hace falta si cambia el logo o la paleta. |

## ⚙️ Configuración (Supabase)

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. Ejecuta [`supabase/schema.sql`](supabase/schema.sql) en el *SQL Editor*
   (crea tablas, RLS y el bucket de imágenes).
3. Copia [`.env.example`](.env.example) a `.env` y completa:

```
PUBLIC_SUPABASE_URL=https://<tu-proyecto>.supabase.co
PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...   # o la anon key (pública)
SITE_URL=https://web-lacasadedios.vercel.app
RESEND_API_KEY=re_...                          # correo del formulario y del boletín
CONTACT_FROM=La Casa de Dios <hola@lacasadedios.cl>
```

> No se usa la `service_role` / clave secreta: toda la escritura pasa por la
> sesión autenticada + las políticas RLS.

**Sin `RESEND_API_KEY` el formulario de contacto no finge un envío exitoso**:
avisa a la persona que escriba directamente al correo de la iglesia.

## 🌐 Despliegue (Vercel)

El sitio usa el adapter `@astrojs/vercel` (SSR). En Vercel → *Settings →
Environment Variables* añade las mismas variables y vuelve a desplegar.

## 🔎 SEO

- Open Graph / Twitter, `canonical`, `theme-color` y **JSON-LD**: `Church` con las
  4 ubicaciones, `BreadcrumbList` en las páginas internas y `NewsArticle` en cada noticia.
- `sitemap-index.xml` (`@astrojs/sitemap`) + `public/robots.txt`.

## ⚠️ Pendientes de contenido

Estos puntos esperan información de la iglesia; el código ya está preparado:

- **Teléfono**: `CONTACT.phone` está vacío a propósito en `src/data/site.ts`
  (el que había era de ejemplo). Al completarlo aparece solo en el pie, en
  contacto, en cada templo y en los datos estructurados.
- **Historia**: `HISTORIA.hitos` está vacío en `src/data/historia.ts`. Al agregar
  los hitos reales, la línea de tiempo aparece sola en `/sobre-nosotros#historia`.
- **Fotografía**: las imágenes son de stock (`src/assets/img/CREDITS.md`).
- **Imagen social**: falta `public/og-image.png` (1200×630) para compartir en redes.

## 📱 Redes

- Instagram: [@jovenescasadedios._](https://instagram.com/jovenescasadedios._)
- YouTube: [Conociendo la Palabra](https://www.youtube.com/@casadediosconociendolapalabrad)
