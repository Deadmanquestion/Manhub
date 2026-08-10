with ranked_brands as (
  select
    b.id,
    b.name,
    lower(trim(b.name)) as brand_key,
    row_number() over (
      partition by lower(trim(b.name))
      order by count(vm.id) desc, (b.name <> lower(b.name)) desc, b.id
    ) as rn
  from public.brands b
  left join public.vehicle_models vm on vm.brand_id = b.id
  group by b.id, b.name
), canonical_brands as (
  select brand_key, id as canonical_id
  from ranked_brands
  where rn = 1
), duplicate_brands as (
  select ranked_brands.id as duplicate_id, canonical_brands.canonical_id
  from ranked_brands
  join canonical_brands using (brand_key)
  where ranked_brands.rn > 1
)
update public.vehicle_models model
set brand_id = duplicate_brands.canonical_id
from duplicate_brands
where model.brand_id = duplicate_brands.duplicate_id;

with ranked_brands as (
  select
    b.id,
    lower(trim(b.name)) as brand_key,
    row_number() over (
      partition by lower(trim(b.name))
      order by count(vm.id) desc, (b.name <> lower(b.name)) desc, b.id
    ) as rn
  from public.brands b
  left join public.vehicle_models vm on vm.brand_id = b.id
  group by b.id, b.name
)
delete from public.brands b
using ranked_brands ranked
where b.id = ranked.id
  and ranked.rn > 1;

update public.brands
set name = case lower(trim(name))
  when 'toyota' then 'Toyota'
  when 'honda' then 'Honda'
  when 'bmw' then 'BMW'
  when 'mercedes-benz' then 'Mercedes-Benz'
  when 'proton' then 'Proton'
  when 'perodua' then 'Perodua'
  when 'mazda' then 'Mazda'
  when 'nissan' then 'Nissan'
  when 'mitsubishi' then 'Mitsubishi'
  when 'isuzu' then 'Isuzu'
  else name
end;

update public.vehicle_models
set model_name = case lower(trim(model_name))
  when 'corolla' then 'Corolla'
  else model_name
end;

create unique index if not exists brands_name_ci_unique
  on public.brands ((lower(trim(name))));
