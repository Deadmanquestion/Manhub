import { StrictMode, useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import type { SupabaseClient } from "@supabase/supabase-js";
import { usePortalAuth } from "@manhub/auth";
import {
  adjustSupplierStock,
  createManHubSupabaseClient,
  deleteSupplierProduct,
  fetchRows,
  getSupplierWallet,
  listProductCategories,
  listSupplierCommissions,
  listSupplierInvoices,
  listSupplierOrders,
  listSupplierProducts,
  listSupplierStockHistory,
  listSupplierWarrantyClaims,
  listSupplierWithdrawals,
  reviewSupplierWarrantyClaim,
  saveSupplierProduct,
  setSupplierOrderStatus,
  submitSupplierWithdrawal,
  uploadSupplierProductImage,
  type ProductCategory,
  type SupplierCommission,
  type SupplierInvoice,
  type SupplierOrder,
  type SupplierProduct,
  type SupplierProductInput,
  type SupplierStockHistory,
  type SupplierWallet,
  type SupplierWarrantyClaim,
  type SupplierWithdrawal,
} from "@manhub/backend";
import { supplierRoutes } from "@manhub/platform-config";
import { Button, Card, DataTable, EmptyState, FormField, MiniChart, PageHeader, PortalShell, StatGrid } from "@manhub/ui";

type Db = SupabaseClient;
type NoticeTone = "info" | "success" | "error";
type SupplierProfile = {
  bank_account_number: string | null;
  bank_name: string | null;
  company_name: string;
  contact_name: string | null;
  email: string | null;
  id: string;
  phone: string | null;
  rating: number;
  status: string;
  supplier_id: string;
  verified: boolean;
};

const money = new Intl.NumberFormat("en-MY", { currency: "MYR", style: "currency" });

const emptyProductForm: SupplierProductInput = {
  active: true,
  brand: "",
  category: "",
  cost_price: 0,
  description: "",
  incoming_stock: 0,
  low_stock_threshold: 5,
  name: "",
  selling_price: 0,
  sku: "",
  stock: 0,
  warranty_duration_months: 6,
};

function SupplierApp() {
  const supabase = useMemo(() => createManHubSupabaseClient(), []);
  const auth = usePortalAuth(supabase, "supplier");
  const [notice, setNotice] = useState<{ text: string; tone: NoticeTone }>({
    text: "Supplier portal is connected to ManFix Supabase.",
    tone: "info",
  });

  const run = useCallback(async (task: () => Promise<void>, success: string) => {
    try {
      await task();
      setNotice({ text: success, tone: "success" });
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "Action failed.", tone: "error" });
    }
  }, []);

  if (!supabase) {
    return (
      <PortalShell eyebrow="Supplier" routes={supplierRoutes} title="ManFix">
        <EmptyState text="Connect Supabase environment variables before opening the Supplier Portal." />
      </PortalShell>
    );
  }

  if (auth.loading || auth.redirecting) {
    return (
      <PortalShell eyebrow="Supplier" routes={[]} title="ManFix">
        <EmptyState text={auth.redirecting ? "Redirecting to secure sign-in..." : "Checking supplier session..."} />
      </PortalShell>
    );
  }

  if (!auth.allowed) {
    return (
      <PortalShell eyebrow="Supplier" routes={[]} title="ManFix">
        <EmptyState text="This portal is only available to approved supplier accounts." />
      </PortalShell>
    );
  }

  return (
    <PortalShell eyebrow="Supplier Portal" routes={supplierRoutes} title="ManFix">
      <PageHeader title="Supplier Portal">
        <Button tone="ghost" onClick={auth.refresh}>Refresh session</Button>
      </PageHeader>
      <Card tone={notice.tone === "error" ? "amber" : notice.tone === "success" ? "blue" : "default"}>
        <strong>{notice.text}</strong>
      </Card>
      <Routes>
        <Route path="/" element={<Dashboard supabase={supabase} />} />
        <Route path="/products" element={<ProductsPage run={run} supabase={supabase} />} />
        <Route path="/inventory" element={<InventoryPage run={run} supabase={supabase} />} />
        <Route path="/orders" element={<OrdersPage run={run} supabase={supabase} />} />
        <Route path="/warranty" element={<WarrantyPage run={run} supabase={supabase} />} />
        <Route path="/withdrawals" element={<WithdrawalsPage run={run} supabase={supabase} />} />
        <Route path="/analytics" element={<AnalyticsPage supabase={supabase} />} />
        <Route path="/profile" element={<ProfilePage run={run} supabase={supabase} />} />
      </Routes>
    </PortalShell>
  );
}

