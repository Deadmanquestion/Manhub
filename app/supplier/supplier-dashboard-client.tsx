"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { HashRouter, Navigate, NavLink, Route, Routes } from "react-router-dom";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Product = {
  active: boolean;
  brand: string;
  category: string;
  cost_price: number;
  created_at: string;
  id: string;
  image_url: string | null;
  incoming_stock: number;
  name: string;
  selling_price: number;
  stock: number;
  warranty_duration_months: number;
};

type SupplierOrder = {
  amount: number;
  cost_total: number;
  created_at: string;
  customer: string;
  id: string;
  invoice_number: string;
  product_name: string;
  quantity: number;
  status: "New" | "Confirmed" | "Dispatched" | "Delivered" | "Cancelled";
  workshop: string;
};

type StockHistory = {
  change_type: "Sale" | "Incoming" | "Adjustment";
  created_at: string;
  id: string;
  note: string | null;
  product_id: string | null;
  product_name: string;
  quantity: number;
};

type Withdrawal = {
  account_number: string;
  amount: number;
  bank: string;
  created_at: string;
  id: string;
  status: "Pending" | "Approved" | "Rejected" | "Paid";
};

type SupplierProfile = {
  bank_account_number: string | null;
  bank_name: string | null;
  company_name: string;
  contact_name: string | null;
  email: string | null;
  id: string;
  phone: string | null;
  rating: number;
};

type WarrantyClaim = {
  description: string;
  id: string;
  inspection_status: string | null;
  status: "Pending Review" | "Approved" | "Rejected" | "Inspection Requested";
  submitted_at: string;
  warranty_id: string;
  warranties?: {
    part_brand: string;
    part_name: string;
    workshop_name: string;
  } | null;
};

type SupplierState = {
  claims: WarrantyClaim[];
  orders: SupplierOrder[];
  products: Product[];
  profile: SupplierProfile | null;
  stockHistory: StockHistory[];
  withdrawals: Withdrawal[];
};

type ProductForm = {
  brand: string;
  category: string;
  cost_price: string;
  image_url: string;
  incoming_stock: string;
  name: string;
  selling_price: string;
  stock: string;
  warranty_duration_months: string;
};

type ProfileForm = {
  bank_account_number: string;
  bank_name: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
};

const emptyState: SupplierState = {
  claims: [],
  orders: [],
  products: [],
  profile: null,
  stockHistory: [],
  withdrawals: [],
};

const navItems = [
  { label: "Dashboard", path: "/dashboard" },
  { label: "Products", path: "/products" },
  { label: "Orders", path: "/orders" },
  { label: "Inventory", path: "/inventory" },
  { label: "Warranty", path: "/warranty" },
  { label: "Withdraw", path: "/withdraw" },
  { label: "Analytics", path: "/analytics" },
  { label: "Profile", path: "/profile" },
];

export default function SupplierDashboardClient() {
  const [mounted, setMounted] = useState(false);
  const [supabase] = useState(() => createSupabaseBrowserClient());

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  if (!mounted) {
    return <ShellLoader />;
  }

  return (
    <HashRouter>
      <SupplierDashboardShell supabase={supabase} />
    </HashRouter>
  );
}

