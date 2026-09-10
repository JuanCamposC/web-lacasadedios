-- ============================================================================
--  Esquema de D1 — Iglesia Evangélica La Casa de Dios
--  Reemplaza al de Supabase. Escrito de cero el 10 de septiembre de 2026.
-- ============================================================================
--
--  POR QUÉ DE CERO Y NO PORTADO
--
--  El esquema de Supabase estaba construido alrededor de RLS de Postgres: 25
--  políticas y 6 funciones `security definer` que hacían cumplir las reglas
--  DENTRO de la base. D1 no tiene nada de eso; es SQLite. Traducir esas 25
--  políticas a código del Worker una por una es el camino donde se cuela el
--  error que no avisa: una política olvidada es una fuga de datos silenciosa.
--
--  Rediseñado, la regla completa cabe en dos frases:
--
--    · TODA escritura pasa por /admin, y /admin entero vive detrás de
--      Cloudflare Access. Si la petición llegó al Worker sin la cabecera de
--      identidad de Access, no escribe. No hay segunda vía.
--    · La lectura pública devuelve solo filas con `publicado = 1`. Ese filtro
--      va en las consultas de las páginas públicas, que son pocas y están
--      todas en src/lib/.
--
--  Por eso desaparece la tabla `admins`: quién puede entrar lo decide Access
--  contra Google Workspace, no una fila en la base. Y desaparecen las 6
--  funciones: el freno por IP es la única que sobrevive, como consulta normal.
--
--  CONVENCIONES DE SQLITE (D1)
--
--  · Sin `uuid`. Las claves son TEXT y las genera el Worker con
--    `crypto.randomUUID()`. Poner el id del lado del código, y no de la base,
--    permite conocerlo antes de insertar.
--  · Sin `timestamptz`. Las fechas son TEXT en ISO-8601 UTC («2026-09-10T20:15:00Z»).
--    Se eligió TEXT y no epoch por dos razones: ordenan bien como cadena, y se
--    leen sin traducir cuando alguien mira la tabla a mano. SIEMPRE en UTC; la
--    conversión a hora de Chile es cosa de la presentación.
--  · Sin `boolean`. INTEGER con CHECK (0, 1).
--  · Los nombres van en castellano, como el resto del código. `slug` se queda
--    en inglés porque es un término técnico sin traducción usada.
--
--  El campo `templo` guarda el slug de src/data/templos.ts —santiago-centro,
--  san-miguel, limache, coya— o 'general' para lo que va a toda la iglesia. No
--  lleva CHECK a propósito: agregar un templo no debe exigir una migración.
-- ============================================================================

pragma foreign_keys = on;