function Dashboard({ supabase }: { supabase: Db }) {
  const products = useSupplierResource(() => listSupplierProducts(supabase), [supabase], [] as SupplierProduct[]);
  const orders = useSupplierResource(() => listSupplierOrders(supabase), [supabase], [] as SupplierOrder[]);
  const commissions = useSupplierResource(() => listSupplierCommissions(supabase), [supabase], [] as SupplierCommission[]);
  const withdrawals = useSupplierResource(() => listSupplierWithdrawals(supabase), [supabase], [] as SupplierWithdrawal[]);
  const claims = useSupplierResource(() => listSupplierWarrantyClaims(supabase), [supabase], [] as SupplierWarrantyClaim[]);
  const wallet = useSupplierResource(() => getSupplierWallet(supabase), [supabase], null as SupplierWallet | null);
  const invoices = useSupplierResource(() => listSupplierInvoices(supabase), [supabase], [] as SupplierInvoice[]);
  const profile = useSupplierResource(async () => {
    const rows = await fetchRows<SupplierProfile>(supabase, "supplier_profiles");
    return rows[0] ?? null;
  }, [supabase], null as SupplierProfile | null);

  const dashboard = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const deliveredOrders = orders.data.filter((order) => order.status === "Delivered");
    const settledToday = commissions.data.filter((item) => item.created_at.startsWith(today));
    const settledMonth = commissions.data.filter((item) => sameMonth(item.created_at));
    const grossToday = settledToday.reduce((sum, item) => sum + Number(item.gross_amount), 0);
    const grossMonth = settledMonth.reduce((sum, item) => sum + Number(item.gross_amount), 0);
    const feesMonth = settledMonth.reduce((sum, item) => sum + Number(item.commission_amount), 0);
    const netMonth = settledMonth.reduce((sum, item) => sum + Number(item.supplier_net_amount), 0);
    const pendingWithdrawal = withdrawals.data.filter((item) => item.status === "Pending").reduce((sum, item) => sum + Number(item.amount), 0);
    const lowStock = products.data.filter((product) => product.stock <= product.low_stock_threshold).length;
    const rating = profile.data ? Number(profile.data.rating).toFixed(1) : "No rating";

    return {
      chart7: groupByRecentDays(deliveredOrders, 7),
      monthly: groupByMonth(deliveredOrders),
      topProducts: topProducts(deliveredOrders),
      stats: [
        ["Today's Gross Sales", money.format(grossToday)],
        ["Monthly Gross Sales", money.format(grossMonth)],
        ["ManFix Fees (20%)", money.format(feesMonth)],
        ["Monthly Net Payout", money.format(netMonth)],
        ["Wallet Available", money.format(Number(wallet.data?.available_balance ?? 0))],
        ["Pending Withdrawal", money.format(pendingWithdrawal)],
        ["Orders Today", orders.data.filter((order) => order.created_at.startsWith(today)).length],
        ["Active Products", products.data.filter((product) => product.active).length],
        ["Low Stock", lowStock],
        ["Warranty Claims", claims.data.length],
        ["Average Rating", rating],
      ] as Array<[string, string | number]>,
    };
  }, [claims.data, commissions.data, orders.data, products.data, profile.data, wallet.data, withdrawals.data]);

  return (
    <>
      <ResourceStatus resources={[products, orders, commissions, withdrawals, claims, wallet, invoices, profile]} />
      <StatGrid items={dashboard.stats} />
      <div className="mh-grid-3">
        <ChartOrEmpty title="Gross Sales (7 days)" data={dashboard.chart7} />
        <ChartOrEmpty title="Monthly Gross Sales" data={dashboard.monthly} />
        <ChartOrEmpty title="Top Selling Products" data={dashboard.topProducts} />
      </div>
    </>
  );
}

