type R2Bucket = {
  put(
    key: string,
    value: ArrayBuffer | ArrayBufferView | ReadableStream,
    options?: {
      customMetadata?: Record<string, string>;
      httpMetadata?: { contentType?: string };
    },
  ): Promise<unknown>;
};

type ExecutionContext = {
  waitUntil(promise: Promise<unknown>): void;
};

type ScheduledController = {
  cron: string;
  scheduledTime: number;
};

type Env = {
  GOOGLE_CSE_API_KEY: string;
  GOOGLE_CSE_ID: string;
  IMAGE_SERVICE_SECRET: string;
  MAX_ATTEMPTS?: string;
  MAX_IMAGE_BYTES?: string;
  PLACEHOLDER_IMAGE_URL?: string;
  PROCESS_BATCH_SIZE?: string;
  R2_PUBLIC_BASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_URL: string;
  TRUSTED_IMAGE_SITES?: string;
  VEHICLE_IMAGES: R2Bucket;
};

type ImageJob = {
  attempts: number;
  id: string;
  vehicle_model_id: string;
};

type VehicleModel = {
  body_type: string | null;
  brand: { name: string } | null;
  generation: string | null;
  id: string;
  image_status: string | null;
  image_url: string | null;
  model_name: string;
};

type GoogleImageResult = {
  displayLink?: string;
  image?: {
    contextLink?: string;
  };
  link?: string;
  mime?: string;
  title?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

const handler = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders, status: 204 });
    const url = new URL(request.url);

    try {
      if (request.method === "GET" && url.pathname === "/health") {
        return json({ service: "vehicle-image-service", status: "ok" });
      }

      if (request.method === "POST" && url.pathname === "/enqueue-missing") {
        requireServiceAuth(request, env);
        const body = await safeJson<{ limit?: number }>(request);
        const supabase = new SupabaseRest(env);
        const queued = await supabase.rpc<{ count: number }>("manfix_enqueue_missing_vehicle_images", {
          limit_count: body.limit ?? 500,
        });
        return json({ queued });
      }

      if (request.method === "POST" && url.pathname === "/process") {
        requireServiceAuth(request, env);
        const body = await safeJson<{ batchSize?: number }>(request);
        const batchSize = body.batchSize ?? numberEnv(env.PROCESS_BATCH_SIZE, 10);
        const promise = processQueue(env, batchSize);
        ctx.waitUntil(promise);
        return json({ accepted: true, batchSize });
      }

      const modelMatch = url.pathname.match(/^\/models\/([^/]+)\/process$/);
      if (request.method === "POST" && modelMatch) {
        requireServiceAuth(request, env);
        const supabase = new SupabaseRest(env);
        const job = await ensureModelJob(supabase, modelMatch[1]);
        const result = await processJob(env, supabase, job);
        return json(result);
      }

      return json({ error: "Not found." }, 404);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Vehicle image service failed.";
      return json({ error: message }, message === "Unauthorized." ? 401 : 500);
    }
  },

  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(processScheduled(env));
  },
};

export default handler;

async function processScheduled(env: Env) {
  const supabase = new SupabaseRest(env);
  await supabase.rpc("manfix_enqueue_missing_vehicle_images", { limit_count: 1000 });
  await processQueue(env, numberEnv(env.PROCESS_BATCH_SIZE, 10), supabase);
}

async function processQueue(env: Env, batchSize: number, existingClient?: SupabaseRest) {
  const supabase = existingClient ?? new SupabaseRest(env);
  const jobs = await supabase.select<ImageJob[]>("vehicle_image_jobs", {
    limit: String(batchSize),
    next_attempt_at: `lte.${new Date().toISOString()}`,
    order: "priority.asc,created_at.asc",
    select: "id,vehicle_model_id,attempts",
    status: "in.(pending,retry_scheduled)",
  });

  const results = [];
  for (const job of jobs) {
    results.push(await processJob(env, supabase, job));
  }
  return { processed: results.length, results };
}

