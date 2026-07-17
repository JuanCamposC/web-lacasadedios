# La Casa de Dios — Sitio web

Sitio institucional de la iglesia **La Casa de Dios**: templos (Santiago Centro,
San Miguel, Limache y Coya), horarios, declaración de fe, y secciones de
**eventos, noticias y videos** gestionables desde un panel con login.

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

## 📁 Estructura

```text
src/
├── components/       Navigation, Footer, TemploPage
├── data/templos.ts   ★ Datos de los templos y contacto (CONTACT)
├── layouts/          Layout (público) y AdminLayout (panel)
├── lib/supabase.ts   Clientes Supabase (browser/server) + tipos
├── middleware.ts     Protege /admin y expone el cliente en rutas SSR
├── scripts/adminCrud.ts   Lógica CRUD reutilizable del panel
└── pages/
    ├── index / sobre-nosotros / templos/*   (estáticas)
    ├── eventos / noticias / videos          (SSR, leen de Supabase)
    └── admin/  login, index, eventos, noticias, videos  (SSR, protegidas)
```

## ✏️ Contenido

- **Templos** (direcciones, horarios, pastores, contacto): [`src/data/templos.ts`](src/data/templos.ts).
- **Eventos, noticias y videos**: desde el **panel `/admin`** (ver abajo).

## 🔐 Panel de administración

1. Entra a **`/admin`** → te pedirá iniciar sesión (`/admin/login`).
2. Con tu usuario de Supabase puedes crear/editar/borrar **eventos, noticias y
   videos**, y subir imágenes. Los cambios aparecen al instante en el sitio.

Los usuarios se crean en Supabase (*Authentication → Users*). El registro público
está desactivado: solo entra quien tú autorices.

## ⚙️ Configuración (Supabase)

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. Ejecuta [`supabase/schema.sql`](supabase/schema.sql) en el *SQL Editor*
   (crea tablas, RLS y el bucket de imágenes).
3. Copia [`.env.example`](.env.example) a `.env` y completa:

```
PUBLIC_SUPABASE_URL=https://<tu-proyecto>.supabase.co
PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...   # o la anon key (pública)
SITE_URL=https://web-lacasadedios.vercel.app
```

> No se usa la `service_role` / clave secreta: toda la escritura pasa por la
> sesión autenticada + las políticas RLS.

## 🌐 Despliegue (Vercel)

El sitio usa el adapter `@astrojs/vercel` (SSR). En Vercel → *Settings →
Environment Variables* añade las mismas 3 variables (`PUBLIC_SUPABASE_URL`,
`PUBLIC_SUPABASE_ANON_KEY`, `SITE_URL`) y vuelve a desplegar.

## 🔎 SEO

- Open Graph / Twitter, `canonical`, `theme-color` y **JSON-LD** `Church` con las
  4 ubicaciones y el contacto.
- `sitemap-index.xml` (`@astrojs/sitemap`) + `public/robots.txt`.
- Pendiente opcional: imagen social en `public/og-image.png` (1200×630).

## 📱 Redes

- Instagram: [@jovenescasadedios._](https://instagram.com/jovenescasadedios._)
- YouTube: [Conociendo la Palabra](https://www.youtube.com/@casadediosconociendolapalabrad)