function ProductsPage({ run, supabase }: ActionProps) {
  const products = useSupplierResource(() => listSupplierProducts(supabase), [supabase], [] as SupplierProduct[]);
  const categories = useSupplierResource(() => listProductCategories(supabase), [supabase], [] as ProductCategory[]);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [form, setForm] = useState<SupplierProductInput>(emptyProductForm);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");

  useEffect(() => {
    if (!form.category && categories.data[0]) {
      setForm((current) => ({ ...current, category: categories.data[0].name }));
    }
  }, [categories.data, form.category]);

  const visibleProducts = products.data.filter((product) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [product.name, product.brand, product.sku ?? ""].some((value) => value.toLowerCase().includes(query));
    const matchesCategory = categoryFilter === "All" || product.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const saved = await saveSupplierProduct(supabase, normalizeProductForm(form), editingId);
      if (imageFile) await uploadSupplierProductImage(supabase, saved.id, imageFile);
      setForm({ ...emptyProductForm, category: categories.data[0]?.name ?? "" });
      setEditingId(undefined);
      setImageFile(null);
      await products.reload();
    }, editingId ? "Product updated." : "Product added to catalogue.");
  };

  const edit = (product: SupplierProduct) => {
    setEditingId(product.id);
    setImageFile(null);
    setForm({
      active: product.active,
      brand: product.brand,
      category: product.category,
      cost_price: Number(product.cost_price),
      description: product.description ?? "",
      image_url: product.image_url,
      incoming_stock: product.incoming_stock,
      low_stock_threshold: product.low_stock_threshold,
      name: product.name,
      selling_price: Number(product.selling_price),
      sku: product.sku ?? "",
      stock: product.stock,
      warranty_duration_months: product.warranty_duration_months,
    });
  };

  return (
    <div className="mh-grid-2">
      <Card>
        <h2 className="mh-card-title">{editingId ? "Edit Product" : "Add Product"}</h2>
        <form className="mh-form-stack" onSubmit={submit}>
          <div className="mh-form-row">
            <FormField label="Name" value={form.name} onChange={(value) => setFormField(setForm, "name", value)} />
            <FormField label="Brand" value={form.brand} onChange={(value) => setFormField(setForm, "brand", value)} />
            <FormField label="SKU" value={form.sku ?? ""} onChange={(value) => setFormField(setForm, "sku", value)} />
          </div>
          <div className="mh-form-row">
            <SelectField label="Category" value={form.category} onChange={(value) => setFormField(setForm, "category", value)} options={categories.data.map((category) => category.name)} />
            <FormField label="Cost Price" type="number" value={String(form.cost_price)} onChange={(value) => setNumberField(setForm, "cost_price", value)} />
            <FormField label="Selling Price" type="number" value={String(form.selling_price)} onChange={(value) => setNumberField(setForm, "selling_price", value)} />
          </div>
          <div className="mh-form-row">
            {!editingId && <FormField label="Opening Stock" type="number" value={String(form.stock)} onChange={(value) => setNumberField(setForm, "stock", value)} />}
            <FormField label="Low Stock Alert" type="number" value={String(form.low_stock_threshold)} onChange={(value) => setNumberField(setForm, "low_stock_threshold", value)} />
            <FormField label="Warranty Months" type="number" value={String(form.warranty_duration_months)} onChange={(value) => setNumberField(setForm, "warranty_duration_months", value)} />
          </div>
          {editingId && <p className="mh-empty">Use Inventory to change stock so every adjustment remains in the stock history.</p>}
          <TextAreaField label="Description" value={form.description ?? ""} onChange={(value) => setFormField(setForm, "description", value)} />
          <label className="mh-field">
            Product image
            <input accept="image/*" onChange={(event) => setImageFile(event.target.files?.[0] ?? null)} type="file" />
          </label>
          <label className="mh-check">
            <input checked={form.active} onChange={(event) => setFormField(setForm, "active", event.target.checked)} type="checkbox" />
            Active product
          </label>
          <div className="mh-actions">
            <Button type="submit">{editingId ? "Save Changes" : "Add Product"}</Button>
            {editingId && <Button tone="ghost" onClick={() => { setEditingId(undefined); setForm({ ...emptyProductForm, category: categories.data[0]?.name ?? "" }); }}>Cancel</Button>}
          </div>
        </form>
      </Card>

      <Card>
        <h2 className="mh-card-title">Catalogue</h2>
        <div className="mh-form-row">
          <FormField label="Search product" value={search} onChange={setSearch} />
          <SelectField label="Filter category" value={categoryFilter} onChange={setCategoryFilter} options={["All", ...categories.data.map((category) => category.name)]} />
        </div>
        <ResourceStatus resources={[products, categories]} />
        <DataTable
          headers={["Image", "Name", "Brand", "Category", "Price", "Stock", "Warranty", "Actions"]}
          rows={visibleProducts.map((product) => [
            product.image_url ? <img alt={product.name} className="mh-product-thumb" src={product.image_url} /> : "No image",
            product.name,
            product.brand,
            product.category,
            money.format(Number(product.selling_price)),
            <StatusBadge tone={product.stock <= product.low_stock_threshold ? "danger" : "success"}>{product.stock}</StatusBadge>,
            `${product.warranty_duration_months} months`,
            <div className="mh-actions">
              <Button tone="ghost" onClick={() => edit(product)}>Edit</Button>
              <Button tone="danger" onClick={() => void run(async () => { await deleteSupplierProduct(supabase, product.id); await products.reload(); }, "Product deleted.")}>Delete</Button>
            </div>,
          ])}
        />
      </Card>
    </div>
  );
}

