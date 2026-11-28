-- ── La papelera: borrar deja de ser definitivo ──────────────────────────────
--
-- Hasta ahora `delete from eventos where id = ?` era de verdad un DELETE, y el
-- diálogo del panel decía «No se puede deshacer» porque era cierto. Es el
-- momento más tenso de administrar el sitio: la fila se va, su imagen se va de
-- R2 detrás, y no hay nada que mirar para recuperarla.
--
-- Con esta columna, borrar es escribir una fecha. Las consultas públicas y el
-- listado del panel dejan de ver la fila, que es todo lo que hacía falta, y
-- durante 30 días se puede traer de vuelta desde /admin/papelera.
--
-- ── POR QUÉ UNA FECHA Y NO UN 0/1 ───────────────────────────────────────────
-- Porque la papelera tiene que poder vaciarse sola. Con una bandera habría que
-- guardar en otro sitio cuándo se borró para saber cuáles ya caducaron; con la
-- fecha, «lo que lleva más de 30 días» es una comparación de texto, que es
-- justo lo que D1 hace bien.
--
-- ── EL ARCHIVO NO SE BORRA AL BORRAR LA FILA ────────────────────────────────
-- Y es la mitad de la gracia. Antes, borrar una noticia liberaba su imagen de
-- R2 (ver olvidarArchivos en src/lib/archivos.ts); si ahora se liberara igual,
-- restaurar la fila devolvería una noticia con un hueco donde estaba la foto.
-- La fila sigue nombrando su archivo mientras está en la papelera, así que
-- `sigueEnUso` la encuentra y el archivo se queda. Se libera al vaciar.
--
-- ── QUÉ TABLAS LA LLEVAN Y POR QUÉ ESAS ─────────────────────────────────────
-- Las siete que el panel puede borrar y cuyas filas son CONTENIDO. Falta
-- `estudios_ocultos` a propósito: ahí una fila no es contenido sino una
-- decisión («este episodio no se enseña»), y quitarla ES el deshacer. Una
-- papelera encima de eso sería una papelera de papelera.
alter table eventos   add column borrado_en text;
alter table noticias  add column borrado_en text;
alter table videos    add column borrado_en text;
alter table estudios  add column borrado_en text;
alter table instagram add column borrado_en text;
alter table enlaces   add column borrado_en text;
alter table reuniones add column borrado_en text;

-- Los índices que ya existían filtran por `publicado` y ordenan por fecha, y
-- ahora toda consulta pública lleva además `borrado_en is null`. Estos dos son
-- los únicos listados que crecen sin tope previsible.
create index if not exists eventos_vivos  on eventos  (borrado_en, publicado, fecha desc);
create index if not exists noticias_vivas on noticias (borrado_en, publicado, publicado_en desc);
