import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Button, Card, EmptyState, MobileShell, PageHeader } from "@manhub/ui";
import { createManHubSupabaseClient, fetchRows } from "@manhub/backend";
import { customerRoutes } from "@manhub/platform-config";
import { usePortalAuth } from "@manhub/auth";
import { useCallback, useEffect, useMemo, useState } from "react";

type Row = Record<string, unknown>;

function CustomerApp() {
  const supabase = useMemo(() => createManHubSupabaseClient(), []);
  const auth = usePortalAuth(supabase, "customer");
  const [rows, setRows] = useState<Row[]>([]);

  const load = useCallback(async (table: string) => {
    if (!supabase || !auth.allowed) return;
    setRows(await fetchRows<Row>(supabase, table));
  }, [auth.allowed, supabase]);

  useEffect(() => {
    if (auth.allowed) void load("customer_vehicles");
  }, [auth.allowed, load]);

  if (!supabase) return <MobileShell><EmptyState text="Connect the shared Supabase project to run the Customer App." /></MobileShell>;
  if (auth.loading || auth.redirecting) return <MobileShell><EmptyState text={auth.redirecting ? "Redirecting to secure sign-in..." : "Checking customer session..."} /></MobileShell>;
  if (!auth.allowed) return <MobileShell><EmptyState text="Customer role required. Redirecting to Unauthorized." /></MobileShell>;

  return (
    <MobileShell>
      <PageHeader title="Hi Daniel"><Button onClick={() => load("notifications")}>Notifications</Button></PageHeader>
      <Routes>
        <Route element={<Home load={load} />} path="/" />
        <Route element={<Feature title="AI Diagnosis" table="ai_usage_events" load={load} rows={rows} />} path="/diagnosis" />
        <Route element={<Feature title="My Vehicles" table="customer_vehicles" load={load} rows={rows} />} path="/vehicles" />
        <Route element={<Feature title="Spare Parts" table="supplier_products" load={load} rows={rows} />} path="/parts" />
        <Route element={<Feature title="Orders" table="supplier_orders" load={load} rows={rows} />} path="/orders" />
        <Route element={<Feature title="Warranty+" table="warranties" load={load} rows={rows} />} path="/warranty" />
        <Route element={<Feature title="Notifications" table="notifications" load={load} rows={rows} />} path="/notifications" />
        <Route element={<Feature title="Profile" table="app_users" load={load} rows={rows} />} path="/profile" />
      </Routes>
    </MobileShell>
  );
}

function Home({ load }: { load: (table: string) => Promise<void> }) {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      {customerRoutes.slice(1).map((route) => (
        <Card key={route.path} tone={route.path === "/diagnosis" ? "blue" : "default"}>
          <h2>{route.label}</h2>
          <p>Customer-only workflow powered by the shared ManFix backend.</p>
          <Button onClick={() => load(route.path === "/parts" ? "supplier_products" : "warranties")}>Open</Button>
        </Card>
      ))}
    </div>
  );
}

function Feature({ load, rows, table, title }: { load: (table: string) => Promise<void>; rows: Row[]; table: string; title: string }) {
  return (
    <Card>
      <h2>{title}</h2>
      <p>Reads from shared table: {table}</p>
      <Button onClick={() => load(table)}>Refresh</Button>
      {rows.length === 0 ? <EmptyState text="No records available for this customer role." /> : <pre>{JSON.stringify(rows.slice(0, 4), null, 2)}</pre>}
    </Card>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><BrowserRouter><CustomerApp /></BrowserRouter></StrictMode>);
