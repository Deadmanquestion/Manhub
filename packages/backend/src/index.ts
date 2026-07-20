import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type ManHubRole = "customer" | "supplier" | "workshop" | "admin";

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
  const { data } = await supabase.auth.getSession();
  const role = data.session?.user.user_metadata?.role ?? data.session?.user.user_metadata?.app_role;
  return isManHubRole(role) ? role : null;
}

export async function routeAfterLogin(supabase: SupabaseClient) {
  const role = await getSessionRole(supabase);
  return role ? portalHomeByRole[role] : "/";
}

export function canOpenPortal(role: ManHubRole | null, portalRole: ManHubRole) {
  return role === portalRole;
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
