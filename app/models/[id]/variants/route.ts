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
    .from("vehicle_variants")
    .select("id,vehicle_model_id,year,engine,displacement,fuel,transmission,drivetrain,horsepower,torque,tyre_size,engine_oil_capacity,transmission_oil_capacity,coolant_capacity,synced_at,discontinued_at")
    .eq("vehicle_model_id", id)
    .is("discontinued_at", null)
    .order("year", { ascending: false });

  if (error) return vehicleJson({ error: error.message }, 500);
  return vehicleJson({ variants: data ?? [] });
}

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

function vehicleJson(body: unknown, status = 200) {
  return Response.json(body, { headers: corsHeaders, status });
}
