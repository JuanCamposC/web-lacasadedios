# Base de datos

Las migraciones se corren **en orden** desde Supabase → SQL Editor → New query → Run.

| Archivo | Qué hace |
|---|---|
| `migrations/0001_init.sql` | Tablas de contenido (eventos, noticias, videos, ajustes, suscriptores), sus políticas y el bucket `media`. |
| `migrations/0002_baja_boletin.sql` | Token por suscriptor y la función `baja_suscriptor`, para darse de baja sin sesión. |
| `migrations/0003_subscribers_pending.sql` | Doble opt-in: columna `pending`, función `confirmar_suscriptor` y freno de altas por IP. Elimina la política que dejaba insertar a cualquiera. |
| `migrations/0004_admins_rls.sql` | Tabla `admins` y `es_admin()`. Las políticas de gestión pasan de «estar autenticado» a «ser alguien en concreto». |

Todas son idempotentes (`if not exists`, `drop policy if exists`, `on conflict do
nothing`): correr una dos veces no rompe nada.

## Después de correr 0004

Comprueba que hay alguien en la lista, o el panel queda cerrado para todos:

```sql
select u.email, (a.user_id is not null) as es_admin
  from auth.users u
  left join public.admins a on a.user_id = u.id;
```

La migración siembra la tabla con las cuentas que ya existían. Para añadir a
alguien más, `node scripts/crear-admin.mjs <correo> <clave>` lo hace en un paso.

## `schema.sql`

Se mantiene como el archivo completo en orden, útil para levantar un proyecto
nuevo de cero de una sola pasada. Es exactamente la concatenación de las cuatro
migraciones: **si tocas una, actualiza también este archivo**.
