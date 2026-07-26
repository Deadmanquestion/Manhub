import { StrictMode, useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { usePortalAuth } from "@manhub/auth";
import { createManHubSupabaseClient, fetchRows, insertRow, resolveMetric, updateStatus } from "@manhub/backend";
import { workshopMetrics, workshopRoutes } from "@manhub/platform-config";
import { Button, Card, DataTable, EmptyState, FormField, MiniChart, PageHeader, PortalShell, StatGrid } from "@manhub/ui";

type Row = { id?: string; [key: string]: unknown };
type Client = NonNullable<ReturnType<typeof createManHubSupabaseClient>>;

function WorkshopApp() {
  const supabase = useMemo(() => createManHubSupabaseClient(), []);
  const auth = usePortalAuth(supabase, "workshop");
  const [notice, setNotice] = useState("Shared workshop operations connected.");

  const run = useCallback(async (task: () => Promise<void>, success: string) => {
    try {
      await task();
      setNotice(success);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Action failed.");
    }
  }, []);

  if (!supabase) return <PortalShell eyebrow="Workshop" routes={workshopRoutes} title="ManFix"><EmptyState text="Add Supabase environment variables to run this portal." /></PortalShell>;
  if (auth.loading || auth.redirecting) return <PortalShell eyebrow="Workshop" routes={[]} title="ManFix"><EmptyState text={auth.redirecting ? "Redirecting to secure sign-in..." : "Checking workshop session..."} /></PortalShell>;
  if (!auth.allowed) return <PortalShell eyebrow="Workshop" routes={[]} title="ManFix"><EmptyState text="Workshop role required. Redirecting to Unauthorized." /></PortalShell>;

  return (
    <PortalShell eyebrow="Workshop Portal" routes={workshopRoutes} title="ManFix">
      <PageHeader title="Workshop Portal"><Button tone="ghost" onClick={auth.refresh}>Refresh session</Button></PageHeader>
      <Card tone="blue"><strong>{notice}</strong></Card>
      <Routes>
        <Route path="/" element={<Dashboard supabase={supabase} />} />
        <Route path="/bookings" element={<Bookings run={run} supabase={supabase} />} />
        <Route path="/repair-queue" element={<RepairQueue run={run} supabase={supabase} />} />
        <Route path="/customers" element={<TablePage supabase={supabase} table="app_users" title="Customers" columns={["full_name", "email", "account_type", "status"]} />} />
        <Route path="/technicians" element={<Technicians run={run} supabase={supabase} />} />
        <Route path="/invoices" element={<Invoices run={run} supabase={supabase} />} />
        <Route path="/warranty" element={<WarrantyInspections run={run} supabase={supabase} />} />
        <Route path="/analytics" element={<Analytics supabase={supabase} />} />
      </Routes>
    </PortalShell>
  );
}

function Dashboard({ supabase }: { supabase: Client }) {
  const [metrics, setMetrics] = useState<Array<[string, string | number]>>([]);
  useEffect(() => {
    void Promise.all(workshopMetrics.map(async (metric) => [metric.label, await resolveMetric(supabase, metric)] as [string, number]))
      .then(setMetrics)
      .catch(() => setMetrics([]));
  }, [supabase]);
  return (
    <>
      <StatGrid items={metrics.length ? metrics : [["Bookings", 0], ["Repair Queue", 0], ["Invoices", 0], ["Warranty Jobs", 0]]} />
      <div className="mh-grid-2">
        <MiniChart title="Bay Utilization" data={[64, 71, 58, 82, 76].map((value, index) => ({ label: `Bay ${index + 1}`, value }))} />
        <MiniChart title="Repair Throughput" data={[7, 9, 6, 11, 12].map((value, index) => ({ label: `D${index + 1}`, value }))} />
      </div>
    </>
  );
}

function Bookings({ run, supabase }: ActionProps) {
  const [rows, setRows] = useRows(supabase, "service_bookings");
  return <TableWithStatus rows={rows} columns={["vehicle_label", "symptom", "scheduled_at", "status"]} title="Bookings" actions={["Accepted", "Cancelled"]} update={(id, status) => run(async () => {
    await updateStatus(supabase, "service_bookings", id, status);
    setRows(await fetchRows<Row>(supabase, "service_bookings"));
  }, `Booking ${status}.`)} />;
}

function RepairQueue({ run, supabase }: ActionProps) {
  const [rows, setRows] = useRows(supabase, "repair_jobs");
  return <TableWithStatus rows={rows} columns={["customer_name", "vehicle_label", "diagnosis", "technician_name", "status"]} title="Repair Queue" actions={["In Progress", "Ready", "Completed"]} update={(id, status) => run(async () => {
    await updateStatus(supabase, "repair_jobs", id, status);
    setRows(await fetchRows<Row>(supabase, "repair_jobs"));
  }, `Repair job marked ${status}.`)} />;
}

function Technicians({ run, supabase }: ActionProps) {
  const [rows, setRows] = useRows(supabase, "technicians");
  const [name, setName] = useState("");
  return (
    <Card>
      <h2 className="mh-card-title">Technicians</h2>
      <div className="mh-form-row">
        <FormField label="Technician Name" value={name} onChange={setName} />
        <Button onClick={() => run(async () => {
          await insertRow(supabase, "technicians", { name, certification: "IMI Certified", status: "Available", jobs_today: 0 });
          setName("");
          setRows(await fetchRows<Row>(supabase, "technicians"));
        }, "Technician added.")}>Add Technician</Button>
      </div>
      <DataTable headers={["Name", "Certification", "Status", "Jobs Today", "Rating"]} rows={rows.map((row) => [String(row.name ?? "-"), String(row.certification ?? "-"), String(row.status ?? "-"), String(row.jobs_today ?? 0), String(row.rating ?? "-")])} />
    </Card>
  );
}

function Invoices({ run, supabase }: ActionProps) {
  const [rows, setRows] = useRows(supabase, "platform_payments");
  return <TableWithStatus rows={rows} columns={["invoice_number", "amount", "status", "method", "created_at"]} title="Invoices" actions={["Paid", "Refunded"]} update={(id, status) => run(async () => {
    await updateStatus(supabase, "platform_payments", id, status);
    setRows(await fetchRows<Row>(supabase, "platform_payments"));
  }, `Invoice ${status}.`)} />;
}

function WarrantyInspections({ run, supabase }: ActionProps) {
  const [rows, setRows] = useRows(supabase, "warranty_claims");
  return <TableWithStatus rows={rows} columns={["warranty_id", "description", "status", "submitted_at"]} title="Warranty Inspection Jobs" actions={["Inspection Accepted", "Inspection Scheduled", "Replacement Recommended"]} update={(id, status) => run(async () => {
    await updateStatus(supabase, "warranty_claims", id, status);
    setRows(await fetchRows<Row>(supabase, "warranty_claims"));
  }, `Warranty inspection ${status}.`)} />;
}

function Analytics({ supabase }: { supabase: Client }) {
  return (
    <div className="mh-grid-2">
      <TablePage supabase={supabase} table="service_bookings" title="Booking Analytics" columns={["vehicle_label", "status", "scheduled_at"]} />
      <TablePage supabase={supabase} table="repair_jobs" title="Repair Analytics" columns={["diagnosis", "technician_name", "status", "created_at"]} />
    </div>
  );
}

function TablePage({ columns, supabase, table, title }: { columns: string[]; supabase: Client; table: string; title: string }) {
  const [rows] = useRows(supabase, table);
  return <TableWithStatus rows={rows} columns={columns} title={title} />;
}

type ActionProps = { run: (task: () => Promise<void>, success: string) => Promise<void>; supabase: Client };

function TableWithStatus({ actions = [], columns, rows, title, update }: { actions?: string[]; columns: string[]; rows: Row[]; title: string; update?: (id: string, status: string) => void }) {
  return (
    <Card>
      <h2 className="mh-card-title">{title}</h2>
      <DataTable headers={[...columns.map(labelize), ...(update ? ["Actions"] : [])]} rows={rows.map((row) => [
        ...columns.map((column) => String(row[column] ?? "-")),
        ...(update ? [<div className="mh-actions">{actions.map((status) => <Button key={status} tone={status.includes("Cancel") ? "danger" : "ghost"} onClick={() => row.id && update(row.id, status)}>{status}</Button>)}</div>] : []),
      ])} />
    </Card>
  );
}

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

createRoot(document.getElementById("root")!).render(<StrictMode><BrowserRouter><WorkshopApp /></BrowserRouter></StrictMode>);