async function processJob(env: Env, supabase: SupabaseRest, job: ImageJob) {
  const attempts = job.attempts + 1;
  await supabase.patch("vehicle_image_jobs", { attempts, status: "processing", updated_at: now() }, {
    id: `eq.${job.id}`,
  });
  await supabase.patch("vehicle_models", { image_last_attempt_at: now(), image_status: "processing" }, {
    id: `eq.${job.vehicle_model_id}`,
  });

  let model: VehicleModel | null = null;
  let keyword = "";
  try {
    model = await getVehicleModel(supabase, job.vehicle_model_id);
    keyword = buildSearchKeyword(model);
    await logImageEvent(supabase, job, "search_started", { search_keyword: keyword });

    if (hasUsableImage(model, env)) {
      await completeJob(supabase, job, {
        event: "existing_image_used",
        publicUrl: model.image_url ?? "",
        searchKeyword: keyword,
        selectedSource: sourceHost(model.image_url ?? ""),
        storageKey: null,
      });
      return { status: "completed", vehicleModelId: model.id };
    }

    const candidate = await findTrustedImage(env, model, keyword);
    await logImageEvent(supabase, job, "image_selected", {
      search_keyword: keyword,
      selected_source: candidate.source,
      details: { title: candidate.title, url: candidate.url },
    });

    const downloaded = await downloadImage(candidate.url, numberEnv(env.MAX_IMAGE_BYTES, 6_000_000));
    const storageKey = buildR2Key(model, candidate.url, downloaded.contentType);
    await env.VEHICLE_IMAGES.put(storageKey, downloaded.bytes, {
      customMetadata: {
        sourceUrl: candidate.url,
        vehicleModelId: model.id,
      },
      httpMetadata: { contentType: downloaded.contentType },
    });
    const publicUrl = `${env.R2_PUBLIC_BASE_URL.replace(/\/$/, "")}/${storageKey}`;

    await supabase.patch("vehicle_models", {
      image_error: null,
      image_source_url: candidate.url,
      image_status: "cached",
      image_storage_key: storageKey,
      image_url: publicUrl,
      updated_at: now(),
    }, { id: `eq.${model.id}` });

    await upsertImageCache(supabase, model.id, candidate.url, storageKey, publicUrl);
    await completeJob(supabase, job, {
      event: "image_cached",
      publicUrl,
      searchKeyword: keyword,
      selectedSource: candidate.source,
      storageKey,
    });

    return { imageUrl: publicUrl, status: "completed", vehicleModelId: model.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Image fetch failed.";
    await retryJob(env, supabase, job, attempts, message, keyword || job.vehicle_model_id);
    return { error: message, status: "retry_scheduled", vehicleModelId: model?.id ?? job.vehicle_model_id };
  }
}

async function getVehicleModel(supabase: SupabaseRest, vehicleModelId: string) {
  const models = await supabase.select<VehicleModel[]>("vehicle_models", {
    id: `eq.${vehicleModelId}`,
    limit: "1",
    select: "id,model_name,generation,body_type,image_url,image_status,brand:brands(name)",
  });
  const model = models[0];
  if (!model) throw new Error("Vehicle model not found.");
  return model;
}

async function ensureModelJob(supabase: SupabaseRest, vehicleModelId: string) {
  const response = await supabase.post<ImageJob[]>("vehicle_image_jobs", {
    next_attempt_at: now(),
    status: "pending",
    updated_at: now(),
    vehicle_model_id: vehicleModelId,
  }, "resolution=merge-duplicates,return=representation", { on_conflict: "vehicle_model_id" });
  return response[0];
}

async function findTrustedImage(env: Env, model: VehicleModel, keyword: string) {
  const sources = trustedSources(env, model.brand?.name ?? "");
  let lastError = "";

  for (const source of sources) {
    const query = `${keyword} site:${source}`;
    const searchUrl = new URL("https://www.googleapis.com/customsearch/v1");
    searchUrl.searchParams.set("key", env.GOOGLE_CSE_API_KEY);
    searchUrl.searchParams.set("cx", env.GOOGLE_CSE_ID);
    searchUrl.searchParams.set("q", query);
    searchUrl.searchParams.set("searchType", "image");
    searchUrl.searchParams.set("num", "5");
    searchUrl.searchParams.set("safe", "active");
    searchUrl.searchParams.set("imgSize", "large");
    searchUrl.searchParams.set("siteSearch", source);
    searchUrl.searchParams.set("siteSearchFilter", "i");

    const response = await fetch(searchUrl);
    if (!response.ok) {
      lastError = `Google CSE failed for ${source}: ${response.status}`;
      continue;
    }

    const body = await response.json() as { items?: GoogleImageResult[] };
    for (const item of body.items ?? []) {
      const imageUrl = item.link ?? "";
      const contextUrl = item.image?.contextLink ?? imageUrl;
      if (!isTrustedUrl(imageUrl, source) && !isTrustedUrl(contextUrl, source)) continue;
      if (item.mime && !item.mime.startsWith("image/")) continue;
      return {
        source,
        title: item.title ?? "",
        url: imageUrl,
      };
    }
  }

  throw new Error(lastError || "No trusted official image found.");
}

async function downloadImage(imageUrl: string, maxBytes: number) {
  const response = await fetch(imageUrl, {
    headers: {
      "User-Agent": "ManFixVehicleImageService/1.0",
    },
  });
  if (!response.ok) throw new Error(`Image download failed: ${response.status}`);

  const contentType = response.headers.get("content-type") ?? "application/octet-stream";
  if (!contentType.startsWith("image/")) throw new Error(`Selected URL is not an image: ${contentType}`);

  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new Error("Selected image is larger than the configured limit.");
  }

  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > maxBytes) throw new Error("Downloaded image is larger than the configured limit.");
  return { bytes, contentType };
}

