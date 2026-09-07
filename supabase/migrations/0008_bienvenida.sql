-- ============================================================================
--  CORREO DE BIENVENIDA
--  Añadida el 2026-09-07. Es idempotente: se puede correr más de una vez.
-- ============================================================================

-- Cuándo se le dio la bienvenida a esta persona.
--
-- Hace falta porque la confirmación no es una acción de una sola vez: el
-- enlace del correo se puede abrir dos veces, o quedarse en el historial del
-- navegador y volver a visitarse meses después. `confirmar_suscriptor` es
-- idempotente por diseño y devuelve `true` también en la segunda pasada, así
-- que sin esta marca cada visita a /confirmar mandaría otra bienvenida.
alter table public.subscribers
  add column if not exists welcomed_at timestamptz;

-- A quien ya estaba confirmado antes de esta migración no se le manda nada:
-- se suscribió hace tiempo y una bienvenida a destiempo solo confunde.
update public.subscribers
   set welcomed_at = confirmed_at
 where pending = false
   and welcomed_at is null
   and confirmed_at is not null;
