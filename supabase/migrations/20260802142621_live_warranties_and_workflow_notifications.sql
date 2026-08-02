create extension if not exists pgcrypto;

alter table public.platform_settings
  add column if not exists service_warranty_months integer not null default 3
    check (service_warranty_months > 0);

create table if not exists public.warranties (
  id text primary key default ('WRNT-' || replace(gen_random_uuid()::text, '-', '')),
  warranty_number text not null unique,
  coverage_type text not null check (coverage_type in ('Part', 'Service')),
  customer_id uuid not null references auth.users(id) on delete restrict,
  customer_name text not null,
  vehicle_id text,
  vehicle_label text,
  supplier_id text,
  supplier_name text,
  workshop_id text,
  workshop_name text,
  order_id text,
  order_item_id text,
  service_booking_id text,
  repair_job_id text,
  invoice_id text,
  invoice_number text,
  part_id text,
  part_name text,
  part_brand text,
  repair_date date not null,
  start_date date not null,
  expiry_date date not null,
  duration_months integer not null check (duration_months > 0),
  mileage_limit integer check (mileage_limit is null or mileage_limit > 0),
  status text not null default 'Active'
    check (status in ('Active', 'Expired', 'Claimed', 'Cancelled')),
  warranty_terms text[] not null default array[
    'Coverage applies only to work and parts purchased through ManFix.',
    'A ManFix-authorized inspection may be required before a claim decision.'
  ],
  repair_history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.warranty_claims (
  id text primary key default ('WCLM-' || replace(gen_random_uuid()::text, '-', '')),
  warranty_id text not null references public.warranties(id) on delete cascade,
  customer_id uuid not null references auth.users(id) on delete restrict,
  description text not null check (btrim(description) <> ''),
  photos text[] not null default '{}',
  videos text[] not null default '{}',
  status text not null default 'Pending Review'
    check (status in ('Pending Review', 'Approved', 'Rejected', 'Inspection Requested')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  inspection_status text
    check (inspection_status is null or inspection_status in ('New', 'Accepted', 'Scheduled', 'Report uploaded', 'Replacement recommended')),
  inspection_report text,
  supplier_id text,
  workshop_id text,
  updated_at timestamptz not null default now()
);

alter table public.warranties
  alter column id set default ('WRNT-' || replace(gen_random_uuid()::text, '-', '')),
  alter column vehicle_id drop not null,
  alter column supplier_id drop not null,
  alter column workshop_id drop not null,
  alter column order_id drop not null,
  alter column invoice_id drop not null,
  alter column part_id drop not null,
  alter column vehicle_label drop not null,
  alter column workshop_name drop not null,
  alter column supplier_name drop not null,
  alter column part_name drop not null,
  alter column part_brand drop not null,
  alter column invoice_number drop not null;

alter table public.warranties
  add column if not exists warranty_number text,
  add column if not exists coverage_type text,
  add column if not exists order_item_id text,
  add column if not exists service_booking_id text,
  add column if not exists repair_job_id text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.warranty_claims
  alter column id set default ('WCLM-' || replace(gen_random_uuid()::text, '-', '')),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists warranties_order_item_unique
  on public.warranties(order_item_id) where order_item_id is not null;
create unique index if not exists warranties_repair_job_unique
  on public.warranties(repair_job_id) where repair_job_id is not null;
create unique index if not exists warranties_number_unique
  on public.warranties(warranty_number) where warranty_number is not null;

create index if not exists warranties_customer_idx on public.warranties(customer_id, created_at desc);
create index if not exists warranties_supplier_idx on public.warranties(supplier_id, created_at desc);
create index if not exists warranties_workshop_idx on public.warranties(workshop_id, created_at desc);
create index if not exists warranty_claims_customer_idx on public.warranty_claims(customer_id, submitted_at desc);
create index if not exists warranty_claims_status_idx on public.warranty_claims(status, submitted_at desc);

alter table public.warranties enable row level security;
alter table public.warranty_claims enable row level security;

drop policy if exists "Suppliers manage own claims" on public.warranty_claims;
drop policy if exists "Workshops manage inspection claims" on public.warranty_claims;
drop policy if exists "Customers submit own claims" on public.warranty_claims;
drop policy if exists "Customers view own claims" on public.warranty_claims;
drop policy if exists "Suppliers manage warranty claims" on public.warranty_claims;
drop policy if exists "Workshops manage warranty inspections" on public.warranty_claims;

drop policy if exists "Customers view own warranties" on public.warranties;
create policy "Customers view own warranties"
on public.warranties for select to authenticated
using (customer_id = (select auth.uid()));

drop policy if exists "Suppliers view supplied warranties" on public.warranties;
create policy "Suppliers view supplied warranties"
on public.warranties for select to authenticated
using (
  supplier_id = (select auth.uid())::text
  and private.manfix_has_approved_role('supplier')
);

drop policy if exists "Workshops view own warranties" on public.warranties;
create policy "Workshops view own warranties"
on public.warranties for select to authenticated
using (
  workshop_id = (select auth.uid())::text
  and private.manfix_has_approved_role('workshop')
);

drop policy if exists "Admins manage warranties" on public.warranties;
create policy "Admins manage warranties"
on public.warranties for all to authenticated
using (private.manfix_has_approved_role('admin'))
with check (private.manfix_has_approved_role('admin'));

drop policy if exists "Customers submit own warranty claims" on public.warranty_claims;
create policy "Customers submit own warranty claims"
on public.warranty_claims for insert to authenticated
with check (
  customer_id = (select auth.uid())
  and status = 'Pending Review'
  and exists (
    select 1 from public.warranties warranty
    where warranty.id = warranty_id
      and warranty.customer_id = (select auth.uid())
      and warranty.status = 'Active'
      and warranty.expiry_date >= current_date
  )
);

drop policy if exists "Customers view own warranty claims" on public.warranty_claims;
create policy "Customers view own warranty claims"
on public.warranty_claims for select to authenticated
using (customer_id = (select auth.uid()));

drop policy if exists "Suppliers view own warranty claims" on public.warranty_claims;
create policy "Suppliers view own warranty claims"
on public.warranty_claims for select to authenticated
using (
  supplier_id = (select auth.uid())::text
  and private.manfix_has_approved_role('supplier')
);

drop policy if exists "Workshops view own warranty claims" on public.warranty_claims;
create policy "Workshops view own warranty claims"
on public.warranty_claims for select to authenticated
using (
  workshop_id = (select auth.uid())::text
  and private.manfix_has_approved_role('workshop')
);

drop policy if exists "Workshops update own warranty inspections" on public.warranty_claims;
create policy "Workshops update own warranty inspections"
on public.warranty_claims for update to authenticated
using (
  workshop_id = (select auth.uid())::text
  and private.manfix_has_approved_role('workshop')
)
with check (
  workshop_id = (select auth.uid())::text
  and private.manfix_has_approved_role('workshop')
);

drop policy if exists "Admins manage warranty claims" on public.warranty_claims;
create policy "Admins manage warranty claims"
on public.warranty_claims for all to authenticated
using (private.manfix_has_approved_role('admin'))
with check (private.manfix_has_approved_role('admin'));

revoke all on public.warranties, public.warranty_claims from anon;
grant select on public.warranties to authenticated;
grant select, insert, update on public.warranty_claims to authenticated;

create or replace function private.manfix_create_part_warranties(target_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_order public.customer_orders%rowtype;
  payment record;
  customer_label text;
  line record;
  supplier_label text;
  warranty_code text;
begin
  select * into target_order
  from public.customer_orders
  where id = target_order_id and status = 'Completed';
  if not found then return; end if;

  select id, payment_number into payment
  from public.customer_payments
  where order_id = target_order.id
  order by created_at desc limit 1;

  select coalesce(nullif(full_name, ''), email, target_order.customer_id::text)
  into customer_label from public.profiles where id = target_order.customer_id;

  for line in
    select item.*, product.warranty_duration_months
    from public.customer_order_items item
    left join public.supplier_products product on product.id = item.product_id
    where item.order_id = target_order.id and item.status = 'Delivered'
  loop
    select coalesce(nullif(company_name, ''), line.supplier_id::text)
    into supplier_label
    from public.supplier_profiles
    where supplier_id = line.supplier_id;

    warranty_code := 'WRNT-' || replace(target_order.order_number, 'MF-', '') || '-' || substr(line.id::text, 1, 6);
    insert into public.warranties (
      warranty_number, coverage_type, customer_id, customer_name,
      supplier_id, supplier_name, order_id, order_item_id, invoice_id,
      invoice_number, part_id, part_name, part_brand, repair_date,
      start_date, expiry_date, duration_months
    ) values (
      warranty_code, 'Part', target_order.customer_id, customer_label,
      line.supplier_id::text, coalesce(supplier_label, line.supplier_id::text),
      target_order.id::text, line.id::text, payment.id::text, payment.payment_number,
      line.product_id::text, line.product_name, line.product_brand, current_date,
      current_date,
      (current_date + make_interval(months => coalesce(line.warranty_duration_months, 6)))::date,
      coalesce(line.warranty_duration_months, 6)
    ) on conflict (order_item_id) where order_item_id is not null do nothing;

    if found then
      perform private.manfix_notify(
        target_order.customer_id, 'Digital warranty activated',
        line.product_name || ' is now covered under ' || warranty_code || '.',
        'warranty', 'warranty', warranty_code, null
      );
    end if;
  end loop;
end;
$$;

create or replace function private.manfix_create_service_warranty(target_job_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_job public.repair_jobs%rowtype;
  booking public.service_bookings%rowtype;
  customer_label text;
  workshop_label text;
  months integer;
  warranty_code text;
begin
  select * into target_job from public.repair_jobs
  where id = target_job_id and status = 'completed';
  if not found or target_job.service_booking_id is null then return; end if;

  select * into booking from public.service_bookings where id = target_job.service_booking_id;
  select coalesce(nullif(full_name, ''), email, target_job.customer_id::text)
  into customer_label from public.profiles where id = target_job.customer_id;
  select coalesce(nullif(name, ''), target_job.workshop_owner_id::text)
  into workshop_label from public.platform_workshops where owner_id = target_job.workshop_owner_id;
  select service_warranty_months into months from public.platform_settings where id = 'platform';
  months := coalesce(months, 3);
  warranty_code := 'WRNT-SVC-' || substr(target_job.id::text, 1, 8);

  insert into public.warranties (
    warranty_number, coverage_type, customer_id, customer_name,
    vehicle_id, vehicle_label, workshop_id, workshop_name,
    service_booking_id, repair_job_id, part_name, repair_date,
    start_date, expiry_date, duration_months, repair_history
  ) values (
    warranty_code, 'Service', target_job.customer_id, customer_label,
    booking.car_id::text, target_job.vehicle_label, target_job.workshop_owner_id::text,
    coalesce(workshop_label, target_job.workshop_owner_id::text),
    booking.id::text, target_job.id::text, booking.service_type, current_date,
    current_date, (current_date + make_interval(months => months))::date,
    months,
    jsonb_build_array(jsonb_build_object(
      'date', current_date,
      'diagnosis', target_job.diagnosis,
      'technician', target_job.technician_name,
      'status', target_job.status
    ))
  ) on conflict (repair_job_id) where repair_job_id is not null do nothing;

  if found then
    perform private.manfix_notify(
      target_job.customer_id, 'Service warranty activated',
      booking.service_type || ' is now covered under ' || warranty_code || '.',
      'warranty', 'warranty', warranty_code, target_job.workshop_owner_id
    );
  end if;
end;
$$;

revoke all on function private.manfix_create_part_warranties(uuid) from public, anon, authenticated;
revoke all on function private.manfix_create_service_warranty(uuid) from public, anon, authenticated;

create or replace function private.manfix_generate_warranty_from_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'Completed' and old.status is distinct from new.status then
    perform private.manfix_create_part_warranties(new.id);
  end if;
  return new;
end;
$$;

create or replace function private.manfix_generate_warranty_from_repair()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'completed' and old.status is distinct from new.status then
    perform private.manfix_create_service_warranty(new.id);
  end if;
  return new;
end;
$$;

revoke all on function private.manfix_generate_warranty_from_order() from public, anon, authenticated;
revoke all on function private.manfix_generate_warranty_from_repair() from public, anon, authenticated;

drop trigger if exists manfix_generate_warranty_from_order on public.customer_orders;
create trigger manfix_generate_warranty_from_order
after update of status on public.customer_orders
for each row execute function private.manfix_generate_warranty_from_order();

drop trigger if exists manfix_generate_warranty_from_repair on public.repair_jobs;
create trigger manfix_generate_warranty_from_repair
after update of status on public.repair_jobs
for each row execute function private.manfix_generate_warranty_from_repair();

create or replace function public.manhub_supplier_review_warranty_claim(
  target_claim_id text,
  next_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_claim public.warranty_claims%rowtype;
begin
  if not private.manfix_has_approved_role('supplier') then
    raise exception 'Approved supplier access is required.';
  end if;
  if next_status not in ('Approved', 'Rejected', 'Inspection Requested') then
    raise exception 'Unsupported warranty decision.';
  end if;

  select * into target_claim from public.warranty_claims
  where id = target_claim_id
    and supplier_id = (select auth.uid())::text
    and status = 'Pending Review'
  for update;
  if not found then raise exception 'Warranty claim is not available for review.'; end if;

  update public.warranty_claims
  set status = next_status,
      reviewed_at = now(),
      inspection_status = case when next_status = 'Inspection Requested' then 'New' else inspection_status end,
      updated_at = now()
  where id = target_claim.id;

  update public.warranties
  set status = case when next_status = 'Approved' then 'Claimed' else status end,
      updated_at = now()
  where id = target_claim.warranty_id;

  perform private.manfix_notify(
    target_claim.customer_id, 'Warranty claim updated',
    'Your warranty claim is now ' || next_status || '.',
    'warranty_claim', 'warranty_claim', target_claim.id::text, (select auth.uid())
  );
  if next_status = 'Inspection Requested' and target_claim.workshop_id is not null then
    perform private.manfix_notify(
      target_claim.workshop_id, 'Warranty inspection requested',
      'A supplier requested an inspection for claim ' || target_claim.id::text || '.',
      'warranty_claim', 'warranty_claim', target_claim.id::text, (select auth.uid())
    );
  end if;
end;
$$;

create or replace function public.manfix_workshop_update_warranty_claim(
  target_claim_id text,
  next_inspection_status text,
  report_text text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_claim public.warranty_claims%rowtype;
begin
  if not private.manfix_has_approved_role('workshop') then
    raise exception 'Approved workshop access is required.';
  end if;
  if next_inspection_status not in ('Accepted', 'Scheduled', 'Report uploaded', 'Replacement recommended') then
    raise exception 'Unsupported inspection status.';
  end if;
  select * into target_claim from public.warranty_claims
  where id = target_claim_id and workshop_id = (select auth.uid())::text for update;
  if not found then raise exception 'Warranty inspection is not assigned to this workshop.'; end if;

  update public.warranty_claims
  set inspection_status = next_inspection_status,
      inspection_report = case when report_text is not null then report_text else inspection_report end,
      updated_at = now()
  where id = target_claim.id;
  perform private.manfix_notify(
    target_claim.customer_id, 'Warranty inspection updated',
    'Your warranty inspection is now ' || next_inspection_status || '.',
    'warranty_claim', 'warranty_claim', target_claim.id::text, (select auth.uid())
  );
end;
$$;

revoke all on function public.manhub_supplier_review_warranty_claim(text, text) from public, anon;
revoke all on function public.manfix_workshop_update_warranty_claim(text, text, text) from public, anon;
grant execute on function public.manhub_supplier_review_warranty_claim(text, text) to authenticated;
grant execute on function public.manfix_workshop_update_warranty_claim(text, text, text) to authenticated;

create or replace function public.manfix_submit_warranty_claim(
  target_warranty_id text,
  problem_description text,
  photo_paths text[] default '{}',
  video_paths text[] default '{}'
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_warranty public.warranties%rowtype;
  created_claim_id text;
begin
  if (select auth.uid()) is null or not private.manfix_has_approved_role('customer') then
    raise exception 'An active customer account is required.';
  end if;
  if nullif(btrim(problem_description), '') is null then
    raise exception 'Describe the warranty problem.';
  end if;
  select * into selected_warranty from public.warranties
  where id = target_warranty_id
    and customer_id = (select auth.uid())
    and status = 'Active'
    and expiry_date >= current_date
  for update;
  if not found then raise exception 'This warranty is not available for a claim.'; end if;

  insert into public.warranty_claims (
    warranty_id, customer_id, description, photos, videos,
    supplier_id, workshop_id, inspection_status
  ) values (
    selected_warranty.id, selected_warranty.customer_id, btrim(problem_description),
    coalesce(photo_paths, '{}'), coalesce(video_paths, '{}'),
    selected_warranty.supplier_id, selected_warranty.workshop_id,
    case when selected_warranty.workshop_id is not null then 'New' else null end
  ) returning id into created_claim_id;

  if selected_warranty.supplier_id is not null then
    perform private.manfix_notify(
      selected_warranty.supplier_id::uuid, 'New warranty claim',
      selected_warranty.warranty_number || ' needs review.',
      'warranty_claim', 'warranty_claim', created_claim_id, (select auth.uid())
    );
  end if;
  if selected_warranty.workshop_id is not null then
    perform private.manfix_notify(
      selected_warranty.workshop_id::uuid, 'Warranty claim submitted',
      selected_warranty.warranty_number || ' may require workshop inspection.',
      'warranty_claim', 'warranty_claim', created_claim_id, (select auth.uid())
    );
  end if;
  return created_claim_id;
end;
$$;

revoke all on function public.manfix_submit_warranty_claim(text, text, text[], text[]) from public, anon;
grant execute on function public.manfix_submit_warranty_claim(text, text, text[], text[]) to authenticated;

create or replace function public.manfix_get_supplier_commission_rate()
returns numeric
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  configured_rate numeric;
begin
  if not (
    private.manfix_has_approved_role('supplier')
    or private.manfix_has_approved_role('admin')
  ) then
    raise exception 'Supplier or administrator access is required.';
  end if;
  select supplier_commission_percent into configured_rate
  from public.platform_settings where id = 'platform';
  return coalesce(configured_rate, 20);
end;
$$;

revoke all on function public.manfix_get_supplier_commission_rate() from public, anon;
grant execute on function public.manfix_get_supplier_commission_rate() to authenticated;

create or replace function private.manfix_notify_booking_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  booking_label text;
begin
  booking_label := coalesce(new.vehicle_label, 'Vehicle booking');
  if tg_op = 'INSERT' then
    perform private.manfix_notify(
      new.user_id, 'Booking submitted',
      booking_label || ' was submitted for ' || to_char(new.scheduled_at, 'DD Mon YYYY HH24:MI') || '.',
      'booking', tg_table_name, new.id::text, new.user_id
    );
    if new.workshop_owner_id is not null then
      perform private.manfix_notify(
        new.workshop_owner_id, 'New workshop booking',
        booking_label || ' is awaiting review.',
        'booking', tg_table_name, new.id::text, new.user_id
      );
    end if;
  elsif old.status is distinct from new.status then
    perform private.manfix_notify(
      new.user_id, 'Booking status updated',
      booking_label || ' is now ' || new.status || '.',
      'booking', tg_table_name, new.id::text, new.workshop_owner_id
    );
  end if;
  return new;
end;
$$;

create or replace function private.manfix_notify_repair_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status is distinct from new.status then
    perform private.manfix_notify(
      new.customer_id, 'Repair progress updated',
      new.vehicle_label || ' is now ' || replace(new.status, '_', ' ') || '.',
      'repair_job', 'repair_job', new.id::text, new.workshop_owner_id
    );
    if new.technician_user_id is not null then
      perform private.manfix_notify(
        new.technician_user_id, 'Repair status updated',
        new.vehicle_label || ' is now ' || replace(new.status, '_', ' ') || '.',
        'repair_job', 'repair_job', new.id::text, new.workshop_owner_id
      );
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.manfix_notify_booking_changes() from public, anon, authenticated;
revoke all on function private.manfix_notify_repair_changes() from public, anon, authenticated;

drop trigger if exists manfix_notify_service_booking_changes on public.service_bookings;
create trigger manfix_notify_service_booking_changes
after insert or update of status on public.service_bookings
for each row execute function private.manfix_notify_booking_changes();

drop trigger if exists manfix_notify_lift_booking_changes on public.lift_bookings;
create trigger manfix_notify_lift_booking_changes
after insert or update of status on public.lift_bookings
for each row execute function private.manfix_notify_booking_changes();

drop trigger if exists manfix_notify_repair_changes on public.repair_jobs;
create trigger manfix_notify_repair_changes
after update of status on public.repair_jobs
for each row execute function private.manfix_notify_repair_changes();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'warranties'
  ) then alter publication supabase_realtime add table public.warranties; end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'warranty_claims'
  ) then alter publication supabase_realtime add table public.warranty_claims; end if;
end;
$$;
