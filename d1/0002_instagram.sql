-- ── Publicaciones de Instagram de la portada ────────────────────────────────
--
-- Las cuatro fotos que salen en la portada, administrables desde /admin.
-- Antes vivían escritas en src/data/site.ts, y cambiarlas exigía tocar código y
-- volver a desplegar: para algo que se renueva cada pocas semanas, eso pone la
-- tarea en manos de quien programa en vez de en las de quien lleva la cuenta.
--
-- LO QUE **NO** ES: no es el muro de Instagram traído en vivo. Sigue siendo una
-- selección hecha a mano —foto subida al bucket, enlace pegado— y esa es la
-- decisión de fondo: traer el muro de verdad obliga a cargar código de Meta en
-- la página y a fichar a cada visitante antes de que encuentre la dirección de
-- un templo.
--
-- `imagen_clave` es la clave del objeto en R2, igual que en eventos y noticias:
-- la base nunca guarda binarios ni direcciones completas. Ver src/lib/medios.ts.
--
-- `orden` decide en qué posición sale cada una, y se arrastra en el panel. Va
-- con `publicado` en el índice porque la portada siempre pide las dos cosas
-- juntas.
create table if not exists instagram (
  id             text primary key,
  imagen_clave   text not null,
  -- Qué se ve en la foto, para quien no puede verla. Obligatorio: una foto sin
  -- texto alternativo es un enlace que un lector de pantalla anuncia como
  -- «enlace, imagen», y son cuatro seguidos.
  alt            text not null,
  -- Dirección de la publicación en Instagram. Puede faltar: una foto sin enlace
  -- se enseña igual y lleva al perfil.
  enlace         text,
  publicado      integer not null default 1 check (publicado in (0, 1)),
  orden          integer not null default 0,
  creado_en      text not null default (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  actualizado_en text not null default (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

create index if not exists instagram_publicadas on instagram (publicado, orden);
