grant usage on schema public to anon, authenticated;

alter table public.brands enable row level security;
alter table public.vehicle_models enable row level security;
alter table public.vehicle_variants enable row level security;
alter table public.product_vehicle_models enable row level security;
alter table public.user_vehicles enable row level security;

grant select on table
  public.brands,
  public.vehicle_models,
  public.vehicle_variants,
  public.product_vehicle_models
to anon, authenticated;

grant select, insert, update, delete on table public.user_vehicles to authenticated;

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

drop policy if exists "Customers read own vehicles" on public.user_vehicles;
create policy "Customers read own vehicles"
  on public.user_vehicles for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Customers create own vehicles" on public.user_vehicles;
create policy "Customers create own vehicles"
  on public.user_vehicles for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Customers update own vehicles" on public.user_vehicles;
create policy "Customers update own vehicles"
  on public.user_vehicles for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Customers delete own vehicles" on public.user_vehicles;
create policy "Customers delete own vehicles"
  on public.user_vehicles for delete
  to authenticated
  using ((select auth.uid()) = user_id);

notify pgrst, 'reload schema';