function InventoryPage({ run, supabase }: ActionProps) {
  const products = useSupplierResource(() => listSupplierProducts(supabase), [supabase], [] as SupplierProduct[]);
  const history = useSupplierResource(() => listSupplierStockHistory(supabase), [supabase], [] as SupplierStockHistory[]);
  const [productId, setProductId] = useState("");
  const [movementType, setMovementType] = useState<"Incoming" | "Adjustment">("Incoming");
  const [quantity, setQuantity] = useState("1");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!productId && products.data[0]) setProductId(products.data[0].id);
  }, [productId, products.data]);

  const lowStock = products.data.filter((product) => product.stock <= product.low_stock_threshold);

  return (
    <>
      <ResourceStatus resources={[products, history]} />
      <div className="mh-grid-2">
        <Card>
          <h2 className="mh-card-title">Real Stock</h2>
          <DataTable
            headers={["Product", "Current Stock", "Low Stock Alert", "Incoming", "Status"]}
            rows={products.data.map((product) => [
              product.name,
              product.stock,
              product.low_stock_threshold,
              product.incoming_stock,
              <StatusBadge tone={product.stock <= product.low_stock_threshold ? "danger" : "success"}>{product.stock <= product.low_stock_threshold ? "Low stock" : "In stock"}</StatusBadge>,
            ])}
          />
        </Card>
        <Card>
          <h2 className="mh-card-title">Add or Correct Stock</h2>
          <p className="mh-empty">Delivered orders deduct stock automatically. Use this form only for received stock or a counted-stock correction.</p>
          <form className="mh-form-stack" onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              await adjustSupplierStock(supabase, productId, movementType, Number(quantity), note);
              setNote("");
              await Promise.all([products.reload(), history.reload()]);
            }, "Stock movement recorded.");
          }}>
            <SelectField label="Product" value={productId} onChange={setProductId} options={products.data.map((product) => ({ label: product.name, value: product.id }))} />
            <SelectField
              label="Movement"
              value={movementType}
              onChange={(value) => setMovementType(value as "Incoming" | "Adjustment")}
              options={[
                { label: "Add received stock", value: "Incoming" },
                { label: "Correct counted stock", value: "Adjustment" },
              ]}
            />
            <FormField label={movementType === "Incoming" ? "Units received" : "Quantity change (+ / -)"} type="number" value={quantity} onChange={setQuantity} />
            <TextAreaField label="Note" value={note} onChange={setNote} />
            <Button type="submit">{movementType === "Incoming" ? "Add Stock" : "Save Adjustment"}</Button>
          </form>
        </Card>
      </div>
      <div className="mh-grid-2">
        <Card>
          <h2 className="mh-card-title">Low Stock Alerts</h2>
          {lowStock.length === 0 ? <EmptyState text="No low stock alerts from Supabase." /> : (
            <DataTable headers={["Product", "Stock", "Alert At"]} rows={lowStock.map((product) => [product.name, product.stock, product.low_stock_threshold])} />
          )}
        </Card>
        <Card>
          <h2 className="mh-card-title">Stock History</h2>
          <DataTable
            headers={["Product", "Movement", "Quantity", "Order", "Note", "Date"]}
            rows={history.data.map((item) => [item.product_name, item.change_type, item.quantity, item.order_id ?? "-", item.note ?? "-", formatDateTime(item.created_at)])}
          />
        </Card>
      </div>
    </>
  );
}

