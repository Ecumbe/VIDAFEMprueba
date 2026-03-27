-- Corrige instalaciones antiguas donde historia_clinica quedo con columnas numericas.
-- Este script no borra datos: solo convierte a text las columnas clinicas que hoy no lo sean.

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

select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'historia_clinica'
order by ordinal_position;
