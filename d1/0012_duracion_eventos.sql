-- ── Un evento puede durar lo que de verdad dura ─────────────────────────────
--
-- La tabla guardaba solo la hora de inicio, y todo lo que necesitaba una hora
-- de término —el botón «Añadir al calendario», el archivo .ics, el `endDate`
-- que lee Google— suponía dos horas, que es lo que dura una reunión larga.
--
-- Eso se rompió con el primer Congreso de Damas: es de 09:00 a 18:00, y quien
-- lo agendaba se llevaba un recordatorio que se cerraba a las once de la
-- mañana. El dato estaba en el afiche y en el texto, pero el calendario no lo
-- podía leer de ahí.
--
-- `duracion_min` son minutos, y vacía sigue significando «dos horas», que es lo
-- correcto para casi todo lo que se agenda. Solo se llena donde la diferencia
-- importa.
--
-- El tope de 1440 son veinticuatro horas: un evento de varios días no se
-- representa con una duración, se representa con varios eventos, y dejar pasar
-- 10080 minutos solo serviría para que un cero de más pasara inadvertido.
alter table eventos add column duracion_min integer
  check (duracion_min is null or (duracion_min > 0 and duracion_min <= 1440));
