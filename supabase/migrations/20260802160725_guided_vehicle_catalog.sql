create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  logo_url text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.vehicle_models (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  model_name text not null,
  year integer not null check (year between 1950 and 2100),
  engine text not null,
  fuel text not null,
  transmission text not null,
  horsepower integer check (horsepower is null or horsepower > 0),
  torque_nm integer check (torque_nm is null or torque_nm > 0),
  image_url text not null,
  created_at timestamptz not null default now(),
  unique (brand_id, model_name, year, engine, transmission)
);

create table if not exists public.user_vehicles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  vehicle_model_id uuid not null references public.vehicle_models(id) on delete restrict,
  plate_number text not null check (btrim(plate_number) <> ''),
  mileage integer not null check (mileage >= 0),
  nickname text check (nickname is null or btrim(nickname) <> ''),
  legacy_car_id uuid unique references public.cars(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists user_vehicles_owner_plate_idx
  on public.user_vehicles (user_id, upper(btrim(plate_number)));
create index if not exists vehicle_models_brand_name_idx
  on public.vehicle_models (brand_id, model_name, year desc);
create index if not exists user_vehicles_user_idx
  on public.user_vehicles (user_id, created_at desc);

create table if not exists public.product_vehicle_models (
  product_id uuid not null references public.supplier_products(id) on delete cascade,
  vehicle_model_id uuid not null references public.vehicle_models(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (product_id, vehicle_model_id)
);

alter table public.service_bookings
  add column if not exists user_vehicle_id uuid references public.user_vehicles(id) on delete set null;
alter table public.service_bookings
  alter column car_id drop not null;
create index if not exists service_bookings_user_vehicle_idx
  on public.service_bookings (user_vehicle_id);

alter table public.lift_bookings
  add column if not exists user_vehicle_id uuid references public.user_vehicles(id) on delete set null;
create index if not exists lift_bookings_user_vehicle_idx
  on public.lift_bookings (user_vehicle_id);

alter table public.brands enable row level security;
alter table public.vehicle_models enable row level security;
alter table public.user_vehicles enable row level security;
alter table public.product_vehicle_models enable row level security;

drop policy if exists "Authenticated users read brands" on public.brands;
create policy "Authenticated users read brands"
  on public.brands for select to authenticated using (true);

drop policy if exists "Authenticated users read vehicle models" on public.vehicle_models;
create policy "Authenticated users read vehicle models"
  on public.vehicle_models for select to authenticated using (true);

drop policy if exists "Customers read own vehicles" on public.user_vehicles;
create policy "Customers read own vehicles"
  on public.user_vehicles for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Customers create own vehicles" on public.user_vehicles;
create policy "Customers create own vehicles"
  on public.user_vehicles for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Customers update own vehicles" on public.user_vehicles;
create policy "Customers update own vehicles"
  on public.user_vehicles for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Customers delete own vehicles" on public.user_vehicles;
create policy "Customers delete own vehicles"
  on public.user_vehicles for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Authenticated users read product compatibility" on public.product_vehicle_models;
create policy "Authenticated users read product compatibility"
  on public.product_vehicle_models for select to authenticated using (true);

drop policy if exists "Suppliers manage product compatibility" on public.product_vehicle_models;
create policy "Suppliers manage product compatibility"
  on public.product_vehicle_models for all to authenticated
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

grant select on public.brands, public.vehicle_models, public.product_vehicle_models to authenticated;
grant select, insert, update, delete on public.user_vehicles to authenticated;
grant insert, update, delete on public.product_vehicle_models to authenticated;

insert into public.brands (name, logo_url)
values
  ('Toyota', 'https://www.google.com/s2/favicons?domain=toyota.com.my&sz=128'),
  ('Honda', 'https://www.google.com/s2/favicons?domain=honda.com.my&sz=128'),
  ('BMW', 'https://www.google.com/s2/favicons?domain=bmw.com.my&sz=128'),
  ('Mercedes-Benz', 'https://www.google.com/s2/favicons?domain=mercedes-benz.com.my&sz=128'),
  ('Proton', 'https://www.google.com/s2/favicons?domain=proton.com&sz=128'),
  ('Perodua', 'https://www.google.com/s2/favicons?domain=perodua.com.my&sz=128'),
  ('Mazda', 'https://www.google.com/s2/favicons?domain=mazda.com.my&sz=128'),
  ('Nissan', 'https://www.google.com/s2/favicons?domain=nissan.com.my&sz=128')
on conflict (name) do update set logo_url = excluded.logo_url;

insert into public.brands (name, logo_url)
select distinct btrim(car.make), 'https://www.google.com/s2/favicons?domain=car.info&sz=128'
from public.cars car
where btrim(coalesce(car.make, '')) <> ''
on conflict (name) do nothing;

insert into public.vehicle_models (
  brand_id, model_name, year, engine, fuel, transmission, horsepower, torque_nm, image_url
)
select distinct
  brand.id,
  btrim(car.model),
  coalesce(car.year, extract(year from current_date)::integer),
  coalesce(nullif(btrim(car.engine), ''), 'Not specified'),
  'Not specified',
  'Not specified',
  null::integer,
  null::integer,
  '/assets/vehicle-catalog/sedan.webp'
from public.cars car
join public.brands brand on lower(brand.name) = lower(btrim(car.make))
where btrim(coalesce(car.model, '')) <> ''
on conflict (brand_id, model_name, year, engine, transmission) do nothing;

insert into public.user_vehicles (
  user_id, vehicle_model_id, plate_number, mileage, nickname, legacy_car_id, created_at, updated_at
)
select
  car.user_id,
  model.id,
  coalesce(nullif(btrim(car.license_plate), ''), 'UNREGISTERED-' || left(car.id::text, 8)),
  greatest(coalesce(car.mileage, 0), 0),
  nullif(btrim(car.notes), ''),
  car.id,
  car.created_at,
  car.updated_at
from public.cars car
join public.brands brand on lower(brand.name) = lower(btrim(car.make))
join lateral (
  select candidate.id
  from public.vehicle_models candidate
  where candidate.brand_id = brand.id
    and lower(candidate.model_name) = lower(btrim(car.model))
    and candidate.year = coalesce(car.year, extract(year from current_date)::integer)
  order by (candidate.engine = coalesce(nullif(btrim(car.engine), ''), 'Not specified')) desc
  limit 1
) model on true
on conflict (legacy_car_id) do nothing;

update public.service_bookings booking
set user_vehicle_id = vehicle.id
from public.user_vehicles vehicle
where booking.car_id = vehicle.legacy_car_id
  and booking.user_vehicle_id is null;

update public.lift_bookings booking
set user_vehicle_id = vehicle.id
from public.user_vehicles vehicle
where booking.car_id = vehicle.legacy_car_id
  and booking.user_vehicle_id is null;

create or replace function public.set_user_vehicle_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_user_vehicle_updated_at() from public, anon, authenticated;

drop trigger if exists user_vehicles_set_updated_at on public.user_vehicles;
create trigger user_vehicles_set_updated_at
before update on public.user_vehicles
for each row execute function public.set_user_vehicle_updated_at();

notify pgrst, 'reload schema';
