-- PASO 1
-- Activa lectura desde el navegador solo para estas tablas no sensibles:
--   public.servicios
--   public.config_campos
--
-- Esto permite que el primer puente del frontend lea servicios y configuracion
-- dinamica directamente desde Supabase usando la anon key.

alter table public.servicios enable row level security;
alter table public.config_campos enable row level security;

drop policy if exists "vf_public_read_servicios" on public.servicios;
create policy "vf_public_read_servicios"
on public.servicios
for select
to anon, authenticated
using (true);

drop policy if exists "vf_public_read_config_campos" on public.config_campos;
create policy "vf_public_read_config_campos"
on public.config_campos
for select
to anon, authenticated
using (true);
