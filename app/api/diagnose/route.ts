type DiagnoseRequest = {
  symptom?: string;
  userVehicleId?: string;
  vehicleModelId?: string;
};

type DiagnosisResult = {
  confidence: number;
  diagnosis: string;
  estimated_cost_range: string;
  possible_causes: string[];
  recommended_actions: string[];
  recommended_parts: string[];
};

const diagnosisSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    diagnosis: { type: "string" },
    confidence: { type: "number" },
    possible_causes: {
      type: "array",
      items: { type: "string" },
    },
    recommended_actions: {
      type: "array",
      items: { type: "string" },
    },
    recommended_parts: {
      type: "array",
      items: { type: "string" },
    },
    estimated_cost_range: { type: "string" },
  },
  required: [
    "diagnosis",
    "confidence",
    "possible_causes",
    "recommended_actions",
    "recommended_parts",
    "estimated_cost_range",
  ],
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: Request) {
  const accessToken = getAccessToken(request);
  if (!accessToken) return json({ error: "Authentication required." }, 401);
  const supabase = createSupabaseServerClient(accessToken);
  if (!supabase) return json({ error: "AI diagnosis is not configured." }, 503);
  const { error: authError } = await supabase.auth.getUser(accessToken);
  if (authError) return json({ error: "Authentication required." }, 401);

  let body: DiagnoseRequest;

  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid diagnosis request." }, 400);
  }

  if (!body.symptom?.trim() || !body.userVehicleId?.trim() || !body.vehicleModelId?.trim()) {
    return json(
      { error: "Symptom and a saved vehicle are required." },
      400,
    );
  }

  const { data: vehicle, error: vehicleError } = await supabase
    .from("user_vehicles")
    .select(`
      mileage,vehicle_model_id,
      vehicle_model:vehicle_models!user_vehicles_vehicle_model_id_fkey(
        model_name,year,engine,fuel,transmission,horsepower,torque_nm,
        brand:brands!vehicle_models_brand_id_fkey(name)
      )
    `)
    .eq("id", body.userVehicleId)
    .eq("vehicle_model_id", body.vehicleModelId)
    .single();
  if (vehicleError || !vehicle) {
    return json({ error: "The selected vehicle could not be verified." }, 404);
  }
  const model = vehicle.vehicle_model as unknown as {
    brand: { name: string };
    engine: string;
    fuel: string;
    horsepower: number | null;
    model_name: string;
    torque_nm: number | null;
    transmission: string;
    year: number;
  };

  const apiKey = getApiKey();
  if (!apiKey) {
    return json(
      { error: "AI diagnosis is not configured." },
      503,
    );
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: getModel(),
        input: [
          {
            role: "system",
            content:
              "You are ManFix's automotive triage assistant. Return cautious customer-facing vehicle pre-diagnosis JSON only. Do not claim certainty. Always recommend technician confirmation before quote.",
          },
          {
            role: "user",
            content: JSON.stringify({
              vehicle_model_id: body.vehicleModelId,
              vehicle: `${model.brand.name} ${model.model_name} ${model.year}`,
              engine: model.engine,
              fuel: model.fuel,
              transmission: model.transmission,
              horsepower: model.horsepower,
              torque_nm: model.torque_nm,
              mileage_km: vehicle.mileage,
              symptom: body.symptom ?? "No symptom provided",
            }),
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "manfix_car_diagnosis",
            strict: true,
            schema: diagnosisSchema,
          },
        },
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error("OpenAI diagnosis request failed", response.status, detail);
      return json(
        { error: "AI diagnosis is temporarily unavailable." },
        502,
      );
    }

    const payload = await response.json();
    const outputText = extractOutputText(payload);
    const parsed = JSON.parse(outputText) as DiagnosisResult;

    return json(normalizeDiagnosis(parsed), 200);
  } catch (error) {
    console.error("AI diagnosis failed", error);
    return json(
      { error: "AI diagnosis is temporarily unavailable." },
      502,
    );
  }
}

function getApiKey() {
  return typeof process !== "undefined" ? process.env.OPENAI_API_KEY : undefined;
}

function getModel() {
  return typeof process !== "undefined" && process.env.OPENAI_MODEL
    ? process.env.OPENAI_MODEL
    : "gpt-4.1-mini";
}

type OpenAiResponsePayload = {
  output?: Array<{
    content?: Array<{
      text?: unknown;
    }>;
  }>;
  output_text?: unknown;
};

function extractOutputText(payload: OpenAiResponsePayload) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text;
  }

  for (const item of payload.output ?? []) {
    for (const content of item.content ?? []) {
      if (typeof content.text === "string" && content.text.trim()) {
        return content.text;
      }
    }
  }

  throw new Error("No diagnosis output text returned");
}

function normalizeDiagnosis(result: DiagnosisResult): DiagnosisResult {
  if (
    !result.diagnosis?.trim()
    || !result.estimated_cost_range?.trim()
    || !isNonEmptyList(result.possible_causes)
    || !isNonEmptyList(result.recommended_actions)
    || !isNonEmptyList(result.recommended_parts)
  ) {
    throw new Error("AI diagnosis response did not match the required schema");
  }

  return {
    confidence: clampConfidence(result.confidence),
    diagnosis: result.diagnosis.trim(),
    estimated_cost_range: result.estimated_cost_range.trim(),
    possible_causes: result.possible_causes.map((value) => value.trim()).filter(Boolean),
    recommended_actions: result.recommended_actions.map((value) => value.trim()).filter(Boolean),
    recommended_parts: result.recommended_parts.map((value) => value.trim()).filter(Boolean),
  };
}

function clampConfidence(value: number) {
  if (!Number.isFinite(value)) throw new Error("AI diagnosis confidence is invalid");
  return Math.max(0, Math.min(100, Math.round(value)));
}

function isNonEmptyList(value: string[] | undefined): value is string[] {
  return Array.isArray(value) && value.some((item) => typeof item === "string" && item.trim());
}

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

function json(body: unknown, status: number) {
  return Response.json(body, { status, headers: corsHeaders });
}

function getAccessToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : null;
}
import { createSupabaseServerClient } from "@/lib/supabase/server";
