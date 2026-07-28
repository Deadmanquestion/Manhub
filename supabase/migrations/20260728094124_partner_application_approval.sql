create extension if not exists pgcrypto;

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('customer', 'supplier', 'workshop', 'technician', 'admin'));

create table public.supplier_applications (
  id uuid primary key default gen_random_uuid(),
  company_name text not null check (length(trim(company_name)) >= 2),
  ssm_registration_number text not null check (length(trim(ssm_registration_number)) >= 2),
  contact_person text not null check (length(trim(contact_person)) >= 2),
  email text not null check (email = lower(trim(email)) and position('@' in email) > 1),
  phone text not null check (length(trim(phone)) >= 7),
  business_address text not null check (length(trim(business_address)) >= 5),
  business_category text not null check (length(trim(business_category)) >= 2),
  bank_account text,
  company_logo_path text,
  supporting_document_paths text[] not null default '{}',
  status text not null default 'Pending'
    check (status in ('Pending', 'Approved', 'Rejected')),
  admin_notes text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  account_user_id uuid unique references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workshop_applications (
  id uuid primary key default gen_random_uuid(),
  workshop_name text not null check (length(trim(workshop_name)) >= 2),
  ssm_number text not null check (length(trim(ssm_number)) >= 2),
  address text not null check (length(trim(address)) >= 5),
  phone text not null check (length(trim(phone)) >= 7),
  email text not null check (email = lower(trim(email)) and position('@' in email) > 1),
  operating_hours text not null check (length(trim(operating_hours)) >= 2),
  brands_supported text[] not null default '{}',
  number_of_technicians integer not null default 0 check (number_of_technicians >= 0),
  number_of_lifts integer not null default 0 check (number_of_lifts >= 0),
  workshop_photo_paths text[] not null default '{}',
  status text not null default 'Pending'
    check (status in ('Pending', 'Approved', 'Rejected')),
  admin_notes text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  account_user_id uuid unique references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.technician_applications (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (length(trim(full_name)) >= 2),
  email text not null check (email = lower(trim(email)) and position('@' in email) > 1),
  phone text not null check (length(trim(phone)) >= 7),
  resume_path text not null,
  work_experience text not null check (length(trim(work_experience)) >= 10),
  certificate_paths text[] not null default '{}',
  current_employer text,
  status text not null default 'Pending'
    check (status in ('Pending', 'Approved', 'Rejected')),
  admin_notes text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  account_user_id uuid unique references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index supplier_applications_pending_email_idx
  on public.supplier_applications (lower(email))
  where status = 'Pending';
create unique index workshop_applications_pending_email_idx
  on public.workshop_applications (lower(email))
  where status = 'Pending';
create unique index technician_applications_pending_email_idx
  on public.technician_applications (lower(email))
  where status = 'Pending';

create index supplier_applications_status_created_idx
  on public.supplier_applications (status, created_at desc);
create index workshop_applications_status_created_idx
  on public.workshop_applications (status, created_at desc);
create index technician_applications_status_created_idx
  on public.technician_applications (status, created_at desc);

create table if not exists public.platform_workshops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  application_id uuid unique references public.workshop_applications(id),
  name text not null,
  ssm_number text not null,
  address text not null,
  city text,
  phone text,
  email text,
  operating_hours text,
  brands_supported text[] not null default '{}',
  number_of_technicians integer not null default 0 check (number_of_technicians >= 0),
  number_of_lifts integer not null default 0 check (number_of_lifts >= 0),
  photo_paths text[] not null default '{}',
  rating numeric(2,1) not null default 0 check (rating between 0 and 5),
  status text not null default 'Approved'
    check (status in ('Pending Approval', 'Approved', 'Verified', 'Suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.technicians
  alter column workshop_owner_id drop not null;

alter table public.technicians
  alter column workshop_owner_id drop default;

alter table public.technicians
  add column if not exists user_id uuid unique references auth.users(id) on delete cascade,
  add column if not exists application_id uuid unique references public.technician_applications(id);

alter table public.repair_jobs
  add column if not exists technician_user_id uuid references auth.users(id) on delete set null;

create index if not exists technicians_user_id_idx
  on public.technicians(user_id);
create index if not exists repair_jobs_technician_user_id_idx
  on public.repair_jobs(technician_user_id, status, scheduled_at);

create or replace function private.manfix_touch_partner_application()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.manfix_touch_partner_application() from public, anon, authenticated;

create trigger supplier_applications_touch_updated_at
before update on public.supplier_applications
for each row execute function private.manfix_touch_partner_application();

create trigger workshop_applications_touch_updated_at
before update on public.workshop_applications
for each row execute function private.manfix_touch_partner_application();

create trigger technician_applications_touch_updated_at
before update on public.technician_applications
for each row execute function private.manfix_touch_partner_application();

create trigger platform_workshops_touch_updated_at
before update on public.platform_workshops
for each row execute function private.manfix_touch_partner_application();

alter table public.supplier_applications enable row level security;
alter table public.workshop_applications enable row level security;
alter table public.technician_applications enable row level security;
alter table public.platform_workshops enable row level security;

create policy "Anyone submits pending supplier applications"
on public.supplier_applications for insert to anon, authenticated
with check (
  status = 'Pending'
  and admin_notes is null
  and reviewed_by is null
  and reviewed_at is null
  and account_user_id is null
);

create policy "Anyone submits pending workshop applications"
on public.workshop_applications for insert to anon, authenticated
with check (
  status = 'Pending'
  and admin_notes is null
  and reviewed_by is null
  and reviewed_at is null
  and account_user_id is null
);

create policy "Anyone submits pending technician applications"
on public.technician_applications for insert to anon, authenticated
with check (
  status = 'Pending'
  and admin_notes is null
  and reviewed_by is null
  and reviewed_at is null
  and account_user_id is null
);

create policy "Admins review supplier applications"
on public.supplier_applications for all to authenticated
using (private.manfix_has_approved_role('admin'))
with check (private.manfix_has_approved_role('admin'));

create policy "Admins review workshop applications"
on public.workshop_applications for all to authenticated
using (private.manfix_has_approved_role('admin'))
with check (private.manfix_has_approved_role('admin'));

create policy "Admins review technician applications"
on public.technician_applications for all to authenticated
using (private.manfix_has_approved_role('admin'))
with check (private.manfix_has_approved_role('admin'));

create policy "Workshops view own profile"
on public.platform_workshops for select to authenticated
using (
  owner_id = (select auth.uid())
  and private.manfix_has_approved_role('workshop')
);

create policy "Admins manage workshop profiles"
on public.platform_workshops for all to authenticated
using (private.manfix_has_approved_role('admin'))
with check (private.manfix_has_approved_role('admin'));

drop policy if exists "Technicians view own roster record" on public.technicians;
create policy "Technicians view own roster record"
on public.technicians for select to authenticated
using (
  user_id = (select auth.uid())
  and private.manfix_has_approved_role('technician')
);

drop policy if exists "Technicians view assigned service bookings" on public.service_bookings;
create policy "Technicians view assigned service bookings"
on public.service_bookings for select to authenticated
using (
  private.manfix_has_approved_role('technician')
  and exists (
    select 1
    from public.technicians
    where technicians.user_id = (select auth.uid())
      and technicians.workshop_owner_id = service_bookings.workshop_owner_id
  )
);

drop policy if exists "Technicians view assigned lift bookings" on public.lift_bookings;
create policy "Technicians view assigned lift bookings"
on public.lift_bookings for select to authenticated
using (
  private.manfix_has_approved_role('technician')
  and exists (
    select 1
    from public.technicians
    where technicians.user_id = (select auth.uid())
      and technicians.workshop_owner_id = lift_bookings.workshop_owner_id
  )
);

drop policy if exists "Technicians view assigned booking photos" on public.booking_photos;
create policy "Technicians view assigned booking photos"
on public.booking_photos for select to authenticated
using (
  private.manfix_has_approved_role('technician')
  and exists (
    select 1
    from public.service_bookings
    join public.technicians
      on technicians.user_id = (select auth.uid())
     and technicians.workshop_owner_id = service_bookings.workshop_owner_id
    where service_bookings.id = booking_photos.service_booking_id
  )
);

drop policy if exists "Technicians view assigned repair jobs" on public.repair_jobs;
create policy "Technicians view assigned repair jobs"
on public.repair_jobs for select to authenticated
using (
  private.manfix_has_approved_role('technician')
  and technician_user_id = (select auth.uid())
);

create or replace function public.manfix_workshop_update_booking_status(
  booking_kind text,
  booking_id uuid,
  next_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_role text;
  owner_id uuid;
  caller_name text;
begin
  caller_role := private.manhub_app_role();

  if caller_role = 'workshop' and private.manfix_has_approved_role('workshop') then
    owner_id := (select auth.uid());
  elsif caller_role = 'technician' and private.manfix_has_approved_role('technician') then
    select workshop_owner_id, name
    into owner_id, caller_name
    from public.technicians
    where user_id = (select auth.uid());

    if owner_id is null then
      raise exception 'Your technician account is not assigned to a workshop.';
    end if;
  else
    raise exception 'Approved workshop or technician access is required.';
  end if;

  if next_status not in ('approved', 'cancelled', 'completed') then
    raise exception 'Unsupported booking status.';
  end if;

  if booking_kind = 'service' then
    update public.service_bookings
    set status = next_status, updated_at = now()
    where id = booking_id
      and workshop_owner_id = owner_id
      and status not in ('cancelled', 'rejected', 'completed');
  elsif booking_kind = 'lift' then
    update public.lift_bookings
    set status = next_status, updated_at = now()
    where id = booking_id
      and workshop_owner_id = owner_id
      and status not in ('cancelled', 'rejected', 'completed');
  else
    raise exception 'Unsupported booking type.';
  end if;

  if not found then
    raise exception 'Booking not found or already closed.';
  end if;

  if caller_role = 'technician' and next_status = 'approved' then
    update public.repair_jobs
    set technician_user_id = (select auth.uid()),
        technician_name = coalesce(caller_name, 'Technician'),
        updated_at = now()
    where ($1 = 'service' and service_booking_id = $2)
       or ($1 = 'lift' and lift_booking_id = $2);
  end if;
end;
$$;

create or replace function public.manfix_workshop_update_repair_status(
  repair_job_id uuid,
  next_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_role text;
begin
  caller_role := private.manhub_app_role();

  if next_status not in ('queued', 'in_progress', 'ready', 'completed') then
    raise exception 'Unsupported repair status.';
  end if;

  if caller_role = 'workshop' and private.manfix_has_approved_role('workshop') then
    update public.repair_jobs
    set status = next_status, updated_at = now()
    where id = repair_job_id
      and workshop_owner_id = (select auth.uid());
  elsif caller_role = 'technician' and private.manfix_has_approved_role('technician') then
    update public.repair_jobs
    set status = next_status, updated_at = now()
    where id = repair_job_id
      and technician_user_id = (select auth.uid());
  else
    raise exception 'Approved workshop or technician access is required.';
  end if;

  if not found then
    raise exception 'Repair job not found.';
  end if;
end;
$$;

revoke all on function public.manfix_workshop_update_booking_status(text, uuid, text) from public, anon;
revoke all on function public.manfix_workshop_update_repair_status(uuid, text) from public, anon;
grant execute on function public.manfix_workshop_update_booking_status(text, uuid, text) to authenticated;
grant execute on function public.manfix_workshop_update_repair_status(uuid, text) to authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'partner-application-documents',
  'partner-application-documents',
  false,
  10485760,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Applicants upload partner documents"
on storage.objects for insert to anon, authenticated
with check (
  bucket_id = 'partner-application-documents'
  and (storage.foldername(name))[1] in ('supplier', 'workshop', 'technician')
  and (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
);

create policy "Admins read partner documents"
on storage.objects for select to authenticated
using (
  bucket_id = 'partner-application-documents'
  and private.manfix_has_approved_role('admin')
);

create policy "Admins remove partner documents"
on storage.objects for delete to authenticated
using (
  bucket_id = 'partner-application-documents'
  and private.manfix_has_approved_role('admin')
);

revoke all on public.supplier_applications from public;
revoke all on public.workshop_applications from public;
revoke all on public.technician_applications from public;
revoke all on public.platform_workshops from public;

grant insert on public.supplier_applications to anon, authenticated;
grant insert on public.workshop_applications to anon, authenticated;
grant insert on public.technician_applications to anon, authenticated;
grant select, update, delete on public.supplier_applications to authenticated;
grant select, update, delete on public.workshop_applications to authenticated;
grant select, update, delete on public.technician_applications to authenticated;
grant select, insert, update, delete on public.platform_workshops to authenticated;
grant all on public.supplier_applications to service_role;
grant all on public.workshop_applications to service_role;
grant all on public.technician_applications to service_role;
grant all on public.platform_workshops to service_role;
