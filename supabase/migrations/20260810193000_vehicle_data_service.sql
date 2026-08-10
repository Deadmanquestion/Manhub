alter table public.brands
  add column if not exists external_provider text,
  add column if not exists external_id text,
  add column if not exists source_hash text,
  add column if not exists synced_at timestamptz,
  add column if not exists discontinued_at timestamptz;

alter table public.vehicle_models
  add column if not exists external_provider text,
  add column if not exists external_id text,
  add column if not exists source_hash text,
  add column if not exists synced_at timestamptz,
  add column if not exists discontinued_at timestamptz,
  add column if not exists image_source_url text,
  add column if not exists image_storage_key text;

alter table public.vehicle_variants
  add column if not exists external_provider text,
  add column if not exists external_id text,
  add column if not exists source_hash text,
  add column if not exists synced_at timestamptz,
  add column if not exists discontinued_at timestamptz;

create unique index if not exists brands_provider_external_id_idx
  on public.brands (external_provider, external_id)
  where external_provider is not null and external_id is not null;

create unique index if not exists vehicle_models_provider_external_id_idx
  on public.vehicle_models (external_provider, external_id)
  where external_provider is not null and external_id is not null;

create unique index if not exists vehicle_variants_provider_external_id_idx
  on public.vehicle_variants (external_provider, external_id)
  where external_provider is not null and external_id is not null;

create index if not exists brands_sync_state_idx
  on public.brands (external_provider, synced_at, discontinued_at);

create index if not exists vehicle_models_sync_state_idx
  on public.vehicle_models (external_provider, synced_at, discontinued_at);

create index if not exists vehicle_variants_sync_state_idx
  on public.vehicle_variants (external_provider, synced_at, discontinued_at);

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

create index if not exists vehicle_sync_runs_provider_started_idx
  on public.vehicle_sync_runs (provider, started_at desc);

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

alter table public.vehicle_data_sources enable row level security;
alter table public.vehicle_sync_runs enable row level security;
alter table public.vehicle_image_cache enable row level security;

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

revoke all on table public.vehicle_data_sources, public.vehicle_sync_runs, public.vehicle_image_cache
  from anon, authenticated;
grant select on table public.vehicle_image_cache to authenticated;
grant select on table public.vehicle_data_sources, public.vehicle_sync_runs to authenticated;
grant all on table public.vehicle_data_sources, public.vehicle_sync_runs, public.vehicle_image_cache to service_role;

insert into public.vehicle_data_sources (provider, priority, config)
values
  ('nhtsa_vpic', 100, jsonb_build_object(
    'capabilities', jsonb_build_array('brands', 'models', 'vin_decoding'),
    'notes', 'Official NHTSA vPIC public catalog. Full trim, engine, image, and global coverage can be supplied by a configured premium provider adapter.'
  ))
on conflict (provider) do update
set
  enabled = excluded.enabled,
  priority = excluded.priority,
  config = public.vehicle_data_sources.config || excluded.config,
  updated_at = now();

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.manfix_schedule_vehicle_sync(
  edge_function_url text,
  bearer_token text
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

  begin
    perform cron.unschedule('manfix-vehicle-data-sync');
  exception
    when others then
      null;
  end;

  perform cron.schedule(
    'manfix-vehicle-data-sync',
    '0 18 * * *',
    format(
      'select net.http_post(url := %L, headers := %L::jsonb, body := %L::jsonb);',
      edge_function_url,
      jsonb_build_object(
        'Authorization', 'Bearer ' || bearer_token,
        'Content-Type', 'application/json'
      )::text,
      jsonb_build_object('mode', 'daily')::text
    )
  );
end;
$$;

revoke all on function public.manfix_schedule_vehicle_sync(text, text) from public, anon, authenticated;
grant execute on function public.manfix_schedule_vehicle_sync(text, text) to service_role;
