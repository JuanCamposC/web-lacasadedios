-- ── Texto alternativo de la imagen de eventos y noticias ────────────────────
--
-- La pantalla de Instagram EXIGE describir la foto, con una ayuda bien escrita
-- sobre por qué: «Para quien no puede verla. Sin esto, quien usa lector de
-- pantalla oye cuatro veces "enlace, imagen"».
--
-- Eventos y noticias no tenían el campo, así que usaban el TÍTULO como texto
-- alternativo. Para un afiche eso es lo peor de los dos mundos: quien ve la
-- imagen lee el título dos veces —arriba en la tarjeta y dentro del afiche— y
-- quien no la ve se queda sin saber que ahí había una fecha, una dirección y un
-- teléfono, que es justo lo que el afiche venía a decir.
--
-- Opcional a propósito. Obligarlo rompería el guardado de las seis filas que ya
-- existen sin él, y una descripción escrita a desgana («imagen») es peor que
-- ninguna: sin texto se sigue usando el título, que al menos dice algo.
alter table eventos  add column imagen_alt text;
alter table noticias add column imagen_alt text;
