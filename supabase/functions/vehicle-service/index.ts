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

type ExistingVehicleRow = {
  id: string;
  image_source_url?: string | null;
  image_status?: string | null;
  image_storage_key?: string | null;
  image_url?: string | null;
  source_hash: string | null;
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
    .select("id,brand_id,model_name,generation,body_type,image_url,image_source_url,image_status,synced_at,discontinued_at")
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
        id,model_name,generation,body_type,image_url,image_status,
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

      const result = await upsertModel(supabase, provider.id, brandId, model);
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

    await triggerVehicleImagePipeline();
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
) {
  const sourceHash = await hashJson(model);
  const now = new Date().toISOString();
  const existing = await findExisting(
    supabase,
    "vehicle_models",
    provider,
    model.externalId,
    "id,source_hash,image_url,image_status,image_source_url,image_storage_key",
  );
  const hasProviderImage = Boolean(model.imageUrl?.trim());
  const keepExistingImage = !hasProviderImage && hasPersistentImage(
    existing?.image_url,
    existing?.image_status,
  );

  const record = {
    body_type: model.bodyType ?? "Unclassified",
    brand_id: brandId,
    discontinued_at: model.discontinued ? now : null,
    external_id: model.externalId,
    external_provider: provider,
    generation: model.generation ?? "Provider catalog",
    image_source_url: hasProviderImage ? model.imageUrl : existing?.image_source_url ?? null,
    image_status: hasProviderImage ? "external" : keepExistingImage ? existing?.image_status ?? "cached" : "queued",
    image_storage_key: hasProviderImage ? null : existing?.image_storage_key ?? null,
    image_url: hasProviderImage ? model.imageUrl : existing?.image_url ?? getPlaceholderImageUrl(),
    model_name: model.modelName,
    source_hash: sourceHash,
    synced_at: now,
  };

  if (!existing) {
    const { data, error } = await supabase.from("vehicle_models").insert(record).select("id").single();
    if (error) throw error;
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
  if (data) return data as ExistingVehicleRow;

  if (table === "brands" && name) {
    const { data: named, error: namedError } = await supabase
      .from("brands")
      .select(select)
      .ilike("name", name)
      .maybeSingle();
    if (namedError) throw namedError;
    return named as ExistingVehicleRow | null;
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

async function sha256Hex(input: string) {
  const data = new TextEncoder().encode(input);
  const bytes = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  return toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)));
}

async function hashJson(value: unknown) {
  return await sha256Hex(JSON.stringify(value, Object.keys(value as object).sort()));
}

function toHex(bytes: Uint8Array) {
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function getNumberEnv(name: string, fallback: number) {
  const value = Number(Deno.env.get(name));
  return Number.isFinite(value) ? value : fallback;
}

function getPlaceholderImageUrl() {
  return Deno.env.get("VEHICLE_PLACEHOLDER_IMAGE_URL") ?? "/vehicle-placeholder.svg";
}

function hasPersistentImage(imageUrl?: string | null, imageStatus?: string | null) {
  const value = imageUrl?.trim();
  if (!value || value.includes("vehicle-placeholder")) return false;
  return imageStatus === "cached" || imageStatus === "external";
}

async function triggerVehicleImagePipeline() {
  const imageServiceUrl = Deno.env.get("VEHICLE_IMAGE_SERVICE_URL");
  const imageServiceSecret = Deno.env.get("VEHICLE_IMAGE_SERVICE_SECRET");
  if (!imageServiceUrl || !imageServiceSecret) return;

  const url = new URL("/enqueue-missing", imageServiceUrl);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${imageServiceSecret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ limit: getNumberEnv("VEHICLE_IMAGE_ENQUEUE_LIMIT", 500) }),
  });

  if (!response.ok) {
    console.error("vehicle image pipeline enqueue failed", response.status, await response.text());
  }
}

function normalizeName(value: string) {
  return value.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase()).trim();
}
