# La Casa de Dios — Sitio web

Sitio institucional de la iglesia **La Casa de Dios**, con información de sus
templos (Santiago Centro, San Miguel, Limache y Coya), horarios de cultos,
declaración de fe y redes sociales.

Construido con **Astro 5**, **Tailwind CSS 3** y **DaisyUI** (tema `church`).

## 🧞 Comandos

| Comando           | Acción                                       |
| :---------------- | :------------------------------------------- |
| `npm install`     | Instala dependencias                         |
| `npm run dev`     | Servidor local en `localhost:4321`           |
| `npm run build`   | Compila el sitio a `./dist/`                 |
| `npm run preview` | Previsualiza el build antes de desplegar     |

## 📁 Estructura

```text
src/
├── components/
│   ├── Navigation.astro     # Navbar + toggle de tema (a11y)
│   ├── Footer.astro
│   └── TemploPage.astro     # Plantilla compartida de cada templo
├── data/
│   └── templos.ts           # ★ Fuente única de datos de los templos
├── layouts/
│   └── Layout.astro         # SEO (OG/Twitter/canonical/JSON-LD) + fuentes
└── pages/
    ├── index.astro
    ├── sobre-nosotros.astro
    └── templos/
        ├── santiago-centro.astro   # wrappers de 3 líneas → <TemploPage slug="…" />
        ├── san-miguel.astro
        ├── limache.astro
        └── coya.astro
```

## ✏️ Cómo editar el contenido

Casi todo el contenido de los templos (direcciones, horarios, mapas, pastores)
vive en **[`src/data/templos.ts`](src/data/templos.ts)**. Edita ahí y las
páginas se actualizan solas.

> **Pendiente de datos reales:** los campos `phone` y `email` de cada templo
> están vacíos a propósito (los valores previos eran placeholders como
> `+56 9 1234 5678`). Al completarlos en `templos.ts`, la tarjeta de contacto
> los muestra automáticamente; si están vacíos, se ofrece contacto por Instagram.

## 🔎 SEO

- Metadatos Open Graph / Twitter, `canonical` y `theme-color` en `Layout.astro`.
- **JSON-LD** `Church` con las 4 ubicaciones (y uno específico por templo).
- `sitemap-index.xml` generado con `@astrojs/sitemap` y `public/robots.txt`.
- **Pendiente (opcional):** añadir una imagen social en `public/og-image.png`
  (1200×630) y pasarla vía la prop `image` del `Layout` para previsualizaciones
  enriquecidas al compartir el enlace.

## 🌐 Despliegue

Desplegado en Vercel. Configura la variable de entorno **`SITE_URL`** con el
dominio real para que `canonical`, `sitemap` y `robots` usen la URL correcta:

```
SITE_URL=https://web-lacasadedios.vercel.app
```

## 📱 Redes

- Instagram: [@jovenescasadedios._](https://instagram.com/jovenescasadedios._)
- YouTube: [Conociendo la Palabra](https://www.youtube.com/@casadediosconociendolapalabrad)