function OrdersPage({ run, supabase }: ActionProps) {
  const orders = useSupplierResource(() => listSupplierOrders(supabase), [supabase], [] as SupplierOrder[]);
  const invoices = useSupplierResource(() => listSupplierInvoices(supabase), [supabase], [] as SupplierInvoice[]);
  const commissions = useSupplierResource(() => listSupplierCommissions(supabase), [supabase], [] as SupplierCommission[]);
  const [selectedInvoice, setSelectedInvoice] = useState<SupplierInvoice | null>(null);

  const invoiceFor = (order: SupplierOrder) => invoices.data.find((invoice) => invoice.order_id === order.id || invoice.invoice_number === order.invoice_number) ?? null;

  return (
    <div className="mh-form-stack">
      <ResourceStatus resources={[orders, invoices, commissions]} />
      <Card tone="blue">
        <h2 className="mh-card-title">Transparent ManFix Settlement</h2>
        <p>For every delivered parts order, ManFix records the gross sale, charges a 20% platform commission, and credits the remaining 80% to your supplier wallet.</p>
      </Card>
      <Card>
        <h2 className="mh-card-title">Orders</h2>
        <DataTable
          headers={["Order ID", "Workshop", "Product", "Qty", "Gross Sale", "ManFix Fee", "Net Payout", "Status", "Actions"]}
          rows={orders.data.map((order) => [
            order.id,
            order.workshop,
            order.product_name,
            order.quantity,
            money.format(Number(order.amount)),
            order.status === "Delivered" ? money.format(Number(order.commission_amount)) : "Calculated on delivery",
            order.status === "Delivered" ? money.format(Number(order.supplier_net_amount)) : "-",
            <StatusBadge tone={order.status === "Cancelled" ? "danger" : order.status === "Delivered" ? "success" : "warning"}>{order.status}</StatusBadge>,
            <div className="mh-actions">
              {nextOrderStatuses(order.status).map((status) => (
                <Button key={status} tone={status === "Cancelled" ? "danger" : "ghost"} onClick={() => void run(async () => {
                  await setSupplierOrderStatus(supabase, order.id, status);
                  await Promise.all([orders.reload(), invoices.reload(), commissions.reload()]);
                }, `Order ${order.id} marked ${status}.`)}>
                  {status}
                </Button>
              ))}
              <Button tone="ghost" onClick={() => setSelectedInvoice(invoiceFor(order))}>View Invoice</Button>
            </div>,
          ])}
        />
      </Card>
      {selectedInvoice && (
        <Card tone="blue">
          <h2 className="mh-card-title">Invoice {selectedInvoice.invoice_number}</h2>
          <div className="mh-detail-grid">
            <Detail label="Gross sale" value={money.format(Number(selectedInvoice.parts_subtotal))} />
            <Detail label={`ManFix fee (${Number(selectedInvoice.commission_rate)}%)`} value={money.format(Number(selectedInvoice.commission_amount))} />
            <Detail label="Your net payout" value={money.format(Number(selectedInvoice.supplier_net_amount))} />
            <Detail label="Customer invoice total" value={money.format(Number(selectedInvoice.total))} />
            <Detail label="Status" value={selectedInvoice.status} />
            <Detail label="Issued" value={formatDateTime(selectedInvoice.issued_at)} />
          </div>
          {selectedInvoice.pdf_url && <a className="mh-link" href={selectedInvoice.pdf_url} rel="noreferrer" target="_blank">Open invoice file</a>}
        </Card>
      )}
      <Card>
        <h2 className="mh-card-title">Commission History</h2>
        <DataTable
          headers={["Order", "Invoice", "Gross Sale", "Rate", "ManFix Fee", "Your Payout", "Status", "Settled"]}
          rows={commissions.data.map((item) => [
            item.order_id,
            item.invoice_number,
            money.format(Number(item.gross_amount)),
            `${Number(item.commission_rate)}%`,
            money.format(Number(item.commission_amount)),
            money.format(Number(item.supplier_net_amount)),
            item.status,
            item.settled_at ? formatDateTime(item.settled_at) : "-",
          ])}
        />
      </Card>
    </div>
  );
}

function WithdrawalsPage({ run, supabase }: ActionProps) {
  const wallet = useSupplierResource(() => getSupplierWallet(supabase), [supabase], null as SupplierWallet | null);
  const withdrawals = useSupplierResource(() => listSupplierWithdrawals(supabase), [supabase], [] as SupplierWithdrawal[]);
  const [amount, setAmount] = useState("");
  const [bank, setBank] = useState("");
  const [accountNumber, setAccountNumber] = useState("");

  return (
    <div className="mh-grid-2">
      <Card>
        <h2 className="mh-card-title">Wallet Balance</h2>
        <ResourceStatus resources={[wallet]} />
        <div className="mh-detail-grid">
          <Detail label="Available Balance" value={money.format(Number(wallet.data?.available_balance ?? 0))} />
          <Detail label="Pending Balance" value={money.format(Number(wallet.data?.pending_balance ?? 0))} />
          <Detail label="Currency" value={wallet.data?.currency ?? "MYR"} />
        </div>
        <form className="mh-form-stack" onSubmit={(event) => {
          event.preventDefault();
          void run(async () => {
            await submitSupplierWithdrawal(supabase, Number(amount), bank, accountNumber);
            setAmount("");
            await Promise.all([wallet.reload(), withdrawals.reload()]);
          }, "Withdrawal request submitted.");
        }}>
          <FormField label="Amount" type="number" value={amount} onChange={setAmount} />
          <FormField label="Bank" value={bank} onChange={setBank} />
          <FormField label="Account Number" value={accountNumber} onChange={setAccountNumber} />
          <Button type="submit">Create Withdraw</Button>
        </form>
      </Card>
      <Card>
        <h2 className="mh-card-title">Withdrawal History</h2>
        <ResourceStatus resources={[withdrawals]} />
        <DataTable
          headers={["Amount", "Bank", "Account", "Status", "Created"]}
          rows={withdrawals.data.map((item) => [
            money.format(Number(item.amount)),
            item.bank,
            maskAccount(item.account_number),
            <StatusBadge tone={item.status === "Rejected" ? "danger" : item.status === "Paid" ? "success" : "warning"}>{item.status}</StatusBadge>,
            formatDateTime(item.created_at),
          ])}
        />
      </Card>
    </div>
  );
}

