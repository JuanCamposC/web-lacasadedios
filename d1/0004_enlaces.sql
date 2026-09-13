-- ── Enlaces de /jovenes ──────────────────────────────────────────────────────
--
-- La página de enlaces de los jóvenes, la que reemplaza a su Linktree. Se
-- administra desde /admin/jovenes porque cambia con cada evento: la playlist
-- del retiro de este año no es la del próximo, y pedir un despliegue por cada
-- playlist deja el trabajo en manos de quien programa.
--
-- /nuestrostemplos NO usa esta tabla: se arma sola con los templos y los
-- horarios. Se decidió así para que la entrada desde el Instagram de la iglesia
-- no dependa de que alguien mantenga una lista.
--
-- El icono no se guarda: se deduce de la dirección (Spotify, YouTube…). Así no
-- hay un desplegable más que llenar ni un icono que no cuadre con el enlace.
-- Ver src/lib/enlaces.ts.
--
-- La base solo acepta direcciones http(s). No es desconfianza del equipo: un
-- `javascript:` pegado por error en un botón público se ejecutaría en el
-- teléfono de quien lo toque.
create table if not exists enlaces (
  id             text primary key,
  titulo         text not null,
  url            text not null check (url like 'https://%' or url like 'http://%'),
  publicado      integer not null default 1 check (publicado in (0, 1)),
  orden          integer not null default 0,
  creado_en      text not null default (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  actualizado_en text not null default (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

create index if not exists enlaces_publicados on enlaces (publicado, orden);

-- Los cuatro del Linktree de @jovenescasadedios._ tal como estaban en
-- septiembre de 2026, en el mismo orden.
insert or ignore into enlaces (id, titulo, url, orden) values
  ('seed-apple', 'Playlist Retiro 2026',
   'https://music.apple.com/cl/playlist/retiro-2026-j%C3%B3venes-casa-de-dios/pl.u-yZyVW73CYqWd7br', 0),
  ('seed-youtube', 'Playlist Retiro 2026',
   'https://music.youtube.com/playlist?list=PLYYePhHolooTFce0D53MPnFwvtf9vtP5Z', 1),
  ('seed-spotify', 'Playlist Retiro 2026',
   'https://open.spotify.com/playlist/3cI6HAUA3JJbpF5uNYY0Os', 2),
  ('seed-instagram', 'Instagram de Jóvenes Casa de Dios',
   'https://www.instagram.com/jovenescasadedios._', 3);
