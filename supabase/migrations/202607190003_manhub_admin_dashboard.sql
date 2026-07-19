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

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid,
  full_name text not null,
  email text not null,
  account_type text not null check (account_type in ('Customer', 'Supplier', 'Workshop', 'Technician', 'Admin')),
  status text not null default 'Pending Verification' check (status in ('Active', 'Pending Verification', 'Verified', 'Suspended', 'Banned')),
  verified boolean not null default false,
  last_active_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.platform_workshops (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid,
  name text not null,
  city text not null,
  services text[] not null default '{}',
  rating numeric(3,2) not null default 0,
  status text not null default 'Pending Verification' check (status in ('Active', 'Pending Verification', 'Verified', 'Suspended', 'Banned')),
  verified boolean not null default false,
  jobs_this_month integer not null default 0,
  revenue_this_month numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.platform_payments (
  id text primary key,
  order_id text not null,
  payer_name text not null,
  payee_name text not null,
  amount numeric(12,2) not null check (amount >= 0),
  commission_amount numeric(12,2) not null default 0,
  status text not null check (status in ('Pending', 'Paid', 'Refunded', 'Escrow')),
  method text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_settings (
  id text primary key default 'platform',
  workshop_commission_percent numeric(5,2) not null default 20,
  supplier_commission_percent numeric(5,2) not null default 25,
  escrow_enabled boolean not null default true,
  ai_diagnosis_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid,
  vehicle_label text,
  diagnosis text,
  confidence numeric(5,2),
  estimated_cost_range text,
  created_at timestamptz not null default now()
);

alter table public.supplier_profiles add column if not exists status text not null default 'Pending Verification' check (status in ('Active', 'Pending Verification', 'Verified', 'Suspended', 'Banned'));
alter table public.supplier_profiles add column if not exists verified boolean not null default false;

create index if not exists app_users_type_idx on public.app_users(account_type);
create index if not exists platform_workshops_status_idx on public.platform_workshops(status);
create index if not exists platform_payments_status_idx on public.platform_payments(status);
create index if not exists ai_usage_created_idx on public.ai_usage_events(created_at);

alter table public.app_users enable row level security;
alter table public.platform_workshops enable row level security;
alter table public.platform_payments enable row level security;
alter table public.platform_settings enable row level security;
alter table public.ai_usage_events enable row level security;

drop policy if exists "Admins manage app users" on public.app_users;
create policy "Admins manage app users"
on public.app_users
for all
to authenticated
using (public.manhub_app_role() = 'admin')
with check (public.manhub_app_role() = 'admin');

drop policy if exists "Admins manage platform workshops" on public.platform_workshops;
create policy "Admins manage platform workshops"
on public.platform_workshops
for all
to authenticated
using (public.manhub_app_role() = 'admin')
with check (public.manhub_app_role() = 'admin');

drop policy if exists "Admins manage platform payments" on public.platform_payments;
create policy "Admins manage platform payments"
on public.platform_payments
for all
to authenticated
using (public.manhub_app_role() = 'admin')
with check (public.manhub_app_role() = 'admin');

drop policy if exists "Admins manage platform settings" on public.platform_settings;
create policy "Admins manage platform settings"
on public.platform_settings
for all
to authenticated
using (public.manhub_app_role() = 'admin')
with check (public.manhub_app_role() = 'admin');

drop policy if exists "Admins manage AI usage" on public.ai_usage_events;
create policy "Admins manage AI usage"
on public.ai_usage_events
for all
to authenticated
using (public.manhub_app_role() = 'admin')
with check (public.manhub_app_role() = 'admin');

drop policy if exists "Admins manage supplier profiles" on public.supplier_profiles;
create policy "Admins manage supplier profiles"
on public.supplier_profiles
for all
to authenticated
using (public.manhub_app_role() = 'admin')
with check (public.manhub_app_role() = 'admin');

drop policy if exists "Admins manage supplier products" on public.supplier_products;
create policy "Admins manage supplier products"
on public.supplier_products
for all
to authenticated
using (public.manhub_app_role() = 'admin')
with check (public.manhub_app_role() = 'admin');

drop policy if exists "Admins manage supplier orders" on public.supplier_orders;
create policy "Admins manage supplier orders"
on public.supplier_orders
for all
to authenticated
using (public.manhub_app_role() = 'admin')
with check (public.manhub_app_role() = 'admin');

drop policy if exists "Admins manage supplier withdrawals" on public.supplier_withdrawals;
create policy "Admins manage supplier withdrawals"
on public.supplier_withdrawals
for all
to authenticated
using (public.manhub_app_role() = 'admin')
with check (public.manhub_app_role() = 'admin');
