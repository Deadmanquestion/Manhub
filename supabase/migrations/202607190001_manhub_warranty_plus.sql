create extension if not exists pgcrypto;

create table if not exists public.warranties (
  id text primary key,
  customer_id uuid not null,
  vehicle_id text not null,
  supplier_id text not null,
  workshop_id text not null,
  order_id text not null,
  invoice_id text not null,
  part_id text not null,
  status text not null check (status in ('Active', 'Expired', 'Claimed', 'Cancelled')),
  start_date date not null,
  expiry_date date not null,
  duration_months integer not null check (duration_months > 0),
  mileage_limit integer,
  created_at timestamptz not null default now(),
  customer_name text not null,
  vehicle_label text not null,
  workshop_name text not null,
  supplier_name text not null,
  part_name text not null,
  part_brand text not null,
  invoice_number text not null,
  repair_date date not null,
  warranty_terms text[] not null default '{}',
  repair_history jsonb not null default '[]'::jsonb
);

create table if not exists public.warranty_claims (
  id text primary key,
  warranty_id text not null references public.warranties(id) on delete cascade,
  customer_id uuid not null,
  description text not null,
  photos text[] not null default '{}',
  videos text[] not null default '{}',
  status text not null check (status in ('Pending Review', 'Approved', 'Rejected', 'Inspection Requested')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  inspection_status text check (inspection_status in ('New', 'Accepted', 'Scheduled', 'Report uploaded', 'Replacement recommended')),
  inspection_report text,
  supplier_id text,
  workshop_id text
);

create index if not exists warranties_customer_idx on public.warranties(customer_id);
create index if not exists warranties_supplier_idx on public.warranties(supplier_id);
create index if not exists warranties_workshop_idx on public.warranties(workshop_id);
create index if not exists warranty_claims_warranty_idx on public.warranty_claims(warranty_id);
create index if not exists warranty_claims_customer_idx on public.warranty_claims(customer_id);

alter table public.warranties enable row level security;
alter table public.warranty_claims enable row level security;

create or replace function public.manhub_app_role()
returns text
language sql
stable
as $$
  select coalesce(
    auth.jwt() ->> 'app_role',
    auth.jwt() -> 'user_metadata' ->> 'app_role',
    ''
  )
$$;

create or replace function public.manhub_supplier_id()
returns text
language sql
stable
as $$
  select coalesce(
    auth.jwt() ->> 'supplier_id',
    auth.jwt() -> 'user_metadata' ->> 'supplier_id',
    ''
  )
$$;

create or replace function public.manhub_workshop_id()
returns text
language sql
stable
as $$
  select coalesce(
    auth.jwt() ->> 'workshop_id',
    auth.jwt() -> 'user_metadata' ->> 'workshop_id',
    ''
  )
$$;

drop policy if exists "Customers view own warranties" on public.warranties;
create policy "Customers view own warranties"
on public.warranties
for select
to authenticated
using ((select auth.uid()) = customer_id);

drop policy if exists "Suppliers view supplied warranties" on public.warranties;
create policy "Suppliers view supplied warranties"
on public.warranties
for select
to authenticated
using (supplier_id = public.manhub_supplier_id());

drop policy if exists "Workshops view inspected warranties" on public.warranties;
create policy "Workshops view inspected warranties"
on public.warranties
for select
to authenticated
using (workshop_id = public.manhub_workshop_id());

drop policy if exists "Admins manage warranties" on public.warranties;
create policy "Admins manage warranties"
on public.warranties
for all
to authenticated
using (public.manhub_app_role() = 'admin')
with check (public.manhub_app_role() = 'admin');

drop policy if exists "Customers submit own claims" on public.warranty_claims;
create policy "Customers submit own claims"
on public.warranty_claims
for insert
to authenticated
with check ((select auth.uid()) = customer_id);

drop policy if exists "Customers view own claims" on public.warranty_claims;
create policy "Customers view own claims"
on public.warranty_claims
for select
to authenticated
using ((select auth.uid()) = customer_id);

drop policy if exists "Suppliers manage own claims" on public.warranty_claims;
create policy "Suppliers manage own claims"
on public.warranty_claims
for all
to authenticated
using (
  exists (
    select 1
    from public.warranties
    where warranties.id = warranty_claims.warranty_id
      and warranties.supplier_id = public.manhub_supplier_id()
  )
)
with check (
  exists (
    select 1
    from public.warranties
    where warranties.id = warranty_claims.warranty_id
      and warranties.supplier_id = public.manhub_supplier_id()
  )
);

drop policy if exists "Workshops manage inspection claims" on public.warranty_claims;
create policy "Workshops manage inspection claims"
on public.warranty_claims
for all
to authenticated
using (
  exists (
    select 1
    from public.warranties
    where warranties.id = warranty_claims.warranty_id
      and warranties.workshop_id = public.manhub_workshop_id()
  )
)
with check (
  exists (
    select 1
    from public.warranties
    where warranties.id = warranty_claims.warranty_id
      and warranties.workshop_id = public.manhub_workshop_id()
  )
);

drop policy if exists "Admins manage warranty claims" on public.warranty_claims;
create policy "Admins manage warranty claims"
on public.warranty_claims
for all
to authenticated
using (public.manhub_app_role() = 'admin')
with check (public.manhub_app_role() = 'admin');
