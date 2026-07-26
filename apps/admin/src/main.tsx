import { StrictMode, useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { usePortalAuth } from "@manhub/auth";
import { createManHubSupabaseClient, fetchRows, insertRow, resolveMetric, updateStatus } from "@manhub/backend";
import { adminMetrics, adminRoutes } from "@manhub/platform-config";
import { Button, Card, DataTable, EmptyState, FormField, MiniChart, PageHeader, PortalShell, StatGrid } from "@manhub/ui";

type Row = { id?: string; [key: string]: unknown };
type Client = NonNullable<ReturnType<typeof createManHubSupabaseClient>>;

function AdminApp() {
  const supabase = useMemo(() => createManHubSupabaseClient(), []);
  const auth = usePortalAuth(supabase, "admin");
  const [notice, setNotice] = useState("Platform owner controls connected.");

  const run = useCallback(async (task: () => Promise<void>, success: string) => {
    try {
      await task();
      setNotice(success);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Action failed.");
    }
  }, []);

  if (!supabase) return <PortalShell eyebrow="Admin" routes={adminRoutes} title="ManFix"><EmptyState text="Add Supabase environment variables to run this dashboard." /></PortalShell>;
  if (auth.loading || auth.redirecting) return <PortalShell eyebrow="Admin" routes={[]} title="ManFix"><EmptyState text={auth.redirecting ? "Redirecting to secure sign-in..." : "Checking admin session..."} /></PortalShell>;
  if (!auth.allowed) return <PortalShell eyebrow="Admin" routes={[]} title="ManFix"><EmptyState text="Admin role required. Redirecting to Unauthorized." /></PortalShell>;

  return (
    <PortalShell eyebrow="Admin Dashboard" routes={adminRoutes} title="ManFix">
      <PageHeader title="Platform Control"><Button tone="ghost" onClick={auth.refresh}>Refresh session</Button></PageHeader>
      <Card tone="blue"><strong>{notice}</strong></Card>
      <Routes>
        <Route path="/" element={<Overview supabase={supabase} />} />
        <Route path="/users" element={<Users run={run} supabase={supabase} />} />
        <Route path="/workshops" element={<StatusPage run={run} supabase={supabase} table="platform_workshops" title="Workshops" columns={["name", "city", "status", "rating"]} actions={["Verified", "Suspended"]} />} />
        <Route path="/suppliers" element={<StatusPage run={run} supabase={supabase} table="supplier_profiles" title="Suppliers" columns={["company_name", "status", "rating", "bank_name"]} actions={["Verified", "Suspended"]} />} />
        <Route path="/orders" element={<StatusPage run={run} supabase={supabase} table="supplier_orders" title="Orders" columns={["id", "workshop", "customer", "amount", "status"]} actions={["Confirmed", "Delivered", "Cancelled"]} />} />
        <Route path="/payments" element={<StatusPage run={run} supabase={supabase} table="platform_payments" title="Payments" columns={["invoice_number", "amount", "commission_amount", "status", "method"]} actions={["Paid", "Refunded", "Escrow"]} />} />
        <Route path="/withdrawals" element={<StatusPage run={run} supabase={supabase} table="supplier_withdrawals" title="Withdrawals" columns={["amount", "bank", "account_number", "status"]} actions={["Approved", "Rejected"]} />} />
        <Route path="/warranty" element={<StatusPage run={run} supabase={supabase} table="warranty_claims" title="Warranty" columns={["warranty_id", "description", "status", "submitted_at"]} actions={["Approved", "Rejected", "Inspection Requested"]} />} />
        <Route path="/analytics" element={<Analytics supabase={supabase} />} />
        <Route path="/settings" element={<Settings run={run} supabase={supabase} />} />
      </Routes>
    </PortalShell>
  );
}

function Overview({ supabase }: { supabase: Client }) {
  const [metrics, setMetrics] = useState<Array<[string, string | number]>>([]);
  useEffect(() => {
    void Promise.all(adminMetrics.map(async (metric) => [metric.label, await resolveMetric(supabase, metric)] as [string, number]))
      .then((items) => setMetrics([["Total GMV", items[0]?.[1] ?? 0], ["Platform Revenue", items[1]?.[1] ?? 0], ["Commission Earned", items[1]?.[1] ?? 0], ["Today's Orders", 0], ["Monthly Orders", 0], ...items.slice(2)]))
      .catch(() => setMetrics([]));
  }, [supabase]);
  return (
    <>
      <StatGrid items={metrics.length ? metrics : [["Total GMV", "RM 0"], ["Platform Revenue", "RM 0"], ["Commission Earned", "RM 0"], ["Today's Orders", 0], ["Monthly Orders", 0], ["Active Customers", 0], ["Active Workshops", 0], ["Active Suppliers", 0], ["Warranty Claims", 0], ["Withdrawal Requests", 0]]} />
      <div className="mh-grid-3">
        <MiniChart title="Revenue" data={[42, 51, 62, 74, 86, 93].map((value, index) => ({ label: `M${index + 1}`, value }))} />
        <MiniChart title="Conversion" data={[18, 24, 28, 33].map((value, index) => ({ label: `W${index + 1}`, value }))} />
        <MiniChart title="AI Usage" data={[120, 146, 188, 213].map((value, index) => ({ label: `W${index + 1}`, value }))} />
      </div>
    </>
  );
}

function Users({ run, supabase }: ActionProps) {
  return <StatusPage run={run} supabase={supabase} table="app_users" title="Users" columns={["full_name", "email", "account_type", "status"]} actions={["Verified", "Suspended", "Banned"]} />;
}

function StatusPage({ actions, columns, run, supabase, table, title }: ActionProps & { actions: string[]; columns: string[]; table: string; title: string }) {
  const [rows, setRows] = useRows(supabase, table);
  return (
    <Card>
      <h2 className="mh-card-title">{title}</h2>
      <DataTable headers={[...columns.map(labelize), "Actions"]} rows={rows.map((row) => [
        ...columns.map((column) => String(row[column] ?? "-")),
        <div className="mh-actions">{actions.map((status) => (
          <Button key={status} tone={status.includes("Reject") || status.includes("Suspend") || status.includes("Ban") ? "danger" : "ghost"} onClick={() => row.id && run(async () => {
            await updateStatus(supabase, table, row.id as string, status);
            setRows(await fetchRows<Row>(supabase, table));
          }, `${title} record marked ${status}.`)}>
            {status}
          </Button>
        ))}</div>,
      ])} />
    </Card>
  );
}

function Analytics({ supabase }: { supabase: Client }) {
  return (
    <div className="mh-grid-2">
      <TablePage supabase={supabase} table="platform_payments" title="Revenue and Growth" columns={["amount", "commission_amount", "status", "created_at"]} />
      <TablePage supabase={supabase} table="ai_usage_events" title="AI Usage" columns={["user_id", "vehicle_label", "diagnosis", "created_at"]} />
      <TablePage supabase={supabase} table="warranty_claims" title="Warranty Claims" columns={["warranty_id", "status", "submitted_at", "reviewed_at"]} />
      <TablePage supabase={supabase} table="platform_workshops" title="Top Workshops" columns={["name", "city", "rating", "status"]} />
      <TablePage supabase={supabase} table="supplier_profiles" title="Top Suppliers" columns={["company_name", "rating", "status", "bank_name"]} />
      <TablePage supabase={supabase} table="app_users" title="Retention" columns={["full_name", "account_type", "last_active_at", "status"]} />
    </div>
  );
}

function Settings({ run, supabase }: ActionProps) {
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  return (
    <Card>
      <h2 className="mh-card-title">Settings</h2>
      <div className="mh-form-row">
        <FormField label="Setting Key" value={key} onChange={setKey} />
        <FormField label="Setting Value" value={value} onChange={setValue} />
        <Button onClick={() => run(async () => {
          await insertRow(supabase, "platform_config_items", { key, value });
          setKey("");
          setValue("");
        }, "Platform setting saved.")}>Save Setting</Button>
      </div>
      <TablePage supabase={supabase} table="platform_config_items" title="Current Settings" columns={["key", "value", "created_at"]} />
    </Card>
  );
}

function TablePage({ columns, supabase, table, title }: { columns: string[]; supabase: Client; table: string; title: string }) {
  const [rows] = useRows(supabase, table);
  return (
    <Card>
      <h2 className="mh-card-title">{title}</h2>
      <DataTable headers={columns.map(labelize)} rows={rows.map((row) => columns.map((column) => String(row[column] ?? "-")))} />
    </Card>
  );
}

type ActionProps = { run: (task: () => Promise<void>, success: string) => Promise<void>; supabase: Client };

function useRows(supabase: Client, table: string) {
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    void fetchRows<Row>(supabase, table).then(setRows).catch(() => setRows([]));
  }, [supabase, table]);
  return [rows, setRows] as const;
}

function labelize(value: string) {
  return value.split("_").join(" ").replace(/\b\w/g, (letter: string) => letter.toUpperCase());
}

createRoot(document.getElementById("root")!).render(<StrictMode><BrowserRouter><AdminApp /></BrowserRouter></StrictMode>);
