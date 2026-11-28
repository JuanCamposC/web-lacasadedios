-- ── Cambios de UN día ───────────────────────────────────────────────────────
--
-- `estado` + `aviso_hasta` (migración 0003) dicen «desde AHORA hasta tal día».
-- Sirve para suspender el jueves que viene, y no sirve para programar con
-- antelación: suspender el jueves 24 de diciembre con eso, a fines de
-- noviembre, deja suspendidos también el 3, el 10 y el 17.
--
-- Una fila de acá es «esta reunión, ESTE día»: se suspende, cambia de hora o se
-- llama distinto (en Limache la Reunión General de Navidad pasa del jueves al
-- miércoles, y el miércoles deja de ser de Jóvenes). Se pueden cargar todas las
-- de un mes de una vez, y cada una rige solo en su fecha, sin que nadie tenga
-- que acordarse de quitarla.
--
-- Si una reunión tiene a la vez un aviso con `aviso_hasta` y una fila de acá
-- para el mismo día, gana esta: es la más concreta.
--
-- `fecha` es un día de Chile (AAAA-MM-DD), igual que `aviso_hasta`. `hora` y
-- `nombre` vacíos significan «los de siempre». Una suspendida no lleva hora.
--
-- Sin papelera: una fila de acá no es contenido sino una decisión, y borrarla
-- ES el deshacer —la reunión vuelve a ser la de siempre ese día—. Si se
-- purga la reunión, se van con ella.
create table if not exists excepciones (
  id             text primary key,
  reunion_id     text not null references reuniones (id) on delete cascade,
  fecha          text not null
                 check (fecha glob '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
  estado         text not null check (estado in ('suspendida', 'cambiada')),
  hora           text check (hora is null or hora glob '[0-2][0-9]:[0-5][0-9]'),
  nombre         text,
  aviso          text,
  creado_en      text not null default (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  actualizado_en text not null default (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  -- Un cambio por reunión y día: dos filas para el mismo día se contradirían.
  unique (reunion_id, fecha)
);

create index if not exists excepciones_por_fecha on excepciones (fecha);
