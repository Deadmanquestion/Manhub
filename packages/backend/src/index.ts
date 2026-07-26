import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ManHubRole = "customer" | "supplier" | "workshop" | "admin";

export type ManHubProfile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: ManHubRole;
  status: string;
};

export type PortalRoute = {
  label: string;
  path: string;
};

export type MetricQuery = {
  label: string;
  table: string;
  type: "count" | "sum";
  column?: string;
  filter?: Record<string, string | number | boolean>;
};

export type SupplierProduct = {
  active: boolean;
  brand: string;
  category: string;
  cost_price: number;
  created_at: string;
  description: string | null;
  id: string;
  image_url: string | null;
  incoming_stock: number;
  low_stock_threshold: number;
  name: string;
  selling_price: number;
  sku: string | null;
  stock: number;
  supplier_id: string;
  updated_at: string;
  warranty_duration_months: number;
};

export type SupplierProductInput = {
  active: boolean;
  brand: string;
  category: string;
  cost_price: number;
  description: string | null;
  image_url?: string | null;
  incoming_stock: number;
  low_stock_threshold: number;
  name: string;
  selling_price: number;
  sku: string | null;
  stock: number;
  warranty_duration_months: number;
};

export type SupplierOrder = {
  amount: number;
  cost_total: number;
  created_at: string;
  customer: string;
  id: string;
  invoice_number: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  status: "New" | "Confirmed" | "Dispatched" | "Delivered" | "Cancelled";
  supplier_id: string;
  workshop: string;
};

export type SupplierStockHistory = {
  change_type: "Sale" | "Incoming" | "Adjustment";
  created_at: string;
  id: string;
  note: string | null;
  product_id: string | null;
  product_name: string;
  quantity: number;
  supplier_id: string;
};

export type SupplierWallet = {
  available_balance: number;
  currency: string;
  pending_balance: number;
  supplier_id: string;
  updated_at: string;
};

export type SupplierWithdrawal = {
  account_number: string;
  amount: number;
  bank: string;
  created_at: string;
  id: string;
  reviewed_at: string | null;
  status: "Pending" | "Approved" | "Rejected" | "Paid";
  supplier_id: string;
};

export type SupplierInvoice = {
  commission_amount: number;
  id: string;
  invoice_number: string;
  issued_at: string;
  order_id: string | null;
  paid_amount: number;
  parts_subtotal: number;
  pdf_url: string | null;
  status: "Pending" | "Paid" | "Refunded" | "Escrow";
  supplier_id: string;
  total: number;
};

export type SupplierWarrantyClaim = {
  description: string;
  id: string;
  photos: string[];
  reviewed_at: string | null;
  status: "Pending Review" | "Approved" | "Rejected" | "Inspection Requested";
  submitted_at: string;
  supplier_id: string | null;
  videos: string[];
  warranty_id: string;
};

export type ProductCategory = {
  id: string;
  name: string;
};

export const portalHomeByRole: Record<ManHubRole, string> = {
  admin: "/admin",
  customer: "/",
  supplier: "/supplier",
  workshop: "/workshop",
};

export const portalHostByRole: Record<ManHubRole, string> = {
  admin: "admin.manhub.my",
  customer: "app.manhub.my",
  supplier: "supplier.manhub.my",
  workshop: "workshop.manhub.my",
};

const localPortalUrlByRole: Record<ManHubRole, string> = {
  admin: "http://localhost:4103",
  customer: "http://localhost:4100",
  supplier: "http://localhost:4101",
  workshop: "http://localhost:4102",
};

const MANHUB_AUTH_COOKIE_NAME = "manhub-auth";
const MANHUB_PRODUCTION_DOMAIN = "manhub.my";

export function isManHubProductionHost(hostname: string) {
  const normalizedHostname = hostname.toLowerCase();
  return normalizedHostname === MANHUB_PRODUCTION_DOMAIN
    || normalizedHostname.endsWith(`.${MANHUB_PRODUCTION_DOMAIN}`);
}

export function canShareManHubSession(sourceUrl: string, destinationUrl: string) {
  try {
    const source = new URL(sourceUrl);
    const destination = new URL(destinationUrl);

    return source.hostname === destination.hostname
      || (isManHubProductionHost(source.hostname) && isManHubProductionHost(destination.hostname));
  } catch {
    return false;
  }
}

