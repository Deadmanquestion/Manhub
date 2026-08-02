revoke all on table
  public.brands,
  public.vehicle_models,
  public.user_vehicles,
  public.product_vehicle_models
from anon, authenticated;

grant select on table
  public.brands,
  public.vehicle_models,
  public.product_vehicle_models
to authenticated;

grant select, insert, update, delete on table public.user_vehicles to authenticated;
grant insert, update, delete on table public.product_vehicle_models to authenticated;

notify pgrst, 'reload schema';
