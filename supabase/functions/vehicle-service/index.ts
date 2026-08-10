import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type VehicleBrandInput = {
  country?: string | null;
  discontinued?: boolean;
  externalId: string;
  logoUrl?: string | null;
  name: string;
};

type VehicleModelInput = {
  bodyType?: string | null;
  brandExternalId: string;
  discontinued?: boolean;
  externalId: string;
  generation?: string | null;
  imageUrl?: string | null;
  modelName: string;
};

type VehicleVariantInput = {
  coolantCapacity?: number | null;
  discontinued?: boolean;
  displacement?: string | null;
  drivetrain?: string | null;
  engine: string;
  engineOilCapacity?: number | null;
  externalId: string;
  fuel: string;
  horsepower?: number | null;
  modelExternalId: string;
  torque?: number | null;
  transmission: string;
  transmissionOilCapacity?: number | null;
  tyreSize?: string | null;
  year: number;
};

type SyncStats = {
  brandsChanged: number;
  brandsSeen: number;
  modelsChanged: number;
  modelsSeen: number;
  variantsChanged: number;
  variantsSeen: number;
};

type VehicleProvider = {
  readonly id: string;
  fetchBrands(): Promise<VehicleBrandInput[]>;
  fetchModelBatch(state: Record<string, unknown>, batchSize: number): Promise<{
    models: VehicleModelInput[];
    nextState: Record<string, unknown>;
  }>;
  fetchVariants(model: VehicleModelInput): Promise<VehicleVariantInput[]>;
};

type NhtsaMake = {
  Make_ID: number;
  Make_Name: string;
};

type NhtsaModel = {
  Make_ID: number;
  Make_Name: string;
  Model_ID: number;
  Model_Name: string;
};

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-vehicle-sync-secret",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createAdminClient();
  if (!supabase) return json({ error: "Vehicle service is not configured." }, 500);

  const segments = getRouteSegments(request);
  try {
    if (request.method === "GET" && segments[0] === "brands" && segments.length === 1) {
      return json(await listBrands(supabase));
    }

    if (request.method === "GET" && segments[0] === "brands" && segments[2] === "models") {
      return json(await listModels(supabase, segments[1]));
    }

    if (request.method === "GET" && segments[0] === "models" && segments[2] === "variants") {
      return json(await listVariants(supabase, segments[1]));
    }

    if (request.method === "GET" && segments[0] === "variants" && segments[1]) {
      return json(await getVariant(supabase, segments[1]));
    }

    if (request.method === "POST" && segments[0] === "sync") {
      if (!isAuthorizedSync(request)) return json({ error: "Vehicle sync authorization is required." }, 401);
      return json(await runSync(supabase));
    }

    if (request.method === "POST" && segments[0] === "vin" && segments[1] === "decode") {
      return json({ error: "VIN decoding adapter is reserved for the vehicle service roadmap." }, 501);
    }

    if (request.method === "GET" && segments[0] === "license-plate") {
      return json({ error: "License plate lookup is reserved for a government or insurer data provider." }, 501);
    }

    return json({ error: "Vehicle endpoint not found." }, 404);
  } catch (error) {
    console.error("vehicle-service failed", error);
    return json({ error: error instanceof Error ? error.message : "Vehicle service failed." }, 500);
  }
});

function createAdminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) return null;

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function getRouteSegments(request: Request) {
  const path = new URL(request.url).pathname.split("/").filter(Boolean);
  const functionIndex = path.indexOf("vehicle-service");
  return functionIndex >= 0 ? path.slice(functionIndex + 1) : path;
}

function isAuthorizedSync(request: Request) {
  const expected = Deno.env.get("VEHICLE_SYNC_SECRET");
  if (!expected) return false;
  const authorization = request.headers.get("Authorization") ?? "";
  const bearer = authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : "";
  return bearer === expected || request.headers.get("x-vehicle-sync-secret") === expected;
}

function json(body: unknown, status = 200) {
  return Response.json(body, { headers: corsHeaders, status });
}

async function listBrands(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("brands")
    .select("id,name,logo_url,country,synced_at,discontinued_at")
    .is("discontinued_at", null)
    .order("name");
  if (error) throw error;
  return { brands: data ?? [] };
}

