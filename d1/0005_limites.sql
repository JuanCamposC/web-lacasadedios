-- ── El freno por IP deja de ser solo del boletín ────────────────────────────
--
-- `intentos_alta` contaba las altas al boletín. El formulario de contacto no
-- tenía ningún freno: un bucle bastaba para agotar la cuota mensual de correo
-- y, con ella, la confirmación de suscripción y el propio formulario.
--
-- Se añade `accion` en vez de crear una tabla gemela: el mecanismo es el mismo
-- —contar lo reciente de una IP, apuntar el intento, borrar lo viejo— y lo
-- único que cambia es qué se cuenta. Con la columna, las cuentas de contacto y
-- las del boletín no se pisan entre sí.
--
-- `default 'alta'` deja las filas que ya existían donde estaban.
alter table intentos_alta add column accion text not null default 'alta';

create index if not exists intentos_alta_accion on intentos_alta (accion, ip, intentado_en);
