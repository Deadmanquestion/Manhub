create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'customer' check (role in ('customer', 'supplier', 'workshop', 'admin')),
  status text not null default 'Active' check (status in ('Active', 'Approved', 'Verified', 'Pending Approval', 'Suspended', 'Banned')),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles(role);
create index if not exists profiles_status_idx on public.profiles(status);

alter table public.profiles enable row level security;

create or replace function public.manhub_app_role()
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(
    (select role from public.profiles where id = auth.uid()),
    auth.jwt() ->> 'role',
    auth.jwt() ->> 'app_role',
    auth.jwt() -> 'user_metadata' ->> 'role',
    auth.jwt() -> 'user_metadata' ->> 'app_role',
    ''
  )
$$;

create or replace function public.manhub_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.manhub_touch_updated_at();

create or replace function public.manhub_create_customer_profile()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.profiles (id, email, full_name, role, status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'customer',
    'Active'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists manhub_create_customer_profile on auth.users;
create trigger manhub_create_customer_profile
after insert on auth.users
for each row execute function public.manhub_create_customer_profile();

drop policy if exists "Users view own profile" on public.profiles;
create policy "Users view own profile"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

drop policy if exists "Customers create own customer profile" on public.profiles;
create policy "Customers create own customer profile"
on public.profiles
for insert
to authenticated
with check (
  (select auth.uid()) = id
  and role = 'customer'
  and status = 'Active'
);

drop policy if exists "Admins manage all profiles" on public.profiles;
create policy "Admins manage all profiles"
on public.profiles
for all
to authenticated
using (public.manhub_app_role() = 'admin')
with check (public.manhub_app_role() = 'admin');

insert into public.profiles (id, email, full_name, role, status)
select
  auth_user_id,
  email,
  full_name,
  case lower(account_type)
    when 'supplier' then 'supplier'
    when 'workshop' then 'workshop'
    when 'technician' then 'workshop'
    when 'admin' then 'admin'
    else 'customer'
  end,
  case
    when status in ('Active', 'Verified') then status
    when status = 'Pending Verification' then 'Pending Approval'
    else status
  end
from public.app_users
where auth_user_id is not null
on conflict (id) do update
set
  email = excluded.email,
  full_name = excluded.full_name,
  role = excluded.role,
  status = excluded.status;
