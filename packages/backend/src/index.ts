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

export type WorkshopBooking = {
  booking_kind: "service" | "lift";
  estimated_price: number;
  id: string;
  payment_status: string;
  scheduled_at: string;
  status: "pending" | "approved" | "rejected" | "cancelled" | "completed";
  symptom: string;
  vehicle_label: string;
};

export type RepairJob = {
  booking_kind: "service" | "lift";
  created_at: string;
  customer_name: string;
  diagnosis: string;
  id: string;
  scheduled_at: string;
  status: "queued" | "in_progress" | "ready" | "completed";
  technician_name: string | null;
  vehicle_label: string;
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
  commission_amount: number;
  commission_rate: number;
  cost_total: number;
  created_at: string;
  customer: string;
  id: string;
  invoice_number: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  settled_at: string | null;
  status: "New" | "Confirmed" | "Dispatched" | "Delivered" | "Cancelled";
  supplier_net_amount: number;
  supplier_id: string;
  workshop: string;
};

export type SupplierStockHistory = {
  change_type: "Opening" | "Sale" | "Incoming" | "Adjustment";
  created_at: string;
  id: string;
  note: string | null;
  order_id: string | null;
  product_id: string | null;
  product_name: string;
  quantity: number;
  supplier_id: string;
};

export type SupplierCommission = {
  commission_amount: number;
  commission_rate: number;
  created_at: string;
  gross_amount: number;
  id: string;
  invoice_number: string;
  order_id: string;
  settled_at: string | null;
  status: "Pending" | "Settled" | "Reversed";
  supplier_id: string;
  supplier_name: string;
  supplier_net_amount: number;
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
  commission_rate: number;
  id: string;
  invoice_number: string;
  issued_at: string;
  order_id: string | null;
  paid_amount: number;
  parts_subtotal: number;
  pdf_url: string | null;
  status: "Pending" | "Paid" | "Refunded" | "Escrow";
  supplier_id: string;
  supplier_net_amount: number;
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
  admin: "admin.manfix.my",
  customer: "app.manfix.my",
  supplier: "supplier.manfix.my",
  workshop: "workshop.manfix.my",
};

const localPortalUrlByRole: Record<ManHubRole, string> = {
  admin: "http://localhost:4103",
  customer: "http://localhost:4100",
  supplier: "http://localhost:4101",
  workshop: "http://localhost:4102",
};

const renderPortalUrlByRole: Partial<Record<ManHubRole, string>> = {
  customer: "https://manhub-customer.onrender.com",
  workshop: "https://manhub-workshop.onrender.com",
};

const portalAliasesByRole: Partial<Record<ManHubRole, string[]>> = {
  workshop: [
    "http://localhost:4105",
    "https://manfix-technician.onrender.com",
    "https://manfix-tech.onrender.com",
    "https://tech.manfix.my",
    "https://workshop.manfix.my",
  ],
};

const MANFIX_AUTH_COOKIE_NAME = "manfix-auth";
const MANFIX_PRODUCTION_DOMAIN = "manfix.my";
const MANFIX_HANDOFF_ACCESS_TOKEN = "manfix_access_token";
const MANFIX_HANDOFF_REFRESH_TOKEN = "manfix_refresh_token";

