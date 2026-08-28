-- ============================================================================
--  ADMINISTRADORES EXPLÍCITOS  (migración — Supabase → SQL Editor)
--  Añadida el 2026-08-27. Es idempotente: se puede correr más de una vez.
--
--  QUÉ ARREGLA
--  Las políticas de gestión decían `auth.role() = 'authenticated'`. Eso no
--  distingue al mantenedor de CUALQUIER cuenta del proyecto: quien consiguiera
--  registrarse —hoy el registro está cerrado, pero basta abrirlo un día, o
--  añadir un inicio de sesión con Google, para que deje de estarlo— podría
--  publicar, editar y borrar el contenido del sitio.
--
--  Se pasa a una lista explícita. Estar autenticado ya no alcanza: hay que ser
--  alguien en concreto.
-- ============================================================================

create table if not exists public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  email      text,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

-- Cada quien puede comprobar si está en la lista; nadie puede modificarla desde
-- el cliente. Las altas van con la clave de servicio (scripts/crear-admin.mjs).
drop policy if exists "admins read self" on public.admins;
create policy "admins read self" on public.admins for select
  using (auth.uid() = user_id);

-- Función de apoyo: evita repetir la subconsulta en cada política y permite
-- cambiar el criterio en un solo sitio.
create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

revoke all on function public.es_admin() from public;
grant execute on function public.es_admin() to anon, authenticated;

-- ── Repuesto de seguridad ───────────────────────────────────────────────────
-- Si la tabla queda vacía —por ejemplo al correr esta migración antes de dar
-- de alta a nadie— las políticas cerrarían el panel para todos, incluido quien
-- tiene que arreglarlo. Se siembra con las cuentas que ya existen: en este
-- proyecto solo hay cuentas de mantenimiento, creadas a mano.
insert into public.admins (user_id, email)
  select id, email from auth.users
on conflict (user_id) do nothing;

-- ── Políticas de gestión, ahora por identidad ───────────────────────────────
drop policy if exists "auth manage events" on public.events;
create policy "admin manage events" on public.events for all
  using (public.es_admin()) with check (public.es_admin());

drop policy if exists "auth manage news" on public.news;
create policy "admin manage news" on public.news for all
  using (public.es_admin()) with check (public.es_admin());

drop policy if exists "auth manage videos" on public.videos;
create policy "admin manage videos" on public.videos for all
  using (public.es_admin()) with check (public.es_admin());

drop policy if exists "auth update settings" on public.settings;
create policy "admin update settings" on public.settings for update
  using (public.es_admin()) with check (public.es_admin());

drop policy if exists "auth read subscribers" on public.subscribers;
create policy "admin read subscribers" on public.subscribers for select
  using (public.es_admin());

drop policy if exists "auth delete subscribers" on public.subscribers;
create policy "admin delete subscribers" on public.subscribers for delete
  using (public.es_admin());

-- ── Archivos subidos ────────────────────────────────────────────────────────
-- Mismo problema en el bucket: subir y borrar imágenes estaba abierto a
-- cualquier cuenta autenticada.
drop policy if exists "auth upload media" on storage.objects;
create policy "admin upload media" on storage.objects for insert
  with check (bucket_id = 'media' and public.es_admin());

drop policy if exists "auth update media" on storage.objects;
create policy "admin update media" on storage.objects for update
  using (bucket_id = 'media' and public.es_admin());

drop policy if exists "auth delete media" on storage.objects;
create policy "admin delete media" on storage.objects for delete
  using (bucket_id = 'media' and public.es_admin());
