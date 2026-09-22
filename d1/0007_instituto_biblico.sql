-- ── El estudio bíblico se llama Instituto Bíblico Bet-El ────────────────────
--
-- En los horarios estaba cargado con dos nombres, uno por modalidad: «Estudio
-- Bíblico Presencial» (San Miguel) y «Estudio Bíblico por Zoom» (los otros
-- tres). Eran la misma reunión escrita de dos formas, así que en el tablero
-- salían en dos líneas separadas aunque coincidan en día y hora.
--
-- Ahora las cuatro se llaman igual y el tablero las agrupa en una sola línea
-- con las cuatro etiquetas de templo. La modalidad no se pierde: vive en la
-- ficha de cada templo (ver `estudio` en src/data/templos.ts), que es donde
-- tiene sentido —«presencial en ESTE templo»— y no repetida en un horario
-- general.
update reuniones
   set nombre = 'Instituto Bíblico Bet-El',
       actualizado_en = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
 where nombre like 'Estudio Bíblico%';
