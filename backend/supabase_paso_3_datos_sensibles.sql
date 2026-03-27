-- PASO 3
-- Crea y asegura las tablas sensibles sincronizadas solo desde Apps Script:
--   public.pacientes
--   public.usuarios_admin
--   public.usuarios_superadmin
--   public.citas
--   public.historia_clinica
--   public.evolucion_paciente
--
-- Estas tablas NO deben exponerse al navegador con la anon key.
-- El backend sincroniza usando la service role key.

create table if not exists public.pacientes (
  id_paciente text primary key,
  cedula text,
  nombre_completo text,
  fecha_nacimiento text,
  telefono text,
  correo text,
  direccion text,
  ocupacion text,
  antecedentes_medicos text,
  fecha_registro text,
  password text,
  creado_por text,
  first_login text default 'NO'
);

alter table public.pacientes add column if not exists cedula text;
alter table public.pacientes add column if not exists nombre_completo text;
alter table public.pacientes add column if not exists fecha_nacimiento text;
alter table public.pacientes add column if not exists telefono text;
alter table public.pacientes add column if not exists correo text;
alter table public.pacientes add column if not exists direccion text;
alter table public.pacientes add column if not exists ocupacion text;
alter table public.pacientes add column if not exists antecedentes_medicos text;
alter table public.pacientes add column if not exists fecha_registro text;
alter table public.pacientes add column if not exists password text;
alter table public.pacientes add column if not exists creado_por text;
alter table public.pacientes add column if not exists first_login text default 'NO';

create unique index if not exists pacientes_id_paciente_key
on public.pacientes (id_paciente);

create index if not exists pacientes_creado_por_idx
on public.pacientes (creado_por);

create table if not exists public.usuarios_admin (
  usuario text primary key,
  nombre_doctor text,
  password text,
  rol text,
  ocupacion text,
  correo_notificaciones text,
  correo text,
  telefono text,
  first_login text default 'NO',
  registro_sanitario text,
  usar_firma_virtual text default 'SI'
);

alter table public.usuarios_admin add column if not exists nombre_doctor text;
alter table public.usuarios_admin add column if not exists password text;
alter table public.usuarios_admin add column if not exists rol text;
alter table public.usuarios_admin add column if not exists ocupacion text;
alter table public.usuarios_admin add column if not exists correo_notificaciones text;
alter table public.usuarios_admin add column if not exists correo text;
alter table public.usuarios_admin add column if not exists telefono text;
alter table public.usuarios_admin add column if not exists first_login text default 'NO';
alter table public.usuarios_admin add column if not exists registro_sanitario text;
alter table public.usuarios_admin add column if not exists usar_firma_virtual text default 'SI';

create unique index if not exists usuarios_admin_usuario_key
on public.usuarios_admin (usuario);

create table if not exists public.usuarios_superadmin (
  usuario text primary key,
  nombre text,
  password text,
  correo text,
  telefono text
);

alter table public.usuarios_superadmin add column if not exists nombre text;
alter table public.usuarios_superadmin add column if not exists password text;
alter table public.usuarios_superadmin add column if not exists correo text;
alter table public.usuarios_superadmin add column if not exists telefono text;

create unique index if not exists usuarios_superadmin_usuario_key
on public.usuarios_superadmin (usuario);

create table if not exists public.citas (
  id_cita text primary key,
  id_paciente text,
  fecha text,
  hora text,
  motivo text,
  estado text,
  fecha_registro text,
  nota_paciente text,
  recomendaciones_serv text,
  creado_por text,
  duracion_minutos integer
);

alter table public.citas add column if not exists id_paciente text;
alter table public.citas add column if not exists fecha text;
alter table public.citas add column if not exists hora text;
alter table public.citas add column if not exists motivo text;
alter table public.citas add column if not exists estado text;
alter table public.citas add column if not exists fecha_registro text;
alter table public.citas add column if not exists nota_paciente text;
alter table public.citas add column if not exists recomendaciones_serv text;
alter table public.citas add column if not exists creado_por text;
alter table public.citas add column if not exists duracion_minutos integer;

create unique index if not exists citas_id_cita_key
on public.citas (id_cita);

create index if not exists citas_id_paciente_idx
on public.citas (id_paciente);

create table if not exists public.historia_clinica (
  id_paciente text primary key,
  app text,
  apf text,
  alergias text,
  aqx text,
  menarquia text,
  prs text,
  num_parejas text,
  ago_g text,
  ago_p text,
  ago_c text,
  ago_a text,
  fecha_aborto text,
  pap text,
  fum text,
  anticonceptivos text,
  tipo_anti text,
  tiempo_uso text,
  tipo_ultimo text,
  fecha_actualizacion text
);

