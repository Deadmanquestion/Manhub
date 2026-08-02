import { createSupabaseServerClient } from "@/lib/supabase/server";

type WarrantyAction =
  | "complete_order_create_warranty"
  | "submit_claim"
  | "supplier_decision"
  | "workshop_update";

type WarrantyPayload = {
  action?: WarrantyAction;
  claim?: Record<string, unknown>;
  claimId?: string;
  orderId?: string;
  status?: string;
  warrantyId?: string;
};

export async function GET(request: Request) {
  const accessToken = getAccessToken(request);
  if (!accessToken) return Response.json({ error: "Authentication required." }, { status: 401 });
  const supabase = createSupabaseServerClient(accessToken);

  if (!supabase) {
    return Response.json({ error: "Warranty service is not configured." }, { status: 503 });
  }

  const { error: authError } = await supabase.auth.getUser(accessToken);
  if (authError) return Response.json({ error: "Authentication required." }, { status: 401 });

  const [warranties, warrantyClaims] = await Promise.all([
    supabase.from("warranties").select("*").order("created_at", { ascending: false }),
    supabase.from("warranty_claims").select("*").order("submitted_at", { ascending: false }),
  ]);

  if (warranties.error || warrantyClaims.error) {
    return Response.json(
      { error: warranties.error?.message ?? warrantyClaims.error?.message },
      { status: 500 },
    );
  }

  return Response.json({
    source: "supabase",
    warrantyClaims: warrantyClaims.data,
    warranties: warranties.data,
  }, { status: 200 });
}

export async function POST(request: Request) {
  let body: WarrantyPayload;

  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid warranty request" }, { status: 400 });
  }

  const accessToken = getAccessToken(request);
  if (!accessToken) return Response.json({ ok: false, error: "Authentication required." }, { status: 401 });
  const supabase = createSupabaseServerClient(accessToken);
  if (!supabase) {
    return Response.json({ ok: false, error: "Warranty service is not configured." }, { status: 503 });
  }

  const { data: userData, error: authError } = await supabase.auth.getUser(accessToken);
  if (authError || !userData.user) {
    return Response.json({ ok: false, error: "Authentication required." }, { status: 401 });
  }

  if (body.action === "complete_order_create_warranty") {
    if (!body.orderId) {
      return Response.json({ ok: false, error: "Order ID is required." }, { status: 400 });
    }

    const { data, error } = await supabase.from("warranties").select("*").eq("order_id", body.orderId);
    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
    return Response.json({ ok: true, source: "supabase", warranties: data }, { status: 200 });
  }

  if (body.action === "submit_claim" && body.claim) {
    const warrantyId = String(body.claim.warranty_id ?? body.claim.warrantyId ?? body.warrantyId ?? "").trim();
    const description = String(body.claim.description ?? "").trim();
    if (!warrantyId || !description) {
      return Response.json({ ok: false, error: "Warranty and problem description are required." }, { status: 400 });
    }
    const { data, error } = await supabase.from("warranty_claims").insert({
      customer_id: userData.user.id,
      description,
      photos: toStringArray(body.claim.photos),
      status: "Pending Review",
      videos: toStringArray(body.claim.videos),
      warranty_id: warrantyId,
    }).select().single();
    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
    return Response.json({ ok: true, claim: data, source: "supabase" }, { status: 200 });
  }

  if (body.action === "supplier_decision" && body.claimId && body.status) {
    const { error } = await supabase.rpc("manhub_supplier_review_warranty_claim", {
      next_status: body.status,
      target_claim_id: body.claimId,
    });
    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
    return Response.json({ ok: true, source: "supabase" }, { status: 200 });
  }

  if (body.action === "workshop_update" && body.claimId && body.status) {
    const { error } = await supabase.rpc("manfix_workshop_update_warranty_claim", {
      next_inspection_status: body.status,
      report_text: null,
      target_claim_id: body.claimId,
    });
    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
    return Response.json({ ok: true, source: "supabase" }, { status: 200 });
  }

  return Response.json({ ok: false, error: "Unsupported warranty action" }, { status: 400 });
}

function getAccessToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : null;
}

function toStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}
