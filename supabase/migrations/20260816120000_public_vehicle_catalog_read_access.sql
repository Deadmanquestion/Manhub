alter table public.brands enable row level security;
alter table public.vehicle_models enable row level security;
alter table public.vehicle_variants enable row level security;
alter table public.product_vehicle_models enable row level security;

drop policy if exists "Public users read brands" on public.brands;
create policy "Public users read brands"
  on public.brands for select
  to anon, authenticated
  using (true);

drop policy if exists "Public users read vehicle models" on public.vehicle_models;
create policy "Public users read vehicle models"
  on public.vehicle_models for select
  to anon, authenticated
  using (true);

drop policy if exists "Public users read vehicle variants" on public.vehicle_variants;
create policy "Public users read vehicle variants"
  on public.vehicle_variants for select
  to anon, authenticated
  using (true);

drop policy if exists "Public users read product compatibility" on public.product_vehicle_models;
create policy "Public users read product compatibility"
  on public.product_vehicle_models for select
  to anon, authenticated
  using (true);

grant select on table
  public.brands,
  public.vehicle_models,
  public.vehicle_variants,
  public.product_vehicle_models
to anon, authenticated;

grant select, insert, update, delete on table public.user_vehicles to authenticated;

notify pgrst, 'reload schema';
