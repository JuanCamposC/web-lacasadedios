-- ============================================================================
--  ETIQUETA DE TEMPLO, AVISO EMERGENTE Y TEXTO AL COMPARTIR
--  Añadida el 2026-09-02. Es idempotente: se puede correr más de una vez.
-- ============================================================================

-- ── Etiqueta de templo ──────────────────────────────────────────────────────
-- Cada noticia, evento y video pertenece a un templo o a todos ('general').
-- Lo ya publicado pasa a 'general' por el valor por defecto: es lo correcto,
-- porque hasta hoy nada se publicaba pensando en un templo concreto.
--
-- SIN restricción CHECK a propósito. Los templos viven en src/data/templos.ts,
-- no en la base: una lista fija aquí obligaría a una migración cada vez que se
-- abra una sede, y las dos listas se desincronizarían tarde o temprano. La
-- validación está donde se escribe, en el desplegable del panel, que se genera
-- desde ese mismo archivo.

alter table public.news   add column if not exists templo text not null default 'general';
alter table public.events add column if not exists templo text not null default 'general';
alter table public.videos add column if not exists templo text not null default 'general';

-- El filtro público consulta por esta columna en cada carga de listado.
create index if not exists news_templo_idx   on public.news   (templo);
create index if not exists events_templo_idx on public.events (templo);
create index if not exists videos_templo_idx on public.videos (templo);

-- ── Aviso emergente ─────────────────────────────────────────────────────────
-- Mismo patrón que «En vivo»: una sola fila en `settings`, lectura pública y
-- escritura solo autenticada. Las políticas ya existen y cubren las columnas
-- nuevas, así que no hay que tocarlas.
--
-- `popup_version` es lo que permite volver a mostrarlo. El navegador recuerda
-- qué versión cerró cada persona; al subir el número, reaparece para todos.
-- Sin esto, cambiar el texto no serviría de nada para quien ya lo hubiera
-- cerrado una vez.

alter table public.settings add column if not exists popup_enabled   boolean not null default false;
alter table public.settings add column if not exists popup_title     text;
alter table public.settings add column if not exists popup_body      text;
alter table public.settings add column if not exists popup_cta_label text;
alter table public.settings add column if not exists popup_cta_url   text;
alter table public.settings add column if not exists popup_image_url text;
alter table public.settings add column if not exists popup_starts_at timestamptz;
alter table public.settings add column if not exists popup_ends_at   timestamptz;
alter table public.settings add column if not exists popup_version   int not null default 1;

-- ── Texto al compartir por WhatsApp ─────────────────────────────────────────
-- `{titulo}` y `{enlace}` se sustituyen al generar el botón. Si queda vacío se
-- usa el texto por defecto del código.
alter table public.settings add column if not exists share_whatsapp text;

update public.settings
   set share_whatsapp = 'Hola, acabo de leer esta noticia que me bendijo. {titulo} — {enlace}'
 where id = 1 and share_whatsapp is null;