async function completeJob(
  supabase: SupabaseRest,
  job: ImageJob,
  payload: {
    event: string;
    publicUrl: string;
    searchKeyword: string;
    selectedSource: string;
    storageKey: string | null;
  },
) {
  await supabase.patch("vehicle_image_jobs", {
    completed_at: now(),
    last_error: null,
    r2_key: payload.storageKey,
    r2_url: payload.publicUrl,
    search_keyword: payload.searchKeyword,
    selected_source: payload.selectedSource,
    status: "completed",
    updated_at: now(),
  }, { id: `eq.${job.id}` });

  await logImageEvent(supabase, job, payload.event, {
    database_status: "updated",
    search_keyword: payload.searchKeyword,
    selected_source: payload.selectedSource,
    upload_status: payload.storageKey ? "uploaded" : "existing",
  });
}

async function retryJob(
  env: Env,
  supabase: SupabaseRest,
  job: ImageJob,
  attempts: number,
  errorMessage: string,
  keyword: string,
) {
  const maxAttempts = numberEnv(env.MAX_ATTEMPTS, 5);
  const finalFailure = attempts >= maxAttempts;
  const nextAttempt = finalFailure ? null : new Date(Date.now() + backoffMs(attempts)).toISOString();
  const placeholder = env.PLACEHOLDER_IMAGE_URL ?? "/vehicle-placeholder.svg";

  await supabase.patch("vehicle_models", {
    image_error: errorMessage,
    image_status: finalFailure ? "failed" : "queued",
    image_url: placeholder,
    updated_at: now(),
  }, { id: `eq.${job.vehicle_model_id}` });

  await supabase.patch("vehicle_image_jobs", {
    last_error: errorMessage,
    next_attempt_at: nextAttempt,
    search_keyword: keyword,
    status: finalFailure ? "failed" : "retry_scheduled",
    updated_at: now(),
  }, { id: `eq.${job.id}` });

  await logImageEvent(supabase, job, finalFailure ? "image_failed" : "image_retry_scheduled", {
    database_status: finalFailure ? "failed" : "queued",
    details: { attempts, error: errorMessage, nextAttempt },
    search_keyword: keyword,
    upload_status: "not_uploaded",
  });
}

