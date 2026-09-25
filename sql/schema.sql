-- Esquema de base de datos: Smart Display + Checador Biometrico
-- Ejecutar en el SQL Editor de Supabase, en este orden.

create table empleados (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users(id),
  nombre_completo text not null,
  puesto text,
  foto_url text,
  hora_entrada_esperada time not null default '09:00',
  rostro_registrado boolean not null default false,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table dispositivos_pantalla (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users(id),
  nombre text not null,
  ubicacion text,
  ultima_conexion timestamptz
);

create table checadas (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references empleados(id),
  tipo text not null check (tipo in ('entrada', 'salida')),
  hora timestamptz not null default now(),
  metodo_biometrico text not null check (metodo_biometrico in ('huella', 'rostro')),
  dispositivo_origen text
);

create table avisos_tablero (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  mensaje text not null,
  publicado_por uuid references empleados(id),
  activo_desde timestamptz not null default now(),
  activo_hasta timestamptz
);

create table contenido_multimedia (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('imagen', 'video')),
  storage_path text not null,
  orden integer not null default 0,
  activo boolean not null default true
);

create table rostros_referencia (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references empleados(id) unique,
  descriptor float8[] not null,
  foto_referencia_path text not null,
  created_at timestamptz not null default now()
);

-- Indices de apoyo para las consultas mas frecuentes
create index idx_checadas_empleado_hora on checadas (empleado_id, hora desc);
create index idx_avisos_vigencia on avisos_tablero (activo_desde, activo_hasta);
create index idx_multimedia_orden on contenido_multimedia (orden) where activo = true;

-- Buckets de Storage (crear manualmente en Storage > New bucket):
--   fotos-empleados     -> privado (fotos de referencia y evidencia de checadas)
--   contenido-multimedia -> publico (imagenes/videos que reproduce la Smart Display)
