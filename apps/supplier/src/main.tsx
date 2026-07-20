import { StrictMode, useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { usePortalAuth } from "@manhub/auth";
import { createManHubSupabaseClient, deleteRow, fetchRows, insertRow, resolveMetric, updateStatus } from "@manhub/backend";
import { supplierMetrics, supplierRoutes } from "@manhub/platform-config";
import { Button, Card, DataTable, EmptyState, FormField, MiniChart, PageHeader, PortalShell, StatGrid } from "@manhub/ui";

type Row = { id?: string; [key: string]: unknown };

function SupplierApp() {
  const supabase = useMemo(() => createManHubSupabaseClient(), []);
  const auth = usePortalAuth(supabase, "supplier");
  const [notice, setNotice] = useState("Connected to shared Supabase backend.");

  const run = useCallback(async (task: () => Promise<void>, success: string) => {
    try {
      await task();
      setNotice(success);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Action failed.");
    }
  }, []);

  if (!supabase) return <PortalShell eyebrow="Supplier" routes={supplierRoutes} title="ManHub"><EmptyState text="Add Supabase environment variables to run this portal." /></PortalShell>;
  if (auth.loading) return <PortalShell eyebrow="Supplier" routes={supplierRoutes} title="ManHub"><EmptyState text="Loading supplier session..." /></PortalShell>;
  if (!auth.allowed) return <PortalShell eyebrow="Supplier" routes={supplierRoutes} title="ManHub"><EmptyState text="Supplier role required. Sign in with role=supplier to open this portal." /></PortalShell>;

  return (
    <PortalShell eyebrow="Supplier Portal" routes={supplierRoutes} title="ManHub">
      <PageHeader title="Supplier Portal"><Button tone="ghost" onClick={auth.refresh}>Refresh session</Button></PageHeader>
      <Card tone="blue"><strong>{notice}</strong></Card>
      <Routes>
        <Route path="/" element={<Dashboard supabase={supabase} />} />
        <Route path="/products" element={<Products run={run} supabase={supabase} />} />
        <Route path="/inventory" element={<TablePage supabase={supabase} table="supplier_products" title="Inventory" columns={["name", "stock", "incoming_stock", "category", "warranty_duration_months", "active"]} />} />
        <Route path="/orders" element={<Orders run={run} supabase={supabase} />} />
        <Route path="/warranty" element={<Warranty run={run} supabase={supabase} />} />
        <Route path="/withdrawals" element={<Withdrawals run={run} supabase={supabase} />} />
        <Route path="/analytics" element={<Analytics supabase={supabase} />} />
        <Route path="/profile" element={<TablePage supabase={supabase} table="supplier_profiles" title="Profile" columns={["company_name", "status", "rating", "bank_name"]} />} />
      </Routes>
    </PortalShell>
  );
}

function Dashboard({ supabase }: { supabase: NonNullable<ReturnType<typeof createManHubSupabaseClient>> }) {
  const [metrics, setMetrics] = useState<Array<[string, string | number]>>([]);
  useEffect(() => {
    void Promise.all(supplierMetrics.map(async (metric) => [metric.label, await resolveMetric(supabase, metric)] as [string, number]))
      .then(setMetrics)
      .catch(() => setMetrics([]));
  }, [supabase]);
  return (
    <>
      <StatGrid items={metrics.length ? metrics : [["Today's Revenue", "RM 0"], ["Monthly Revenue", "RM 0"], ["Pending Withdrawal", "RM 0"], ["Orders Today", 0], ["Active Products", 0], ["Low Stock", 0], ["Warranty Claims", 0], ["Average Rating", "0.0"]]} />
      <div className="mh-grid-3">
        <MiniChart title="Revenue (7 days)" data={[18, 28, 22, 41, 37, 56, 64].map((value, index) => ({ label: `D${index + 1}`, value }))} />
        <MiniChart title="Monthly Revenue" data={[42, 58, 74, 86].map((value, index) => ({ label: `M${index + 1}`, value }))} />
        <MiniChart title="Top Selling Products" data={[64, 42, 31].map((value, index) => ({ label: ["Pads", "Oil", "Battery"][index], value }))} />
      </div>
    </>
  );
}

function Products({ run, supabase }: ActionProps) {
  const [rows, setRows] = useRows(supabase, "supplier_products");
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [price, setPrice] = useState("");
  const add = () => run(async () => {
    await insertRow(supabase, "supplier_products", { name, brand, category: "Brake", cost_price: 0, selling_price: Number(price || 0), stock: 1, warranty_duration_months: 6, active: true });
    setName("");
    setBrand("");
    setPrice("");
    setRows(await fetchRows<Row>(supabase, "supplier_products"));
  }, "Product saved to shared catalogue.");
  return (
    <Card>
      <h2 className="mh-card-title">Products</h2>
      <div className="mh-form-row">
        <FormField label="Name" value={name} onChange={setName} />
        <FormField label="Brand" value={brand} onChange={setBrand} />
        <FormField label="Selling Price" value={price} onChange={setPrice} type="number" />
        <Button onClick={add}>Add Product</Button>
      </div>
      <DataTable headers={["Name", "Brand", "Category", "Stock", "Warranty", "Actions"]} rows={rows.map((row) => [
        String(row.name ?? "-"),
        String(row.brand ?? "-"),
        String(row.category ?? "-"),
        String(row.stock ?? 0),
        `${row.warranty_duration_months ?? 0} months`,
        <Button tone="danger" onClick={() => row.id && run(async () => {
          await deleteRow(supabase, "supplier_products", row.id as string);
          setRows(await fetchRows<Row>(supabase, "supplier_products"));
        }, "Product removed.")}>Delete</Button>,
      ])} />
    </Card>
  );
}

function Orders({ run, supabase }: ActionProps) {
  const [rows, setRows] = useRows(supabase, "supplier_orders");
  return <TableWithStatus rows={rows} columns={["id", "workshop", "customer", "product_name", "quantity", "status", "invoice_number"]} title="Orders" update={(id, status) => run(async () => {
    await updateStatus(supabase, "supplier_orders", id, status);
    setRows(await fetchRows<Row>(supabase, "supplier_orders"));
  }, `Order marked ${status}.`)} />;
}

function Warranty({ run, supabase }: ActionProps) {
  const [rows, setRows] = useRows(supabase, "warranty_claims");
  return <TableWithStatus rows={rows} columns={["id", "warranty_id", "description", "status", "submitted_at"]} title="Warranty" update={(id, status) => run(async () => {
    await updateStatus(supabase, "warranty_claims", id, status);
    setRows(await fetchRows<Row>(supabase, "warranty_claims"));
  }, `Warranty claim ${status}.`)} actions={["Approved", "Rejected", "Inspection Requested"]} />;
}

function Withdrawals({ run, supabase }: ActionProps) {
  const [rows, setRows] = useRows(supabase, "supplier_withdrawals");
  const [amount, setAmount] = useState("");
  return (
    <Card>
      <h2 className="mh-card-title">Withdraw</h2>
      <div className="mh-form-row">
        <FormField label="Amount" value={amount} onChange={setAmount} type="number" />
        <Button onClick={() => run(async () => {
          await insertRow(supabase, "supplier_withdrawals", { amount: Number(amount || 0), bank: "Maybank", account_number: "**** 4321", status: "Pending" });
          setAmount("");
          setRows(await fetchRows<Row>(supabase, "supplier_withdrawals"));
        }, "Withdrawal request submitted.")}>Create Withdraw</Button>
      </div>
      <DataTable headers={["Amount", "Bank", "Account", "Status"]} rows={rows.map((row) => [String(row.amount ?? "0"), String(row.bank ?? "-"), String(row.account_number ?? "-"), String(row.status ?? "-")])} />
    </Card>
  );
}

function Analytics({ supabase }: { supabase: NonNullable<ReturnType<typeof createManHubSupabaseClient>> }) {
  return (
    <div className="mh-grid-2">
      <TablePage supabase={supabase} table="supplier_orders" title="Revenue and Profit" columns={["amount", "cost_total", "status", "created_at"]} />
      <TablePage supabase={supabase} table="supplier_products" title="Top Products" columns={["name", "brand", "stock", "selling_price"]} />
      <TablePage supabase={supabase} table="supplier_orders" title="Top Workshops" columns={["workshop", "product_name", "quantity", "amount"]} />
      <TablePage supabase={supabase} table="supplier_orders" title="Repeat Customers" columns={["customer", "product_name", "created_at"]} />
    </div>
  );
}

function TablePage({ columns, supabase, table, title }: { columns: string[]; supabase: NonNullable<ReturnType<typeof createManHubSupabaseClient>>; table: string; title: string }) {
  const [rows] = useRows(supabase, table);
  return <TableWithStatus rows={rows} columns={columns} title={title} />;
}

type ActionProps = { run: (task: () => Promise<void>, success: string) => Promise<void>; supabase: NonNullable<ReturnType<typeof createManHubSupabaseClient>> };

function TableWithStatus({ actions = ["Fulfilled", "Cancelled"], columns, rows, title, update }: { actions?: string[]; columns: string[]; rows: Row[]; title: string; update?: (id: string, status: string) => void }) {
  return (
    <Card>
      <h2 className="mh-card-title">{title}</h2>
      <DataTable headers={[...columns.map(labelize), ...(update ? ["Actions"] : [])]} rows={rows.map((row) => [
        ...columns.map((column) => String(row[column] ?? "-")),
        ...(update ? [<div className="mh-actions">{actions.map((status) => <Button key={status} tone={status.includes("Reject") || status.includes("Cancel") ? "danger" : "ghost"} onClick={() => row.id && update(row.id, status)}>{status}</Button>)}</div>] : []),
      ])} />
    </Card>
  );
}

function useRows(supabase: NonNullable<ReturnType<typeof createManHubSupabaseClient>>, table: string) {
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    void fetchRows<Row>(supabase, table).then(setRows).catch(() => setRows([]));
  }, [supabase, table]);
  return [rows, setRows] as const;
}

function labelize(value: string) {
  return value.split("_").join(" ").replace(/\b\w/g, (letter: string) => letter.toUpperCase());
}

createRoot(document.getElementById("root")!).render(<StrictMode><BrowserRouter><SupplierApp /></BrowserRouter></StrictMode>);
