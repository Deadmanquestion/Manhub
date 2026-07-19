"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Section = "Overview" | "Users" | "Workshops" | "Suppliers" | "Orders" | "Payments" | "Withdrawals" | "Warranty" | "Analytics" | "Settings";
type AccountType = "Customer" | "Supplier" | "Workshop" | "Technician" | "Admin";
type AccountStatus = "Active" | "Pending Verification" | "Verified" | "Suspended" | "Banned";
type PaymentStatus = "Pending" | "Paid" | "Refunded" | "Escrow";
type WithdrawalStatus = "Pending" | "Approved" | "Rejected" | "Paid";
type ClaimStatus = "Pending Review" | "Approved" | "Rejected" | "Inspection Requested";

type AppUser = {
  account_type: AccountType;
  created_at: string;
  email: string;
  full_name: string;
  id: string;
  last_active_at: string | null;
  status: AccountStatus;
  verified: boolean;
};

type Workshop = {
  city: string;
  id: string;
  jobs_this_month: number;
  name: string;
  rating: number;
  revenue_this_month: number;
  services: string[];
  status: AccountStatus;
  verified: boolean;
};

type Supplier = {
  company_name: string;
  contact_name: string | null;
  email: string | null;
  id: string;
  rating: number;
  status: AccountStatus;
  supplier_id: string;
  verified: boolean;
};

type Product = {
  category: string;
  id: string;
  name: string;
  selling_price: number;
  stock: number;
  supplier_id: string;
};

type Order = {
  amount: number;
  cost_total: number;
  created_at: string;
  customer: string;
  id: string;
  invoice_number: string;
  product_name: string;
  quantity: number;
  status: "New" | "Confirmed" | "Dispatched" | "Delivered" | "Cancelled";
  supplier_id: string;
  workshop: string;
};

type Payment = {
  amount: number;
  commission_amount: number;
  created_at: string;
  id: string;
  method: string | null;
  order_id: string;
  payee_name: string;
  payer_name: string;
  status: PaymentStatus;
};

type Withdrawal = {
  account_number: string;
  amount: number;
  bank: string;
  created_at: string;
  id: string;
  status: WithdrawalStatus;
  supplier_id: string;
};

type WarrantyClaim = {
  description: string;
  id: string;
  inspection_status: string | null;
  status: ClaimStatus;
  submitted_at: string;
  warranty_id: string;
  warranties?: {
    part_brand: string;
    part_name: string;
    supplier_name: string;
    workshop_name: string;
  } | null;
};

type Setting = {
  ai_diagnosis_enabled: boolean;
  escrow_enabled: boolean;
  supplier_commission_percent: number;
  workshop_commission_percent: number;
};

type AiUsage = {
  confidence: number | null;
  created_at: string;
  diagnosis: string | null;
  id: string;
  vehicle_label: string | null;
};

type AdminState = {
  aiUsage: AiUsage[];
  claims: WarrantyClaim[];
  orders: Order[];
  payments: Payment[];
  products: Product[];
  settings: Setting | null;
  suppliers: Supplier[];
  users: AppUser[];
  withdrawals: Withdrawal[];
  workshops: Workshop[];
};

const emptyState: AdminState = {
  aiUsage: [],
  claims: [],
  orders: [],
  payments: [],
  products: [],
  settings: null,
  suppliers: [],
  users: [],
  withdrawals: [],
  workshops: [],
};

const sections: Section[] = ["Overview", "Users", "Workshops", "Suppliers", "Orders", "Payments", "Withdrawals", "Warranty", "Analytics", "Settings"];

