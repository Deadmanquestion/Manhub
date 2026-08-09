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

with seed_models (brand_name, model_name, generation, body_type, image_url) as (
  values
    ('Toyota', 'Vios', 'AC100', 'Sedan', '/assets/vehicle-catalog/sedan.webp'),
    ('Toyota', 'Camry', 'XV80', 'Sedan', '/assets/vehicle-catalog/sedan.webp'),
    ('Toyota', 'Corolla Cross', 'XG10', 'SUV', '/assets/vehicle-catalog/suv.webp'),
    ('Toyota', 'Hilux', 'AN120/AN130', 'Pickup', '/assets/vehicle-catalog/pickup.webp'),
    ('Toyota', 'Alphard', 'AH40', 'MPV', '/assets/vehicle-catalog/mpv.webp'),
    ('Honda', 'City', 'GN', 'Sedan', '/assets/vehicle-catalog/sedan.webp'),
    ('Honda', 'Civic', 'FE', 'Sedan', '/assets/vehicle-catalog/sedan.webp'),
    ('Honda', 'HR-V', 'RV', 'SUV', '/assets/vehicle-catalog/suv.webp'),
    ('BMW', '3 Series', 'G20 LCI', 'Sedan', '/assets/vehicle-catalog/sedan.webp'),
    ('BMW', 'X3', 'G45', 'SUV', '/assets/vehicle-catalog/suv.webp'),
    ('Mercedes-Benz', 'C-Class', 'W206', 'Sedan', '/assets/vehicle-catalog/sedan.webp'),
    ('Mercedes-Benz', 'GLC', 'X254', 'SUV', '/assets/vehicle-catalog/suv.webp'),
    ('Proton', 'Saga', 'MC2', 'Sedan', '/assets/vehicle-catalog/sedan.webp'),
    ('Proton', 'X50', 'Binyue-based', 'SUV', '/assets/vehicle-catalog/suv.webp'),
    ('Proton', 'X70', 'Boyue-based', 'SUV', '/assets/vehicle-catalog/suv.webp'),
    ('Perodua', 'Myvi', 'D20N', 'Hatchback', '/assets/vehicle-catalog/hatchback.webp'),
    ('Perodua', 'Axia', 'A300', 'Hatchback', '/assets/vehicle-catalog/hatchback.webp'),
    ('Perodua', 'Ativa', 'A270', 'SUV', '/assets/vehicle-catalog/suv.webp'),
    ('Mazda', 'Mazda3', 'BP', 'Sedan/Hatchback', '/assets/vehicle-catalog/hatchback.webp'),
    ('Mazda', 'CX-5', 'KF', 'SUV', '/assets/vehicle-catalog/suv.webp'),
    ('Nissan', 'Almera', 'N18', 'Sedan', '/assets/vehicle-catalog/sedan.webp'),
    ('Nissan', 'X-Trail', 'T33', 'SUV', '/assets/vehicle-catalog/suv.webp'),
    ('Mitsubishi', 'Triton', 'LC2T', 'Pickup', '/assets/vehicle-catalog/pickup.webp'),
    ('Mitsubishi', 'Xpander', 'NC1W', 'MPV', '/assets/vehicle-catalog/mpv.webp'),
    ('Isuzu', 'D-Max', 'RG01', 'Pickup', '/assets/vehicle-catalog/pickup.webp'),
    ('Isuzu', 'MU-X', 'RJ', 'SUV', '/assets/vehicle-catalog/suv.webp')
)
insert into public.vehicle_models (brand_id, model_name, generation, body_type, image_url)
select brand.id, seed.model_name, seed.generation, seed.body_type, seed.image_url
from seed_models seed
join public.brands brand on brand.name = seed.brand_name
on conflict (brand_id, model_name, generation) do update
set body_type = excluded.body_type,
    image_url = excluded.image_url,
    updated_at = now();