function WarrantyPage({ run, supabase }: ActionProps) {
  const claims = useSupplierResource(() => listSupplierWarrantyClaims(supabase), [supabase], [] as SupplierWarrantyClaim[]);

  return (
    <Card>
      <h2 className="mh-card-title">Warranty Management</h2>
      <ResourceStatus resources={[claims]} />
      <StatGrid items={[
        ["Pending Claims", claims.data.filter((claim) => claim.status === "Pending Review").length],
        ["Approved Claims", claims.data.filter((claim) => claim.status === "Approved").length],
        ["Rejected Claims", claims.data.filter((claim) => claim.status === "Rejected").length],
        ["Inspection Required", claims.data.filter((claim) => claim.status === "Inspection Requested").length],
      ]} />
      <DataTable
        headers={["Claim", "Warranty", "Description", "Status", "Submitted", "Actions"]}
        rows={claims.data.map((claim) => [
          claim.id,
          claim.warranty_id,
          claim.description,
          <StatusBadge tone={claim.status === "Rejected" ? "danger" : claim.status === "Approved" ? "success" : "warning"}>{claim.status}</StatusBadge>,
          formatDateTime(claim.submitted_at),
          <div className="mh-actions">
            {(["Approved", "Rejected", "Inspection Requested"] satisfies Array<Exclude<SupplierWarrantyClaim["status"], "Pending Review">>).map((status) => (
              <Button key={status} tone={status === "Rejected" ? "danger" : "ghost"} onClick={() => void run(async () => {
                await reviewSupplierWarrantyClaim(supabase, claim.id, status);
                await claims.reload();
              }, `Warranty claim ${status}.`)}>
                {status === "Approved" ? "Approve" : status === "Rejected" ? "Reject" : "Request Inspection"}
              </Button>
            ))}
          </div>,
        ])}
      />
    </Card>
  );
}

function AnalyticsPage({ supabase }: { supabase: Db }) {
  const products = useSupplierResource(() => listSupplierProducts(supabase), [supabase], [] as SupplierProduct[]);
  const orders = useSupplierResource(() => listSupplierOrders(supabase), [supabase], [] as SupplierOrder[]);
  const claims = useSupplierResource(() => listSupplierWarrantyClaims(supabase), [supabase], [] as SupplierWarrantyClaim[]);
  const commissions = useSupplierResource(() => listSupplierCommissions(supabase), [supabase], [] as SupplierCommission[]);

  const analytics = useMemo(() => {
    const grossSales = commissions.data.reduce((sum, item) => sum + Number(item.gross_amount), 0);
    const manFixFees = commissions.data.reduce((sum, item) => sum + Number(item.commission_amount), 0);
    const netRevenue = commissions.data.reduce((sum, item) => sum + Number(item.supplier_net_amount), 0);
    const deliveredCost = orders.data.filter((order) => order.status === "Delivered").reduce((sum, order) => sum + Number(order.cost_total), 0);
    const profit = netRevenue - deliveredCost;
    const workshops = groupByText(orders.data, (order) => order.workshop, (order) => Number(order.amount));
    const repeatCustomers = groupByText(orders.data, (order) => order.customer, () => 1).filter((item) => item.value > 1);
    return {
      monthlyRevenue: groupByMonth(orders.data),
      productRevenue: topProducts(orders.data),
      stats: [
        ["Gross Sales", money.format(grossSales)],
        ["ManFix Fees (20%)", money.format(manFixFees)],
        ["Net Revenue", money.format(netRevenue)],
        ["Profit After Fees", money.format(profit)],
        ["Top Products", products.data.length],
        ["Top Workshops", workshops.length],
        ["Repeat Customers", repeatCustomers.length],
        ["Warranty Claims", claims.data.length],
      ] as Array<[string, string | number]>,
      workshops,
      repeatCustomers,
    };
  }, [claims.data.length, commissions.data, orders.data, products.data.length]);

  return (
    <>
      <ResourceStatus resources={[products, orders, claims, commissions]} />
      <StatGrid items={analytics.stats} />
      <div className="mh-grid-2">
        <ChartOrEmpty title="Revenue" data={analytics.monthlyRevenue} />
        <ChartOrEmpty title="Top Products" data={analytics.productRevenue} />
        <ChartOrEmpty title="Top Workshops" data={analytics.workshops} />
        <ChartOrEmpty title="Repeat Customers" data={analytics.repeatCustomers} />
      </div>
    </>
  );
}

