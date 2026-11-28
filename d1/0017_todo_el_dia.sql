-- ── Eventos de día completo ─────────────────────────────────────────────────
--
-- Para lo que ocupa el día entero y todavía no tiene horario: la salida
-- congregacional con bautismo del 9 de enero de 2027 («un día completo de
-- compartir, horarios y lugar por confirmar»). Sin esto había que inventarle
-- una hora, y el sitio la habría anunciado como si fuera un dato.
--
-- `fecha` sigue siendo un instante —el resto del código ordena y filtra por
-- él—, pero con `todo_el_dia = 1` solo cuenta su DÍA en Chile: la hora no se
-- enseña en ninguna parte y el calendario del teléfono lo agenda como evento
-- de día completo.
alter table eventos add column todo_el_dia integer not null default 0
  check (todo_el_dia in (0, 1));
