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

export async function GET() {
  const supabase = createSupabaseServerClient();

  if (!supabase) {
    return Response.json(demoWarrantyPayload(), { status: 200 });
  }

  const [warranties, warrantyClaims] = await Promise.all([
    supabase.from("warranties").select("*").order("created_at", { ascending: false }),
    supabase.from("warranty_claims").select("*").order("submitted_at", { ascending: false }),
  ]);

  if (warranties.error || warrantyClaims.error) {
    return Response.json(demoWarrantyPayload(), { status: 200 });
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

  const supabase = createSupabaseServerClient();
  if (!supabase) {
    return Response.json({ ok: true, source: "demo-fallback", ...fallbackActionResult(body) }, { status: 200 });
  }

  if (body.action === "complete_order_create_warranty") {
    const warranty = buildWarrantyInsert(body);
    const { data, error } = await supabase.from("warranties").upsert(warranty, { onConflict: "id" }).select().single();
    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
    return Response.json({ ok: true, source: "supabase", warranty: data }, { status: 200 });
  }

  if (body.action === "submit_claim" && body.claim) {
    const { data, error } = await supabase.from("warranty_claims").upsert(mapClaimInsert(body.claim), { onConflict: "id" }).select().single();
    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
    return Response.json({ ok: true, claim: data, source: "supabase" }, { status: 200 });
  }

  if (body.action === "supplier_decision" && body.claimId && body.status) {
    const { data, error } = await supabase
      .from("warranty_claims")
      .update({ reviewed_at: new Date().toISOString(), status: body.status })
      .eq("id", body.claimId)
      .select()
      .single();
    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
    return Response.json({ ok: true, claim: data, source: "supabase" }, { status: 200 });
  }

  if (body.action === "workshop_update" && body.claimId && body.status) {
    const { data, error } = await supabase
      .from("warranty_claims")
      .update({ inspection_status: body.status })
      .eq("id", body.claimId)
      .select()
      .single();
    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
    return Response.json({ ok: true, claim: data, source: "supabase" }, { status: 200 });
  }

  return Response.json({ ok: false, error: "Unsupported warranty action" }, { status: 400 });
}

function buildWarrantyInsert(body: WarrantyPayload) {
  return {
    customer_id: "00000000-0000-0000-0000-000000000101",
    customer_name: "Daniel Tan",
    duration_months: 6,
    expiry_date: "2027-01-19",
    id: body.warrantyId ?? "WRNT-08471-001",
    invoice_id: "invoice-08471",
    invoice_number: "INV-08471",
    mileage_limit: 10000,
    order_id: body.orderId ?? "order-08471",
    part_brand: "Bendix",
    part_id: "bendix-front-brake",
    part_name: "Brake pad set front",
    repair_date: "2026-07-19",
    start_date: "2026-07-19",
    status: "Active",
    supplier_id: "supplier-partshub",
    supplier_name: "PartsHub Trading Sdn Bhd",
    vehicle_id: "vios",
    vehicle_label: "Toyota Vios 1.5G - WXY 4321",
    warranty_terms: [
      "Valid only for ManFix orders.",
      "A certified workshop inspection is required before claim approval.",
      "Outside repair voids platform-backed coverage.",
    ],
    workshop_id: "workshop-autofix",
    workshop_name: "AutoFix Pro",
  };
}

function mapClaimInsert(claim: Record<string, unknown>) {
  return {
    customer_id: "00000000-0000-0000-0000-000000000101",
    description: String(claim.description ?? ""),
    id: String(claim.id ?? `claim-${Date.now()}`),
    photos: Array.isArray(claim.photos) ? claim.photos : [],
    status: String(claim.status ?? "Pending Review"),
    submitted_at: new Date().toISOString(),
    videos: Array.isArray(claim.videos) ? claim.videos : [],
    warranty_id: String(claim.warrantyId ?? "WRNT-08471-001"),
  };
}

function fallbackActionResult(body: WarrantyPayload) {
  if (body.action === "complete_order_create_warranty") {
    return { warranty: buildWarrantyInsert(body) };
  }

  if (body.action === "submit_claim") {
    return { claim: body.claim };
  }

  return { action: body.action, status: body.status };
}

function demoWarrantyPayload() {
  return {
    source: "demo-fallback",
    warrantyClaims: [],
    warranties: [],
  };
}
