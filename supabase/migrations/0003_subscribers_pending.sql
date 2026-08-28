-- ============================================================================
--  ALTA DEL BOLETÍN CON DOBLE OPT-IN  (migración — Supabase → SQL Editor)
--  Añadida el 2026-08-27. Es idempotente: se puede correr más de una vez.
--
--  QUÉ ARREGLA
--  La política anterior era `for insert with check (true)`: cualquiera con la
--  clave anónima —que es pública por diseño— podía escribir en la tabla sin
--  límite, y suscribir a terceros sin su consentimiento. Se elimina y el alta
--  pasa a hacerse SOLO desde /api/suscribir con la clave de servicio, que
--  valida el correo y limita por IP antes de escribir.
-- ============================================================================

-- `pending` separa "dejó su correo" de "confirmó que es suyo". Solo se envía
-- boletín a los confirmados.
alter table public.subscribers
  add column if not exists pending boolean not null default true;

-- Los que ya estaban suscritos antes de esta migración dieron su correo bajo
-- las reglas anteriores: se dan por confirmados para no dejarlos fuera.
update public.subscribers set pending = false where pending is true
  and created_at < timestamptz '2026-08-27';

alter table public.subscribers
  add column if not exists confirmed_at timestamptz;

update public.subscribers set confirmed_at = created_at
  where pending = false and confirmed_at is null;

-- Fuera la política abierta. Sin ninguna política de insert, RLS bloquea toda
-- escritura con la clave anónima: solo entra la clave de servicio, que salta
-- RLS y vive únicamente en el servidor.
drop policy if exists "public subscribe" on public.subscribers;

-- Confirmar sí tiene que funcionar sin sesión: quien recibe el correo no tiene
-- cuenta. Mismo patrón que `baja_suscriptor` — el token es la credencial, así
-- que basta con una función `security definer` que solo toca esa fila.
create or replace function public.confirmar_suscriptor(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  tocadas int;
begin
  update public.subscribers
     set pending = false,
         confirmed_at = coalesce(confirmed_at, now())
   where token = p_token;
  get diagnostics tocadas = row_count;
  return tocadas > 0;
end;
$$;

revoke all on function public.confirmar_suscriptor(uuid) from public;
grant execute on function public.confirmar_suscriptor(uuid) to anon, authenticated;

-- ── Freno de altas por IP ───────────────────────────────────────────────────
-- El límite en memoria del proceso no sirve en serverless: cada instancia
-- tiene el suyo y se reinician constantemente. Esta tabla lo hace real.
create table if not exists public.subscribe_attempts (
  ip         text not null,
  attempted_at timestamptz not null default now()
);

create index if not exists subscribe_attempts_ip_idx
  on public.subscribe_attempts (ip, attempted_at desc);

alter table public.subscribe_attempts enable row level security;
-- Sin políticas: nadie llega con la clave anónima. Solo la clave de servicio.

-- Cuenta los intentos de una IP en la ventana y registra el actual. Devuelve
-- cuántos había ANTES de este, para que el endpoint decida.
create or replace function public.registrar_intento_alta(p_ip text, p_ventana interval)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  previos int;
begin
  delete from public.subscribe_attempts
   where attempted_at < now() - greatest(p_ventana, interval '1 day');

  select count(*) into previos
    from public.subscribe_attempts
   where ip = p_ip and attempted_at > now() - p_ventana;

  insert into public.subscribe_attempts (ip) values (p_ip);
  return previos;
end;
$$;

revoke all on function public.registrar_intento_alta(text, interval) from public;