export function createManHubSupabaseClient() {
  const url = import.meta.env.VITE_SUPABASE_URL ?? import.meta.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
    ?? import.meta.env.VITE_SUPABASE_ANON_KEY
    ?? import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ?? import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return null;
  }

  const hostname = typeof window === "undefined" ? "" : window.location.hostname;
  const productionHost = isManHubProductionHost(hostname);

  return createBrowserClient(url, key, {
    cookieOptions: {
      name: MANHUB_AUTH_COOKIE_NAME,
      path: "/",
      sameSite: "lax",
      secure: productionHost || hostname !== "localhost",
      ...(productionHost ? { domain: `.${MANHUB_PRODUCTION_DOMAIN}` } : {}),
    },
  });
}

export async function getSessionRole(supabase: SupabaseClient): Promise<ManHubRole | null> {
  const profile = await getSessionProfile(supabase);
  return profile?.role ?? null;
}

export async function getSessionProfile(supabase: SupabaseClient): Promise<ManHubProfile | null> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id,email,full_name,role,status")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (error || !data || !isManHubRole(data.role)) {
    return null;
  }

  return data as ManHubProfile;
}

export async function routeAfterLogin(supabase: SupabaseClient, nextUrl?: string | null) {
  const role = await getSessionRole(supabase);
  if (!role) return getUnauthorizedUrl("missing-profile");

  if (nextUrl) {
    const requestedRole = getPortalRoleForUrl(nextUrl);
    if (!requestedRole || requestedRole === role) {
      return nextUrl;
    }
    return getUnauthorizedUrl("wrong-role");
  }

  return getPortalDestination(role);
}

export function canOpenPortal(role: ManHubRole | null, portalRole: ManHubRole) {
  return role === portalRole;
}

export function isProfileEnabled(profile: ManHubProfile | null) {
  if (!profile) return false;
  return ["Active", "Approved", "Verified"].includes(profile.status);
}

export function getAuthAppUrl() {
  return import.meta.env.VITE_MANHUB_AUTH_URL ?? "http://localhost:4104";
}

export function getUnauthorizedUrl(reason = "role") {
  const url = new URL("/unauthorized", getAuthAppUrl());
  url.searchParams.set("reason", reason);
  return url.toString();
}

export function getLoginUrl(nextUrl?: string) {
  const url = new URL("/login", getAuthAppUrl());
  if (nextUrl) url.searchParams.set("next", nextUrl);
  return url.toString();
}

export function getPortalDestination(role: ManHubRole) {
  const configured = {
    admin: import.meta.env.VITE_MANHUB_ADMIN_URL,
    customer: import.meta.env.VITE_MANHUB_CUSTOMER_URL,
    supplier: import.meta.env.VITE_MANHUB_SUPPLIER_URL,
    workshop: import.meta.env.VITE_MANHUB_WORKSHOP_URL,
  } satisfies Partial<Record<ManHubRole, string | undefined>>;

  return configured[role] ?? localPortalUrlByRole[role];
}

export function getPortalRoleForUrl(value: string): ManHubRole | null {
  try {
    const fallbackOrigin = typeof window === "undefined" ? "http://localhost" : window.location.origin;
    const url = new URL(value, fallbackOrigin);
    const host = url.hostname.toLowerCase();
    const port = url.port;
    const firstPath = url.pathname.split("/").filter(Boolean)[0]?.toLowerCase();

    if (firstPath === "admin" || host.startsWith("admin.") || port === "4103") return "admin";
    if (firstPath === "supplier" || host.startsWith("supplier.") || port === "4101") return "supplier";
    if (firstPath === "workshop" || host.startsWith("workshop.") || port === "4102") return "workshop";
    if (firstPath === "app" || host.startsWith("app.") || port === "4100") return "customer";
    return null;
  } catch {
    return null;
  }
}

export async function upsertCustomerProfile(supabase: SupabaseClient, fullName: string) {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Customer account was created. Please confirm your email before signing in.");

  const { error } = await supabase.from("profiles").upsert({
    email: data.user.email ?? null,
    full_name: fullName,
    id: data.user.id,
    role: "customer",
    status: "Active",
  });

  if (error) throw error;
}

export async function fetchRows<T>(supabase: SupabaseClient, table: string, select = "*") {
  const { data, error } = await supabase.from(table).select(select);
  if (error) throw error;
  return (data ?? []) as T[];
}

export async function updateStatus(supabase: SupabaseClient, table: string, id: string, status: string) {
  const { error } = await supabase.from(table).update({ status }).eq("id", id);
  if (error) throw error;
}

export async function insertRow<T extends Record<string, unknown>>(supabase: SupabaseClient, table: string, values: T) {
  const { data, error } = await supabase.from(table).insert(values).select().single();
  if (error) throw error;
  return data as T;
}

export async function deleteRow(supabase: SupabaseClient, table: string, id: string) {
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) throw error;
}

export async function listSupplierProducts(supabase: SupabaseClient) {
  return fetchRows<SupplierProduct>(supabase, "supplier_products");
}