async function upsertImageCache(
  supabase: SupabaseRest,
  vehicleModelId: string,
  originalUrl: string,
  storageKey: string,
  publicUrl: string,
) {
  await supabase.post("vehicle_image_cache", {
    fetched_at: now(),
    original_url: originalUrl,
    provider: "cloudflare_r2",
    public_url: publicUrl,
    source_hash: await sha256Hex(`${vehicleModelId}:${originalUrl}:${storageKey}`),
    status: "cached",
    storage_key: storageKey,
    updated_at: now(),
    vehicle_model_id: vehicleModelId,
  }, "resolution=merge-duplicates", { on_conflict: "vehicle_model_id,provider" });
}

async function logImageEvent(
  supabase: SupabaseRest,
  job: ImageJob,
  event: string,
  payload: {
    database_status?: string;
    details?: Record<string, unknown>;
    search_keyword?: string;
    selected_source?: string;
    upload_status?: string;
  },
) {
  await supabase.post("vehicle_image_logs", {
    database_status: payload.database_status ?? null,
    details: payload.details ?? {},
    event,
    job_id: job.id,
    search_keyword: payload.search_keyword ?? null,
    selected_source: payload.selected_source ?? null,
    upload_status: payload.upload_status ?? null,
    vehicle_model_id: job.vehicle_model_id,
  });
}

class SupabaseRest {
  private readonly restUrl: string;
  private readonly headers: HeadersInit;

  constructor(env: Env) {
    this.restUrl = `${env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1`;
    this.headers = {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    };
  }

  async select<T>(table: string, params: Record<string, string>): Promise<T> {
    const url = new URL(`${this.restUrl}/${table}`);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    return await this.request<T>(url, { method: "GET" });
  }

  async patch<T = unknown>(table: string, body: unknown, filters: Record<string, string>): Promise<T> {
    const url = new URL(`${this.restUrl}/${table}`);
    for (const [key, value] of Object.entries(filters)) url.searchParams.set(key, value);
    return await this.request<T>(url, {
      body: JSON.stringify(body),
      headers: { Prefer: "return=minimal" },
      method: "PATCH",
    });
  }

  async post<T = unknown>(
    table: string,
    body: unknown,
    prefer = "return=minimal",
    params: Record<string, string> = {},
  ): Promise<T> {
    const url = new URL(`${this.restUrl}/${table}`);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    return await this.request<T>(url, {
      body: JSON.stringify(body),
      headers: { Prefer: prefer },
      method: "POST",
    });
  }

  async rpc<T = unknown>(name: string, body: unknown): Promise<T> {
    const url = new URL(`${this.restUrl}/rpc/${name}`);
    return await this.request<T>(url, {
      body: JSON.stringify(body),
      method: "POST",
    });
  }

