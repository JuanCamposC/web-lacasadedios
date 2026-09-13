-- ── Reuniones semanales de cada templo ──────────────────────────────────────
--
-- Hasta ahora los horarios estaban escritos en src/data/templos.ts: cambiar
-- una hora exigía tocar código y volver a desplegar. Ahora se administran desde
-- /admin/horarios.
--
-- ── EL ESTADO Y SU FECHA DE CADUCIDAD ───────────────────────────────────────
-- `estado` dice si la reunión va normal, está SUSPENDIDA o CAMBIÓ de horario, y
-- `aviso` es la frase que ve la gente («Este jueves se hace a las 19:00»).
--
-- `aviso_hasta` existe para lo que pasa siempre: se suspende la reunión de
-- esta semana y nadie se acuerda de volver a encenderla. Con una fecha puesta,
-- al día siguiente la reunión vuelve SOLA a la normalidad. Es una fecha de
-- Chile (AAAA-MM-DD), no un instante: «hasta el jueves» es un día del
-- calendario de la iglesia. Vacía, el aviso dura hasta que alguien lo quite.
--
-- Un cambio de horario PERMANENTE no usa nada de esto: se edita la hora y
-- listo. `cambiada` es para lo temporal.
--
-- ── LAS COMPROBACIONES ──────────────────────────────────────────────────────
-- El panel ofrece desplegables y un selector de hora, pero la base no se fía:
-- una hora mal escrita («8pm») rompería el orden de la semana y el cálculo de
-- «la próxima reunión», que compara horas como texto. Por eso la hora tiene
-- que ser HH:MM de verdad, y el templo uno de los cuatro.
create table if not exists reuniones (
  id             text primary key,
  templo         text not null
                 check (templo in ('santiago-centro', 'san-miguel', 'limache', 'coya')),
  -- 0 = domingo … 6 = sábado, igual que Date.getDay() en el navegador.
  dia            integer not null check (dia between 0 and 6),
  hora           text not null check (hora glob '[0-2][0-9]:[0-5][0-9]'),
  nombre         text not null,
  estado         text not null default 'normal'
                 check (estado in ('normal', 'suspendida', 'cambiada')),
  aviso          text,
  aviso_hasta    text check (aviso_hasta is null or aviso_hasta glob '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
  publicado      integer not null default 1 check (publicado in (0, 1)),
  orden          integer not null default 0,
  creado_en      text not null default (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  actualizado_en text not null default (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

create index if not exists reuniones_semana on reuniones (publicado, dia, hora);
create index if not exists reuniones_templo on reuniones (templo, dia, hora);

-- ── Los horarios que ya estaban publicados ──────────────────────────────────
-- Copiados tal cual de src/data/templos.ts, para que el día del cambio la web
-- diga exactamente lo mismo que decía. Ids fijos e `insert or ignore`: correr
-- esta migración dos veces no duplica nada.
insert or ignore into reuniones (id, templo, dia, hora, nombre) values
  ('seed-stgo-dom-1100', 'santiago-centro', 0, '11:00', 'Culto General'),
  ('seed-stgo-lun-2000', 'santiago-centro', 1, '20:00', 'Estudio Bíblico'),
  ('seed-stgo-jue-2000', 'santiago-centro', 4, '20:00', 'Culto General'),

  ('seed-smig-dom-1030', 'san-miguel', 0, '10:30', 'Culto General'),
  ('seed-smig-dom-1900', 'san-miguel', 0, '19:00', 'Culto General'),
  ('seed-smig-lun-2000', 'san-miguel', 1, '20:00', 'Estudio Bíblico'),
  ('seed-smig-mar-2000', 'san-miguel', 2, '20:00', 'Discipulado'),
  ('seed-smig-jue-2000', 'san-miguel', 4, '20:00', 'Reunión General'),
  ('seed-smig-sab-1730', 'san-miguel', 6, '17:30', 'Reunión de Jóvenes'),

  ('seed-lima-sab-1900', 'limache', 6, '19:00', 'Culto General'),
  ('seed-lima-lun-2000', 'limache', 1, '20:00', 'Estudio Bíblico'),
  ('seed-lima-mie-2000', 'limache', 3, '20:00', 'Reunión de Jóvenes y Preadolescentes'),
  ('seed-lima-jue-2000', 'limache', 4, '20:00', 'Culto General'),

  ('seed-coya-sab-1900', 'coya', 6, '19:00', 'Culto General'),
  ('seed-coya-lun-2000', 'coya', 1, '20:00', 'Estudio Bíblico'),
  ('seed-coya-mie-2000', 'coya', 3, '20:00', 'Culto General');
