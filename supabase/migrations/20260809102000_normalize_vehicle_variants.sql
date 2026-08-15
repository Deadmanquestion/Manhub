drop policy if exists "Authenticated users read vehicle models" on public.vehicle_models;
drop policy if exists "Authenticated users read product compatibility" on public.product_vehicle_models;
drop policy if exists "Suppliers create product compatibility" on public.product_vehicle_models;
drop policy if exists "Suppliers update product compatibility" on public.product_vehicle_models;
drop policy if exists "Suppliers delete product compatibility" on public.product_vehicle_models;

alter table public.user_vehicles
  drop constraint if exists user_vehicles_vehicle_model_id_fkey;

alter table public.product_vehicle_models
  drop constraint if exists product_vehicle_models_vehicle_model_id_fkey;

drop index if exists public.vehicle_models_brand_name_idx;
drop index if exists public.product_vehicle_models_vehicle_model_idx;
drop index if exists public.user_vehicles_vehicle_model_idx;

alter table public.brands
  add column if not exists country text;

alter table public.vehicle_models
  rename to vehicle_models_legacy;

alter table public.vehicle_models_legacy
  rename constraint vehicle_models_pkey to vehicle_models_legacy_pkey;

create table public.vehicle_models (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  model_name text not null check (btrim(model_name) <> ''),
  generation text not null default 'Current' check (btrim(generation) <> ''),
  body_type text not null default 'Not specified' check (btrim(body_type) <> ''),
  image_url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, model_name, generation)
);

