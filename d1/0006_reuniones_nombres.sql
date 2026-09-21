-- ── Todo se llama «reunión» ─────────────────────────────────────────────────
--
-- El sitio decía «cultos» en unos sitios y «reuniones» en otros, y la base
-- tenía las dos: ocho filas «Culto General» y una «Reunión General», que son
-- lo mismo con dos nombres. Quien mira el horario no tiene por qué deducir si
-- se trata de cosas distintas.
--
-- La migración 0003 no se toca: ya está aplicada en las dos bases y reescribir
-- una migración vieja hace que una base nueva y una existente dejen de
-- coincidir. Se corrige aquí, que es el orden en que ocurrió de verdad.
update reuniones
   set nombre = 'Reunión General',
       actualizado_en = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
 where nombre = 'Culto General';
