-- ============================================================================
--  AVISO DE TRANSMISIÓN EN VIVO
--  Añadida el 2026-09-07. Es idempotente: se puede correr más de una vez.
-- ============================================================================

-- Qué transmisión se anunció YA por correo.
--
-- Sin esta marca, cada vez que se guardara el formulario de «En vivo» con el
-- interruptor encendido saldría otra tanda de correos a toda la lista: basta
-- con corregir una errata en el título para escribirle dos veces a todo el
-- mundo. Guardando aquí el enlace anunciado, /api/notify sabe que esa
-- transmisión ya se avisó y no repite.
--
-- Se guarda el enlace y no una fecha ni un booleano a propósito: cuando empieza
-- la transmisión siguiente el enlace cambia, deja de coincidir, y el aviso
-- vuelve a salir solo. No hay nada que acordarse de reiniciar.
alter table public.settings
  add column if not exists live_notified_url text;
