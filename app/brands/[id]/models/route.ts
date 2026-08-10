import { createSupabaseServiceClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = createSupabaseServiceClient();
  if (!supabase) return vehicleJson({ error: "Vehicle service is not configured." }, 503);

  const { data, error } = await supabase
    .from("vehicle_models")
    .select("id,brand_id,model_name,generation,body_type,image_url,image_source_url,image_status,synced_at,discontinued_at")
    .eq("brand_id", id)
    .is("discontinued_at", null)
    .order("model_name");

  if (error) return vehicleJson({ error: error.message }, 500);
  return vehicleJson({ models: data ?? [] });
}

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

function vehicleJson(body: unknown, status = 200) {
  return Response.json(body, { headers: corsHeaders, status });
}
