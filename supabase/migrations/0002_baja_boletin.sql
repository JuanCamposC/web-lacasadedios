-- ============================================================================
--  BAJA DEL BOLETÍN  (migración — ejecutar en Supabase → SQL Editor)
--  Añadida el 2026-08-12. Es idempotente: se puede correr más de una vez.
-- ============================================================================

-- Cada suscriptor lleva un token secreto. Es lo que va en el enlace de baja
-- del correo, para no exponer el id ni permitir dar de baja a otra persona.
alter table public.subscribers
  add column if not exists token uuid not null default gen_random_uuid();

create unique index if not exists subscribers_token_key on public.subscribers (token);

-- Los suscriptores que ya existían no tenían token: se les asigna uno.
update public.subscribers set token = gen_random_uuid() where token is null;

-- Darse de baja tiene que funcionar SIN sesión (quien recibe el correo no
-- tiene cuenta). No se puede resolver con una política de borrado abierta:
-- cualquiera podría vaciar la tabla omitiendo el filtro. Se hace con una
-- función `security definer` que solo borra la fila cuyo token coincide.
create or replace function public.baja_suscriptor(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  borradas int;
begin
  delete from public.subscribers where token = p_token;
  get diagnostics borradas = row_count;
  return borradas > 0;
end;
$$;

revoke all on function public.baja_suscriptor(uuid) from public;
grant execute on function public.baja_suscriptor(uuid) to anon, authenticated;
