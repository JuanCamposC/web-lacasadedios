-- ============================================================================
--  AVISO EMERGENTE: MODO IMAGEN Y POSICIÓN DEL BOTÓN
--  Añadida el 2026-09-02. Es idempotente: se puede correr más de una vez.
-- ============================================================================

-- `normal`  → imagen arriba, título y texto debajo (lo que había).
-- `imagen`  → solo la imagen, a sangre, con el botón encima.
--
-- Se guarda como texto y no como enum: un enum obliga a migrar para añadir un
-- modo, y aquí el valor lo escribe un desplegable cerrado del panel.
alter table public.settings
  add column if not exists popup_layout text not null default 'normal';

-- Dónde se posa el botón cuando el modo es `imagen`. Nueve anclajes, con la
-- forma «vertical-horizontal»: arriba|centro|abajo × izquierda|centro|derecha.
alter table public.settings
  add column if not exists popup_cta_pos text not null default 'abajo-centro';
