# Puesta en marcha de los cambios de la auditoría

Hay **siete pasos fuera del código**. El orden importa: los pasos 1 a 3 dejan el
sitio funcionando, y los 4 a 7 se pueden hacer después con calma.

> **Lo que se rompe si no haces nada.** El formulario del boletín deja de dar de
> alta (dice «no está configurado») en cuanto se despliegue esta rama, porque la
> tabla ya no acepta escrituras desde el navegador. Todo lo demás sigue igual.

---

## 1 · Correr las migraciones · **antes de desplegar**

Supabase → **SQL Editor** → New query. Pega y ejecuta **en este orden**:

| # | Archivo | ¿Ya lo corriste? |
|---|---|---|
| 1 | `supabase/migrations/0002_baja_boletin.sql` | Puede que sí, es de agosto. Correrlo dos veces no rompe nada. |
| 2 | `supabase/migrations/0003_subscribers_pending.sql` | Nuevo |
| 3 | `supabase/migrations/0004_admins_rls.sql` | Nuevo |

Las tres son idempotentes: si una ya estaba aplicada, no pasa nada.

**Comprueba la 0004 antes de seguir.** Es la única que puede dejarte fuera de tu
propio panel:

```sql
select u.email, (a.user_id is not null) as es_admin
  from auth.users u
  left join public.admins a on a.user_id = u.id;
```

Si tu correo sale con `es_admin = false`, añádelo a mano antes de continuar:

```sql
insert into public.admins (user_id, email)
  select id, email from auth.users where email = 'tucorreo@lacasadedios.cl'
on conflict (user_id) do nothing;
```

---

## 2 · Añadir la clave de servicio en Vercel · **antes de desplegar**

Sin esto, nadie puede suscribirse al boletín.

1. Supabase → **Project Settings → API** → copia la clave **`service_role`**
   (la secreta, no la `anon`).
2. Vercel → el proyecto → **Settings → Environment Variables**.
3. Nombre: `SUPABASE_SERVICE_ROLE_KEY` · Valor: la clave · Entornos: los tres.

> **Pega la clave sola**, sin comillas alrededor. Es el error que ya nos costó
> una tarde con `CONTACT_FROM`.

> Esta clave salta todas las políticas RLS. **No** la pongas nunca en una
> variable que empiece por `PUBLIC_`, o acabaría en el navegador.

---

## 3 · Desplegar

Fusiona `fix/auditoria` a `main`. Vercel construye solo.

Cuando termine, comprueba en el sitio:

- [ ] La portada carga y el logo se ve bien.
- [ ] Suscribirse en el pie responde **«Revisa tu correo y confirma la
      suscripción»**. Si dice «no está configurado», falta el paso 2.
- [ ] Llega el correo de confirmación y el botón lleva a `/confirmar`.
- [ ] `/admin/login` deja entrar y se puede editar una noticia. Si entra pero no
      deja guardar, falta el paso 1.

> **Si algo falla, el motivo exacto está en Vercel** → el despliegue → pestaña
> **Logs**, en una línea que empieza por `[suscribir]`. Al navegador solo le
> llega el motivo en una frase; el detalle se queda en el servidor a propósito,
> porque el formulario es público y llegó a repetir el contenido de una variable
> de entorno mal pegada.

---

## 4 · Activar la verificación en dos pasos

1. Supabase → **Authentication → Multi-Factor Authentication** → activa **TOTP**.
2. Entra a `/admin/seguridad` y pulsa **Activar**.
3. Escanea el QR con tu aplicación (Google Authenticator, Microsoft
   Authenticator, 1Password…) y escribe el código.

Desde ahí, entrar al panel pide contraseña **y** código.

> **Si pierdes el teléfono** te quedas fuera. Se arregla con la clave de servicio,
> borrando el factor desde Supabase → Authentication → Users → tu usuario. Ten
> guardados los códigos de recuperación que ofrezca tu aplicación.

Mientras no hagas esto, el panel sigue entrando solo con contraseña: la
comprobación solo actúa sobre cuentas que ya tienen un factor dado de alta.

---

## 5 · Comprobar la región de las funciones

`vercel.json` fija `"regions": ["gru1"]` (São Paulo), la más cercana a Chile.

**Pero conviene que la función esté cerca de Supabase, no de Chile**: cada página
hace una o dos consultas a la base, y la propia documentación de Vercel avisa de
esto.

1. Supabase → **Settings → General** → mira la región del proyecto.
2. Si está en **South America (São Paulo)**, `gru1` es correcto: déjalo.
3. Si está en **East US (Virginia)** o similar, cambia `vercel.json` a
   `"regions": ["iad1"]`.

La caché del punto 9 quita peso a esta decisión: la mayoría de las visitas ya no
llegan a consultar la base.

---

## 6 · Terminar la configuración del correo (pendiente de antes)

Sigue sin resolverse desde agosto. Sin esto no sale ningún correo, ni el de
confirmación del boletín ni los avisos.

En **Netexplora** (no en NIC, que solo delega), añade los tres registros que pide
Resend:

| Tipo | Nombre | Valor |
|---|---|---|
| MX | `send` | el que indique Resend |
| TXT | `send` | el SPF que indique Resend |
| TXT | `resend._domainkey` | la clave DKIM |

Y **añade `include:amazonses.com` al SPF que ya existe**: hoy termina en `-all`,
que rechaza todo lo que no esté listado.

---

## 7 · Decidir la licencia del repositorio

Es lo único que quedó sin hacer, porque es una decisión tuya y no técnica.

Sin archivo `LICENSE`, GitHub entiende **«todos los derechos reservados»**. Para
un sitio institucional a medida suele ser lo correcto, pero si el repositorio es
público conviene decirlo explícitamente para que nadie asuma que puede reutilizar
el código.

Dime qué prefieres y lo agrego:

- **Propietario**: «© Iglesia Evangélica La Casa de Dios. Todos los derechos
  reservados.»
- **Abierto** (MIT, por ejemplo), si la idea es que otras iglesias lo aprovechen.
- **Sin archivo**, dejándolo como está.

---

## Resumen de variables de entorno

| Variable | ¿Secreta? | Sin ella |
|---|---|---|
| `PUBLIC_SUPABASE_URL` | No | El sitio no habla con la base |
| `PUBLIC_SUPABASE_ANON_KEY` | No | Igual |
| `SUPABASE_SERVICE_ROLE_KEY` | **Sí** | **No se puede suscribir nadie** |
| `SITE_URL` | No | Los enlaces de los correos apuntan mal |
| `RESEND_API_KEY` | **Sí** | No sale ningún correo |
| `CONTACT_FROM` | No | Se usa el remitente de prueba de Resend |
