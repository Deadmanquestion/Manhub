# ManFix Vehicle Image Service

The Vehicle Image Service is a Cloudflare Worker that keeps `vehicle_models.image_url` correct without manual uploads.

## Flow

1. Vehicle sync inserts or updates `vehicle_models`.
2. If the model has no official image, Supabase queues a `vehicle_image_jobs` row and stores `/vehicle-placeholder.svg` temporarily.
3. The Cloudflare Worker runs every 15 minutes.
4. It searches Google Custom Search with official/trusted manufacturer domains only.
5. It downloads the selected image, uploads it to Cloudflare R2, and updates `vehicle_models.image_url`.
6. Future app requests read the cached R2 URL directly from Supabase.

## Tables

- `vehicle_models.image_status`
- `vehicle_image_jobs`
- `vehicle_image_logs`
- `vehicle_image_cache`

## Worker Configuration

Deploy from the repo root:

```bash
npm run image-worker:deploy
```

Configure these Cloudflare Worker secrets:

```bash
wrangler secret put SUPABASE_URL --config workers/vehicle-image-service/wrangler.toml
wrangler secret put SUPABASE_SERVICE_ROLE_KEY --config workers/vehicle-image-service/wrangler.toml
wrangler secret put IMAGE_SERVICE_SECRET --config workers/vehicle-image-service/wrangler.toml
wrangler secret put GOOGLE_CSE_API_KEY --config workers/vehicle-image-service/wrangler.toml
wrangler secret put GOOGLE_CSE_ID --config workers/vehicle-image-service/wrangler.toml
wrangler secret put R2_PUBLIC_BASE_URL --config workers/vehicle-image-service/wrangler.toml
```

`IMAGE_SERVICE_SECRET` must match the Supabase Edge Function secret `VEHICLE_IMAGE_SERVICE_SECRET`.

## Trusted Sources

The default source list is limited to manufacturer, newsroom, press, and media-kit domains. Add more with the `TRUSTED_IMAGE_SITES` Worker variable as a comma-separated list.

## Manual Test

```bash
curl -X POST https://YOUR_WORKER_URL/process \
  -H "Authorization: Bearer YOUR_IMAGE_SERVICE_SECRET" \
  -H "Content-Type: application/json" \
  -d "{\"batchSize\":1}"
```

Failed jobs are retried with exponential backoff. After the final attempt, the model keeps the placeholder and the failure is recorded in `vehicle_image_logs`.