-- ── Eventos ─────────────────────────────────────────────────────────────────
create table if not exists eventos (
  id             text primary key,
  titulo         text not null,
  slug           text unique,
  fecha          text not null,             -- ISO-8601 UTC: cuándo ocurre
  lugar          text,
  descripcion    text,
  imagen_clave   text,                      -- clave del objeto en R2, no una URL
  templo         text not null default 'general',
  publicado      integer not null default 1 check (publicado in (0, 1)),
  creado_en      text not null default (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  actualizado_en text not null default (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- La portada y /eventos piden lo publicado ordenado por fecha. Sin este índice
-- eso es un recorrido completo de la tabla en cada visita.
create index if not exists eventos_publicados on eventos (publicado, fecha);
create index if not exists eventos_templo on eventos (templo);

-- ── Noticias ────────────────────────────────────────────────────────────────
create table if not exists noticias (
  id             text primary key,
  titulo         text not null,
  slug           text unique,
  bajada         text,                      -- resumen para el listado
  cuerpo         text,                      -- markdown
  imagen_clave   text,
  templo         text not null default 'general',
  publicado      integer not null default 1 check (publicado in (0, 1)),
  publicado_en   text not null default (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  creado_en      text not null default (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  actualizado_en text not null default (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

create index if not exists noticias_publicadas on noticias (publicado, publicado_en desc);
create index if not exists noticias_templo on noticias (templo);

-- ── Videos (YouTube) ────────────────────────────────────────────────────────
-- El video sigue viviendo en YouTube y no en R2: no cuesta nada, no tiene tope,
-- y trae reproductor, subtítulos y calidad adaptable sin que nadie los mantenga.
create table if not exists videos (
  id          text primary key,
  titulo      text not null,
  youtube_url text not null,
  descripcion text,
  templo      text not null default 'general',
  publicado   integer not null default 1 check (publicado in (0, 1)),
  orden       integer not null default 0,
  creado_en   text not null default (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

create index if not exists videos_publicados on videos (publicado, orden);

-- ── Estudios en audio ───────────────────────────────────────────────────────
-- La razón por la que R2 está en el presupuesto. El archivo vive en R2 y aquí
-- solo queda su clave; la base nunca guarda binarios.
--
-- SE SIRVE DESDE UN DOMINIO PROPIO DE R2, NO A TRAVÉS DEL WORKER. Dos motivos,
-- y los dos importan:
--   · Un audio de una hora se escucha a saltos. Eso son peticiones con Range, y
--     R2 las responde de forma nativa. Pasarlas por el Worker obligaría a
--     implementar Range a mano, que es exactamente donde se rompe el arrastrar
--     la barra de reproducción.
--   · El tráfico de salida de R2 es gratis y no gasta CPU del Worker. Servirlo
--     por el Worker pagaría CPU por cada trozo de audio.
--
-- `duracion_seg` y `bytes` se guardan para poder mostrarlos sin abrir el
-- archivo, y para vigilar cuánto ocupa la biblioteca contra los 10 GB gratuitos.
create table if not exists estudios (
  id             text primary key,
  titulo         text not null,
  slug           text unique,
  descripcion    text,
  predicador     text,
  serie          text,                      -- para agrupar una serie de estudios
  fecha          text not null,             -- ISO-8601 UTC: cuándo se predicó
  archivo_clave  text not null,             -- clave del objeto en R2
  tipo_mime      text not null default 'audio/mpeg',
  duracion_seg   integer,
  bytes          integer,
  templo         text not null default 'general',
  publicado      integer not null default 1 check (publicado in (0, 1)),
  creado_en      text not null default (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  actualizado_en text not null default (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

create index if not exists estudios_publicados on estudios (publicado, fecha desc);
create index if not exists estudios_serie on estudios (serie);
create index if not exists estudios_templo on estudios (templo);

-- ── Boletín ─────────────────────────────────────────────────────────────────
-- Doble aceptación: al darse de alta, la fila nace con `pendiente = 1` y no
-- recibe nada salvo el correo de confirmación. Es lo que impide inscribir a
-- terceros, y por eso el freno por IP de más abajo es la segunda defensa y no
-- la primera.
--
-- `token` es lo que viaja en el enlace de baja de cada correo. Se guarda y no
-- se deriva del id: así el enlace no revela nada de la fila, y quien tenga un
-- correo viejo puede darse de baja para siempre.
create table if not exists suscriptores (
  id            text primary key,
  correo        text not null unique,
  token         text not null unique,
  pendiente     integer not null default 1 check (pendiente in (0, 1)),
  confirmado_en text,
  bienvenido_en text,
  creado_en     text not null default (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

create index if not exists suscriptores_confirmados on suscriptores (pendiente);

-- ── Freno de altas por IP ───────────────────────────────────────────────────
-- Regla: 5 altas por IP cada 60 minutos, la misma que había en Supabase.
--
-- POR QUÉ UNA TABLA Y NO EL LIMITADOR DE CLOUDFLARE: el binding de rate
-- limiting solo admite ventanas de 10 o 60 SEGUNDOS, así que no puede expresar
-- «5 por hora». Y el costo de la tabla es irrelevante: el formulario recibe
-- unas pocas altas al día contra las 100.000 escrituras diarias del tramo
-- gratuito de D1.
--
-- Las filas se barren solas: cada intento borra lo anterior a 24 horas.
create table if not exists intentos_alta (
  ip           text not null,
  intentado_en text not null default (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

create index if not exists intentos_alta_ip on intentos_alta (ip, intentado_en);

-- ── Ajustes del sitio ───────────────────────────────────────────────────────
-- Una sola fila, con `id = 1` forzado. Guarda dos cosas que el panel enciende y
-- apaga sin desplegar: la transmisión en vivo y el aviso emergente.
create table if not exists ajustes (
  id integer primary key check (id = 1),

  -- En vivo
  vivo_activo      integer not null default 0 check (vivo_activo in (0, 1)),
  vivo_url         text,
  vivo_titulo      text,
  -- URL de la última transmisión ya avisada por correo. Evita mandar dos veces
  -- el mismo aviso si alguien vuelve a guardar la misma transmisión.
  vivo_url_avisada text,

  -- Aviso emergente
  aviso_activo    integer not null default 0 check (aviso_activo in (0, 1)),
  aviso_titulo    text,
  aviso_cuerpo    text,
  aviso_boton     text,
  aviso_boton_url text,
  aviso_imagen_clave text,
  aviso_desde     text,                     -- ISO-8601 UTC, opcional
  aviso_hasta     text,
  -- Sube de número cada vez que cambia el contenido del aviso. El navegador
  -- guarda cuál vio; si el número no coincide, se vuelve a mostrar. Sin esto,
  -- cambiar el texto no se lo mostraría a quien ya lo había cerrado.
  aviso_version   integer not null default 1,
  aviso_diseno    text not null default 'normal',
  aviso_boton_pos text not null default 'abajo-centro',

  compartir_whatsapp text,
  actualizado_en text not null default (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

insert or ignore into ajustes (id) values (1);