  private async request<T>(url: URL, init: RequestInit): Promise<T> {
    const response = await fetch(url, {
      ...init,
      headers: {
        ...this.headers,
        ...(init.headers ?? {}),
      },
    });
    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Supabase REST failed: ${response.status} ${message}`);
    }
    if (response.status === 204) return undefined as T;
    const text = await response.text();
    if (!text) return undefined as T;
    return JSON.parse(text) as T;
  }
}

function requireServiceAuth(request: Request, env: Env) {
  const authorization = request.headers.get("Authorization") ?? "";
  const bearer = authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : "";
  if (!env.IMAGE_SERVICE_SECRET || bearer !== env.IMAGE_SERVICE_SECRET) {
    throw new Error("Unauthorized.");
  }
}

async function safeJson<T>(request: Request): Promise<T> {
  try {
    return await request.json() as T;
  } catch {
    return {} as T;
  }
}

function buildSearchKeyword(model: VehicleModel) {
  return [
    model.brand?.name,
    model.model_name,
    model.generation,
    model.body_type,
    "official press image",
  ].filter(Boolean).join(" ");
}

function hasUsableImage(model: VehicleModel, env: Env) {
  const imageUrl = model.image_url?.trim();
  if (!imageUrl) return false;
  if (imageUrl === (env.PLACEHOLDER_IMAGE_URL ?? "/vehicle-placeholder.svg")) return false;
  if (imageUrl.includes("vehicle-placeholder")) return false;
  return model.image_status === "cached" || model.image_status === "external";
}

function trustedSources(env: Env, brandName: string) {
  const configured = splitCsv(env.TRUSTED_IMAGE_SITES);
  const defaultSources = [
    "global.toyota",
    "toyota.com",
    "honda.com",
    "global.honda",
    "nissan-global.com",
    "mazda.com",
    "mitsubishi-motors.com",
    "subaru.com",
    "suzuki-global.com",
    "lexus.com",
    "bmw.com",
    "press.bmwgroup.com",
    "mercedes-benz.com",
    "media.mercedes-benz.com",
    "audi-mediacenter.com",
    "volkswagen-newsroom.com",
    "skoda-storyboard.com",
    "newsroom.porsche.com",
    "tesla.com",
    "tesla-cdn.thron.com",
    "bydglobal.com",
    "byd.com",
    "proton.com",
    "perodua.com.my",
    "hyundai.com",
    "worldwide.hyundai.com",
    "news.hyundai.com",
    "kia.com",
    "press.kia.com",
    "ford.com",
    "media.ford.com",
    "chevrolet.com",
    "media.gm.com",
    "stellantisnorthamerica.com",
    "media.stellantisnorthamerica.com",
    "volvocars.com",
    "media.volvocars.com",
    "media.jaguarlandrover.com",
    "landrover.com",
    "jaguar.com",
    "media.landrover.com",
    "media.jaguar.com",
    "press.rolls-roycemotorcars.com",
    "bentleymedia.com",
    "media.ferrari.com",
    "lamborghini.com",
    "cars.mclaren.press",
    "press.mini.com",
    "mini.com",
    "peugeot.com",
    "media.stellantis.com",
    "renault.com",
    "media.renault.com",
    "cheryinternational.com",
    "gwm-global.com",
    "haval-global.com",
    "jaecoo.com",
    "jaecoo.com.my",
    "mgmotor.com",
    "mg.co.uk",
  ];
  const preferred = defaultSources.filter((source) => source.includes(slugBrand(brandName)));
  return unique([...configured, ...preferred, ...defaultSources]);
}

function isTrustedUrl(value: string, source: string) {
  try {
    const host = new URL(value).hostname.toLowerCase();
    const normalized = source.toLowerCase();
    return host === normalized || host.endsWith(`.${normalized}`);
  } catch {
    return false;
  }
}

function buildR2Key(model: VehicleModel, imageUrl: string, contentType: string) {
  const extension = contentType.includes("png")
    ? "png"
    : contentType.includes("webp")
      ? "webp"
      : "jpg";
  const sourceHash = shortHash(imageUrl);
  return `vehicles/${safeSlug(model.brand?.name ?? "unknown")}/${safeSlug(model.model_name)}-${model.id}-${sourceHash}.${extension}`;
}

function sourceHost(value: string) {
  try {
    return new URL(value).hostname;
  } catch {
    return "";
  }
}

function backoffMs(attempts: number) {
  return Math.min(7 * 24 * 60 * 60 * 1000, 60 * 60 * 1000 * (2 ** Math.max(0, attempts - 1)));
}

async function sha256Hex(input: string) {
  const data = new TextEncoder().encode(input);
  const bytes = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  return toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)));
}

function shortHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function toHex(bytes: Uint8Array) {
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function safeSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "vehicle";
}

function slugBrand(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function splitCsv(value: string | undefined) {
  return (value ?? "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function numberEnv(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function now() {
  return new Date().toISOString();
}

function json(body: unknown, status = 200) {
  return Response.json(body, { headers: corsHeaders, status });
}
