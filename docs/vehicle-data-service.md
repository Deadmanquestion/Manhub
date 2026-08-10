# ManFix Vehicle Data Service

ManFix no longer maintains a hand-written vehicle catalog. Vehicle data is synced from external providers into Supabase, then served to the apps through a stable API.

## Data Source

The default adapter uses the official NHTSA vPIC API for vehicle makes, models, and future VIN decoding support. For complete global trims, engines, transmissions, official images, and regional variants, configure a full vehicle-data provider through `VEHICLE_DATA_PROVIDER_URL`.

The provider adapter expects:

- `GET /brands`
- `GET /models?limit=60&cursor=...`
- `GET /models/:externalId/variants`

Returned records are stored in:

- `brands`
- `vehicle_models`
- `vehicle_variants`
- `vehicle_image_cache`
- `vehicle_sync_runs`
- `vehicle_data_sources`

Rows are compared by `source_hash`, so existing data is only updated when the provider data changes.

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

Optional provider secrets:

```bash
supabase secrets set VEHICLE_DATA_PROVIDER_URL=https://your-provider.example.com
supabase secrets set VEHICLE_DATA_PROVIDER_KEY=your-provider-api-key
supabase secrets set VEHICLE_SYNC_BATCH_SIZE=60
supabase secrets set VEHICLE_SYNC_START_YEAR=1990
supabase secrets set VEHICLE_SYNC_END_YEAR=2027
```

Optional image cache secrets:

```bash
supabase secrets set VEHICLE_IMAGE_SEARCH_API_URL=https://your-image-resolver.example.com/search
supabase secrets set VEHICLE_IMAGE_SEARCH_API_KEY=your-image-api-key
supabase secrets set CF_R2_ACCOUNT_ID=your-cloudflare-account-id
supabase secrets set CF_R2_BUCKET=your-r2-bucket
supabase secrets set CF_R2_ACCESS_KEY_ID=your-r2-access-key
supabase secrets set CF_R2_SECRET_ACCESS_KEY=your-r2-secret-key
supabase secrets set CF_R2_PUBLIC_BASE_URL=https://your-r2-public-domain
```

If no image is supplied by the provider and no image resolver is configured, the service leaves the image as pending. It does not use random placeholder images.

## Daily Sync

After applying migrations and deploying the Edge Function, schedule daily sync in Supabase SQL Editor:

```sql
select public.manfix_schedule_vehicle_sync(
  'https://YOUR_PROJECT_REF.supabase.co/functions/v1/vehicle-service/sync',
  'YOUR_VEHICLE_SYNC_SECRET'
);
```

The cron job runs daily at `18:00 UTC`, stores a sync run record, and advances the provider cursor.

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
