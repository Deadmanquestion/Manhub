create index if not exists product_vehicle_models_vehicle_model_idx
  on public.product_vehicle_models (vehicle_model_id, product_id);

create index if not exists user_vehicles_vehicle_model_idx
  on public.user_vehicles (vehicle_model_id);

drop policy if exists "Suppliers manage product compatibility"
  on public.product_vehicle_models;

drop policy if exists "Suppliers create product compatibility"
  on public.product_vehicle_models;
create policy "Suppliers create product compatibility"
  on public.product_vehicle_models for insert to authenticated
  with check (
    exists (
      select 1 from public.supplier_products product
      where product.id = product_id
        and product.supplier_id = (select auth.uid())
    )
  );

drop policy if exists "Suppliers update product compatibility"
  on public.product_vehicle_models;
create policy "Suppliers update product compatibility"
  on public.product_vehicle_models for update to authenticated
  using (
    exists (
      select 1 from public.supplier_products product
      where product.id = product_id
        and product.supplier_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.supplier_products product
      where product.id = product_id
        and product.supplier_id = (select auth.uid())
    )
  );

drop policy if exists "Suppliers delete product compatibility"
  on public.product_vehicle_models;
create policy "Suppliers delete product compatibility"
  on public.product_vehicle_models for delete to authenticated
  using (
    exists (
      select 1 from public.supplier_products product
      where product.id = product_id
        and product.supplier_id = (select auth.uid())
    )
  );

notify pgrst, 'reload schema';