async function listModels(supabase: SupabaseClient, brandId: string) {
  const { data, error } = await supabase
    .from("vehicle_models")
    .select("id,brand_id,model_name,generation,body_type,image_url,image_source_url,synced_at,discontinued_at")
    .eq("brand_id", brandId)
    .is("discontinued_at", null)
    .order("model_name");
  if (error) throw error;
  return { models: data ?? [] };
}

async function listVariants(supabase: SupabaseClient, modelId: string) {
  const { data, error } = await supabase
    .from("vehicle_variants")
    .select("id,vehicle_model_id,year,engine,displacement,fuel,transmission,drivetrain,horsepower,torque,tyre_size,engine_oil_capacity,transmission_oil_capacity,coolant_capacity,synced_at,discontinued_at")
    .eq("vehicle_model_id", modelId)
    .is("discontinued_at", null)
    .order("year", { ascending: false });
  if (error) throw error;
  return { variants: data ?? [] };
}

async function getVariant(supabase: SupabaseClient, variantId: string) {
  const { data, error } = await supabase
    .from("vehicle_variants")
    .select(`
      id,vehicle_model_id,year,engine,displacement,fuel,transmission,drivetrain,
      horsepower,torque,tyre_size,engine_oil_capacity,transmission_oil_capacity,coolant_capacity,
      vehicle_model:vehicle_models(
        id,model_name,generation,body_type,image_url,
        brand:brands(id,name,logo_url,country)
      )
    `)
    .eq("id", variantId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { variant: null };
  return { variant: data };
}

async function runSync(supabase: SupabaseClient) {
  const provider = createProvider();
  const startedAt = new Date().toISOString();
  const runId = await createSyncRun(supabase, provider.id);
  const stats: SyncStats = {
    brandsChanged: 0,
    brandsSeen: 0,
    modelsChanged: 0,
    modelsSeen: 0,
    variantsChanged: 0,
    variantsSeen: 0,
  };

  try {
    await ensureProviderRow(supabase, provider.id);
    const source = await getProviderState(supabase, provider.id);
    const brands = await provider.fetchBrands();
    stats.brandsSeen = brands.length;

    const brandIdByExternalId = new Map<string, string>();
    for (const brand of brands) {
      const result = await upsertBrand(supabase, provider.id, brand);
      brandIdByExternalId.set(brand.externalId, result.id);
      if (result.changed) stats.brandsChanged += 1;
    }

    const batchSize = getNumberEnv("VEHICLE_SYNC_BATCH_SIZE", 60);
    const modelBatch = await provider.fetchModelBatch(source.last_cursor ?? {}, batchSize);
    stats.modelsSeen = modelBatch.models.length;

    const modelIdByExternalId = new Map<string, string>();
    for (const model of modelBatch.models) {
      const brandId = brandIdByExternalId.get(model.brandExternalId)
        ?? await findBrandId(supabase, provider.id, model.brandExternalId);
      if (!brandId) continue;

      const image = await resolveModelImage(model);
      const result = await upsertModel(supabase, provider.id, brandId, {
        ...model,
        imageUrl: image.publicUrl ?? model.imageUrl ?? "",
      }, image);
      modelIdByExternalId.set(model.externalId, result.id);
      if (result.changed) stats.modelsChanged += 1;

      const variants = await provider.fetchVariants(model);
      stats.variantsSeen += variants.length;
      for (const variant of variants) {
        const modelId = modelIdByExternalId.get(variant.modelExternalId) ?? result.id;
        if (!isUsableVariant(variant)) continue;
        const variantResult = await upsertVariant(supabase, provider.id, modelId, variant);
        if (variantResult.changed) stats.variantsChanged += 1;
      }
    }

    await supabase
      .from("vehicle_data_sources")
      .update({
        last_cursor: modelBatch.nextState,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("provider", provider.id);

    await finishSyncRun(supabase, runId, "completed", stats, startedAt);
    return { provider: provider.id, runId, status: "completed", ...stats };
  } catch (error) {
    await finishSyncRun(
      supabase,
      runId,
      "failed",
      stats,
      startedAt,
      error instanceof Error ? error.message : "Vehicle sync failed.",
    );
    throw error;
  }
}

function createProvider(): VehicleProvider {
  const customProviderUrl = Deno.env.get("VEHICLE_DATA_PROVIDER_URL");
  if (customProviderUrl) {
    return new HttpVehicleProvider(customProviderUrl, Deno.env.get("VEHICLE_DATA_PROVIDER_KEY") ?? "");
  }
  return new NhtsaProvider();
}

class HttpVehicleProvider implements VehicleProvider {
  readonly id = "external_vehicle_provider";

  constructor(private readonly baseUrl: string, private readonly apiKey: string) {}

  async fetchBrands(): Promise<VehicleBrandInput[]> {
    const body = await this.getJson<{ brands: VehicleBrandInput[] }>("/brands");
    return body.brands ?? [];
  }

  async fetchModelBatch(state: Record<string, unknown>, batchSize: number) {
    const cursor = typeof state.cursor === "string" ? state.cursor : "";
    const body = await this.getJson<{ cursor?: string; models: VehicleModelInput[] }>(
      `/models?limit=${batchSize}&cursor=${encodeURIComponent(cursor)}`,
    );
    return { models: body.models ?? [], nextState: { cursor: body.cursor ?? "" } };
  }

  async fetchVariants(model: VehicleModelInput): Promise<VehicleVariantInput[]> {
    const body = await this.getJson<{ variants: VehicleVariantInput[] }>(
      `/models/${encodeURIComponent(model.externalId)}/variants`,
    );
    return body.variants ?? [];
  }

  private async getJson<T>(path: string): Promise<T> {
    const url = new URL(path, this.baseUrl);
    const response = await fetch(url, {
      headers: this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : undefined,
    });
    if (!response.ok) throw new Error(`Vehicle provider failed: ${response.status}`);
    return await response.json() as T;
  }
}

class NhtsaProvider implements VehicleProvider {
  readonly id = "nhtsa_vpic";
  private makes: VehicleBrandInput[] | null = null;

  async fetchBrands(): Promise<VehicleBrandInput[]> {
    if (this.makes) return this.makes;
    const data = await this.getJson<{ Results: NhtsaMake[] }>(
      "https://vpic.nhtsa.dot.gov/api/vehicles/GetAllMakes?format=json",
    );
    this.makes = (data.Results ?? [])
      .filter((make) => make.Make_ID && make.Make_Name)
      .map((make) => ({
        country: null,
        externalId: String(make.Make_ID),
        logoUrl: null,
        name: normalizeName(make.Make_Name),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return this.makes;
  }

  async fetchModelBatch(state: Record<string, unknown>, batchSize: number) {
    const brands = await this.fetchBrands();
    const startYear = getNumberEnv("VEHICLE_SYNC_START_YEAR", new Date().getFullYear() - 12);
    const endYear = getNumberEnv("VEHICLE_SYNC_END_YEAR", new Date().getFullYear() + 1);
    let makeOffset = typeof state.makeOffset === "number" ? state.makeOffset : 0;
    let year = typeof state.year === "number" ? state.year : startYear;
    const models: VehicleModelInput[] = [];
    let processed = 0;

    while (processed < batchSize && brands.length > 0) {
      if (makeOffset >= brands.length) {
        makeOffset = 0;
        year += 1;
      }
      if (year > endYear) year = startYear;

      const brand = brands[makeOffset];
      const data = await this.getJson<{ Results: NhtsaModel[] }>(
        `https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeIdYear/makeId/${brand.externalId}/modelyear/${year}?format=json`,
      );

      for (const model of data.Results ?? []) {
        models.push({
          bodyType: null,
          brandExternalId: String(model.Make_ID),
          externalId: `${model.Make_ID}:${model.Model_ID}`,
          generation: null,
          imageUrl: null,
          modelName: normalizeName(model.Model_Name),
        });
      }

      makeOffset += 1;
      processed += 1;
    }

    return { models, nextState: { makeOffset, year } };
  }

  async fetchVariants(): Promise<VehicleVariantInput[]> {
    return [];
  }

  private async getJson<T>(url: string): Promise<T> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`NHTSA vPIC request failed: ${response.status}`);
    return await response.json() as T;
  }
}

async function ensureProviderRow(supabase: SupabaseClient, provider: string) {
  const { error } = await supabase
    .from("vehicle_data_sources")
    .upsert({ provider, updated_at: new Date().toISOString() }, { onConflict: "provider" });
  if (error) throw error;
}

async function createSyncRun(supabase: SupabaseClient, provider: string) {
  await ensureProviderRow(supabase, provider);
  const { data, error } = await supabase
    .from("vehicle_sync_runs")
    .insert({ provider, status: "running" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function finishSyncRun(
  supabase: SupabaseClient,
  runId: string,
  status: "completed" | "failed",
  stats: SyncStats,
  startedAt: string,
  errorMessage?: string,
) {
  const { error } = await supabase
    .from("vehicle_sync_runs")
    .update({
      brands_changed: stats.brandsChanged,
      brands_seen: stats.brandsSeen,
      error_message: errorMessage ?? null,
      finished_at: new Date().toISOString(),
      metadata: { startedAt },
      models_changed: stats.modelsChanged,
      models_seen: stats.modelsSeen,
      status,
      variants_changed: stats.variantsChanged,
      variants_seen: stats.variantsSeen,
    })
    .eq("id", runId);
  if (error) console.error("vehicle sync run update failed", error);
}

async function getProviderState(supabase: SupabaseClient, provider: string) {
  const { data, error } = await supabase
    .from("vehicle_data_sources")
    .select("last_cursor")
    .eq("provider", provider)
    .maybeSingle();
  if (error) throw error;
  return (data ?? { last_cursor: {} }) as { last_cursor: Record<string, unknown> };
}

async function findBrandId(supabase: SupabaseClient, provider: string, externalId: string) {
  const { data, error } = await supabase
    .from("brands")
    .select("id")
    .eq("external_provider", provider)
    .eq("external_id", externalId)
    .maybeSingle();
  if (error) throw error;
  return data?.id as string | undefined;
}

async function upsertBrand(supabase: SupabaseClient, provider: string, brand: VehicleBrandInput) {
  const sourceHash = await hashJson(brand);
  const now = new Date().toISOString();
  const existing = await findExisting(
    supabase,
    "brands",
    provider,
    brand.externalId,
    "id,source_hash",
    brand.name,
  );

  const record = {
    country: brand.country ?? null,
    discontinued_at: brand.discontinued ? now : null,
    external_id: brand.externalId,
    external_provider: provider,
    logo_url: brand.logoUrl ?? "",
    name: brand.name,
    source_hash: sourceHash,
    synced_at: now,
  };

  if (!existing) {
    const { data, error } = await supabase.from("brands").insert(record).select("id").single();
    if (error) throw error;
    return { changed: true, id: data.id as string };
  }

  if (existing.source_hash === sourceHash) return { changed: false, id: existing.id as string };

  const { data, error } = await supabase
    .from("brands")
    .update(record)
    .eq("id", existing.id)
    .select("id")
    .single();
  if (error) throw error;
  return { changed: true, id: data.id as string };
}

async function upsertModel(
  supabase: SupabaseClient,
  provider: string,
  brandId: string,
  model: VehicleModelInput,
  image: { originalUrl?: string | null; publicUrl?: string | null; storageKey?: string | null },
) {
  const sourceHash = await hashJson({ ...model, image });
  const now = new Date().toISOString();
  const existing = await findExisting(
    supabase,
    "vehicle_models",
    provider,
    model.externalId,
    "id,source_hash",
  );

  const record = {
    body_type: model.bodyType ?? "Unclassified",
    brand_id: brandId,
    discontinued_at: model.discontinued ? now : null,
    external_id: model.externalId,
    external_provider: provider,
    generation: model.generation ?? "Provider catalog",
    image_source_url: image.originalUrl ?? model.imageUrl ?? null,
    image_storage_key: image.storageKey ?? null,
    image_url: image.publicUrl ?? model.imageUrl ?? "",
    model_name: model.modelName,
    source_hash: sourceHash,
    synced_at: now,
  };

  if (!existing) {
    const { data, error } = await supabase.from("vehicle_models").insert(record).select("id").single();
    if (error) throw error;
    await updateImageCache(supabase, data.id, image);
    return { changed: true, id: data.id as string };
  }

  if (existing.source_hash === sourceHash) return { changed: false, id: existing.id as string };

  const { data, error } = await supabase
    .from("vehicle_models")
    .update(record)
    .eq("id", existing.id)
    .select("id")
    .single();
  if (error) throw error;
  await updateImageCache(supabase, data.id, image);
  return { changed: true, id: data.id as string };
}

async function upsertVariant(
  supabase: SupabaseClient,
  provider: string,
  modelId: string,
  variant: VehicleVariantInput,
) {
  const sourceHash = await hashJson(variant);
  const now = new Date().toISOString();
  const existing = await findExisting(
    supabase,
    "vehicle_variants",
    provider,
    variant.externalId,
    "id,source_hash",
  );

  const record = {
    coolant_capacity: variant.coolantCapacity ?? null,
    discontinued_at: variant.discontinued ? now : null,
    displacement: variant.displacement ?? null,
    drivetrain: variant.drivetrain,
    engine: variant.engine,
    engine_oil_capacity: variant.engineOilCapacity ?? null,
    external_id: variant.externalId,
    external_provider: provider,
    fuel: variant.fuel,
    horsepower: variant.horsepower ?? null,
    source_hash: sourceHash,
    synced_at: now,
    torque: variant.torque ?? null,
    transmission: variant.transmission,
    transmission_oil_capacity: variant.transmissionOilCapacity ?? null,
    tyre_size: variant.tyreSize ?? null,
    vehicle_model_id: modelId,
    year: variant.year,
  };

  if (!existing) {
    const { data, error } = await supabase.from("vehicle_variants").insert(record).select("id").single();
    if (error) throw error;
    return { changed: true, id: data.id as string };
  }

  if (existing.source_hash === sourceHash) return { changed: false, id: existing.id as string };

  const { data, error } = await supabase
    .from("vehicle_variants")
    .update(record)
    .eq("id", existing.id)
    .select("id")
    .single();
  if (error) throw error;
  return { changed: true, id: data.id as string };
}

async function findExisting(
  supabase: SupabaseClient,
  table: "brands" | "vehicle_models" | "vehicle_variants",
  provider: string,
  externalId: string,
  select: string,
  name?: string,
) {
  const { data, error } = await supabase
    .from(table)
    .select(select)
    .eq("external_provider", provider)
    .eq("external_id", externalId)
    .maybeSingle();
  if (error) throw error;
  if (data) return data as { id: string; source_hash: string | null };

  if (table === "brands" && name) {
    const { data: named, error: namedError } = await supabase
      .from("brands")
      .select(select)
      .ilike("name", name)
      .maybeSingle();
    if (namedError) throw namedError;
    return named as { id: string; source_hash: string | null } | null;
  }

  return null;
}

function isUsableVariant(variant: VehicleVariantInput) {
  return Boolean(
    variant.externalId
      && variant.modelExternalId
      && variant.year
      && variant.engine?.trim()
      && variant.fuel?.trim()
      && variant.transmission?.trim()
      && variant.drivetrain?.trim(),
  );
}

async function resolveModelImage(model: VehicleModelInput) {
  if (model.imageUrl) return { originalUrl: model.imageUrl, publicUrl: model.imageUrl, storageKey: null };

  const resolverUrl = Deno.env.get("VEHICLE_IMAGE_SEARCH_API_URL");
  const resolverKey = Deno.env.get("VEHICLE_IMAGE_SEARCH_API_KEY");
  if (!resolverUrl) return {};

  const query = `${model.modelName} ${model.generation ?? ""} official vehicle image`.trim();
  const url = resolverUrl.includes("{query}")
    ? resolverUrl.replace("{query}", encodeURIComponent(query))
    : `${resolverUrl}${resolverUrl.includes("?") ? "&" : "?"}q=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: resolverKey ? { Authorization: `Bearer ${resolverKey}` } : undefined,
  });
  if (!response.ok) return {};

  const body = await response.json() as {
    imageUrl?: string;
    results?: Array<{ imageUrl?: string; url?: string }>;
    url?: string;
  };
  const imageUrl = body.imageUrl ?? body.url ?? body.results?.[0]?.imageUrl ?? body.results?.[0]?.url;
  if (!imageUrl) return {};

  const cached = await cacheImageInR2(imageUrl, model);
  return cached.publicUrl
    ? { originalUrl: imageUrl, publicUrl: cached.publicUrl, storageKey: cached.storageKey }
    : { originalUrl: imageUrl, publicUrl: imageUrl, storageKey: null };
}

async function cacheImageInR2(imageUrl: string, model: VehicleModelInput) {
  const accountId = Deno.env.get("CF_R2_ACCOUNT_ID");
  const bucket = Deno.env.get("CF_R2_BUCKET");
  const accessKeyId = Deno.env.get("CF_R2_ACCESS_KEY_ID");
  const secretAccessKey = Deno.env.get("CF_R2_SECRET_ACCESS_KEY");
  const publicBaseUrl = Deno.env.get("CF_R2_PUBLIC_BASE_URL");
  if (!accountId || !bucket || !accessKeyId || !secretAccessKey || !publicBaseUrl) return {};

  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) return {};

  const contentType = imageResponse.headers.get("content-type") ?? "image/jpeg";
  const extension = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  const storageKey = `vehicles/${safeSlug(model.brandExternalId)}/${safeSlug(model.modelName)}-${safeSlug(model.externalId)}.${extension}`;
  const bytes = new Uint8Array(await imageResponse.arrayBuffer());
  const endpoint = `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${storageKey}`;
  const signedHeaders = await signR2Put(endpoint, bytes, contentType, accessKeyId, secretAccessKey);
  const upload = await fetch(endpoint, { body: bytes, headers: signedHeaders, method: "PUT" });
  if (!upload.ok) return {};

  return {
    publicUrl: `${publicBaseUrl.replace(/\/$/, "")}/${storageKey}`,
    storageKey,
  };
}

async function updateImageCache(
  supabase: SupabaseClient,
  vehicleModelId: string,
  image: { originalUrl?: string | null; publicUrl?: string | null; storageKey?: string | null },
) {
  const { error } = await supabase.from("vehicle_image_cache").upsert({
    fetched_at: image.publicUrl ? new Date().toISOString() : null,
    original_url: image.originalUrl ?? null,
    public_url: image.publicUrl ?? null,
    source_hash: await hashJson(image),
    status: image.publicUrl ? "cached" : "pending",
    storage_key: image.storageKey ?? null,
    updated_at: new Date().toISOString(),
    vehicle_model_id: vehicleModelId,
  }, { onConflict: "vehicle_model_id,provider" });
  if (error) console.error("vehicle image cache update failed", error);
}

async function signR2Put(
  endpoint: string,
  body: Uint8Array,
  contentType: string,
  accessKeyId: string,
  secretAccessKey: string,
) {
  const url = new URL(endpoint);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = await sha256Hex(body);
  const canonicalHeaders = [
    `content-type:${contentType}`,
    `host:${url.host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`,
  ].join("\n") + "\n";
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = [
    "PUT",
    encodeURI(url.pathname),
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    await sha256Hex(new TextEncoder().encode(canonicalRequest)),
  ].join("\n");
  const signingKey = await getSigningKey(secretAccessKey, dateStamp);
  const signature = toHex(new Uint8Array(await hmac(signingKey, stringToSign)));
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  return {
    Authorization: authorization,
    "Content-Type": contentType,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
}

async function getSigningKey(secretAccessKey: string, dateStamp: string) {
  const dateKey = await hmac(new TextEncoder().encode(`AWS4${secretAccessKey}`), dateStamp);
  const dateRegionKey = await hmac(dateKey, "auto");
  const dateRegionServiceKey = await hmac(dateRegionKey, "s3");
  return await hmac(dateRegionServiceKey, "aws4_request");
}

async function hmac(key: ArrayBuffer | Uint8Array, message: string) {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );
  return await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(message));
}

async function sha256Hex(input: Uint8Array) {
  return toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", input)));
}

async function hashJson(value: unknown) {
  return await sha256Hex(new TextEncoder().encode(JSON.stringify(value, Object.keys(value as object).sort())));
}

function toHex(bytes: Uint8Array) {
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function getNumberEnv(name: string, fallback: number) {
  const value = Number(Deno.env.get(name));
  return Number.isFinite(value) ? value : fallback;
}

function normalizeName(value: string) {
  return value.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase()).trim();
}

function safeSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