function ProfilePage({ run, supabase }: ActionProps) {
  const profile = useSupplierResource(async () => {
    const rows = await fetchRows<SupplierProfile>(supabase, "supplier_profiles");
    return rows[0] ?? null;
  }, [supabase], null as SupplierProfile | null);
  const [form, setForm] = useState({
    bank_account_number: "",
    bank_name: "",
    company_name: "",
    contact_name: "",
    email: "",
    phone: "",
  });

  useEffect(() => {
    if (!profile.data) return;
    setForm({
      bank_account_number: profile.data.bank_account_number ?? "",
      bank_name: profile.data.bank_name ?? "",
      company_name: profile.data.company_name,
      contact_name: profile.data.contact_name ?? "",
      email: profile.data.email ?? "",
      phone: profile.data.phone ?? "",
    });
  }, [profile.data]);

  return (
    <div className="mh-grid-2">
      <Card>
        <h2 className="mh-card-title">Supplier Profile</h2>
        <ResourceStatus resources={[profile]} />
        <form className="mh-form-stack" onSubmit={(event) => {
          event.preventDefault();
          void run(async () => {
            if (profile.data?.id) {
              const { error } = await supabase.from("supplier_profiles").update(form).eq("id", profile.data.id);
              if (error) throw error;
            } else {
              const { error } = await supabase.from("supplier_profiles").insert(form);
              if (error) throw error;
            }
            await profile.reload();
          }, "Supplier profile saved.");
        }}>
          <FormField label="Company Name" value={form.company_name} onChange={(value) => setProfileForm(setForm, "company_name", value)} />
          <FormField label="Contact Name" value={form.contact_name} onChange={(value) => setProfileForm(setForm, "contact_name", value)} />
          <FormField label="Email" type="email" value={form.email} onChange={(value) => setProfileForm(setForm, "email", value)} />
          <FormField label="Phone" value={form.phone} onChange={(value) => setProfileForm(setForm, "phone", value)} />
          <FormField label="Bank" value={form.bank_name} onChange={(value) => setProfileForm(setForm, "bank_name", value)} />
          <FormField label="Bank Account Number" value={form.bank_account_number} onChange={(value) => setProfileForm(setForm, "bank_account_number", value)} />
          <Button type="submit">Save Profile</Button>
        </form>
      </Card>
      <Card tone="blue">
        <h2 className="mh-card-title">Account Status</h2>
        <div className="mh-detail-grid">
          <Detail label="Status" value={profile.data?.status ?? "Not created"} />
          <Detail label="Verified" value={profile.data?.verified ? "Yes" : "No"} />
          <Detail label="Rating" value={profile.data ? String(profile.data.rating) : "No rating"} />
        </div>
      </Card>
    </div>
  );
}

type ActionProps = {
  run: (task: () => Promise<void>, success: string) => Promise<void>;
  supabase: Db;
};

type Resource<T> = {
  data: T;
  error: string | null;
  loading: boolean;
  reload: () => Promise<void>;
};

function useSupplierResource<T>(load: () => Promise<T>, deps: unknown[], initialData: T): Resource<T> {
  const [data, setData] = useState<T>(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await load());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load Supabase records.");
      setData(initialData);
    } finally {
      setLoading(false);
    }
  }, deps);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, error, loading, reload };
}

function ResourceStatus({ resources }: { resources: Array<Resource<unknown>> }) {
  const loading = resources.some((resource) => resource.loading);
  const error = resources.find((resource) => resource.error)?.error;
  if (loading) return <p className="mh-empty">Loading Supabase records...</p>;
  if (error) return <p className="mh-empty">{error}</p>;
  return null;
}

