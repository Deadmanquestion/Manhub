alter table public.vehicle_models
  add column if not exists discontinued_at timestamptz;

alter table public.vehicle_variants
  add column if not exists discontinued_at timestamptz;

with static_catalog_models as (
  select id
  from public.vehicle_models
  where external_provider is null
    and synced_at is null
    and image_url like '/assets/vehicle-catalog/%'
)
update public.vehicle_variants variant
set discontinued_at = coalesce(variant.discontinued_at, now()),
    updated_at = now()
from static_catalog_models model
where variant.vehicle_model_id = model.id
  and variant.external_provider is null
  and variant.synced_at is null;

with static_catalog_models as (
  select id
  from public.vehicle_models
  where external_provider is null
    and synced_at is null
    and image_url like '/assets/vehicle-catalog/%'
)
update public.vehicle_models model
set discontinued_at = coalesce(model.discontinued_at, now()),
    updated_at = now()
from static_catalog_models static_model
where model.id = static_model.id;
