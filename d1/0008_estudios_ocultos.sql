-- Episodios del Instituto Bíblico que NO se enseñan en el sitio.
--
-- ── POR QUÉ HACE FALTA ──────────────────────────────────────────────────────
-- Los audios no viven acá: los publica RSS.com y el sitio los lee de su feed
-- (ver src/lib/rss.ts). Y RSS.com no tiene término medio: un episodio está
-- publicado o está borrado, no se puede ocultar ni dejar en borrador. Lo dice
-- su propia documentación, y la razón es que el feed se reparte a la vez a
-- Spotify, Apple y todo lo demás.
--
-- Esta tabla es ese término medio, pero solo para lacasadedios.cl: el episodio
-- sigue publicado en RSS.com y en las aplicaciones de podcast, y deja de
-- aparecer en la página del Instituto. Sirve para una prueba que se subió sin
-- querer, un audio que quedó mal grabado, o uno que todavía no toca enseñar.
--
-- ── POR QUÉ SE GUARDA EL GUID Y NO EL NÚMERO DE EPISODIO ────────────────────
-- El `guid` es el identificador que el feed da a cada episodio y no cambia
-- aunque le editen el título, la fecha o el número. Colgar de cualquier otra
-- cosa haría que un episodio oculto reapareciera solo el día que alguien le
-- corrige una tilde al título.
--
-- `titulo` se guarda por comodidad y puede quedar viejo: es para que el panel
-- pueda decir QUÉ está oculto aunque RSS.com no responda en ese momento. Lo que
-- manda siempre es el `guid`.
create table if not exists estudios_ocultos (
  id             text primary key,
  guid           text not null unique,
  titulo         text,
  creado_en      text not null default (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  actualizado_en text not null default (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

create index if not exists estudios_ocultos_guid on estudios_ocultos (guid);
