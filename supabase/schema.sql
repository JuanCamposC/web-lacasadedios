-- ============================================================================
--  La Casa de Dios — Esquema de contenido (eventos, noticias, videos)
--  Ejecuta este archivo en Supabase: Dashboard → SQL Editor → New query → Run.
-- ============================================================================

-- ── Tablas ──────────────────────────────────────────────────────────────────
create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  slug        text unique,
  event_date  timestamptz not null,
  location    text,
  description text,
  image_url   text,
  published   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.news (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  slug         text unique,
  excerpt      text,
  body         text,
  image_url    text,
  published    boolean not null default true,
  published_at timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.videos (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  youtube_url text not null,
  description text,
  published   boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

-- ── Row Level Security ───────────────────────────────────────────────────────
alter table public.events enable row level security;
alter table public.news   enable row level security;
alter table public.videos enable row level security;

-- Lectura pública: solo contenido publicado
create policy "public read events" on public.events for select using (published = true);
create policy "public read news"   on public.news   for select using (published = true);
create policy "public read videos" on public.videos for select using (published = true);

-- Escritura/gestión: solo usuarios autenticados (el mantenedor)
create policy "auth manage events" on public.events for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth manage news" on public.news for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth manage videos" on public.videos for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ── Storage: bucket público para imágenes de eventos/noticias ────────────────
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

create policy "public read media" on storage.objects for select
  using (bucket_id = 'media');
create policy "auth upload media" on storage.objects for insert
  with check (bucket_id = 'media' and auth.role() = 'authenticated');
create policy "auth update media" on storage.objects for update
  using (bucket_id = 'media' and auth.role() = 'authenticated');
create policy "auth delete media" on storage.objects for delete
  using (bucket_id = 'media' and auth.role() = 'authenticated');

-- ── Newsletter: suscriptores ─────────────────────────────────────────────────
create table if not exists public.subscribers (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique,
  created_at timestamptz not null default now()
);

alter table public.subscribers enable row level security;

-- Cualquiera puede suscribirse (insertar su correo)…
create policy "public subscribe" on public.subscribers for insert
  with check (true);
-- …pero solo el mantenedor autenticado puede leer/borrar la lista.
create policy "auth read subscribers" on public.subscribers for select
  using (auth.role() = 'authenticated');
create policy "auth delete subscribers" on public.subscribers for delete
  using (auth.role() = 'authenticated');

-- ── Ajustes del sitio: "En vivo" (fila única) ────────────────────────────────
create table if not exists public.settings (
  id           int primary key default 1,
  live_enabled boolean not null default false,
  live_url     text,
  live_title   text,
  updated_at   timestamptz not null default now(),
  constraint settings_single_row check (id = 1)
);
insert into public.settings (id) values (1) on conflict (id) do nothing;

alter table public.settings enable row level security;
-- Lectura pública (para mostrar el estado "En vivo" en el sitio)
create policy "public read settings" on public.settings for select using (true);
-- Solo el mantenedor autenticado puede cambiarlo
create policy "auth update settings" on public.settings for update
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ── Datos de ejemplo (opcional; borra si no los quieres) ─────────────────────
insert into public.events (title, event_date, location, description) values
  ('Culto de Aniversario', now() + interval '14 days', 'Templo San Miguel', 'Celebración especial de aniversario de la congregación.')
on conflict do nothing;

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
