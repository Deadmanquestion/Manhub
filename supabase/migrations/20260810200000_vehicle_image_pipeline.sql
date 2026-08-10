alter table public.vehicle_models
  add column if not exists image_status text not null default 'missing'
    check (image_status in ('missing', 'queued', 'processing', 'cached', 'external', 'failed')),
  add column if not exists image_last_attempt_at timestamptz,
  add column if not exists image_error text;

update public.vehicle_models
set image_status = case
  when nullif(btrim(image_url), '') is null then 'missing'
  when image_url ilike '%vehicle-placeholder%' then 'missing'
  when image_storage_key is not null then 'cached'
  else 'external'
end
where image_status = 'missing';

create table if not exists public.vehicle_image_jobs (
  id uuid primary key default gen_random_uuid(),
  vehicle_model_id uuid not null references public.vehicle_models(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed', 'retry_scheduled')),
  priority integer not null default 100,
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  search_keyword text,
  selected_source text,
  r2_key text,
  r2_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (vehicle_model_id)
);

create index if not exists vehicle_image_jobs_status_due_idx
  on public.vehicle_image_jobs (status, next_attempt_at, priority, created_at);

create table if not exists public.vehicle_image_logs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.vehicle_image_jobs(id) on delete set null,
  vehicle_model_id uuid references public.vehicle_models(id) on delete set null,
  event text not null,
  search_keyword text,
  selected_source text,
  upload_status text,
  database_status text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists vehicle_image_logs_model_created_idx
  on public.vehicle_image_logs (vehicle_model_id, created_at desc);

create or replace function public.manfix_vehicle_model_needs_image(
  image_url text,
  image_status text
)
returns boolean
language sql
immutable
as $$
  select
    nullif(btrim(image_url), '') is null
    or image_url ilike '%vehicle-placeholder%'
    or image_status in ('missing', 'queued')
$$;

create or replace function public.manfix_enqueue_vehicle_image_job(
  target_vehicle_model_id uuid,
  job_priority integer default 100
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  queued_job_id uuid;
begin
  insert into public.vehicle_image_jobs (
    vehicle_model_id,
    status,
    priority,
    next_attempt_at,
    updated_at
  )
  values (
    target_vehicle_model_id,
    'pending',
    job_priority,
    now(),
    now()
  )
  on conflict (vehicle_model_id) do update
  set
    status = case
      when public.vehicle_image_jobs.status = 'processing' then public.vehicle_image_jobs.status
      else 'pending'
    end,
    priority = least(public.vehicle_image_jobs.priority, excluded.priority),
    next_attempt_at = now(),
    updated_at = now()
  returning id into queued_job_id;

  update public.vehicle_models
  set
    image_status = case
      when image_status = 'processing' then image_status
      else 'queued'
    end,
    updated_at = now()
  where id = target_vehicle_model_id
    and public.manfix_vehicle_model_needs_image(image_url, image_status);

  return queued_job_id;
end;
$$;

create or replace function public.manfix_enqueue_missing_vehicle_images(limit_count integer default 500)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  queued_count integer;
begin
  with candidates as (
    select model.id
    from public.vehicle_models model
    left join public.vehicle_image_jobs job
      on job.vehicle_model_id = model.id
    where public.manfix_vehicle_model_needs_image(model.image_url, model.image_status)
      and model.image_status <> 'failed'
      and (
        job.id is null
        or job.status = 'pending'
        or (job.status = 'retry_scheduled' and job.next_attempt_at <= now())
      )
    order by model.synced_at nulls first, model.created_at
    limit greatest(limit_count, 1)
  ), queued as (
    insert into public.vehicle_image_jobs (
      vehicle_model_id,
      status,
      priority,
      next_attempt_at,
      updated_at
    )
    select id, 'pending', 100, now(), now()
    from candidates
    on conflict (vehicle_model_id) do update
    set
      status = case
        when public.vehicle_image_jobs.status = 'processing' then public.vehicle_image_jobs.status
        when public.vehicle_image_jobs.status = 'retry_scheduled'
          and public.vehicle_image_jobs.next_attempt_at > now()
          then public.vehicle_image_jobs.status
        else 'pending'
      end,
      next_attempt_at = case
        when public.vehicle_image_jobs.status = 'retry_scheduled'
          and public.vehicle_image_jobs.next_attempt_at > now()
          then public.vehicle_image_jobs.next_attempt_at
        else now()
      end,
      updated_at = now()
    returning vehicle_model_id
  )
  update public.vehicle_models model
  set
    image_status = case
      when model.image_status = 'processing' then model.image_status
      else 'queued'
    end,
    updated_at = now()
  from queued
  where model.id = queued.vehicle_model_id;

  get diagnostics queued_count = row_count;
  return queued_count;
end;
$$;

create or replace function private.manfix_queue_vehicle_image_on_model_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.image_status <> 'failed'
    and public.manfix_vehicle_model_needs_image(new.image_url, new.image_status)
  then
    perform public.manfix_enqueue_vehicle_image_job(new.id, 100);
  end if;

  return new;
end;
$$;

drop trigger if exists queue_vehicle_image_on_model_change on public.vehicle_models;
create trigger queue_vehicle_image_on_model_change
after insert or update of image_url on public.vehicle_models
for each row
when (pg_trigger_depth() < 2)
execute function private.manfix_queue_vehicle_image_on_model_change();

alter table public.vehicle_image_jobs enable row level security;
alter table public.vehicle_image_logs enable row level security;

drop policy if exists "Admins read vehicle image jobs" on public.vehicle_image_jobs;
create policy "Admins read vehicle image jobs"
  on public.vehicle_image_jobs for select to authenticated
  using (
    private.manfix_has_approved_role('admin')
    or private.manfix_has_approved_role('super_admin')
  );

drop policy if exists "Admins read vehicle image logs" on public.vehicle_image_logs;
create policy "Admins read vehicle image logs"
  on public.vehicle_image_logs for select to authenticated
  using (
    private.manfix_has_approved_role('admin')
    or private.manfix_has_approved_role('super_admin')
  );

revoke all on table public.vehicle_image_jobs, public.vehicle_image_logs from anon, authenticated;
grant select on table public.vehicle_image_jobs, public.vehicle_image_logs to authenticated;
grant all on table public.vehicle_image_jobs, public.vehicle_image_logs to service_role;

revoke all on function public.manfix_enqueue_vehicle_image_job(uuid, integer) from public, anon, authenticated;
revoke all on function public.manfix_enqueue_missing_vehicle_images(integer) from public, anon, authenticated;
grant execute on function public.manfix_enqueue_vehicle_image_job(uuid, integer) to service_role;
grant execute on function public.manfix_enqueue_missing_vehicle_images(integer) to service_role;
