-- PASO 2
-- Activa lectura desde el navegador para tablas no clinicas usadas en el panel admin:
--   public.config_promociones
--   public.config_vacaciones
--   public.config_infografias

alter table public.config_promociones enable row level security;
alter table public.config_vacaciones enable row level security;
alter table public.config_infografias enable row level security;

drop policy if exists "vf_public_read_config_promociones" on public.config_promociones;
create policy "vf_public_read_config_promociones"
on public.config_promociones
for select
to anon, authenticated
using (true);

drop policy if exists "vf_public_read_config_vacaciones" on public.config_vacaciones;
create policy "vf_public_read_config_vacaciones"
on public.config_vacaciones
for select
to anon, authenticated
using (true);

drop policy if exists "vf_public_read_config_infografias" on public.config_infografias;
create policy "vf_public_read_config_infografias"
on public.config_infografias
for select
to anon, authenticated
using (true);