export function isManHubProductionHost(hostname: string) {
  const normalizedHostname = hostname.toLowerCase();
  return normalizedHostname === MANFIX_PRODUCTION_DOMAIN
    || normalizedHostname.endsWith(`.${MANFIX_PRODUCTION_DOMAIN}`);
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

export function createManFixSessionHandoffUrl(
  destinationUrl: string,
  accessToken: string,
  refreshToken: string,
) {
  if (!getPortalRoleForUrl(destinationUrl)) {
    throw new Error("The requested ManFix portal is not trusted.");
  }

  const url = new URL(destinationUrl);
  const fragment = new URLSearchParams(url.hash.slice(1));
  fragment.set(MANFIX_HANDOFF_ACCESS_TOKEN, accessToken);
  fragment.set(MANFIX_HANDOFF_REFRESH_TOKEN, refreshToken);
  url.hash = fragment.toString();
  return url.toString();
}

export function readManFixSessionHandoff(value: string) {
  try {
    const url = new URL(value);
    const fragment = new URLSearchParams(url.hash.slice(1));
    const accessToken = fragment.get(MANFIX_HANDOFF_ACCESS_TOKEN);
    const refreshToken = fragment.get(MANFIX_HANDOFF_REFRESH_TOKEN);

    if (!accessToken || !refreshToken) return null;
    return { accessToken, refreshToken };
  } catch {
    return null;
  }
}

export function removeManFixSessionHandoff(value: string) {
  const url = new URL(value);
  const fragment = new URLSearchParams(url.hash.slice(1));
  fragment.delete(MANFIX_HANDOFF_ACCESS_TOKEN);
  fragment.delete(MANFIX_HANDOFF_REFRESH_TOKEN);
  url.hash = fragment.toString();
  return url.toString();
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
      name: MANFIX_AUTH_COOKIE_NAME,
      path: "/",
      sameSite: "lax",
      secure: productionHost || hostname !== "localhost",
      ...(productionHost ? { domain: `.${MANFIX_PRODUCTION_DOMAIN}` } : {}),
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
    if (requestedRole === role) {
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
  return import.meta.env.VITE_MANFIX_AUTH_URL
    ?? import.meta.env.VITE_MANHUB_AUTH_URL
    ?? "http://localhost:4104";
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

export function getLogoutUrl() {
  return new URL("/logout", getAuthAppUrl()).toString();
}

export function getPortalDestination(role: ManHubRole) {
  const configured = {
    admin: import.meta.env.VITE_MANFIX_ADMIN_URL ?? import.meta.env.VITE_MANHUB_ADMIN_URL,
    customer: import.meta.env.VITE_MANFIX_CUSTOMER_URL ?? import.meta.env.VITE_MANHUB_CUSTOMER_URL,
    supplier: import.meta.env.VITE_MANFIX_SUPPLIER_URL ?? import.meta.env.VITE_MANHUB_SUPPLIER_URL,
    workshop: import.meta.env.VITE_MANFIX_WORKSHOP_URL
      ?? import.meta.env.VITE_MANHUB_WORKSHOP_URL,
  } satisfies Partial<Record<ManHubRole, string | undefined>>;

  return configured[role] ?? localPortalUrlByRole[role];
}

export function getPortalRoleForUrl(value: string): ManHubRole | null {
  try {
    const fallbackOrigin = typeof window === "undefined" ? "http://localhost" : window.location.origin;
    const url = new URL(value, fallbackOrigin);
    const authOrigin = new URL(getAuthAppUrl(), fallbackOrigin).origin;

    for (const role of Object.keys(portalHomeByRole) as ManHubRole[]) {
      const configuredUrl = getPortalDestination(role);
      const candidates = [
        localPortalUrlByRole[role],
        `https://${portalHostByRole[role]}`,
        ...(renderPortalUrlByRole[role] ? [renderPortalUrlByRole[role]] : []),
        ...(portalAliasesByRole[role] ?? []),
        ...(new URL(configuredUrl, fallbackOrigin).origin === authOrigin ? [] : [configuredUrl]),
      ];

      if (candidates.some((candidate) => new URL(candidate, fallbackOrigin).origin === url.origin)) {
        return role;
      }
    }

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

export async function listWorkshopBookings(supabase: SupabaseClient) {
  const columns = "id,vehicle_label,symptom,scheduled_at,status,payment_status,estimated_price";
  const [serviceResult, liftResult] = await Promise.all([
    supabase.from("service_bookings").select(columns),
    supabase.from("lift_bookings").select(columns),
  ]);

  const error = serviceResult.error ?? liftResult.error;
  if (error) throw error;

  const serviceRows = (serviceResult.data ?? []).map((row) => ({
    ...row,
    booking_kind: "service" as const,
  }));
  const liftRows = (liftResult.data ?? []).map((row) => ({
    ...row,
    booking_kind: "lift" as const,
  }));

  return [...serviceRows, ...liftRows]
    .filter((row) => !["cancelled", "rejected"].includes(String(row.status)))
    .sort((a, b) => String(a.scheduled_at).localeCompare(String(b.scheduled_at))) as WorkshopBooking[];
}

export async function setWorkshopBookingStatus(
  supabase: SupabaseClient,
  bookingKind: WorkshopBooking["booking_kind"],
  bookingId: string,
  status: "approved" | "cancelled" | "completed",
) {
  const { error } = await supabase.rpc("manfix_workshop_update_booking_status", {
    booking_id: bookingId,
    booking_kind: bookingKind,
    next_status: status,
  });
  if (error) throw error;
}

export async function listRepairJobs(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("repair_jobs")
    .select("id,booking_kind,customer_name,vehicle_label,diagnosis,technician_name,scheduled_at,status,created_at")
    .order("scheduled_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as RepairJob[];
}

export async function setWorkshopRepairStatus(
  supabase: SupabaseClient,
  repairJobId: string,
  status: RepairJob["status"],
) {
  const { error } = await supabase.rpc("manfix_workshop_update_repair_status", {
    next_status: status,
    repair_job_id: repairJobId,
  });
  if (error) throw error;
}

export function subscribeToWorkshopOperations(
  supabase: SupabaseClient,
  onChange: () => void,
) {
  const channel = supabase
    .channel(`workshop-operations-${Math.random().toString(36).slice(2)}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "service_bookings" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "lift_bookings" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "repair_jobs" }, onChange)
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

export async function listSupplierProducts(supabase: SupabaseClient) {
  return fetchRows<SupplierProduct>(supabase, "supplier_products");
}

export async function saveSupplierProduct(supabase: SupabaseClient, values: SupplierProductInput, id?: string) {
  if (id) {
    const { incoming_stock: _incomingStock, stock: _stock, ...editableValues } = values;
    const { data, error } = await supabase
      .from("supplier_products")
      .update(editableValues)
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

export async function listSupplierCommissions(supabase: SupabaseClient) {
  return fetchRows<SupplierCommission>(supabase, "supplier_commissions");
}

export async function adjustSupplierStock(
  supabase: SupabaseClient,
  productId: string,
  movementType: Extract<SupplierStockHistory["change_type"], "Incoming" | "Adjustment">,
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
