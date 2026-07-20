create extension if not exists pgcrypto;

create or replace function public.manhub_app_role()
returns text
language sql
stable
as $$
  select coalesce(
    auth.jwt() ->> 'role',
    auth.jwt() ->> 'app_role',
    auth.jwt() -> 'user_metadata' ->> 'role',
    auth.jwt() -> 'user_metadata' ->> 'app_role',
    ''
  )
$$;

create or replace function public.manhub_is_admin()
returns boolean
language sql
stable
as $$
  select public.manhub_app_role() = 'admin'
$$;

create table if not exists public.portal_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  role text not null check (role in ('customer', 'supplier', 'workshop', 'admin')),
  supplier_id uuid,
  workshop_id uuid,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

create table if not exists public.customer_vehicles (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null default auth.uid(),
  label text not null,
  plate_number text,
  year integer,
  mileage integer not null default 0,
  vin text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  title text not null,
  body text not null,
  status text not null default 'Unread' check (status in ('Unread', 'Read', 'Archived')),
  created_at timestamptz not null default now()
);

create table if not exists public.service_bookings (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null default auth.uid(),
  workshop_owner_id uuid,
  vehicle_label text not null,
  symptom text not null,
  scheduled_at timestamptz,
  status text not null default 'Pending' check (status in ('Pending', 'Accepted', 'Cancelled', 'Completed')),
  created_at timestamptz not null default now()
);

