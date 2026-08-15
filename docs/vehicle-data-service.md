# ManFix Vehicle Data Service

ManFix no longer maintains a hand-written vehicle catalog. Vehicle data is synced from external providers into Supabase, then served to the apps through a stable API.

## Data Source

The production catalog is synced from a provider feed configured with `VEHICLE_DATA_PROVIDER_URL`. Public reference sources such as the official NHTSA vPIC API are useful for makes, models, and future VIN decoding, but they do not provide the complete global trim, engine, transmission, fluid-capacity, and official-media coverage ManFix needs for production spare-parts compatibility.

Without a production provider URL, the sync endpoint fails by default instead of creating incomplete catalog data. You can explicitly allow the limited NHTSA adapter for reference testing with `VEHICLE_ALLOW_PUBLIC_REFERENCE_PROVIDER=true`, but it should not be used as the production catalog.

The provider adapter expects:

- `GET /brands`
- `GET /models?limit=250&cursor=...`
- `GET /models/:externalId/variants`

Model records must include:

- `externalId`
- `brandExternalId`
- `modelName`
- `generation`
- `bodyType`
- `productionStartYear`
- `productionEndYear`
- `imageUrl` or `officialUrl`

Variant records must include:

- `externalId`
- `modelExternalId`
- `year`
- `engine`
- `displacement`
- `fuel`
- `transmission`
- `drivetrain`
- `horsepower`
- `torque`
- `engineOilCapacity`
- `transmissionOilCapacity`
- `coolantCapacity`

Returned records are stored in:

- `brands`
- `vehicle_models`
- `vehicle_variants`
- `vehicle_image_cache`
- `vehicle_sync_runs`
- `vehicle_data_sources`
- `vehicle_image_jobs`
- `vehicle_image_logs`

Rows are compared by `source_hash`, so existing data is only updated when the provider data changes. Every sync also records `last_seen_sync_run_id`; when the provider returns a complete snapshot, missing rows are marked with `discontinued_at` instead of being duplicated.

## Platform API

The platform service exposes:

- `GET /brands`
- `GET /brands/:id/models`
- `GET /models/:id/variants`
- `GET /variants/:id`

These endpoints read cached data from Supabase using the server-only service role key.

## Supabase Edge Function

Deploy the sync function:

```bash
supabase functions deploy vehicle-service
```

Required Supabase secrets:

```bash
supabase secrets set VEHICLE_SYNC_SECRET=your-secure-random-secret
```

Required production provider secrets:

```bash
supabase secrets set VEHICLE_DATA_PROVIDER_URL=https://your-provider.example.com
supabase secrets set VEHICLE_DATA_PROVIDER_KEY=your-provider-api-key
supabase secrets set VEHICLE_DATA_PROVIDER_ID=production_vehicle_provider
supabase secrets set VEHICLE_SYNC_BATCH_SIZE=250
supabase secrets set VEHICLE_SYNC_MAX_BATCHES_PER_RUN=20
```

Optional reference/testing secrets:

```bash
supabase secrets set VEHICLE_ALLOW_PUBLIC_REFERENCE_PROVIDER=true
supabase secrets set VEHICLE_SYNC_REQUIRE_COMPLETE_VARIANTS=false
```

Optional image pipeline secrets:

```bash
supabase secrets set VEHICLE_IMAGE_SERVICE_URL=https://manfix-vehicle-image-service.YOUR_WORKER_SUBDOMAIN.workers.dev
supabase secrets set VEHICLE_IMAGE_SERVICE_SECRET=your-secure-random-secret
supabase secrets set VEHICLE_IMAGE_ENQUEUE_LIMIT=500
supabase secrets set VEHICLE_PLACEHOLDER_IMAGE_URL=/vehicle-placeholder.svg
```

If no image is supplied by the provider, the service stores the local placeholder and queues the vehicle model for the Cloudflare Worker image pipeline. It does not use random third-party images.

## Vehicle Image Service

The Cloudflare Worker in `workers/vehicle-image-service` searches trusted official sources with Google Custom Search, downloads the selected image, uploads it to Cloudflare R2, then updates `vehicle_models.image_url`.

Required Worker secrets and bindings:

- R2 bucket binding: `VEHICLE_IMAGES`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `IMAGE_SERVICE_SECRET`
- `GOOGLE_CSE_API_KEY`
- `GOOGLE_CSE_ID`
- `R2_PUBLIC_BASE_URL`

Optional Worker variables:

- `TRUSTED_IMAGE_SITES`
- `PLACEHOLDER_IMAGE_URL`
- `MAX_ATTEMPTS`
- `MAX_IMAGE_BYTES`
- `PROCESS_BATCH_SIZE`

Useful commands:

```bash
npm run image-worker:typecheck
npm run image-worker:deploy
```

The Worker runs every 15 minutes and can also be called manually:

```bash
curl -X POST https://YOUR_WORKER_URL/enqueue-missing \
  -H "Authorization: Bearer YOUR_IMAGE_SERVICE_SECRET" \
  -H "Content-Type: application/json" \
  -d "{\"limit\":500}"

curl -X POST https://YOUR_WORKER_URL/process \
  -H "Authorization: Bearer YOUR_IMAGE_SERVICE_SECRET" \
  -H "Content-Type: application/json" \
  -d "{\"batchSize\":10}"
```

## Weekly Sync

After applying migrations and deploying the Edge Function, schedule weekly sync in Supabase SQL Editor:

```sql
select public.manfix_schedule_vehicle_sync(
  'https://YOUR_PROJECT_REF.supabase.co/functions/v1/vehicle-service/sync',
  'YOUR_VEHICLE_SYNC_SECRET'
);
```

The cron job runs weekly at `18:00 UTC` on Sunday, stores a sync run record, and advances the provider cursor. Pass a third cron expression argument if you need a different schedule.

Sync status is available at:

```text
GET /sync/status
```

## Render Environment

The main `manfix-platform` Render service needs:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Do not add `SUPABASE_SERVICE_ROLE_KEY` to customer, supplier, workshop, technician, admin, or auth static apps.

## Roadmap Hooks

The service is structured for:

- VIN decoding
- License plate lookup
- OEM spare part compatibility
- Maintenance schedule sync
- Provider-specific official image caching