function SelectField({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: Array<string | { label: string; value: string }>;
  value: string;
}) {
  return (
    <label className="mh-field">
      {label}
      <select onChange={(event) => onChange(event.target.value)} value={value}>
        {options.map((option) => {
          const normalized = typeof option === "string" ? { label: option, value: option } : option;
          return <option key={normalized.value} value={normalized.value}>{normalized.label}</option>;
        })}
      </select>
    </label>
  );
}

function TextAreaField({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className="mh-field">
      {label}
      <textarea onChange={(event) => onChange(event.target.value)} rows={4} value={value} />
    </label>
  );
}

function StatusBadge({ children, tone }: { children: ReactNode; tone: "danger" | "success" | "warning" }) {
  return <span className={`mh-badge ${tone}`}>{children}</span>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="mh-detail">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ChartOrEmpty({ data, title }: { data: Array<{ label: string; value: number }>; title: string }) {
  if (data.length === 0) {
    return (
      <Card>
        <h2 className="mh-card-title">{title}</h2>
        <EmptyState text="No Supabase records available for this chart yet." />
      </Card>
    );
  }

  return <MiniChart data={data} title={title} />;
}

function setFormField<K extends keyof SupplierProductInput>(
  setForm: React.Dispatch<React.SetStateAction<SupplierProductInput>>,
  key: K,
  value: SupplierProductInput[K],
) {
  setForm((current) => ({ ...current, [key]: value }));
}

function setNumberField<K extends keyof SupplierProductInput>(
  setForm: React.Dispatch<React.SetStateAction<SupplierProductInput>>,
  key: K,
  value: string,
) {
  setForm((current) => ({ ...current, [key]: Number(value || 0) }));
}

function setProfileForm<T extends Record<string, string>, K extends keyof T>(
  setForm: React.Dispatch<React.SetStateAction<T>>,
  key: K,
  value: string,
) {
  setForm((current) => ({ ...current, [key]: value }));
}

function normalizeProductForm(form: SupplierProductInput): SupplierProductInput {
  return {
    ...form,
    brand: form.brand.trim(),
    category: form.category.trim(),
    cost_price: Number(form.cost_price),
    description: form.description?.trim() || null,
    incoming_stock: Number(form.incoming_stock),
    low_stock_threshold: Number(form.low_stock_threshold),
    name: form.name.trim(),
    selling_price: Number(form.selling_price),
    sku: form.sku?.trim() || null,
    stock: Number(form.stock),
    warranty_duration_months: Number(form.warranty_duration_months),
  };
}

function sameMonth(value: string) {
  const date = new Date(value);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function groupByRecentDays(orders: SupplierOrder[], days: number) {
  const today = new Date();
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (days - 1 - index));
    const key = date.toISOString().slice(0, 10);
    return {
      label: date.toLocaleDateString("en-MY", { day: "2-digit", month: "short" }),
      value: orders.filter((order) => order.created_at.startsWith(key)).reduce((sum, order) => sum + Number(order.amount), 0),
    };
  }).filter((item) => item.value > 0);
}

function groupByMonth(orders: SupplierOrder[]) {
  const map = new Map<string, number>();
  orders.forEach((order) => {
    const label = new Date(order.created_at).toLocaleDateString("en-MY", { month: "short" });
    map.set(label, (map.get(label) ?? 0) + Number(order.amount));
  });
  return Array.from(map, ([label, value]) => ({ label, value })).slice(-6);
}

function topProducts(orders: SupplierOrder[]) {
  return groupByText(orders, (order) => order.product_name, (order) => Number(order.quantity)).slice(0, 5);
}

function groupByText<T>(rows: T[], getLabel: (row: T) => string, getValue: (row: T) => number) {
  const map = new Map<string, number>();
  rows.forEach((row) => {
    const label = getLabel(row);
    map.set(label, (map.get(label) ?? 0) + getValue(row));
  });
  return Array.from(map, ([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-MY", { dateStyle: "medium", timeStyle: "short" });
}

function maskAccount(value: string) {
  return value.length <= 4 ? value : `**** ${value.slice(-4)}`;
}

function nextOrderStatuses(status: SupplierOrder["status"]): SupplierOrder["status"][] {
  if (status === "New") return ["Confirmed", "Cancelled"];
  if (status === "Confirmed") return ["Dispatched", "Cancelled"];
  if (status === "Dispatched") return ["Delivered", "Cancelled"];
  return [];
}

createRoot(document.getElementById("root")!).render(<StrictMode><BrowserRouter><SupplierApp /></BrowserRouter></StrictMode>);