export async function saveSupplierProduct(supabase: SupabaseClient, values: SupplierProductInput, id?: string) {
  if (id) {
    const { data, error } = await supabase
      .from("supplier_products")
      .update(values)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as SupplierProduct;
  }

  const { data, error } = await supabase
    .from("supplier_products")
    .insert(values)
    .select()
    .single();
  if (error) throw error;
  return data as SupplierProduct;
}

export async function deleteSupplierProduct(supabase: SupabaseClient, id: string) {
  await deleteRow(supabase, "supplier_products", id);
}

export async function uploadSupplierProductImage(supabase: SupabaseClient, productId: string, file: File) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error("Sign in is required before uploading product images.");

  const extension = file.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() || "jpg";
  const path = `${userData.user.id}/${productId}/${Date.now()}.${extension}`;
  const { error } = await supabase.storage
    .from("supplier-product-images")
    .upload(path, file, { contentType: file.type || "image/jpeg", upsert: true });
  if (error) throw error;

  const { data } = supabase.storage.from("supplier-product-images").getPublicUrl(path);
  const imageUrl = data.publicUrl;
  const { error: updateError } = await supabase.from("supplier_products").update({ image_url: imageUrl }).eq("id", productId);
  if (updateError) throw updateError;
  return imageUrl;
}

export async function listProductCategories(supabase: SupabaseClient) {
  return fetchRows<ProductCategory>(supabase, "product_categories");
}

export async function listSupplierOrders(supabase: SupabaseClient) {
  return fetchRows<SupplierOrder>(supabase, "supplier_orders");
}

export async function setSupplierOrderStatus(supabase: SupabaseClient, orderId: string, status: SupplierOrder["status"]) {
  const { error } = await supabase.rpc("manhub_supplier_update_order_status", {
    next_status: status,
    target_order_id: orderId,
  });
  if (error) throw error;
}

export async function listSupplierStockHistory(supabase: SupabaseClient) {
  return fetchRows<SupplierStockHistory>(supabase, "supplier_stock_history");
}

export async function adjustSupplierStock(
  supabase: SupabaseClient,
  productId: string,
  movementType: SupplierStockHistory["change_type"],
  quantity: number,
  note: string,
) {
  const { error } = await supabase.rpc("manhub_supplier_adjust_stock", {
    movement_note: note || null,
    movement_quantity: quantity,
    movement_type: movementType,
    target_product_id: productId,
  });
  if (error) throw error;
}

export async function getSupplierWallet(supabase: SupabaseClient) {
  const { data, error } = await supabase.from("supplier_wallets").select("*").maybeSingle();
  if (error) throw error;
  return data as SupplierWallet | null;
}

export async function listSupplierWithdrawals(supabase: SupabaseClient) {
  return fetchRows<SupplierWithdrawal>(supabase, "supplier_withdrawals");
}

export async function submitSupplierWithdrawal(supabase: SupabaseClient, amount: number, bank: string, accountNumber: string) {
  const { data, error } = await supabase.rpc("manhub_supplier_submit_withdrawal", {
    requested_account_number: accountNumber,
    requested_amount: amount,
    requested_bank: bank,
  });
  if (error) throw error;
  return data as string;
}

export async function listSupplierInvoices(supabase: SupabaseClient) {
  return fetchRows<SupplierInvoice>(supabase, "supplier_invoices");
}

export async function listSupplierWarrantyClaims(supabase: SupabaseClient) {
  return fetchRows<SupplierWarrantyClaim>(supabase, "warranty_claims");
}

export async function reviewSupplierWarrantyClaim(
  supabase: SupabaseClient,
  claimId: string,
  status: Exclude<SupplierWarrantyClaim["status"], "Pending Review">,
) {
  const { error } = await supabase.rpc("manhub_supplier_review_warranty_claim", {
    next_status: status,
    target_claim_id: claimId,
  });
  if (error) throw error;
}

export async function resolveMetric(supabase: SupabaseClient, metric: MetricQuery) {
  let query = supabase.from(metric.table).select(metric.column ?? "id", {
    count: metric.type === "count" ? "exact" : undefined,
    head: metric.type === "count",
  });

  Object.entries(metric.filter ?? {}).forEach(([key, value]) => {
    query = query.eq(key, value);
  });

  const { count, data, error } = await query;
  if (error) throw error;

  if (metric.type === "count") {
    return count ?? 0;
  }

  const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
  return rows.reduce((sum, row) => sum + Number(row[metric.column ?? "amount"] ?? 0), 0);
}

function isManHubRole(role: unknown): role is ManHubRole {
  return role === "customer" || role === "supplier" || role === "workshop" || role === "admin";
}
