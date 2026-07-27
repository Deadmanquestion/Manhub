create extension if not exists pgcrypto;

create table if not exists public.cars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  make text not null,
  model text not null,
  year integer check (year is null or year between 1886 and 2100),
  license_plate text,
  color text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.service_catalog (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  estimated_price numeric(12,2) not null default 0 check (estimated_price >= 0),
  estimated_duration_minutes integer not null default 60 check (estimated_duration_minutes > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lifts (
  id uuid primary key default gen_random_uuid(),
  workshop_owner_id uuid not null references auth.users(id),
  name text not null,
  location_label text,
  hourly_rate numeric(12,2) not null default 0 check (hourly_rate >= 0),
  max_vehicle_weight_kg integer not null default 2500 check (max_vehicle_weight_kg > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workshop_owner_id, name)
);

create table if not exists public.lift_unavailable_slots (
  id uuid primary key default gen_random_uuid(),
  lift_id uuid not null references public.lifts(id) on delete cascade,
  blocked_start_at timestamptz not null,
  blocked_end_at timestamptz not null,
  reason text,
  created_at timestamptz not null default now(),
  check (blocked_end_at > blocked_start_at)
);

create table if not exists public.service_bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  car_id uuid not null references public.cars(id),
  workshop_owner_id uuid references auth.users(id),
  service_catalog_id uuid references public.service_catalog(id),
  service_type text not null,
  estimated_price numeric(12,2) not null default 0 check (estimated_price >= 0),
  service_date timestamptz not null,
  scheduled_at timestamptz not null,
  customer_notes text,
  symptom text,
  vehicle_label text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled', 'completed')),
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'paid', 'refunded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lift_bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  car_id uuid references public.cars(id),
  lift_id uuid not null references public.lifts(id),
  workshop_owner_id uuid references auth.users(id),
  requested_start_at timestamptz not null,
  requested_end_at timestamptz not null,
  scheduled_at timestamptz not null,
  customer_notes text,
  symptom text,
  vehicle_label text not null,
  estimated_price numeric(12,2) not null default 0 check (estimated_price >= 0),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled', 'completed')),
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'paid', 'refunded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requested_end_at > requested_start_at)
);

create table if not exists public.booking_photos (
  id uuid primary key default gen_random_uuid(),
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  service_booking_id uuid not null references public.service_bookings(id) on delete cascade,
  storage_path text not null,
  photo_url text not null,
  caption text,
  created_at timestamptz not null default now()
);

create table if not exists public.technicians (
  id uuid primary key default gen_random_uuid(),
  workshop_owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  certification text,
  status text not null default 'Available'
    check (status in ('Available', 'Busy', 'Off Shift')),
  jobs_today integer not null default 0 check (jobs_today >= 0),
  rating numeric(2,1) check (rating is null or rating between 0 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.repair_jobs (
  id uuid primary key default gen_random_uuid(),
  booking_kind text not null check (booking_kind in ('service', 'lift')),
  service_booking_id uuid unique references public.service_bookings(id) on delete cascade,
  lift_booking_id uuid unique references public.lift_bookings(id) on delete cascade,
  workshop_owner_id uuid not null references auth.users(id),
  customer_id uuid not null references auth.users(id),
  customer_name text not null,
  vehicle_label text not null,
  diagnosis text not null,
  technician_name text,
  scheduled_at timestamptz not null,
  status text not null default 'queued'
    check (status in ('queued', 'in_progress', 'ready', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (booking_kind = 'service' and service_booking_id is not null and lift_booking_id is null)
    or
    (booking_kind = 'lift' and lift_booking_id is not null and service_booking_id is null)
  )
);

create index if not exists cars_user_id_idx on public.cars(user_id);
create index if not exists lifts_workshop_owner_id_idx on public.lifts(workshop_owner_id);
create index if not exists lift_unavailable_slots_lift_time_idx
  on public.lift_unavailable_slots(lift_id, blocked_start_at, blocked_end_at);
create index if not exists service_bookings_user_id_idx on public.service_bookings(user_id);
create index if not exists service_bookings_workshop_status_idx
  on public.service_bookings(workshop_owner_id, status, scheduled_at);
create index if not exists lift_bookings_user_id_idx on public.lift_bookings(user_id);
create index if not exists lift_bookings_workshop_status_idx
  on public.lift_bookings(workshop_owner_id, status, scheduled_at);
create index if not exists booking_photos_booking_idx on public.booking_photos(service_booking_id);
create index if not exists technicians_workshop_owner_id_idx on public.technicians(workshop_owner_id);
create index if not exists repair_jobs_workshop_status_idx
  on public.repair_jobs(workshop_owner_id, status, scheduled_at);
create index if not exists repair_jobs_customer_id_idx on public.repair_jobs(customer_id);

create or replace function private.manfix_default_workshop_owner()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id
  from public.profiles
  where role = 'workshop'
    and status in ('Active', 'Approved', 'Verified')
  order by created_at
  limit 1
$$;

revoke all on function private.manfix_default_workshop_owner() from public, anon, authenticated;

create or replace function private.manfix_prepare_service_booking()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  car_record record;
begin
  select make, model, license_plate
  into car_record
  from public.cars
  where id = new.car_id
    and user_id = new.user_id;

  if not found then
    raise exception 'The selected vehicle does not belong to this customer.';
  end if;

  new.workshop_owner_id := coalesce(
    new.workshop_owner_id,
    private.manfix_default_workshop_owner()
  );

  if new.workshop_owner_id is null then
    raise exception 'No approved workshop is available for this booking.';
  end if;

  new.vehicle_label := trim(concat_ws(' ', car_record.make, car_record.model))
    || coalesce(' (' || nullif(car_record.license_plate, '') || ')', '');
  new.symptom := coalesce(nullif(new.customer_notes, ''), new.service_type);
  new.scheduled_at := new.service_date;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.manfix_prepare_lift_booking()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  car_record record;
  lift_record record;
begin
  select workshop_owner_id, hourly_rate
  into lift_record
  from public.lifts
  where id = new.lift_id
    and is_active;

  if not found then
    raise exception 'The selected lift is not available.';
  end if;

  if new.car_id is not null then
    select make, model, license_plate
    into car_record
    from public.cars
    where id = new.car_id
      and user_id = new.user_id;

    if not found then
      raise exception 'The selected vehicle does not belong to this customer.';
    end if;

    new.vehicle_label := trim(concat_ws(' ', car_record.make, car_record.model))
      || coalesce(' (' || nullif(car_record.license_plate, '') || ')', '');
  else
    new.vehicle_label := 'Vehicle not selected';
  end if;

  new.workshop_owner_id := lift_record.workshop_owner_id;
  new.scheduled_at := new.requested_start_at;
  new.symptom := coalesce(nullif(new.customer_notes, ''), 'Lift bay rental');
  new.estimated_price := round(
    lift_record.hourly_rate
      * (extract(epoch from (new.requested_end_at - new.requested_start_at)) / 3600),
    2
  );
  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.manfix_sync_repair_job()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  booking_id uuid;
  customer_id uuid;
  customer_name text;
  workshop_id uuid;
  vehicle text;
  diagnosis_text text;
  booking_time timestamptz;
begin
  if tg_op = 'DELETE' then
    if tg_table_name = 'service_bookings' then
      delete from public.repair_jobs where service_booking_id = old.id;
    else
      delete from public.repair_jobs where lift_booking_id = old.id;
    end if;
    return old;
  end if;

  if new.status in ('cancelled', 'rejected') then
    if tg_table_name = 'service_bookings' then
      delete from public.repair_jobs where service_booking_id = new.id;
    else
      delete from public.repair_jobs where lift_booking_id = new.id;
    end if;
    return new;
  end if;

  if new.status <> 'approved' then
    return new;
  end if;

  booking_id := new.id;
  customer_id := new.user_id;
  workshop_id := new.workshop_owner_id;
  vehicle := new.vehicle_label;
  diagnosis_text := new.symptom;
  booking_time := new.scheduled_at;

  select coalesce(nullif(full_name, ''), email, 'Customer')
  into customer_name
  from public.profiles
  where id = customer_id;

  if tg_table_name = 'service_bookings' then
    insert into public.repair_jobs (
      booking_kind,
      service_booking_id,
      workshop_owner_id,
      customer_id,
      customer_name,
      vehicle_label,
      diagnosis,
      scheduled_at
    )
    values (
      'service',
      booking_id,
      workshop_id,
      customer_id,
      coalesce(customer_name, 'Customer'),
      vehicle,
      diagnosis_text,
      booking_time
    )
    on conflict (service_booking_id) do update
    set workshop_owner_id = excluded.workshop_owner_id,
        customer_name = excluded.customer_name,
        vehicle_label = excluded.vehicle_label,
        diagnosis = excluded.diagnosis,
        scheduled_at = excluded.scheduled_at,
        updated_at = now();
  else
    insert into public.repair_jobs (
      booking_kind,
      lift_booking_id,
      workshop_owner_id,
      customer_id,
      customer_name,
      vehicle_label,
      diagnosis,
      scheduled_at
    )
    values (
      'lift',
      booking_id,
      workshop_id,
      customer_id,
      coalesce(customer_name, 'Customer'),
      vehicle,
      diagnosis_text,
      booking_time
    )
    on conflict (lift_booking_id) do update
    set workshop_owner_id = excluded.workshop_owner_id,
        customer_name = excluded.customer_name,
        vehicle_label = excluded.vehicle_label,
        diagnosis = excluded.diagnosis,
        scheduled_at = excluded.scheduled_at,
        updated_at = now();
  end if;

  return new;
end;
$$;

create or replace function private.manfix_complete_booking_from_job()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();

  if new.status = 'completed' and old.status is distinct from new.status then
    if new.booking_kind = 'service' then
      update public.service_bookings
      set status = 'completed', updated_at = now()
      where id = new.service_booking_id;
    else
      update public.lift_bookings
      set status = 'completed', updated_at = now()
      where id = new.lift_booking_id;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.manfix_prepare_service_booking() from public, anon, authenticated;
revoke all on function private.manfix_prepare_lift_booking() from public, anon, authenticated;
revoke all on function private.manfix_sync_repair_job() from public, anon, authenticated;
revoke all on function private.manfix_complete_booking_from_job() from public, anon, authenticated;

drop trigger if exists manfix_prepare_service_booking on public.service_bookings;
create trigger manfix_prepare_service_booking
before insert or update of car_id, user_id, customer_notes, service_type, service_date
on public.service_bookings
for each row execute function private.manfix_prepare_service_booking();

drop trigger if exists manfix_prepare_lift_booking on public.lift_bookings;
create trigger manfix_prepare_lift_booking
before insert or update of car_id, user_id, lift_id, customer_notes, requested_start_at, requested_end_at
on public.lift_bookings
for each row execute function private.manfix_prepare_lift_booking();

drop trigger if exists manfix_sync_service_repair_job on public.service_bookings;
create trigger manfix_sync_service_repair_job
after insert or update of status or delete
on public.service_bookings
for each row execute function private.manfix_sync_repair_job();

drop trigger if exists manfix_sync_lift_repair_job on public.lift_bookings;
create trigger manfix_sync_lift_repair_job
after insert or update of status or delete
on public.lift_bookings
for each row execute function private.manfix_sync_repair_job();

drop trigger if exists manfix_complete_booking_from_job on public.repair_jobs;
create trigger manfix_complete_booking_from_job
before update of status on public.repair_jobs
for each row execute function private.manfix_complete_booking_from_job();

create or replace function public.manfix_cancel_booking(
  booking_kind text,
  booking_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required.';
  end if;

  if booking_kind = 'service' then
    update public.service_bookings
    set status = 'cancelled', updated_at = now()
    where id = booking_id
      and user_id = (select auth.uid())
      and status in ('pending', 'approved');
  elsif booking_kind = 'lift' then
    update public.lift_bookings
    set status = 'cancelled', updated_at = now()
    where id = booking_id
      and user_id = (select auth.uid())
      and status in ('pending', 'approved');
  else
    raise exception 'Unsupported booking type.';
  end if;

  if not found then
    raise exception 'This booking cannot be cancelled.';
  end if;
end;
$$;

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
begin
  if not private.manfix_has_approved_role('workshop') then
    raise exception 'Approved workshop access is required.';
  end if;

  if next_status not in ('approved', 'cancelled', 'completed') then
    raise exception 'Unsupported booking status.';
  end if;

  if booking_kind = 'service' then
    update public.service_bookings
    set status = next_status, updated_at = now()
    where id = booking_id
      and workshop_owner_id = (select auth.uid())
      and status not in ('cancelled', 'rejected', 'completed');
  elsif booking_kind = 'lift' then
    update public.lift_bookings
    set status = next_status, updated_at = now()
    where id = booking_id
      and workshop_owner_id = (select auth.uid())
      and status not in ('cancelled', 'rejected', 'completed');
  else
    raise exception 'Unsupported booking type.';
  end if;

  if not found then
    raise exception 'Booking not found or already closed.';
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
begin
  if not private.manfix_has_approved_role('workshop') then
    raise exception 'Approved workshop access is required.';
  end if;

  if next_status not in ('queued', 'in_progress', 'ready', 'completed') then
    raise exception 'Unsupported repair status.';
  end if;

  update public.repair_jobs
  set status = next_status, updated_at = now()
  where id = repair_job_id
    and workshop_owner_id = (select auth.uid());

  if not found then
    raise exception 'Repair job not found.';
  end if;
end;
$$;

create or replace function public.manfix_list_lift_busy_slots(
  target_lift_id uuid,
  range_start timestamptz,
  range_end timestamptz
)
returns table (
  starts_at timestamptz,
  ends_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select requested_start_at, requested_end_at
  from public.lift_bookings
  where lift_id = target_lift_id
    and status in ('pending', 'approved', 'completed')
    and requested_start_at < range_end
    and requested_end_at > range_start
  union all
  select blocked_start_at, blocked_end_at
  from public.lift_unavailable_slots
  where lift_id = target_lift_id
    and blocked_start_at < range_end
    and blocked_end_at > range_start
$$;

revoke all on function public.manfix_cancel_booking(text, uuid) from public, anon;
revoke all on function public.manfix_workshop_update_booking_status(text, uuid, text) from public, anon;
revoke all on function public.manfix_workshop_update_repair_status(uuid, text) from public, anon;
revoke all on function public.manfix_list_lift_busy_slots(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.manfix_cancel_booking(text, uuid) to authenticated;
grant execute on function public.manfix_workshop_update_booking_status(text, uuid, text) to authenticated;
grant execute on function public.manfix_workshop_update_repair_status(uuid, text) to authenticated;
grant execute on function public.manfix_list_lift_busy_slots(uuid, timestamptz, timestamptz) to authenticated;

alter table public.cars enable row level security;
alter table public.service_catalog enable row level security;
alter table public.lifts enable row level security;
alter table public.lift_unavailable_slots enable row level security;
alter table public.service_bookings enable row level security;
alter table public.lift_bookings enable row level security;
alter table public.booking_photos enable row level security;
alter table public.technicians enable row level security;
alter table public.repair_jobs enable row level security;

create policy "Customers manage own cars"
on public.cars for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Authenticated users view active service catalog"
on public.service_catalog for select to authenticated
using (is_active);

create policy "Admins manage service catalog"
on public.service_catalog for all to authenticated
using (private.manfix_has_approved_role('admin'))
with check (private.manfix_has_approved_role('admin'));

create policy "Authenticated users view active lifts"
on public.lifts for select to authenticated
using (is_active);

create policy "Workshops manage own lifts"
on public.lifts for all to authenticated
using (
  workshop_owner_id = (select auth.uid())
  and private.manfix_has_approved_role('workshop')
)
with check (
  workshop_owner_id = (select auth.uid())
  and private.manfix_has_approved_role('workshop')
);

create policy "Workshops manage own blocked lift slots"
on public.lift_unavailable_slots for all to authenticated
using (
  exists (
    select 1
    from public.lifts
    where lifts.id = lift_unavailable_slots.lift_id
      and lifts.workshop_owner_id = (select auth.uid())
  )
  and private.manfix_has_approved_role('workshop')
)
with check (
  exists (
    select 1
    from public.lifts
    where lifts.id = lift_unavailable_slots.lift_id
      and lifts.workshop_owner_id = (select auth.uid())
  )
  and private.manfix_has_approved_role('workshop')
);

create policy "Customers view own service bookings"
on public.service_bookings for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Customers create own service bookings"
on public.service_bookings for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Workshops manage assigned service bookings"
on public.service_bookings for all to authenticated
using (
  workshop_owner_id = (select auth.uid())
  and private.manfix_has_approved_role('workshop')
)
with check (
  workshop_owner_id = (select auth.uid())
  and private.manfix_has_approved_role('workshop')
);

create policy "Admins manage service bookings"
on public.service_bookings for all to authenticated
using (private.manfix_has_approved_role('admin'))
with check (private.manfix_has_approved_role('admin'));

create policy "Customers view own lift bookings"
on public.lift_bookings for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Customers create own lift bookings"
on public.lift_bookings for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Workshops manage assigned lift bookings"
on public.lift_bookings for all to authenticated
using (
  workshop_owner_id = (select auth.uid())
  and private.manfix_has_approved_role('workshop')
)
with check (
  workshop_owner_id = (select auth.uid())
  and private.manfix_has_approved_role('workshop')
);

create policy "Admins manage lift bookings"
on public.lift_bookings for all to authenticated
using (private.manfix_has_approved_role('admin'))
with check (private.manfix_has_approved_role('admin'));

create policy "Customers manage own booking photos"
on public.booking_photos for all to authenticated
using ((select auth.uid()) = uploaded_by)
with check (
  (select auth.uid()) = uploaded_by
  and exists (
    select 1
    from public.service_bookings
    where service_bookings.id = booking_photos.service_booking_id
      and service_bookings.user_id = (select auth.uid())
  )
);

create policy "Workshops view assigned booking photos"
on public.booking_photos for select to authenticated
using (
  private.manfix_has_approved_role('workshop')
  and exists (
    select 1
    from public.service_bookings
    where service_bookings.id = booking_photos.service_booking_id
      and service_bookings.workshop_owner_id = (select auth.uid())
  )
);

create policy "Workshops manage own technicians"
on public.technicians for all to authenticated
using (
  workshop_owner_id = (select auth.uid())
  and private.manfix_has_approved_role('workshop')
)
with check (
  workshop_owner_id = (select auth.uid())
  and private.manfix_has_approved_role('workshop')
);

create policy "Customers view own repair jobs"
on public.repair_jobs for select to authenticated
using ((select auth.uid()) = customer_id);

create policy "Workshops manage assigned repair jobs"
on public.repair_jobs for all to authenticated
using (
  workshop_owner_id = (select auth.uid())
  and private.manfix_has_approved_role('workshop')
)
with check (
  workshop_owner_id = (select auth.uid())
  and private.manfix_has_approved_role('workshop')
);

create policy "Admins manage repair jobs"
on public.repair_jobs for all to authenticated
using (private.manfix_has_approved_role('admin'))
with check (private.manfix_has_approved_role('admin'));

revoke all on public.cars from anon;
revoke all on public.service_catalog from anon;
revoke all on public.lifts from anon;
revoke all on public.lift_unavailable_slots from anon;
revoke all on public.service_bookings from anon;
revoke all on public.lift_bookings from anon;
revoke all on public.booking_photos from anon;
revoke all on public.technicians from anon;
revoke all on public.repair_jobs from anon;

grant select, insert, update, delete on public.cars to authenticated;
grant select, insert, update, delete on public.service_catalog to authenticated;
grant select, insert, update, delete on public.lifts to authenticated;
grant select, insert, update, delete on public.lift_unavailable_slots to authenticated;
grant select, insert, update, delete on public.service_bookings to authenticated;
grant select, insert, update, delete on public.lift_bookings to authenticated;
grant select, insert, update, delete on public.booking_photos to authenticated;
grant select, insert, update, delete on public.technicians to authenticated;
grant select, insert, update, delete on public.repair_jobs to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'service_bookings'
  ) then
    alter publication supabase_realtime add table public.service_bookings;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'lift_bookings'
  ) then
    alter publication supabase_realtime add table public.lift_bookings;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'repair_jobs'
  ) then
    alter publication supabase_realtime add table public.repair_jobs;
  end if;
end
$$;

insert into public.service_catalog (
  name,
  description,
  estimated_price,
  estimated_duration_minutes
)
values
  ('Oil Change', 'Engine oil and filter replacement.', 128, 60),
  ('Brake Inspection', 'Brake pad, rotor, and fluid inspection.', 68, 45),
  ('General Diagnosis', 'Workshop diagnosis for warning lights, noise, or drivability issues.', 88, 60),
  ('Air Conditioning Service', 'Cooling performance inspection and service.', 150, 90)
on conflict (name) do update
set description = excluded.description,
    estimated_price = excluded.estimated_price,
    estimated_duration_minutes = excluded.estimated_duration_minutes,
    is_active = true,
    updated_at = now();

insert into public.lifts (
  workshop_owner_id,
  name,
  location_label,
  hourly_rate,
  max_vehicle_weight_kg
)
select
  id,
  lift_name,
  'ManFix Workshop',
  hourly_rate,
  max_weight
from public.profiles
cross join (
  values
    ('Lift Bay 1', 24::numeric, 2500),
    ('Lift Bay 2', 28::numeric, 3200)
) as lift_seed(lift_name, hourly_rate, max_weight)
where role = 'workshop'
  and status in ('Active', 'Approved', 'Verified')
on conflict (workshop_owner_id, name) do update
set is_active = true,
    hourly_rate = excluded.hourly_rate,
    max_vehicle_weight_kg = excluded.max_vehicle_weight_kg,
    updated_at = now();
