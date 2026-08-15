create extension if not exists pgcrypto;
create extension if not exists pg_cron;
create extension if not exists pg_net;

alter table public.brands
  add column if not exists external_provider text,
  add column if not exists external_id text,
  add column if not exists source_hash text,
  add column if not exists synced_at timestamptz,
  add column if not exists discontinued_at timestamptz,
  add column if not exists source_payload jsonb not null default '{}'::jsonb,
  add column if not exists source_updated_at timestamptz,
  add column if not exists last_seen_at timestamptz,
  add column if not exists last_seen_sync_run_id uuid;

alter table public.vehicle_models
  add column if not exists external_provider text,
  add column if not exists external_id text,
  add column if not exists source_hash text,
  add column if not exists synced_at timestamptz,
  add column if not exists discontinued_at timestamptz,
  add column if not exists image_source_url text,
  add column if not exists image_storage_key text,
  add column if not exists image_status text not null default 'missing'
    check (image_status in ('missing', 'queued', 'processing', 'cached', 'external', 'failed')),
  add column if not exists image_last_attempt_at timestamptz,
  add column if not exists image_error text,
  add column if not exists official_url text,
  add column if not exists production_start_year integer,
  add column if not exists production_end_year integer,
  add column if not exists source_payload jsonb not null default '{}'::jsonb,
  add column if not exists source_updated_at timestamptz,
  add column if not exists last_seen_at timestamptz,
  add column if not exists last_seen_sync_run_id uuid;

alter table public.vehicle_variants
  add column if not exists external_provider text,
  add column if not exists external_id text,
  add column if not exists source_hash text,
  add column if not exists synced_at timestamptz,
  add column if not exists discontinued_at timestamptz,
  add column if not exists source_payload jsonb not null default '{}'::jsonb,
  add column if not exists source_updated_at timestamptz,
  add column if not exists last_seen_at timestamptz,
  add column if not exists last_seen_sync_run_id uuid;