alter table public.historia_clinica add column if not exists app text;
alter table public.historia_clinica add column if not exists apf text;
alter table public.historia_clinica add column if not exists alergias text;
alter table public.historia_clinica add column if not exists aqx text;
alter table public.historia_clinica add column if not exists menarquia text;
alter table public.historia_clinica add column if not exists prs text;
alter table public.historia_clinica add column if not exists num_parejas text;
alter table public.historia_clinica add column if not exists ago_g text;
alter table public.historia_clinica add column if not exists ago_p text;
alter table public.historia_clinica add column if not exists ago_c text;
alter table public.historia_clinica add column if not exists ago_a text;
alter table public.historia_clinica add column if not exists fecha_aborto text;
alter table public.historia_clinica add column if not exists pap text;
alter table public.historia_clinica add column if not exists fum text;
alter table public.historia_clinica add column if not exists anticonceptivos text;
alter table public.historia_clinica add column if not exists tipo_anti text;
alter table public.historia_clinica add column if not exists tiempo_uso text;
alter table public.historia_clinica add column if not exists tipo_ultimo text;
alter table public.historia_clinica add column if not exists fecha_actualizacion text;

do $$
declare
  history_col text;
begin
  foreach history_col in array ARRAY[
    'app',
    'apf',
    'alergias',
    'aqx',
    'menarquia',
    'prs',
    'num_parejas',
    'ago_g',
    'ago_p',
    'ago_c',
    'ago_a',
    'fecha_aborto',
    'pap',
    'fum',
    'anticonceptivos',
    'tipo_anti',
    'tiempo_uso',
    'tipo_ultimo',
    'fecha_actualizacion'
  ]
  loop
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'historia_clinica'
        and column_name = history_col
        and data_type <> 'text'
    ) then
      execute format(
        'alter table public.historia_clinica alter column %I type text using case when %I is null then null else %I::text end',
        history_col,
        history_col,
        history_col
      );
    end if;
  end loop;
end $$;

create unique index if not exists historia_clinica_id_paciente_key
on public.historia_clinica (id_paciente);

create table if not exists public.evolucion_paciente (
  id_evolucion text primary key,
  id_paciente text,
  fecha_consulta text,
  motivo_consulta text,
  evolucion text,
  diagnostico text,
  tratamiento text,
  sugerencias text,
  creado_por text,
  fecha_actualizacion text
);

alter table public.evolucion_paciente add column if not exists id_paciente text;
alter table public.evolucion_paciente add column if not exists fecha_consulta text;
alter table public.evolucion_paciente add column if not exists motivo_consulta text;
alter table public.evolucion_paciente add column if not exists evolucion text;
alter table public.evolucion_paciente add column if not exists diagnostico text;
alter table public.evolucion_paciente add column if not exists tratamiento text;
alter table public.evolucion_paciente add column if not exists sugerencias text;
alter table public.evolucion_paciente add column if not exists creado_por text;
alter table public.evolucion_paciente add column if not exists fecha_actualizacion text;

create unique index if not exists evolucion_paciente_id_evolucion_key
on public.evolucion_paciente (id_evolucion);

create index if not exists evolucion_paciente_id_paciente_idx
on public.evolucion_paciente (id_paciente);

alter table public.pacientes enable row level security;
alter table public.usuarios_admin enable row level security;
alter table public.usuarios_superadmin enable row level security;
alter table public.citas enable row level security;
alter table public.historia_clinica enable row level security;
alter table public.evolucion_paciente enable row level security;

drop policy if exists "vf_public_read_pacientes" on public.pacientes;
drop policy if exists "vf_public_read_usuarios_admin" on public.usuarios_admin;
drop policy if exists "vf_public_read_usuarios_superadmin" on public.usuarios_superadmin;
drop policy if exists "vf_public_read_citas" on public.citas;
drop policy if exists "vf_public_read_historia_clinica" on public.historia_clinica;
drop policy if exists "vf_public_read_evolucion_paciente" on public.evolucion_paciente;

revoke all on table public.pacientes from anon, authenticated;
revoke all on table public.usuarios_admin from anon, authenticated;
revoke all on table public.usuarios_superadmin from anon, authenticated;
revoke all on table public.citas from anon, authenticated;
revoke all on table public.historia_clinica from anon, authenticated;
revoke all on table public.evolucion_paciente from anon, authenticated;