export default function AdminDashboardClient() {
  const [ready, setReady] = useState(false);
  const [supabase] = useState(() => createSupabaseBrowserClient());

  useEffect(() => {
    const frame = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  if (!ready) return <Loader />;
  return <AdminShell supabase={supabase} />;
}

function AdminShell({ supabase }: { supabase: SupabaseClient | null }) {
  const [active, setActive] = useState<Section>("Overview");
  const [data, setData] = useState<AdminState>(emptyState);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState<User | null>(null);

  const refresh = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      setError("Connect Supabase environment variables to run the Admin Dashboard.");
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

    const [users, workshops, suppliers, products, orders, payments, withdrawals, claims, settings, aiUsage] = await Promise.all([
      supabase.from("app_users").select("*").order("created_at", { ascending: false }),
      supabase.from("platform_workshops").select("*").order("created_at", { ascending: false }),
      supabase.from("supplier_profiles").select("id,supplier_id,company_name,contact_name,email,rating,status,verified").order("created_at", { ascending: false }),
      supabase.from("supplier_products").select("id,supplier_id,name,category,selling_price,stock"),
      supabase.from("supplier_orders").select("*").order("created_at", { ascending: false }),
      supabase.from("platform_payments").select("*").order("created_at", { ascending: false }),
      supabase.from("supplier_withdrawals").select("*").order("created_at", { ascending: false }),
      supabase
        .from("warranty_claims")
        .select("id,warranty_id,description,status,inspection_status,submitted_at,warranties(part_brand,part_name,supplier_name,workshop_name)")
        .order("submitted_at", { ascending: false }),
      supabase.from("platform_settings").select("*").eq("id", "platform").maybeSingle(),
      supabase.from("ai_usage_events").select("*").order("created_at", { ascending: false }).limit(50),
    ]);

    const queryError = users.error ?? workshops.error ?? suppliers.error ?? products.error ?? orders.error ?? payments.error ?? withdrawals.error ?? claims.error ?? settings.error ?? aiUsage.error;
    if (queryError) {
      setError(queryError.message);
      setLoading(false);
      return;
    }

    setData({
      aiUsage: (aiUsage.data ?? []) as AiUsage[],
      claims: normalizeClaims(claims.data ?? []),
      orders: (orders.data ?? []) as Order[],
      payments: (payments.data ?? []) as Payment[],
      products: (products.data ?? []) as Product[],
      settings: settings.data as Setting | null,
      suppliers: (suppliers.data ?? []) as Supplier[],
      users: (users.data ?? []) as AppUser[],
      withdrawals: (withdrawals.data ?? []) as Withdrawal[],
      workshops: (workshops.data ?? []) as Workshop[],
    });
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => void refresh());
    return () => cancelAnimationFrame(frame);
  }, [refresh]);

  const actions = useMemo(() => createAdminActions(supabase, refresh, setError, setMessage), [supabase, refresh]);
  const metrics = useMemo(() => buildMetrics(data), [data]);

  async function signIn() {
    if (!supabase) return;
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(signInError.message);
      return;
    }
    setMessage("Admin signed in.");
    await refresh();
  }

  async function signUp() {
    if (!supabase) return;
    const { error: signUpError } = await supabase.auth.signUp({ email, password, options: { data: { app_role: "admin" } } });
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    setMessage("Admin account created. Confirm email if required, then set app_role=admin in Supabase.");
    await refresh();
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setData(emptyState);
    setMessage("Signed out.");
  }

  return (
    <main className="min-h-screen bg-[#060b12] text-slate-100">
      <div className="grid min-h-screen xl:grid-cols-[278px_1fr]">
        <aside className="border-b border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl xl:border-b-0 xl:border-r">
          <div className="mb-5 rounded-2xl border border-white/10 bg-gradient-to-br from-blue-500/20 to-emerald-400/10 p-4">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-200">ManHub HQ</p>
            <h1 className="mt-2 text-2xl font-black">Platform Admin</h1>
            <p className="mt-1 text-xs text-slate-400">Owner control center</p>
          </div>
          <nav className="grid grid-cols-2 gap-2 md:grid-cols-5 xl:grid-cols-1">
            {sections.map((item) => (
              <button className={`rounded-xl px-3 py-3 text-left text-sm font-black transition ${active === item ? "bg-blue-500 text-white shadow-lg shadow-blue-950/40" : "bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"}`} key={item} onClick={() => setActive(item)} type="button">
                {item}
              </button>
            ))}
          </nav>
        </aside>

        <section className="min-w-0 p-4 sm:p-6 lg:p-8">
          <header className="mb-6 flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">Operations cockpit</p>
              <h2 className="mt-1 text-3xl font-black">{active}</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="ghost-button" onClick={refresh} type="button">Refresh</button>
              {user && <button className="primary-button" onClick={signOut} type="button">Sign out</button>}
            </div>
          </header>

          {message && <Notice tone="success">{message}</Notice>}
          {error && <Notice tone="error">{error}</Notice>}
          {loading && <Loader />}
          {!loading && !user && <AuthPanel email={email} password={password} setEmail={setEmail} setPassword={setPassword} signIn={signIn} signUp={signUp} supabaseReady={Boolean(supabase)} />}
          {!loading && user && (
            <>
              {active === "Overview" && <Overview metrics={metrics} />}
              {active === "Users" && <UsersPage actions={actions} users={data.users} />}
              {active === "Workshops" && <WorkshopsPage actions={actions} workshops={data.workshops} />}
              {active === "Suppliers" && <SuppliersPage actions={actions} orders={data.orders} products={data.products} suppliers={data.suppliers} withdrawals={data.withdrawals} />}
              {active === "Orders" && <OrdersPage actions={actions} orders={data.orders} />}
              {active === "Payments" && <PaymentsPage actions={actions} payments={data.payments} />}
              {active === "Withdrawals" && <WithdrawalsPage actions={actions} withdrawals={data.withdrawals} />}
              {active === "Warranty" && <WarrantyPage actions={actions} claims={data.claims} />}
              {active === "Analytics" && <AnalyticsPage data={data} metrics={metrics} />}
              {active === "Settings" && <SettingsPage actions={actions} settings={data.settings} />}
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function createAdminActions(
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
    async updateClaim(id: string, status: ClaimStatus) {
      await run(async () => await supabase!.from("warranty_claims").update({ reviewed_at: new Date().toISOString(), status }).eq("id", id), `Warranty claim ${status.toLowerCase()}.`);
    },
    async updatePayment(id: string, status: PaymentStatus) {
      await run(async () => await supabase!.from("platform_payments").update({ status, updated_at: new Date().toISOString() }).eq("id", id), `Payment marked ${status.toLowerCase()}.`);
    },
    async updateOrder(id: string, status: Order["status"]) {
      await run(async () => await supabase!.from("supplier_orders").update({ status }).eq("id", id), `Order ${status.toLowerCase()}.`);
    },
    async updateSupplier(id: string, status: AccountStatus, verified = status === "Verified") {
      await run(async () => await supabase!.from("supplier_profiles").update({ status, verified }).eq("id", id), `Supplier ${status.toLowerCase()}.`);
    },
    async updateUser(id: string, status: AccountStatus, verified = status === "Verified") {
      await run(async () => await supabase!.from("app_users").update({ status, verified }).eq("id", id), `User ${status.toLowerCase()}.`);
    },
    async updateWorkshop(id: string, status: AccountStatus, verified = status === "Verified") {
      await run(async () => await supabase!.from("platform_workshops").update({ status, verified }).eq("id", id), `Workshop ${status.toLowerCase()}.`);
    },
    async updateWithdrawal(id: string, status: WithdrawalStatus) {
      await run(async () => await supabase!.from("supplier_withdrawals").update({ status, reviewed_at: new Date().toISOString() }).eq("id", id), `Withdrawal ${status.toLowerCase()}.`);
    },
    async saveSettings(settings: Setting) {
      await run(async () => await supabase!.from("platform_settings").upsert({ ...settings, id: "platform", updated_at: new Date().toISOString() }, { onConflict: "id" }), "Settings saved.");
    },
  };
}

type Actions = ReturnType<typeof createAdminActions>;

function Overview({ metrics }: { metrics: ReturnType<typeof buildMetrics> }) {
  return (
    <section>
      <KpiGrid items={[
        ["Total GMV", money(metrics.totalGmv)],
        ["Platform Revenue", money(metrics.platformRevenue)],
        ["Commission Earned", money(metrics.commissionEarned)],
        ["Today's Orders", String(metrics.todayOrders)],
        ["Monthly Orders", String(metrics.monthlyOrders)],
        ["Active Customers", String(metrics.activeCustomers)],
        ["Active Workshops", String(metrics.activeWorkshops)],
        ["Active Suppliers", String(metrics.activeSuppliers)],
        ["Warranty Claims", String(metrics.warrantyClaims)],
        ["Withdrawal Requests", String(metrics.withdrawalRequests)],
      ]} />
      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard title="Revenue" data={metrics.revenueChart} />
        <ChartCard title="Growth" data={metrics.growthChart} />
        <ChartCard title="Warranty Claims" data={metrics.claimChart} />
      </div>
    </section>
  );
}

function UsersPage({ actions, users }: { actions: Actions; users: AppUser[] }) {
  const [filter, setFilter] = useState<AccountType | "All">("All");
  const filtered = filter === "All" ? users : users.filter((user) => user.account_type === filter);
  return (
    <section>
      <div className="mb-4 flex flex-wrap gap-2">
        {(["All", "Customer", "Supplier", "Workshop", "Technician"] as const).map((item) => (
          <button className={`ghost-button ${filter === item ? "bg-blue-500 text-white" : ""}`} key={item} onClick={() => setFilter(item)} type="button">{item}</button>
        ))}
      </div>
      <DataTable
        headers={["Name", "Email", "Type", "Status", "Verified", "Actions"]}
        rows={filtered.map((user) => [
          user.full_name,
          user.email,
          user.account_type,
          user.status,
          user.verified ? "Yes" : "No",
          <ActionGroup key={user.id}>
            <button className="tiny-button" onClick={() => actions.updateUser(user.id, "Verified", true)} type="button">Verify</button>
            <button className="ghost-button" onClick={() => actions.updateUser(user.id, "Suspended", false)} type="button">Suspend</button>
            <button className="danger-button" onClick={() => actions.updateUser(user.id, "Banned", false)} type="button">Ban</button>
          </ActionGroup>,
        ])}
      />
    </section>
  );
}

function WorkshopsPage({ actions, workshops }: { actions: Actions; workshops: Workshop[] }) {
  return (
    <DataTable
      headers={["Workshop", "City", "Services", "Revenue", "Rating", "Status", "Actions"]}
      rows={workshops.map((item) => [
        item.name,
        item.city,
        item.services.join(", "),
        money(item.revenue_this_month),
        item.rating.toFixed(1),
        item.status,
        <ActionGroup key={item.id}>
          <button className="tiny-button" onClick={() => actions.updateWorkshop(item.id, "Verified", true)} type="button">Verify</button>
          <button className="ghost-button" onClick={() => actions.updateWorkshop(item.id, "Suspended", false)} type="button">Suspend</button>
          <button className="danger-button" onClick={() => actions.updateWorkshop(item.id, "Banned", false)} type="button">Ban</button>
        </ActionGroup>,
      ])}
    />
  );
}

function SuppliersPage({ actions, orders, products, suppliers, withdrawals }: { actions: Actions; orders: Order[]; products: Product[]; suppliers: Supplier[]; withdrawals: Withdrawal[] }) {
  return (
    <DataTable
      headers={["Supplier", "Revenue", "Products", "Withdrawal", "Rating", "Status", "Actions"]}
      rows={suppliers.map((supplier) => {
        const revenue = orders.filter((order) => order.supplier_id === supplier.supplier_id).reduce((sum, order) => sum + Number(order.amount), 0);
        const productCount = products.filter((product) => product.supplier_id === supplier.supplier_id).length;
        const pendingWithdrawal = withdrawals.filter((item) => item.supplier_id === supplier.supplier_id && item.status === "Pending").reduce((sum, item) => sum + Number(item.amount), 0);
        return [
          supplier.company_name,
          money(revenue),
          String(productCount),
          money(pendingWithdrawal),
          supplier.rating.toFixed(1),
          supplier.status,
          <ActionGroup key={supplier.id}>
            <button className="tiny-button" onClick={() => actions.updateSupplier(supplier.id, "Verified", true)} type="button">Verify</button>
            <button className="ghost-button" onClick={() => actions.updateSupplier(supplier.id, "Suspended", false)} type="button">Suspend</button>
          </ActionGroup>,
        ];
      })}
    />
  );
}

function OrdersPage({ actions, orders }: { actions: Actions; orders: Order[] }) {
  return (
    <DataTable
      headers={["Order", "Workshop", "Customer", "Product", "Qty", "Amount", "Status", "Actions"]}
      rows={orders.map((order) => [
        order.id,
        order.workshop,
        order.customer,
        order.product_name,
        String(order.quantity),
        money(order.amount),
        order.status,
        <ActionGroup key={order.id}>
          <button className="tiny-button" onClick={() => actions.updateOrder(order.id, "Confirmed")} type="button">Confirm</button>
          <button className="ghost-button" onClick={() => actions.updateOrder(order.id, "Delivered")} type="button">Complete</button>
          <button className="danger-button" onClick={() => actions.updateOrder(order.id, "Cancelled")} type="button">Cancel</button>
        </ActionGroup>,
      ])}
    />
  );
}

function PaymentsPage({ actions, payments }: { actions: Actions; payments: Payment[] }) {
  return (
    <section>
      <KpiGrid items={[
        ["Pending", String(payments.filter((item) => item.status === "Pending").length)],
        ["Paid", String(payments.filter((item) => item.status === "Paid").length)],
        ["Refund", String(payments.filter((item) => item.status === "Refunded").length)],
        ["Escrow", String(payments.filter((item) => item.status === "Escrow").length)],
      ]} />
      <DataTable
        headers={["Payment", "Order", "Payer", "Payee", "Amount", "Commission", "Status", "Actions"]}
        rows={payments.map((payment) => [
          payment.id,
          payment.order_id,
          payment.payer_name,
          payment.payee_name,
          money(payment.amount),
          money(payment.commission_amount),
          payment.status,
          <ActionGroup key={payment.id}>
            <button className="tiny-button" onClick={() => actions.updatePayment(payment.id, "Paid")} type="button">Paid</button>
            <button className="ghost-button" onClick={() => actions.updatePayment(payment.id, "Escrow")} type="button">Escrow</button>
            <button className="danger-button" onClick={() => actions.updatePayment(payment.id, "Refunded")} type="button">Refund</button>
          </ActionGroup>,
        ])}
      />
    </section>
  );
}

function WithdrawalsPage({ actions, withdrawals }: { actions: Actions; withdrawals: Withdrawal[] }) {
  return (
    <DataTable
      headers={["Amount", "Bank", "Account", "Status", "History", "Actions"]}
      rows={withdrawals.map((item) => [
        money(item.amount),
        item.bank,
        item.account_number,
        item.status,
        formatDate(item.created_at),
        <ActionGroup key={item.id}>
          <button className="tiny-button" onClick={() => actions.updateWithdrawal(item.id, "Approved")} type="button">Approve</button>
          <button className="danger-button" onClick={() => actions.updateWithdrawal(item.id, "Rejected")} type="button">Reject</button>
          <button className="ghost-button" onClick={() => actions.updateWithdrawal(item.id, "Paid")} type="button">Mark Paid</button>
        </ActionGroup>,
      ])}
    />
  );
}

function WarrantyPage({ actions, claims }: { actions: Actions; claims: WarrantyClaim[] }) {
  return (
    <section>
      <KpiGrid items={[
        ["Pending", String(claims.filter((item) => item.status === "Pending Review").length)],
        ["Approved", String(claims.filter((item) => item.status === "Approved").length)],
        ["Rejected", String(claims.filter((item) => item.status === "Rejected").length)],
        ["Inspection Required", String(claims.filter((item) => item.status === "Inspection Requested").length)],
      ]} />
      <DataTable
        headers={["Claim", "Part", "Supplier", "Workshop", "Status", "Actions"]}
        rows={claims.map((claim) => [
          claim.id,
          `${claim.warranties?.part_brand ?? ""} ${claim.warranties?.part_name ?? ""}`.trim(),
          claim.warranties?.supplier_name ?? "-",
          claim.warranties?.workshop_name ?? "-",
          claim.status,
          <ActionGroup key={claim.id}>
            <button className="tiny-button" onClick={() => actions.updateClaim(claim.id, "Approved")} type="button">Approve</button>
            <button className="danger-button" onClick={() => actions.updateClaim(claim.id, "Rejected")} type="button">Reject</button>
            <button className="ghost-button" onClick={() => actions.updateClaim(claim.id, "Inspection Requested")} type="button">Request Inspection</button>
          </ActionGroup>,
        ])}
      />
    </section>
  );
}

function AnalyticsPage({ data, metrics }: { data: AdminState; metrics: ReturnType<typeof buildMetrics> }) {
  return (
    <section>
      <KpiGrid items={[
        ["Revenue", money(metrics.totalGmv)],
        ["Growth", `${metrics.growthRate}%`],
        ["Conversion", `${metrics.conversion}%`],
        ["Retention", `${metrics.retention}%`],
        ["AI Usage", String(data.aiUsage.length)],
        ["Warranty Claims", String(data.claims.length)],
      ]} />
      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard title="Revenue" data={metrics.revenueChart} />
        <ChartCard title="AI Usage" data={metrics.aiChart} />
        <ChartCard title="Warranty Claims" data={metrics.claimChart} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ListPanel title="Top Workshops" items={metrics.topWorkshops} />
        <ListPanel title="Top Suppliers" items={metrics.topSuppliers} />
      </div>
    </section>
  );
}

function SettingsPage({ actions, settings }: { actions: Actions; settings: Setting | null }) {
  const [form, setForm] = useState<Setting>(settings ?? {
    ai_diagnosis_enabled: true,
    escrow_enabled: true,
    supplier_commission_percent: 25,
    workshop_commission_percent: 20,
  });

  function update(field: keyof Setting, value: boolean | number) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
      <h3 className="text-lg font-black">Platform Settings</h3>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-black text-slate-300">Workshop commission %
          <input className="field" value={form.workshop_commission_percent} onChange={(event) => update("workshop_commission_percent", Number(event.target.value))} />
        </label>
        <label className="grid gap-2 text-sm font-black text-slate-300">Supplier commission %
          <input className="field" value={form.supplier_commission_percent} onChange={(event) => update("supplier_commission_percent", Number(event.target.value))} />
        </label>
        <label className="flex items-center gap-3 rounded-xl bg-white/[0.05] p-3 text-sm font-black">
          <input checked={form.escrow_enabled} type="checkbox" onChange={(event) => update("escrow_enabled", event.target.checked)} />
          Escrow enabled
        </label>
        <label className="flex items-center gap-3 rounded-xl bg-white/[0.05] p-3 text-sm font-black">
          <input checked={form.ai_diagnosis_enabled} type="checkbox" onChange={(event) => update("ai_diagnosis_enabled", event.target.checked)} />
          AI diagnosis enabled
        </label>
      </div>
      <button className="primary-button mt-4" onClick={() => actions.saveSettings(form)} type="button">Save Settings</button>
    </section>
  );
}

function AuthPanel({ email, password, setEmail, setPassword, signIn, signUp, supabaseReady }: {
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
      <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-300">Owner access</p>
      <h2 className="mt-2 text-3xl font-black">Sign in to ManHub Admin</h2>
      <p className="mt-2 text-sm text-slate-400">All sections use Supabase tables and admin RLS policies.</p>
      {!supabaseReady && <p className="mt-3 rounded-xl bg-amber-400/10 p-3 text-sm font-bold text-amber-200">Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to enable this dashboard.</p>}
      <div className="mt-5 grid gap-3">
        <input className="field" placeholder="Admin email" value={email} onChange={(event) => setEmail(event.target.value)} />
        <input className="field" placeholder="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        <div className="flex flex-wrap gap-2">
          <button className="primary-button" disabled={!supabaseReady} onClick={signIn} type="button">Sign in</button>
          <button className="ghost-button" disabled={!supabaseReady} onClick={signUp} type="button">Create admin account</button>
        </div>
      </div>
    </section>
  );
}

function KpiGrid({ items }: { items: string[][] }) {
  return (
    <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {items.map(([label, value]) => (
        <article className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 shadow-xl shadow-black/10" key={label}>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
          <strong className="mt-2 block text-2xl font-black text-white">{value}</strong>
        </article>
      ))}
    </div>
  );
}

function DataTable({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[840px] border-collapse text-left text-sm">
          <thead className="bg-white/[0.06] text-xs uppercase tracking-[0.12em] text-slate-500">
            <tr>{headers.map((item) => <th className="px-4 py-3" key={item}>{item}</th>)}</tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td className="px-4 py-5 text-slate-400" colSpan={headers.length}>No live Supabase records found.</td></tr>}
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

function ChartCard({ data, title }: { data: Array<{ label: string; value: number }>; title: string }) {
  const max = Math.max(1, ...data.map((item) => item.value));
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
      <h3 className="text-lg font-black">{title}</h3>
      <div className="mt-4 grid gap-3">
        {data.map((item) => (
          <div className="grid grid-cols-[88px_1fr_72px] items-center gap-2 text-sm" key={item.label}>
            <span className="truncate text-slate-400">{item.label}</span>
            <span className="h-3 overflow-hidden rounded-full bg-white/10">
              <span className="block h-full rounded-full bg-gradient-to-r from-blue-400 to-emerald-300" style={{ width: `${Math.max(8, (item.value / max) * 100)}%` }} />
            </span>
            <b className="text-right text-slate-200">{item.value > 999 ? money(item.value) : item.value}</b>
          </div>
        ))}
      </div>
    </article>
  );
}

function ListPanel({ items, title }: { items: Array<{ label: string; value: number }>; title: string }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
      <h3 className="text-lg font-black">{title}</h3>
      <div className="mt-3 grid gap-2">
        {items.length === 0 && <p className="rounded-xl border border-dashed border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">No live records yet.</p>}
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

function ActionGroup({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>;
}

function Notice({ children, tone }: { children: ReactNode; tone: "error" | "success" }) {
  const classes = tone === "error" ? "border-red-300/30 bg-red-500/10 text-red-100" : "border-emerald-300/30 bg-emerald-500/10 text-emerald-100";
  return <p className={`mb-4 rounded-xl border p-3 text-sm font-bold ${classes}`}>{children}</p>;
}

function Loader() {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 text-sm font-bold text-slate-300">Loading admin workspace...</div>;
}

function buildMetrics(data: AdminState) {
  const today = new Date().toISOString().slice(0, 10);
  const month = new Date().toISOString().slice(0, 7);
  const totalGmv = data.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const commissionEarned = data.payments.reduce((sum, payment) => sum + Number(payment.commission_amount), 0);
  const monthlyOrders = data.orders.filter((order) => order.created_at.startsWith(month)).length;
  const activeCustomers = data.users.filter((user) => user.account_type === "Customer" && user.status !== "Banned").length;

  return {
    activeCustomers,
    activeSuppliers: data.suppliers.filter((supplier) => supplier.status !== "Banned").length,
    activeWorkshops: data.workshops.filter((workshop) => workshop.status !== "Banned").length,
    aiChart: monthlyCount(data.aiUsage, "created_at"),
    claimChart: monthlyCount(data.claims, "submitted_at"),
    commissionEarned,
    conversion: data.users.length === 0 ? 0 : Math.round((data.orders.length / data.users.length) * 100),
    growthChart: monthlyMoney(data.payments, "amount"),
    growthRate: growthRate(monthlyMoney(data.payments, "amount")),
    monthlyOrders,
    platformRevenue: commissionEarned,
    retention: retention(data.orders.map((order) => order.customer)),
    revenueChart: monthlyMoney(data.payments, "amount"),
    todayOrders: data.orders.filter((order) => order.created_at.startsWith(today)).length,
    topSuppliers: topBy(data.suppliers.map((supplier) => supplier.company_name)),
    topWorkshops: topBy(data.orders.map((order) => order.workshop)),
    totalGmv,
    warrantyClaims: data.claims.length,
    withdrawalRequests: data.withdrawals.filter((item) => item.status === "Pending").length,
  };
}

function monthlyMoney(rows: Array<{ created_at: string } & Record<string, unknown>>, valueField: string) {
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (5 - index));
    const key = date.toISOString().slice(0, 7);
    return {
      label: date.toLocaleDateString("en", { month: "short" }),
      value: rows.filter((item) => item.created_at.startsWith(key)).reduce((sum, item) => sum + Number(item[valueField]), 0),
    };
  });
}