create table if not exists public.vehicle_data_sources (
  provider text primary key,
  enabled boolean not null default true,
  priority integer not null default 100,
  last_synced_at timestamptz,
  last_cursor jsonb not null default '{}'::jsonb,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vehicle_sync_runs (
  id uuid primary key default gen_random_uuid(),
  provider text not null references public.vehicle_data_sources(provider) on delete restrict,
  status text not null default 'running'
    check (status in ('running', 'completed', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  brands_seen integer not null default 0,
  models_seen integer not null default 0,
  variants_seen integer not null default 0,
  brands_changed integer not null default 0,
  models_changed integer not null default 0,
  variants_changed integer not null default 0,
  error_message text,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.vehicle_sync_runs
  add column if not exists complete_snapshot boolean not null default false,
  add column if not exists provider_capabilities jsonb not null default '[]'::jsonb;

create table if not exists public.vehicle_image_cache (
  id uuid primary key default gen_random_uuid(),
  vehicle_model_id uuid not null references public.vehicle_models(id) on delete cascade,
  provider text not null default 'cloudflare_r2',
  original_url text,
  storage_key text,
  public_url text,
  status text not null default 'pending'
    check (status in ('pending', 'cached', 'failed')),
  source_hash text,
  fetched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (vehicle_model_id, provider)
);

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

alter table public.brands
  drop constraint if exists brands_production_years_check;

alter table public.vehicle_models
  drop constraint if exists vehicle_models_production_years_check;

alter table public.vehicle_models
  add constraint vehicle_models_production_years_check
  check (
    production_start_year is null
    or production_end_year is null
    or production_end_year >= production_start_year
  );

create index if not exists brands_provider_seen_idx
  on public.brands (external_provider, last_seen_sync_run_id, discontinued_at);

create unique index if not exists brands_provider_external_id_idx
  on public.brands (external_provider, external_id)
  where external_provider is not null and external_id is not null;

create index if not exists vehicle_models_provider_seen_idx
  on public.vehicle_models (external_provider, last_seen_sync_run_id, discontinued_at);

create unique index if not exists vehicle_models_provider_external_id_idx
  on public.vehicle_models (external_provider, external_id)
  where external_provider is not null and external_id is not null;

create index if not exists vehicle_variants_provider_seen_idx
  on public.vehicle_variants (external_provider, last_seen_sync_run_id, discontinued_at);

create unique index if not exists vehicle_variants_provider_external_id_idx
  on public.vehicle_variants (external_provider, external_id)
  where external_provider is not null and external_id is not null;

create index if not exists vehicle_models_brand_production_idx
  on public.vehicle_models (brand_id, model_name, production_start_year, production_end_year);

create index if not exists vehicle_variants_model_specs_idx
  on public.vehicle_variants (
    vehicle_model_id,
    year desc,
    engine,
    displacement,
    transmission,
    drivetrain
  );

create index if not exists vehicle_sync_runs_provider_started_idx
  on public.vehicle_sync_runs (provider, started_at desc);

create index if not exists vehicle_image_jobs_status_due_idx
  on public.vehicle_image_jobs (status, next_attempt_at, priority, created_at);

create index if not exists vehicle_image_logs_model_created_idx
  on public.vehicle_image_logs (vehicle_model_id, created_at desc);

update public.vehicle_models
set image_status = case
  when nullif(btrim(image_url), '') is null then 'missing'
  when image_url ilike '%vehicle-placeholder%' then 'missing'
  when image_storage_key is not null then 'cached'
  else 'external'
end
where image_status = 'missing';

alter table public.vehicle_data_sources enable row level security;
alter table public.vehicle_sync_runs enable row level security;
alter table public.vehicle_image_cache enable row level security;
alter table public.vehicle_image_jobs enable row level security;
alter table public.vehicle_image_logs enable row level security;

drop policy if exists "Admins read vehicle data sources" on public.vehicle_data_sources;
create policy "Admins read vehicle data sources"
  on public.vehicle_data_sources for select to authenticated
  using (
    private.manfix_has_approved_role('admin')
    or private.manfix_has_approved_role('super_admin')
  );

drop policy if exists "Admins read vehicle sync runs" on public.vehicle_sync_runs;
create policy "Admins read vehicle sync runs"
  on public.vehicle_sync_runs for select to authenticated
  using (
    private.manfix_has_approved_role('admin')
    or private.manfix_has_approved_role('super_admin')
  );

drop policy if exists "Authenticated users read vehicle image cache" on public.vehicle_image_cache;
create policy "Authenticated users read vehicle image cache"
  on public.vehicle_image_cache for select to authenticated
  using (true);

drop policy if exists "Service role manages vehicle image jobs" on public.vehicle_image_jobs;
create policy "Service role manages vehicle image jobs"
  on public.vehicle_image_jobs for all to service_role
  using (true)
  with check (true);

drop policy if exists "Admins read vehicle image jobs" on public.vehicle_image_jobs;
create policy "Admins read vehicle image jobs"
  on public.vehicle_image_jobs for select to authenticated
  using (
    private.manfix_has_approved_role('admin')
    or private.manfix_has_approved_role('super_admin')
  );

drop policy if exists "Service role manages vehicle image logs" on public.vehicle_image_logs;
create policy "Service role manages vehicle image logs"
  on public.vehicle_image_logs for all to service_role
  using (true)
  with check (true);

drop policy if exists "Admins read vehicle image logs" on public.vehicle_image_logs;
create policy "Admins read vehicle image logs"
  on public.vehicle_image_logs for select to authenticated
  using (
    private.manfix_has_approved_role('admin')
    or private.manfix_has_approved_role('super_admin')
  );

revoke all on table public.vehicle_data_sources, public.vehicle_sync_runs, public.vehicle_image_cache,
  public.vehicle_image_jobs, public.vehicle_image_logs
  from anon, authenticated;
grant select on table public.vehicle_data_sources, public.vehicle_sync_runs, public.vehicle_image_cache,
  public.vehicle_image_jobs, public.vehicle_image_logs to authenticated;
grant all on table public.vehicle_data_sources, public.vehicle_sync_runs, public.vehicle_image_cache,
  public.vehicle_image_jobs, public.vehicle_image_logs to service_role;

insert into public.vehicle_data_sources (provider, enabled, priority, config)
values
  ('production_vehicle_provider', true, 10, jsonb_build_object(
    'required', true,
    'cadence', 'weekly',
    'capabilities', jsonb_build_array(
      'brands',
      'models',
      'generations',
      'variants',
      'technical_specs',
      'official_images',
      'production_years'
    ),
    'required_model_fields', jsonb_build_array(
      'externalId',
      'brandExternalId',
      'modelName',
      'generation',
      'bodyType',
      'productionStartYear'
    ),
    'required_variant_fields', jsonb_build_array(
      'externalId',
      'modelExternalId',
      'year',
      'engine',
      'displacement',
      'fuel',
      'transmission',
      'drivetrain',
      'horsepower',
      'torque',
      'engineOilCapacity',
      'transmissionOilCapacity',
      'coolantCapacity'
    ),
    'notes', 'Primary ManFix production catalog feed. Public reference APIs are not enough for production trims, specs, and official media.'
  )),
  ('nhtsa_vpic', false, 100, jsonb_build_object(
    'reference_only', true,
    'capabilities', jsonb_build_array('brands', 'models', 'vin_decoding'),
    'notes', 'Official public NHTSA vPIC source for reference and VIN decoding. It is intentionally disabled for production catalog sync unless VEHICLE_ALLOW_PUBLIC_REFERENCE_PROVIDER=true.'
  ))
on conflict (provider) do update
set
  enabled = excluded.enabled,
  priority = excluded.priority,
  config = public.vehicle_data_sources.config || excluded.config,
  updated_at = now();

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

revoke all on function public.manfix_enqueue_vehicle_image_job(uuid, integer) from public, anon, authenticated;
revoke all on function public.manfix_enqueue_missing_vehicle_images(integer) from public, anon, authenticated;
grant execute on function public.manfix_enqueue_vehicle_image_job(uuid, integer) to service_role;
grant execute on function public.manfix_enqueue_missing_vehicle_images(integer) to service_role;

drop function if exists public.manfix_schedule_vehicle_sync(text, text);

create or replace function public.manfix_schedule_vehicle_sync(
  edge_function_url text,
  bearer_token text,
  cron_expression text default '0 18 * * 0'
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if edge_function_url is null or length(trim(edge_function_url)) = 0 then
    raise exception 'edge_function_url is required';
  end if;

  if bearer_token is null or length(trim(bearer_token)) = 0 then
    raise exception 'bearer_token is required';
  end if;

  if cron_expression is null or length(trim(cron_expression)) = 0 then
    raise exception 'cron_expression is required';
  end if;

  begin
    perform cron.unschedule('manfix-vehicle-data-sync');
  exception
    when others then
      null;
  end;

  perform cron.schedule(
    'manfix-vehicle-data-sync',
    cron_expression,
    format(
      'select net.http_post(url := %L, headers := %L::jsonb, body := %L::jsonb);',
      edge_function_url,
      jsonb_build_object(
        'Authorization', 'Bearer ' || bearer_token,
        'Content-Type', 'application/json'
      )::text,
      jsonb_build_object('mode', 'weekly')::text
    )
  );
end;
$$;

revoke all on function public.manfix_schedule_vehicle_sync(text, text, text) from public, anon, authenticated;
grant execute on function public.manfix_schedule_vehicle_sync(text, text, text) to service_role;

notify pgrst, 'reload schema';
