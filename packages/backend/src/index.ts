import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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

export function createManHubSupabaseClient() {
  const url = import.meta.env.VITE_SUPABASE_URL ?? import.meta.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
    ?? import.meta.env.VITE_SUPABASE_ANON_KEY
    ?? import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ?? import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return null;
  }

  return createClient(url, key);
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

export async function routeAfterLogin(supabase: SupabaseClient) {
  const role = await getSessionRole(supabase);
  return role ? getPortalDestination(role) : getUnauthorizedUrl();
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