function monthlyCount<T extends Record<K, string>, K extends keyof T>(rows: T[], dateField: K) {
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (5 - index));
    const key = date.toISOString().slice(0, 7);
    return {
      label: date.toLocaleDateString("en", { month: "short" }),
      value: rows.filter((item) => String(item[dateField]).startsWith(key)).length,
    };
  });
}

function topBy(values: string[]) {
  const map = new Map<string, number>();
  values.filter(Boolean).forEach((value) => map.set(value, (map.get(value) ?? 0) + 1));
  return Array.from(map.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 5);
}

function retention(customers: string[]) {
  const repeats = topBy(customers).filter((item) => item.value > 1).reduce((sum, item) => sum + item.value, 0);
  return customers.length === 0 ? 0 : Math.round((repeats / customers.length) * 100);
}

function growthRate(values: Array<{ value: number }>) {
  const previous = values.at(-2)?.value ?? 0;
  const current = values.at(-1)?.value ?? 0;
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function normalizeClaims(rows: unknown[]): WarrantyClaim[] {
  return rows.map((row) => {
    const claim = row as WarrantyClaim & { warranties?: WarrantyClaim["warranties"] | WarrantyClaim["warranties"][] };
    return { ...claim, warranties: Array.isArray(claim.warranties) ? claim.warranties[0] ?? null : claim.warranties ?? null };
  });
}

function money(value: number) {
  return `RM ${Number(value || 0).toLocaleString("en-MY", { maximumFractionDigits: 0 })}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" });
}