function SupplierDashboardShell({ supabase }: { supabase: SupabaseClient | null }) {
  const [data, setData] = useState<SupplierState>(emptyState);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState<User | null>(null);

  const refresh = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      setError("Connect Supabase environment variables to run the supplier dashboard.");
      return;
    }

    setLoading(true);
    setError("");

    const { data: sessionData } = await supabase.auth.getSession();
    const currentUser = sessionData.session?.user ?? null;
    setUser(currentUser);

    if (!currentUser) {
      setData(emptyState);
      setLoading(false);
      return;
    }

    const [products, orders, stockHistory, withdrawals, profile, claims] = await Promise.all([
      supabase.from("supplier_products").select("*").order("created_at", { ascending: false }),
      supabase.from("supplier_orders").select("*").order("created_at", { ascending: false }),
      supabase.from("supplier_stock_history").select("*").order("created_at", { ascending: false }).limit(30),
      supabase.from("supplier_withdrawals").select("*").order("created_at", { ascending: false }),
      supabase.from("supplier_profiles").select("*").maybeSingle(),
      supabase
        .from("warranty_claims")
        .select("id,warranty_id,description,status,inspection_status,submitted_at,warranties(part_brand,part_name,workshop_name)")
        .order("submitted_at", { ascending: false }),
    ]);

    const queryError = products.error ?? orders.error ?? stockHistory.error ?? withdrawals.error ?? profile.error ?? claims.error;
    if (queryError) {
      setError(queryError.message);
      setLoading(false);
      return;
    }

    setData({
      claims: normalizeClaims(claims.data ?? []),
      orders: (orders.data ?? []) as SupplierOrder[],
      products: (products.data ?? []) as Product[],
      profile: profile.data as SupplierProfile | null,
      stockHistory: (stockHistory.data ?? []) as StockHistory[],
      withdrawals: (withdrawals.data ?? []) as Withdrawal[],
    });
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => void refresh());
    return () => cancelAnimationFrame(frame);
  }, [refresh]);

  async function signIn() {
    if (!supabase) return;
    setError("");
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(signInError.message);
      return;
    }
    setMessage("Signed in.");
    await refresh();
  }

  async function signUp() {
    if (!supabase) return;
    setError("");
    const { error: signUpError } = await supabase.auth.signUp({ email, password });
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    setMessage("Account created. Confirm email if your Supabase project requires it.");
    await refresh();
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setData(emptyState);
    setMessage("Signed out.");
  }

  const actions = useMemo(() => createActions(supabase, refresh, setError, setMessage), [supabase, refresh]);
  const metrics = useMemo(() => buildMetrics(data), [data]);

  return (
    <main className="min-h-screen bg-[#07111f] text-slate-100">
      <div className="grid min-h-screen lg:grid-cols-[260px_1fr]">
        <aside className="border-b border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl lg:border-b-0 lg:border-r">
          <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.07] p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">ManHub</p>
            <h1 className="mt-2 text-2xl font-black">Supplier</h1>
            <p className="mt-1 text-xs text-slate-400">{data.profile?.company_name ?? "Secure supplier workspace"}</p>
          </div>
          <nav className="grid grid-cols-2 gap-2 lg:grid-cols-1">
            {navItems.map((item) => (
              <NavLink
                className={({ isActive }) => [
                  "rounded-xl px-3 py-3 text-sm font-black transition",
                  isActive ? "bg-blue-500 text-white shadow-lg shadow-blue-950/40" : "bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]",
                ].join(" ")}
                key={item.path}
                to={item.path}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <section className="min-w-0 p-4 sm:p-6 lg:p-8">
          <header className="mb-6 flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-300">PartsHub operating cockpit</p>
              <h2 className="mt-1 text-2xl font-black">Supplier Dashboard</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="rounded-xl bg-white/10 px-4 py-2 text-sm font-black text-slate-100" onClick={refresh} type="button">Refresh</button>
              {user && <button className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-950" onClick={signOut} type="button">Sign out</button>}
            </div>
          </header>

          {message && <StatusNotice tone="success" text={message} />}
          {error && <StatusNotice tone="error" text={error} />}
          {loading && <ShellLoader />}
          {!loading && !user && (
            <AuthPanel
              email={email}
              password={password}
              setEmail={setEmail}
              setPassword={setPassword}
              signIn={signIn}
              signUp={signUp}
              supabaseReady={Boolean(supabase)}
            />
          )}
          {!loading && user && (
            <Routes>
              <Route element={<Navigate replace to="/dashboard" />} path="/" />
              <Route element={<DashboardPage data={data} metrics={metrics} />} path="/dashboard" />
              <Route element={<ProductsPage actions={actions} products={data.products} />} path="/products" />
              <Route element={<OrdersPage actions={actions} orders={data.orders} />} path="/orders" />
              <Route element={<InventoryPage actions={actions} products={data.products} stockHistory={data.stockHistory} />} path="/inventory" />
              <Route element={<WarrantyPage actions={actions} claims={data.claims} />} path="/warranty" />
              <Route element={<WithdrawPage actions={actions} metrics={metrics} profile={data.profile} withdrawals={data.withdrawals} />} path="/withdraw" />
              <Route element={<AnalyticsPage metrics={metrics} />} path="/analytics" />
              <Route element={<ProfilePage actions={actions} profile={data.profile} user={user} />} path="/profile" />
            </Routes>
          )}
        </section>
      </div>
    </main>
  );
}

function createActions(
  supabase: SupabaseClient | null,
  refresh: () => Promise<void>,
  setError: (error: string) => void,
  setMessage: (message: string) => void,
) {
  async function run(action: () => Promise<{ error: { message: string } | null }>, success: string) {
    if (!supabase) {
      setError("Supabase is not connected.");
      return;
    }
    setError("");
    const result = await action();
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setMessage(success);
    await refresh();
  }

  return {
    async deleteProduct(id: string) {
      await run(async () => await supabase!.from("supplier_products").delete().eq("id", id), "Product deleted.");
    },
    async receiveIncoming(product: Product) {
      await run(async () => {
        const stock = product.stock + product.incoming_stock;
        const update = await supabase!.from("supplier_products").update({ incoming_stock: 0, stock }).eq("id", product.id);
        if (update.error) return update;
        return supabase!.from("supplier_stock_history").insert({
          change_type: "Incoming",
          product_id: product.id,
          product_name: product.name,
          quantity: product.incoming_stock,
          note: "Incoming stock received",
        });
      }, "Incoming stock received.");
    },
    async saveProduct(form: ProductForm, editing?: Product) {
      const payload = {
        brand: form.brand,
        category: form.category,
        cost_price: Number(form.cost_price),
        image_url: form.image_url || null,
        incoming_stock: Number(form.incoming_stock),
        name: form.name,
        selling_price: Number(form.selling_price),
        stock: Number(form.stock),
        warranty_duration_months: Number(form.warranty_duration_months),
      };
      await run(
        async () => editing
          ? await supabase!.from("supplier_products").update(payload).eq("id", editing.id)
          : await supabase!.from("supplier_products").insert(payload),
        editing ? "Product updated." : "Product added.",
      );
    },
    async saveProfile(form: ProfileForm, user: User) {
      await run(async () => await supabase!.from("supplier_profiles").upsert({
        bank_account_number: form.bank_account_number,
        bank_name: form.bank_name,
        company_name: form.company_name,
        contact_name: form.contact_name,
        email: form.email,
        phone: form.phone,
        supplier_id: user.id,
      }, { onConflict: "supplier_id" }), "Profile saved.");
    },
    async submitWithdrawal(amount: string, bank: string, account: string) {
      await run(async () => await supabase!.from("supplier_withdrawals").insert({
        account_number: account,
        amount: Number(amount),
        bank,
      }), "Withdrawal request created.");
    },
    async updateClaim(claimId: string, status: WarrantyClaim["status"]) {
      await run(async () => await supabase!.from("warranty_claims").update({
        reviewed_at: new Date().toISOString(),
        status,
      }).eq("id", claimId), `Claim ${status.toLowerCase()}.`);
    },
    async updateOrderStatus(orderId: string, status: SupplierOrder["status"]) {
      await run(async () => await supabase!.from("supplier_orders").update({ status }).eq("id", orderId), `Order ${status.toLowerCase()}.`);
    },
  };
}

type Actions = ReturnType<typeof createActions>;

function DashboardPage({ data, metrics }: { data: SupplierState; metrics: ReturnType<typeof buildMetrics> }) {
  const kpis = [
    ["Today's Revenue", money(metrics.todayRevenue)],
    ["Monthly Revenue", money(metrics.monthlyRevenue)],
    ["Pending Withdrawal", money(metrics.pendingWithdrawal)],
    ["Orders Today", String(metrics.ordersToday)],
    ["Active Products", String(metrics.activeProducts)],
    ["Low Stock", String(metrics.lowStock)],
    ["Warranty Claims", String(data.claims.length)],
    ["Average Rating", metrics.averageRating.toFixed(1)],
  ];

  return (
    <PageFrame title="Dashboard" subtitle="Live supplier revenue, fulfilment, inventory, and warranty workload.">
      <KpiGrid items={kpis} />
      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard data={metrics.revenue7Days} title="Revenue 7 days" />
        <ChartCard data={metrics.monthlyRevenueChart} title="Monthly Revenue" />
        <ChartCard data={metrics.topSellingProducts} title="Top Selling Products" />
      </div>
    </PageFrame>
  );
}

function ProductsPage({ actions, products }: { actions: Actions; products: Product[] }) {
  const [editing, setEditing] = useState<Product | undefined>();
  const [formOpen, setFormOpen] = useState(false);
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const categories = ["All", ...Array.from(new Set(products.map((item) => item.category)))];
  const filtered = products.filter((item) => {
    const matchesSearch = `${item.name} ${item.brand}`.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === "All" || item.category === category;
    return matchesSearch && matchesCategory;
  });

  return (
    <PageFrame title="Products" subtitle="Create and maintain the supplier catalogue shown to ManHub workshops.">
      <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_220px_auto]">
        <input className="field" placeholder="Search product" value={search} onChange={(event) => setSearch(event.target.value)} />
        <select className="field" value={category} onChange={(event) => setCategory(event.target.value)}>
          {categories.map((item) => <option key={item}>{item}</option>)}
        </select>
        <button className="primary-button" onClick={() => { setEditing(undefined); setFormOpen(true); }} type="button">Add Product</button>
      </div>
      {formOpen && <ProductEditor actions={actions} editing={editing} onClose={() => setFormOpen(false)} />}
      <div className="grid gap-3">
        {filtered.length === 0 && <EmptyPanel text="No products match this search." />}
        {filtered.map((product) => (
          <article className="glass-row" key={product.id}>
            <div className="flex min-w-0 items-center gap-3">
              <div className="h-14 w-14 shrink-0 rounded-xl border border-white/10 bg-slate-800 bg-cover bg-center" style={{ backgroundImage: product.image_url ? `url(${product.image_url})` : undefined }} />
              <div className="min-w-0">
                <h3 className="truncate text-base font-black">{product.brand} {product.name}</h3>
                <p className="text-sm text-slate-400">{product.category} - Stock {product.stock} - {product.warranty_duration_months} month warranty</p>
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-sm font-black text-emerald-300">{money(product.selling_price)}</span>
              <button className="ghost-button" onClick={() => { setEditing(product); setFormOpen(true); }} type="button">Edit</button>
              <button className="danger-button" onClick={() => actions.deleteProduct(product.id)} type="button">Delete</button>
            </div>
          </article>
        ))}
      </div>
    </PageFrame>
  );
}

function OrdersPage({ actions, orders }: { actions: Actions; orders: SupplierOrder[] }) {
  return (
    <PageFrame title="Orders" subtitle="Fulfilment queue from ManHub workshops and customer jobs.">
      <DataTable
        headers={["Order ID", "Workshop", "Customer", "Product", "Qty", "Status", "Invoice", "Actions"]}
        rows={orders.map((order) => [
          order.id,
          order.workshop,
          order.customer,
          order.product_name,
          String(order.quantity),
          order.status,
          order.invoice_number,
          <div className="flex flex-wrap gap-2" key={order.id}>
            <button className="tiny-button" onClick={() => actions.updateOrderStatus(order.id, "Confirmed")} type="button">Confirm</button>
            <button className="tiny-button" onClick={() => actions.updateOrderStatus(order.id, "Dispatched")} type="button">Dispatch</button>
            <button className="tiny-button" onClick={() => actions.updateOrderStatus(order.id, "Delivered")} type="button">Delivered</button>
          </div>,
        ])}
      />
    </PageFrame>
  );
}

function InventoryPage({ actions, products, stockHistory }: { actions: Actions; products: Product[]; stockHistory: StockHistory[] }) {
  return (
    <PageFrame title="Inventory" subtitle="Monitor stock health and receive incoming inventory.">
      <div className="grid gap-4 xl:grid-cols-3">
        <InventoryPanel title="Current Stock" products={products} render={(product) => `${product.stock} units`} />
        <InventoryPanel title="Low Stock" products={products.filter((item) => item.stock <= 5)} render={(product) => `${product.stock} left`} />
        <InventoryPanel title="Incoming Stock" products={products.filter((item) => item.incoming_stock > 0)} render={(product) => (
          <button className="tiny-button" onClick={() => actions.receiveIncoming(product)} type="button">Receive {product.incoming_stock}</button>
        )} />
      </div>
      <section className="mt-4 rounded-2xl border border-white/10 bg-white/[0.06] p-4">
        <h3 className="text-lg font-black">Stock History</h3>
        <div className="mt-3 grid gap-2">
          {stockHistory.length === 0 && <EmptyPanel text="No stock history yet." />}
          {stockHistory.map((item) => (
            <article className="rounded-xl bg-white/[0.05] p-3" key={item.id}>
              <strong>{item.product_name}</strong>
              <p className="text-sm text-slate-400">{item.change_type} - {item.quantity} units - {formatDate(item.created_at)}</p>
            </article>
          ))}
        </div>
      </section>
    </PageFrame>
  );
}

function WithdrawPage({ actions, metrics, profile, withdrawals }: { actions: Actions; metrics: ReturnType<typeof buildMetrics>; profile: SupplierProfile | null; withdrawals: Withdrawal[] }) {
  const [amount, setAmount] = useState("");
  const [bank, setBank] = useState(profile?.bank_name ?? "");
  const [account, setAccount] = useState(profile?.bank_account_number ?? "");

  return (
    <PageFrame title="Withdraw" subtitle="Request settlement from completed supplier payouts.">
      <KpiGrid items={[["Available Balance", money(metrics.availableBalance)], ["Pending Balance", money(metrics.pendingWithdrawal)]]} />
      <section className="mb-4 rounded-2xl border border-white/10 bg-white/[0.06] p-4">
        <h3 className="text-lg font-black">Withdrawal Request</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <input className="field" placeholder="Amount" value={amount} onChange={(event) => setAmount(event.target.value)} />
          <input className="field" placeholder="Bank" value={bank} onChange={(event) => setBank(event.target.value)} />
          <input className="field" placeholder="Account Number" value={account} onChange={(event) => setAccount(event.target.value)} />
        </div>
        <button className="primary-button mt-3" onClick={() => actions.submitWithdrawal(amount, bank, account)} type="button">Create Withdraw</button>
      </section>
      <DataTable
        headers={["Amount", "Bank", "Account Number", "Status", "Date"]}
        rows={withdrawals.map((item) => [money(item.amount), item.bank, item.account_number, item.status, formatDate(item.created_at)])}
      />
    </PageFrame>
  );
}

function WarrantyPage({ actions, claims }: { actions: Actions; claims: WarrantyClaim[] }) {
  const cards = [
    ["Pending Claims", claims.filter((item) => item.status === "Pending Review").length],
    ["Approved Claims", claims.filter((item) => item.status === "Approved").length],
    ["Rejected Claims", claims.filter((item) => item.status === "Rejected").length],
    ["Inspection Required", claims.filter((item) => item.status === "Inspection Requested").length],
  ];

  return (
    <PageFrame title="Warranty" subtitle="Review supplier warranty claims and request workshop inspection where needed.">
      <KpiGrid items={cards.map(([label, value]) => [String(label), String(value)])} />
      <div className="grid gap-3">
        {claims.length === 0 && <EmptyPanel text="No warranty claims assigned to this supplier." />}
        {claims.map((claim) => (
          <article className="glass-row" key={claim.id}>
            <div>
              <h3 className="font-black">{claim.id} - {claim.warranties?.part_brand} {claim.warranties?.part_name}</h3>
              <p className="text-sm text-slate-400">{claim.description}</p>
              <p className="mt-1 text-xs font-black text-blue-300">{claim.status} {claim.inspection_status ? `- ${claim.inspection_status}` : ""}</p>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button className="tiny-button" onClick={() => actions.updateClaim(claim.id, "Approved")} type="button">Approve</button>
              <button className="danger-button" onClick={() => actions.updateClaim(claim.id, "Rejected")} type="button">Reject</button>
              <button className="ghost-button" onClick={() => actions.updateClaim(claim.id, "Inspection Requested")} type="button">Request Inspection</button>
            </div>
          </article>
        ))}
      </div>
    </PageFrame>
  );
}

function AnalyticsPage({ metrics }: { metrics: ReturnType<typeof buildMetrics> }) {
  return (
    <PageFrame title="Analytics" subtitle="Profitability, product concentration, workshop demand, and customer repeat signals.">
      <KpiGrid items={[["Revenue", money(metrics.monthlyRevenue)], ["Profit", money(metrics.profit)], ["Repeat Customers", String(metrics.repeatCustomers)], ["Top Workshops", String(metrics.topWorkshops.length)]]} />
      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard data={metrics.monthlyRevenueChart} title="Revenue" />
        <ChartCard data={metrics.profitChart} title="Profit" />
        <ChartCard data={metrics.topSellingProducts} title="Top Products" />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ListPanel items={metrics.topWorkshops} title="Top Workshops" />
        <ListPanel items={metrics.topCustomers} title="Repeat Customers" />
      </div>
    </PageFrame>
  );
}

function ProfilePage({ actions, profile, user }: { actions: Actions; profile: SupplierProfile | null; user: User }) {
  const [form, setForm] = useState<ProfileForm>({
    bank_account_number: profile?.bank_account_number ?? "",
    bank_name: profile?.bank_name ?? "",
    company_name: profile?.company_name ?? "",
    contact_name: profile?.contact_name ?? "",
    email: profile?.email ?? user.email ?? "",
    phone: profile?.phone ?? "",
  });

  function update(field: keyof ProfileForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  return (
    <PageFrame title="Profile" subtitle="Supplier business identity, support contact, and settlement account.">
      <section className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <input className="field" placeholder="Company Name" value={form.company_name} onChange={(event) => update("company_name", event.target.value)} />
          <input className="field" placeholder="Contact Name" value={form.contact_name} onChange={(event) => update("contact_name", event.target.value)} />
          <input className="field" placeholder="Email" value={form.email} onChange={(event) => update("email", event.target.value)} />
          <input className="field" placeholder="Phone" value={form.phone} onChange={(event) => update("phone", event.target.value)} />
          <input className="field" placeholder="Bank Name" value={form.bank_name} onChange={(event) => update("bank_name", event.target.value)} />
          <input className="field" placeholder="Bank Account Number" value={form.bank_account_number} onChange={(event) => update("bank_account_number", event.target.value)} />
        </div>
        <button className="primary-button mt-4" onClick={() => actions.saveProfile(form, user)} type="button">Save Profile</button>
      </section>
    </PageFrame>
  );
}

function ProductEditor({ actions, editing, onClose }: { actions: Actions; editing?: Product; onClose: () => void }) {
  const [form, setForm] = useState<ProductForm>({
    brand: editing?.brand ?? "",
    category: editing?.category ?? "Brake",
    cost_price: String(editing?.cost_price ?? ""),
    image_url: editing?.image_url ?? "",
    incoming_stock: String(editing?.incoming_stock ?? 0),
    name: editing?.name ?? "",
    selling_price: String(editing?.selling_price ?? ""),
    stock: String(editing?.stock ?? 0),
    warranty_duration_months: String(editing?.warranty_duration_months ?? 6),
  });

  function update(field: keyof ProductForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function save() {
    await actions.saveProduct(form, editing);
    onClose();
  }

  return (
    <section className="mb-4 rounded-2xl border border-blue-300/20 bg-blue-500/10 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-black">{editing ? "Edit Product" : "Add Product"}</h3>
        <button className="ghost-button" onClick={onClose} type="button">Close</button>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <input className="field" placeholder="Name" value={form.name} onChange={(event) => update("name", event.target.value)} />
        <input className="field" placeholder="Brand" value={form.brand} onChange={(event) => update("brand", event.target.value)} />
        <input className="field" placeholder="Category" value={form.category} onChange={(event) => update("category", event.target.value)} />
        <input className="field" placeholder="Cost Price" value={form.cost_price} onChange={(event) => update("cost_price", event.target.value)} />
        <input className="field" placeholder="Selling Price" value={form.selling_price} onChange={(event) => update("selling_price", event.target.value)} />
        <input className="field" placeholder="Stock" value={form.stock} onChange={(event) => update("stock", event.target.value)} />
        <input className="field" placeholder="Incoming Stock" value={form.incoming_stock} onChange={(event) => update("incoming_stock", event.target.value)} />
        <input className="field" placeholder="Warranty Duration" value={form.warranty_duration_months} onChange={(event) => update("warranty_duration_months", event.target.value)} />
        <input className="field" placeholder="Image URL" value={form.image_url} onChange={(event) => update("image_url", event.target.value)} />
      </div>
      <button className="primary-button mt-3" onClick={save} type="button">{editing ? "Save Changes" : "Add Product"}</button>
    </section>
  );
}

function AuthPanel({
  email,
  password,
  setEmail,
  setPassword,
  signIn,
  signUp,
  supabaseReady,
}: {
  email: string;
  password: string;
  setEmail: (email: string) => void;
  setPassword: (password: string) => void;
  signIn: () => void;
  signUp: () => void;
  supabaseReady: boolean;
}) {
  return (
    <section className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-white/[0.07] p-6 shadow-2xl shadow-black/30">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">Secure supplier access</p>
      <h2 className="mt-2 text-3xl font-black">Sign in to load live Supabase records</h2>
      <p className="mt-2 text-sm text-slate-400">Products, orders, withdrawals, and warranty claims are queried from Supabase with RLS.</p>
      {!supabaseReady && <p className="mt-3 rounded-xl bg-amber-400/10 p-3 text-sm font-bold text-amber-200">Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to enable this dashboard.</p>}
      <div className="mt-5 grid gap-3">
        <input className="field" placeholder="Supplier email" value={email} onChange={(event) => setEmail(event.target.value)} />
        <input className="field" placeholder="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        <div className="flex flex-wrap gap-2">
          <button className="primary-button" disabled={!supabaseReady} onClick={signIn} type="button">Sign in</button>
          <button className="ghost-button" disabled={!supabaseReady} onClick={signUp} type="button">Create supplier account</button>
        </div>
      </div>
    </section>
  );
}

function PageFrame({ children, subtitle, title }: { children: React.ReactNode; subtitle: string; title: string }) {
  return (
    <section>
      <div className="mb-5">
        <h2 className="text-3xl font-black">{title}</h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-400">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function KpiGrid({ items }: { items: string[][] }) {
  return (
    <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map(([label, value]) => (
        <article className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 shadow-xl shadow-black/10" key={label}>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
          <strong className="mt-2 block text-2xl font-black text-white">{value}</strong>
        </article>
      ))}
    </div>
  );
}

function ChartCard({ data, title }: { data: Array<{ label: string; value: number }>; title: string }) {
  const max = Math.max(1, ...data.map((item) => item.value));
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
      <h3 className="text-lg font-black">{title}</h3>
      <div className="mt-4 grid gap-3">
        {data.length === 0 && <EmptyPanel text="No chart data yet." />}
        {data.map((item) => (
          <div className="grid grid-cols-[88px_1fr_70px] items-center gap-2 text-sm" key={item.label}>
            <span className="truncate text-slate-400">{item.label}</span>
            <span className="h-3 overflow-hidden rounded-full bg-white/10">
              <span className="block h-full rounded-full bg-gradient-to-r from-emerald-300 to-blue-400" style={{ width: `${Math.max(8, (item.value / max) * 100)}%` }} />
            </span>
            <b className="text-right text-slate-200">{item.value > 999 ? money(item.value) : item.value}</b>
          </div>
        ))}
      </div>
    </article>
  );
}

function DataTable({ headers, rows }: { headers: string[]; rows: Array<Array<React.ReactNode>> }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead className="bg-white/[0.06] text-xs uppercase tracking-[0.12em] text-slate-500">
            <tr>{headers.map((item) => <th className="px-4 py-3" key={item}>{item}</th>)}</tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td className="px-4 py-5 text-slate-400" colSpan={headers.length}>No records found.</td></tr>}
            {rows.map((row, index) => (
              <tr className="border-t border-white/10" key={index}>
                {row.map((cell, cellIndex) => <td className="px-4 py-3" key={cellIndex}>{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function InventoryPanel({ products, render, title }: { products: Product[]; render: (product: Product) => React.ReactNode; title: string }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
      <h3 className="text-lg font-black">{title}</h3>
      <div className="mt-3 grid gap-2">
        {products.length === 0 && <EmptyPanel text="No records." />}
        {products.map((product) => (
          <article className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.05] p-3" key={product.id}>
            <span className="min-w-0 truncate text-sm font-black">{product.name}</span>
            <span className="text-sm text-slate-300">{render(product)}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

function ListPanel({ items, title }: { items: Array<{ label: string; value: number }>; title: string }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
      <h3 className="text-lg font-black">{title}</h3>
      <div className="mt-3 grid gap-2">
        {items.length === 0 && <EmptyPanel text="No records yet." />}
        {items.map((item) => (
          <article className="flex justify-between rounded-xl bg-white/[0.05] p-3" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">{text}</p>;
}

function StatusNotice({ text, tone }: { text: string; tone: "error" | "success" }) {
  const classes = tone === "error" ? "border-red-300/30 bg-red-500/10 text-red-100" : "border-emerald-300/30 bg-emerald-500/10 text-emerald-100";
  return <p className={`mb-4 rounded-xl border p-3 text-sm font-bold ${classes}`}>{text}</p>;
}

function ShellLoader() {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 text-sm font-bold text-slate-300">Loading supplier workspace...</div>;
}

function buildMetrics(data: SupplierState) {
  const todayKey = new Date().toISOString().slice(0, 10);
  const monthKey = new Date().toISOString().slice(0, 7);
  const paidWithdrawals = data.withdrawals.filter((item) => item.status === "Paid").reduce((sum, item) => sum + Number(item.amount), 0);
  const pendingWithdrawal = data.withdrawals.filter((item) => item.status === "Pending").reduce((sum, item) => sum + Number(item.amount), 0);
  const deliveredRevenue = data.orders.filter((item) => item.status === "Delivered").reduce((sum, item) => sum + Number(item.amount), 0);
  const profit = data.orders.reduce((sum, item) => sum + Number(item.amount) - Number(item.cost_total), 0);

  return {
    activeProducts: data.products.filter((item) => item.active).length,
    availableBalance: Math.max(0, deliveredRevenue - paidWithdrawals - pendingWithdrawal),
    averageRating: Number(data.profile?.rating ?? 0),
    lowStock: data.products.filter((item) => item.stock <= 5).length,
    monthlyRevenue: data.orders.filter((item) => item.created_at.startsWith(monthKey)).reduce((sum, item) => sum + Number(item.amount), 0),
    monthlyRevenueChart: monthlyChart(data.orders, "amount"),
    ordersToday: data.orders.filter((item) => item.created_at.startsWith(todayKey)).length,
    pendingWithdrawal,
    profit,
    profitChart: monthlyProfitChart(data.orders),
    repeatCustomers: repeated(data.orders.map((item) => item.customer)).reduce((sum, item) => sum + item.value, 0),
    revenue7Days: last7Days(data.orders),
    todayRevenue: data.orders.filter((item) => item.created_at.startsWith(todayKey)).reduce((sum, item) => sum + Number(item.amount), 0),
    topCustomers: repeated(data.orders.map((item) => item.customer)),
    topSellingProducts: topBy(data.orders, "product_name", "quantity"),
    topWorkshops: repeated(data.orders.map((item) => item.workshop)),
  };
}

function normalizeClaims(rows: unknown[]): WarrantyClaim[] {
  return rows.map((row) => {
    const claim = row as WarrantyClaim & { warranties?: WarrantyClaim["warranties"] | WarrantyClaim["warranties"][] };
    const warranty = Array.isArray(claim.warranties) ? claim.warranties[0] : claim.warranties;
    return {
      ...claim,
      warranties: warranty ?? null,
    };
  });
}

function last7Days(orders: SupplierOrder[]) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const key = date.toISOString().slice(0, 10);
    return {
      label: date.toLocaleDateString("en", { weekday: "short" }),
      value: orders.filter((item) => item.created_at.startsWith(key)).reduce((sum, item) => sum + Number(item.amount), 0),
    };
  });
}

function monthlyChart(orders: SupplierOrder[], field: "amount") {
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (5 - index));
    const key = date.toISOString().slice(0, 7);
    return {
      label: date.toLocaleDateString("en", { month: "short" }),
      value: orders.filter((item) => item.created_at.startsWith(key)).reduce((sum, item) => sum + Number(item[field]), 0),
    };
  });
}

function monthlyProfitChart(orders: SupplierOrder[]) {
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (5 - index));
    const key = date.toISOString().slice(0, 7);
    return {
      label: date.toLocaleDateString("en", { month: "short" }),
      value: orders.filter((item) => item.created_at.startsWith(key)).reduce((sum, item) => sum + Number(item.amount) - Number(item.cost_total), 0),
    };
  });
}

function repeated(values: string[]) {
  const map = new Map<string, number>();
  values.forEach((value) => map.set(value, (map.get(value) ?? 0) + 1));
  return Array.from(map.entries()).map(([label, value]) => ({ label, value })).filter((item) => item.value > 1).sort((a, b) => b.value - a.value).slice(0, 5);
}

function topBy(orders: SupplierOrder[], labelField: "product_name", valueField: "quantity") {
  const map = new Map<string, number>();
  orders.forEach((order) => map.set(order[labelField], (map.get(order[labelField]) ?? 0) + Number(order[valueField])));
  return Array.from(map.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 5);
}

function money(value: number) {
  return `RM ${Number(value || 0).toLocaleString("en-MY", { maximumFractionDigits: 0 })}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" });
}
