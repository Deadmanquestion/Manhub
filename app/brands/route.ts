import { createSupabaseServerClient } from "@/lib/supabase/server";

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function GET() {
  const supabase = createSupabaseServerClient();
  if (!supabase) return vehicleJson({ error: "Vehicle service is not configured." }, 503);

  const { data, error } = await supabase
    .from("brands")
    .select("id,name,logo_url,country,synced_at,discontinued_at")
    .is("discontinued_at", null)
    .order("name");

  if (error) return vehicleJson({ error: error.message }, 500);
  return vehicleJson({ brands: data ?? [] });
}

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

function vehicleJson(body: unknown, status = 200) {
  return Response.json(body, { headers: corsHeaders, status });
}
