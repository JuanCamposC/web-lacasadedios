-- ============================================================================
--  La Casa de Dios — Esquema de contenido (eventos, noticias, videos)
--  Ejecuta este archivo en Supabase: Dashboard → SQL Editor → New query → Run.
--
--  SE PUEDE VOLVER A CORRER. No se podía: `create policy` no admite «si no
--  existe», así que la segunda ejecución moría en la primera política con un
--  42710 y, por la transacción del editor, no aplicaba nada. Ahora cada
--  política lleva delante su `drop policy if exists`, y las dos inserciones
--  de siembra solo escriben con la tabla vacía.
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
drop policy if exists "public read events" on public.events;
create policy "public read events" on public.events for select using (published = true);
drop policy if exists "public read news" on public.news;
create policy "public read news"   on public.news   for select using (published = true);
drop policy if exists "public read videos" on public.videos;
create policy "public read videos" on public.videos for select using (published = true);

-- Escritura/gestión: solo usuarios autenticados (el mantenedor)
drop policy if exists "auth manage events" on public.events;
create policy "auth manage events" on public.events for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
drop policy if exists "auth manage news" on public.news;
create policy "auth manage news" on public.news for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
drop policy if exists "auth manage videos" on public.videos;
create policy "auth manage videos" on public.videos for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ── Storage: bucket público para imágenes de eventos/noticias ────────────────
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

drop policy if exists "public read media" on storage.objects;
create policy "public read media" on storage.objects for select
  using (bucket_id = 'media');
drop policy if exists "auth upload media" on storage.objects;
create policy "auth upload media" on storage.objects for insert
  with check (bucket_id = 'media' and auth.role() = 'authenticated');
drop policy if exists "auth update media" on storage.objects;
create policy "auth update media" on storage.objects for update
  using (bucket_id = 'media' and auth.role() = 'authenticated');
drop policy if exists "auth delete media" on storage.objects;
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
drop policy if exists "public subscribe" on public.subscribers;
create policy "public subscribe" on public.subscribers for insert
  with check (true);
-- …pero solo el mantenedor autenticado puede leer/borrar la lista.
drop policy if exists "auth read subscribers" on public.subscribers;
create policy "auth read subscribers" on public.subscribers for select
  using (auth.role() = 'authenticated');
drop policy if exists "auth delete subscribers" on public.subscribers;
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
drop policy if exists "public read settings" on public.settings;
create policy "public read settings" on public.settings for select using (true);
-- Solo el mantenedor autenticado puede cambiarlo
drop policy if exists "auth update settings" on public.settings;
create policy "auth update settings" on public.settings for update
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ── Datos de ejemplo (opcional; borra si no los quieres) ─────────────────────
-- `on conflict do nothing` NO servía aquí: no hay ninguna restricción única
-- que violar, así que cada ejecución añadía otro evento de ejemplo. Se siembra
-- solo con la tabla vacía, que es lo que se quería decir.
insert into public.events (title, event_date, location, description)
  select 'Culto de Aniversario', now() + interval '14 days', 'Templo San Miguel',
         'Celebración especial de aniversario de la congregación.'
   where not exists (select 1 from public.events);