create table public.vehicle_variants (
  id uuid primary key default gen_random_uuid(),
  vehicle_model_id uuid not null references public.vehicle_models(id) on delete cascade,
  year integer not null check (year between 1950 and 2100),
  engine text not null check (btrim(engine) <> ''),
  displacement integer check (displacement is null or displacement > 0),
  fuel text not null check (btrim(fuel) <> ''),
  transmission text not null check (btrim(transmission) <> ''),
  drivetrain text not null default 'Not specified' check (btrim(drivetrain) <> ''),
  horsepower integer check (horsepower is null or horsepower > 0),
  torque integer check (torque is null or torque > 0),
  tyre_size text,
  engine_oil_capacity numeric(5,2) check (engine_oil_capacity is null or engine_oil_capacity > 0),
  transmission_oil_capacity numeric(5,2) check (transmission_oil_capacity is null or transmission_oil_capacity > 0),
  coolant_capacity numeric(5,2) check (coolant_capacity is null or coolant_capacity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (vehicle_model_id, year, engine, transmission, drivetrain)
);

with legacy_models as (
  select
    legacy.id as legacy_id,
    legacy.brand_id,
    legacy.model_name,
    case
      when legacy.year >= 2021 then 'Current'
      when legacy.year between 2016 and 2020 then '2016-2020'
      when legacy.year between 2011 and 2015 then '2011-2015'
      else 'Earlier'
    end as generation,
    case
      when legacy.image_url ilike '%suv%' then 'SUV'
      when legacy.image_url ilike '%pickup%' then 'Pickup'
      when legacy.image_url ilike '%mpv%' then 'MPV'
      when legacy.image_url ilike '%hatchback%' then 'Hatchback'
      else 'Sedan'
    end as body_type,
    max(legacy.image_url) as image_url
  from public.vehicle_models_legacy legacy
  group by legacy.id, legacy.brand_id, legacy.model_name, legacy.year, legacy.image_url
)
insert into public.vehicle_models (brand_id, model_name, generation, body_type, image_url)
select distinct brand_id, model_name, generation, body_type, image_url
from legacy_models
on conflict (brand_id, model_name, generation) do update
set body_type = excluded.body_type,
    image_url = excluded.image_url,
    updated_at = now();

insert into public.vehicle_variants (
  id,
  vehicle_model_id,
  year,
  engine,
  displacement,
  fuel,
  transmission,
  drivetrain,
  horsepower,
  torque,
  tyre_size,
  engine_oil_capacity,
  transmission_oil_capacity,
  coolant_capacity,
  created_at,
  updated_at
)
select
  legacy.id,
  model.id,
  legacy.year,
  legacy.engine,
  null,
  legacy.fuel,
  legacy.transmission,
  'FWD',
  legacy.horsepower,
  legacy.torque_nm,
  null,
  null,
  null,
  null,
  legacy.created_at,
  now()
from public.vehicle_models_legacy legacy
join public.vehicle_models model
  on model.brand_id = legacy.brand_id
  and model.model_name = legacy.model_name
  and model.generation = case
    when legacy.year >= 2021 then 'Current'
    when legacy.year between 2016 and 2020 then '2016-2020'
    when legacy.year between 2011 and 2015 then '2011-2015'
    else 'Earlier'
  end
on conflict (id) do nothing;

alter table public.user_vehicles
  add column if not exists vehicle_variant_id uuid;

update public.user_vehicles
set vehicle_variant_id = vehicle_model_id
where vehicle_variant_id is null;

alter table public.user_vehicles
  alter column vehicle_variant_id set not null,
  add constraint user_vehicles_vehicle_variant_id_fkey
    foreign key (vehicle_variant_id) references public.vehicle_variants(id) on delete restrict;

alter table public.user_vehicles
  drop column vehicle_model_id;

alter table public.product_vehicle_models
  drop constraint if exists product_vehicle_models_pkey,
  add column if not exists vehicle_variant_id uuid;

update public.product_vehicle_models
set vehicle_variant_id = vehicle_model_id
where vehicle_variant_id is null;

alter table public.product_vehicle_models
  alter column vehicle_variant_id set not null,
  add constraint product_vehicle_models_vehicle_variant_id_fkey
    foreign key (vehicle_variant_id) references public.vehicle_variants(id) on delete cascade,
  drop column vehicle_model_id,
  add primary key (product_id, vehicle_variant_id);

drop table public.vehicle_models_legacy;

insert into public.brands (name, logo_url, country)
values
  ('Toyota', 'https://www.google.com/s2/favicons?domain=toyota.com.my&sz=128', 'Japan'),
  ('Honda', 'https://www.google.com/s2/favicons?domain=honda.com.my&sz=128', 'Japan'),
  ('BMW', 'https://www.google.com/s2/favicons?domain=bmw.com.my&sz=128', 'Germany'),
  ('Mercedes-Benz', 'https://www.google.com/s2/favicons?domain=mercedes-benz.com.my&sz=128', 'Germany'),
  ('Proton', 'https://www.google.com/s2/favicons?domain=proton.com&sz=128', 'Malaysia'),
  ('Perodua', 'https://www.google.com/s2/favicons?domain=perodua.com.my&sz=128', 'Malaysia'),
  ('Mazda', 'https://www.google.com/s2/favicons?domain=mazda.com.my&sz=128', 'Japan'),
  ('Nissan', 'https://www.google.com/s2/favicons?domain=nissan.com.my&sz=128', 'Japan'),
  ('Mitsubishi', 'https://www.google.com/s2/favicons?domain=mitsubishi-motors.com.my&sz=128', 'Japan'),
  ('Isuzu', 'https://www.google.com/s2/favicons?domain=isuzu.net.my&sz=128', 'Japan')
on conflict (name) do update
set logo_url = excluded.logo_url,
    country = excluded.country;

create index vehicle_models_brand_name_idx
  on public.vehicle_models (brand_id, model_name, generation);

create index vehicle_models_body_type_idx
  on public.vehicle_models (body_type);

create index vehicle_variants_model_year_idx
  on public.vehicle_variants (vehicle_model_id, year desc);

create index vehicle_variants_year_engine_idx
  on public.vehicle_variants (year, engine);

create index vehicle_variants_displacement_fuel_idx
  on public.vehicle_variants (displacement, fuel);

create index product_vehicle_models_vehicle_variant_idx
  on public.product_vehicle_models (vehicle_variant_id, product_id);

create index user_vehicles_vehicle_variant_idx
  on public.user_vehicles (vehicle_variant_id);

alter table public.vehicle_models enable row level security;
alter table public.vehicle_variants enable row level security;

drop policy if exists "Authenticated users read vehicle models" on public.vehicle_models;
create policy "Authenticated users read vehicle models"
  on public.vehicle_models for select to authenticated using (true);

drop policy if exists "Authenticated users read vehicle variants" on public.vehicle_variants;
create policy "Authenticated users read vehicle variants"
  on public.vehicle_variants for select to authenticated using (true);

drop policy if exists "Authenticated users read product compatibility" on public.product_vehicle_models;
create policy "Authenticated users read product compatibility"
  on public.product_vehicle_models for select to authenticated using (true);

drop policy if exists "Suppliers create product compatibility" on public.product_vehicle_models;
create policy "Suppliers create product compatibility"
  on public.product_vehicle_models for insert to authenticated
  with check (
    exists (
      select 1 from public.supplier_products product
      where product.id = product_id
        and product.supplier_id = (select auth.uid())
    )
  );

drop policy if exists "Suppliers update product compatibility" on public.product_vehicle_models;
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

drop policy if exists "Suppliers delete product compatibility" on public.product_vehicle_models;
create policy "Suppliers delete product compatibility"
  on public.product_vehicle_models for delete to authenticated
  using (
    exists (
      select 1 from public.supplier_products product
      where product.id = product_id
        and product.supplier_id = (select auth.uid())
    )
  );

revoke all on table public.vehicle_models, public.vehicle_variants from anon, authenticated;
grant select on table public.brands, public.vehicle_models, public.vehicle_variants, public.product_vehicle_models to authenticated;
grant insert, update, delete on table public.product_vehicle_models to authenticated;

notify pgrst, 'reload schema';