with seed_variants (
  brand_name, model_name, generation, model_year, engine, displacement, fuel, transmission,
  drivetrain, horsepower, torque, tyre_size, engine_oil_capacity, transmission_oil_capacity, coolant_capacity
) as (
  values
    ('Toyota', 'Vios', 'AC100', 2023, '2NR-VE 1.5L', 1496, 'Petrol', 'CVT', 'FWD', 106, 138, '195/60R16', 3.60, 6.50, 5.10),
    ('Toyota', 'Vios', 'AC100', 2024, '2NR-VE 1.5L', 1496, 'Petrol', 'CVT', 'FWD', 106, 138, '195/60R16', 3.60, 6.50, 5.10),
    ('Toyota', 'Camry', 'XV80', 2025, 'A25A-FXS 2.5L Hybrid', 2487, 'Petrol hybrid', 'e-CVT', 'FWD', 230, 221, '235/45R18', 4.50, 4.20, 6.60),
    ('Toyota', 'Corolla Cross', 'XG10', 2025, '2ZR-FXE 1.8L Hybrid', 1798, 'Petrol hybrid', 'e-CVT', 'FWD', 122, 142, '225/50R18', 4.20, 4.00, 6.10),
    ('Toyota', 'Hilux', 'AN120/AN130', 2025, '1GD-FTV 2.8L Turbo Diesel', 2755, 'Diesel', '6-speed automatic', '4WD', 204, 500, '265/60R18', 7.50, 10.50, 9.10),
    ('Toyota', 'Alphard', 'AH40', 2025, 'A25A-FXS 2.5L Hybrid', 2487, 'Petrol hybrid', 'e-CVT', 'FWD', 250, 239, '225/60R18', 4.50, 4.20, 7.00),
    ('Honda', 'City', 'GN', 2025, 'L15ZF 1.5L', 1498, 'Petrol', 'CVT', 'FWD', 121, 145, '185/55R16', 3.60, 3.80, 4.90),
    ('Honda', 'Civic', 'FE', 2025, 'L15B7 1.5L Turbo', 1498, 'Petrol', 'CVT', 'FWD', 182, 240, '235/40R18', 3.70, 4.30, 5.60),
    ('Honda', 'HR-V', 'RV', 2025, 'L15C 1.5L Turbo', 1498, 'Petrol', 'CVT', 'FWD', 181, 240, '225/50R18', 3.70, 4.30, 5.60),
    ('BMW', '3 Series', 'G20 LCI', 2025, 'B48 2.0L Turbo', 1998, 'Petrol', '8-speed automatic', 'RWD', 184, 300, '225/45R18', 5.25, 8.50, 7.20),
    ('BMW', 'X3', 'G45', 2025, 'B48 2.0L Turbo', 1998, 'Petrol', '8-speed automatic', 'AWD', 208, 330, '245/50R19', 5.25, 8.50, 7.60),
    ('Mercedes-Benz', 'C-Class', 'W206', 2025, 'M254 1.5L Turbo Mild Hybrid', 1496, 'Petrol hybrid', '9-speed automatic', 'RWD', 204, 300, '225/45R18', 6.00, 9.00, 7.00),
    ('Mercedes-Benz', 'GLC', 'X254', 2025, 'M254 2.0L Turbo Mild Hybrid', 1999, 'Petrol hybrid', '9-speed automatic', 'AWD', 258, 400, '235/55R19', 6.50, 9.00, 8.00),
    ('Proton', 'Saga', 'MC2', 2025, 'S4PE 1.3L', 1332, 'Petrol', '4-speed automatic', 'FWD', 95, 120, '185/55R15', 4.00, 5.80, 5.50),
    ('Proton', 'X50', 'Binyue-based', 2025, '1.5L TGDi', 1477, 'Petrol', '7-speed DCT', 'FWD', 177, 255, '215/55R18', 5.60, 6.80, 6.20),
    ('Proton', 'X70', 'Boyue-based', 2025, '1.5L TGDi', 1477, 'Petrol', '7-speed DCT', 'FWD', 177, 255, '225/60R18', 5.60, 6.80, 6.30),
    ('Perodua', 'Myvi', 'D20N', 2025, '2NR-VE 1.5L', 1496, 'Petrol', 'D-CVT', 'FWD', 102, 137, '185/55R15', 3.50, 6.00, 5.00),
    ('Perodua', 'Axia', 'A300', 2025, '1KR-VE 1.0L', 998, 'Petrol', 'D-CVT', 'FWD', 67, 91, '175/65R14', 3.10, 5.80, 4.70),
    ('Perodua', 'Ativa', 'A270', 2025, '1KR-VET 1.0L Turbo', 996, 'Petrol', 'D-CVT', 'FWD', 98, 140, '205/60R17', 3.10, 5.80, 4.70),
    ('Mazda', 'Mazda3', 'BP', 2025, 'Skyactiv-G 2.0L', 1998, 'Petrol', '6-speed automatic', 'FWD', 162, 213, '215/45R18', 4.20, 7.80, 6.20),
    ('Mazda', 'CX-5', 'KF', 2025, 'Skyactiv-G 2.0L', 1998, 'Petrol', '6-speed automatic', 'FWD', 162, 213, '225/55R19', 4.20, 7.80, 6.30),
    ('Nissan', 'Almera', 'N18', 2025, 'HR10DET 1.0L Turbo', 999, 'Petrol', 'Xtronic CVT', 'FWD', 100, 152, '205/55R16', 3.40, 6.90, 5.20),
    ('Nissan', 'X-Trail', 'T33', 2025, 'PR25DD 2.5L', 2488, 'Petrol', 'Xtronic CVT', 'AWD', 181, 244, '235/55R19', 5.00, 8.40, 7.10),
    ('Mitsubishi', 'Triton', 'LC2T', 2025, '4N16 2.4L Turbo Diesel', 2439, 'Diesel', '6-speed automatic', '4WD', 204, 470, '265/60R18', 7.60, 10.20, 8.80),
    ('Mitsubishi', 'Xpander', 'NC1W', 2025, '4A91 1.5L', 1499, 'Petrol', '4-speed automatic', 'FWD', 105, 141, '205/55R16', 4.00, 6.00, 5.50),
    ('Isuzu', 'D-Max', 'RG01', 2025, '4JJ3-TCX 3.0L Turbo Diesel', 2999, 'Diesel', '6-speed automatic', '4WD', 190, 450, '265/60R18', 7.30, 9.80, 9.00),
    ('Isuzu', 'MU-X', 'RJ', 2025, '4JJ3-TCX 3.0L Turbo Diesel', 2999, 'Diesel', '6-speed automatic', '4WD', 190, 450, '265/60R18', 7.30, 9.80, 9.00)
)
insert into public.vehicle_variants (
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
  coolant_capacity
)
select
  model.id,
  seed.model_year,
  seed.engine,
  seed.displacement,
  seed.fuel,
  seed.transmission,
  seed.drivetrain,
  seed.horsepower,
  seed.torque,
  seed.tyre_size,
  seed.engine_oil_capacity,
  seed.transmission_oil_capacity,
  seed.coolant_capacity
from seed_variants seed
join public.brands brand on brand.name = seed.brand_name
join public.vehicle_models model
  on model.brand_id = brand.id
  and model.model_name = seed.model_name
  and model.generation = seed.generation
on conflict (vehicle_model_id, year, engine, transmission, drivetrain) do update
set displacement = excluded.displacement,
    fuel = excluded.fuel,
    horsepower = excluded.horsepower,
    torque = excluded.torque,
    tyre_size = excluded.tyre_size,
    engine_oil_capacity = excluded.engine_oil_capacity,
    transmission_oil_capacity = excluded.transmission_oil_capacity,
    coolant_capacity = excluded.coolant_capacity,
    updated_at = now();

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
