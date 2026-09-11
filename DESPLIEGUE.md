# Desplegar

El sitio vive entero en Cloudflare: Workers para servirlo, D1 para los datos, R2
para los archivos, Access para la puerta del panel y Resend para el correo.

## La regla que más veces se ha olvidado

**Compilar SIEMPRE antes de desplegar**, aunque no hayas tocado código.

```bash
SITE_URL=https://pruebas.lacasadedios.cl MEDIOS_DOMINIO=medios.lacasadedios.cl npm run build
npx wrangler deploy
```

Wrangler **no lee `wrangler.jsonc`**. El adaptador de Astro escribe una copia en
`dist/server/wrangler.json` al compilar, y wrangler sigue esa copia. Lo dice en
tres líneas al empezar cada despliegue:

```
Using redirected Wrangler configuration.
 - Configuration being used: "dist/server/wrangler.json"
 - Original user's configuration: "wrangler.jsonc"
```

El síntoma de saltárselo es que agregas una variable, despliegas sin un solo
error, y la variable no está. Sin aviso. Ya pasó con `BOLETIN_FROM`.

`SITE_URL` va en el shell **además** de en `wrangler.jsonc` porque Astro incrusta
las canónicas y el sitemap al compilar. Compilar para pruebas y compilar para
producción no son la misma compilación.

## La base de datos

El esquema está en `d1/0001_esquema.sql` y es idempotente (`create table if not
exists`), así que correrlo dos veces no rompe nada:

```bash
npx wrangler d1 execute lacasadedios --remote --file=d1/0001_esquema.sql
```

Sin `--remote` se aplica a la copia local de miniflare, que es la que usa
`npm run dev`. Son dos bases distintas y conviene tenerlo presente: lo que
cargas en una no aparece en la otra.

## Lo que no pasa por aquí

**Los secretos.** `npx wrangler secret put RESEND_API_KEY` va directo al Worker,
sin compilar ni desplegar. Es el único secreto que hay.

**Quién puede entrar al panel.** Lo decide Cloudflare Access, no el código. Se
cambia en Zero Trust → Access → Applications, y tiene efecto al instante.

## El día del lanzamiento

Hoy el Worker de la aplicación responde solo en `pruebas.lacasadedios.cl`;
`lacasadedios.cl` y `www` los sirve el Worker de mantenimiento, que está en
`mantenimiento/`. Lanzar es:

1. Cambiar `routes` en `wrangler.jsonc` a los dos dominios de producción.
2. Cambiar `SITE_URL` a `https://lacasadedios.cl`, en `vars` **y** al compilar.
3. Compilar, desplegar, y borrar el Worker `lacasadedios-construccion`.

No hay ningún interruptor que apagar. El `noindex` del sitio de pruebas se apaga
solo: la regla de `public/_headers` lleva el nombre de dominio, y la del Worker
sale de `SITE_URL` (ver `src/lib/cabeceras.ts`).

## Comprobar que salió bien

```bash
npm run check     # tipos
npm test          # pruebas
curl -sI https://pruebas.lacasadedios.cl/    # 302 al login de Access = correcto
```

Que `pruebas` responda 302 no es un fallo: es Access haciendo su trabajo. Para
ver el sitio hay que entrar por el navegador con una cuenta `@lacasadedios.cl`.