create table if not exists public.repair_jobs (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.service_bookings(id) on delete set null,
  workshop_owner_id uuid not null default auth.uid(),
  customer_id uuid,
  customer_name text,
  vehicle_label text not null,
  diagnosis text not null,
  technician_name text,
  status text not null default 'Queued' check (status in ('Queued', 'In Progress', 'Ready', 'Completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.technicians (
  id uuid primary key default gen_random_uuid(),
  workshop_owner_id uuid not null default auth.uid(),
  name text not null,
  certification text,
  status text not null default 'Available',
  jobs_today integer not null default 0,
  rating numeric(3,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.file_assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  portal_role text not null check (portal_role in ('customer', 'supplier', 'workshop', 'admin')),
  bucket text not null,
  path text not null,
  purpose text,
  created_at timestamptz not null default now()
);

create table if not exists public.api_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid default auth.uid(),
  portal_role text,
  endpoint text not null,
  action text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.platform_config_items (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.platform_payments add column if not exists invoice_number text;
alter table public.platform_payments add column if not exists workshop_owner_id uuid;

create index if not exists customer_vehicles_customer_idx on public.customer_vehicles(customer_id);
create index if not exists notifications_user_idx on public.notifications(user_id);
create index if not exists service_bookings_customer_idx on public.service_bookings(customer_id);
create index if not exists service_bookings_workshop_idx on public.service_bookings(workshop_owner_id);
create index if not exists repair_jobs_workshop_idx on public.repair_jobs(workshop_owner_id);
create index if not exists technicians_workshop_idx on public.technicians(workshop_owner_id);

alter table public.portal_memberships enable row level security;
alter table public.customer_vehicles enable row level security;
alter table public.notifications enable row level security;
alter table public.service_bookings enable row level security;
alter table public.repair_jobs enable row level security;
alter table public.technicians enable row level security;
alter table public.file_assets enable row level security;
alter table public.api_audit_events enable row level security;
alter table public.platform_config_items enable row level security;

drop policy if exists "Users view own portal memberships" on public.portal_memberships;
create policy "Users view own portal memberships"
on public.portal_memberships for select to authenticated
using ((select auth.uid()) = user_id or public.manhub_is_admin());

drop policy if exists "Admins manage portal memberships" on public.portal_memberships;
create policy "Admins manage portal memberships"
on public.portal_memberships for all to authenticated
using (public.manhub_is_admin())
with check (public.manhub_is_admin());

drop policy if exists "Customers manage own vehicles" on public.customer_vehicles;
create policy "Customers manage own vehicles"
on public.customer_vehicles for all to authenticated
using ((select auth.uid()) = customer_id or public.manhub_is_admin())
with check ((select auth.uid()) = customer_id or public.manhub_is_admin());

drop policy if exists "Users manage own notifications" on public.notifications;
create policy "Users manage own notifications"
on public.notifications for all to authenticated
using ((select auth.uid()) = user_id or public.manhub_is_admin())
with check ((select auth.uid()) = user_id or public.manhub_is_admin());

drop policy if exists "Customers manage own bookings" on public.service_bookings;
create policy "Customers manage own bookings"
on public.service_bookings for all to authenticated
using ((select auth.uid()) = customer_id or public.manhub_is_admin())
with check ((select auth.uid()) = customer_id or public.manhub_is_admin());

drop policy if exists "Workshops manage assigned bookings" on public.service_bookings;
create policy "Workshops manage assigned bookings"
on public.service_bookings for all to authenticated
using ((select auth.uid()) = workshop_owner_id or public.manhub_is_admin())
with check ((select auth.uid()) = workshop_owner_id or public.manhub_is_admin());

drop policy if exists "Workshops manage repair jobs" on public.repair_jobs;
create policy "Workshops manage repair jobs"
on public.repair_jobs for all to authenticated
using ((select auth.uid()) = workshop_owner_id or public.manhub_is_admin())
with check ((select auth.uid()) = workshop_owner_id or public.manhub_is_admin());

drop policy if exists "Customers view own repair jobs" on public.repair_jobs;
create policy "Customers view own repair jobs"
on public.repair_jobs for select to authenticated
using ((select auth.uid()) = customer_id or public.manhub_is_admin());

drop policy if exists "Workshops manage technicians" on public.technicians;
create policy "Workshops manage technicians"
on public.technicians for all to authenticated
using ((select auth.uid()) = workshop_owner_id or public.manhub_is_admin())
with check ((select auth.uid()) = workshop_owner_id or public.manhub_is_admin());

drop policy if exists "Owners manage file assets" on public.file_assets;
create policy "Owners manage file assets"
on public.file_assets for all to authenticated
using ((select auth.uid()) = owner_id or public.manhub_is_admin())
with check ((select auth.uid()) = owner_id or public.manhub_is_admin());

drop policy if exists "Authenticated users insert API audit events" on public.api_audit_events;
create policy "Authenticated users insert API audit events"
on public.api_audit_events for insert to authenticated
with check ((select auth.uid()) = actor_id or public.manhub_is_admin());

drop policy if exists "Admins read API audit events" on public.api_audit_events;
create policy "Admins read API audit events"
on public.api_audit_events for select to authenticated
using (public.manhub_is_admin());

drop policy if exists "Admins manage platform config items" on public.platform_config_items;
create policy "Admins manage platform config items"
on public.platform_config_items for all to authenticated
using (public.manhub_is_admin())
with check (public.manhub_is_admin());

drop policy if exists "Customers view active supplier products" on public.supplier_products;
create policy "Customers view active supplier products"
on public.supplier_products for select to authenticated
using (active = true and public.manhub_app_role() = 'customer');

drop policy if exists "Customers view active workshops" on public.platform_workshops;
create policy "Customers view active workshops"
on public.platform_workshops for select to authenticated
using (status in ('Active', 'Verified') and public.manhub_app_role() = 'customer');

drop policy if exists "Suppliers update own orders" on public.supplier_orders;
create policy "Suppliers update own orders"
on public.supplier_orders for update to authenticated
using ((select auth.uid()) = supplier_id)
with check ((select auth.uid()) = supplier_id);

drop policy if exists "Workshops view own invoices" on public.platform_payments;
create policy "Workshops view own invoices"
on public.platform_payments for select to authenticated
using ((select auth.uid()) = workshop_owner_id or public.manhub_is_admin());

drop policy if exists "Workshops update own invoices" on public.platform_payments;
create policy "Workshops update own invoices"
on public.platform_payments for update to authenticated
using ((select auth.uid()) = workshop_owner_id or public.manhub_is_admin())
with check ((select auth.uid()) = workshop_owner_id or public.manhub_is_admin());

drop policy if exists "Customers insert own AI usage" on public.ai_usage_events;
create policy "Customers insert own AI usage"
on public.ai_usage_events for insert to authenticated
with check ((select auth.uid()) = customer_id or public.manhub_is_admin());

drop policy if exists "Customers read own AI usage" on public.ai_usage_events;
create policy "Customers read own AI usage"
on public.ai_usage_events for select to authenticated
using ((select auth.uid()) = customer_id or public.manhub_is_admin());
