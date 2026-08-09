import { StrictMode, useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { signOut, SwitchPortalButton, usePortalAuth } from "@manhub/auth";
import {
  createManHubSupabaseClient,
  createPartnerDocumentLinks,
  fetchRows,
  getSupplierCommissionRate,
  getLogoutUrl,
  insertRow,
  listPartnerApplications,
  reviewPartnerApplication,
  savePartnerApplicationNotes,
  updateCustomerPayment,
  updateStatus,
  type PartnerApplicationRecord,
  type PartnerApplicationType,
  type ManHubProfile,
  type ManHubRole,
  portalLabelByRole,
} from "@manhub/backend";
import { adminRoutes } from "@manhub/platform-config";
import { Button, Card, DataTable, EmptyState, FormField, MiniChart, NotificationsPanel, PageHeader, PortalShell, StatGrid, TextAreaField } from "@manhub/ui";

type Row = { id?: string; [key: string]: unknown };
type Client = NonNullable<ReturnType<typeof createManHubSupabaseClient>>;
const money = new Intl.NumberFormat("en-MY", { currency: "MYR", style: "currency" });

function AdminApp() {
  const supabase = useMemo(() => createManHubSupabaseClient(), []);
  const auth = usePortalAuth(supabase, "admin");
  const [notice, setNotice] = useState("Platform owner controls connected.");
  const [signingOut, setSigningOut] = useState(false);

  const run = useCallback(async (task: () => Promise<void>, success: string) => {
    try {
      await task();
      setNotice(success);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Action failed.");
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    if (!supabase || signingOut) return;

    setSigningOut(true);
    try {
      await signOut(supabase);
      window.location.replace(getLogoutUrl());
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to log out.");
      setSigningOut(false);
    }
  }, [signingOut, supabase]);

  if (!supabase) return <PortalShell eyebrow="Admin" routes={adminRoutes} title="ManFix"><EmptyState text="Add Supabase environment variables to run this dashboard." /></PortalShell>;
  if (auth.loading || auth.redirecting) return <PortalShell eyebrow="Admin" routes={[]} title="ManFix"><EmptyState text={auth.redirecting ? "Redirecting to secure sign-in..." : "Checking admin session..."} /></PortalShell>;
  if (!auth.allowed) return <PortalShell eyebrow="Admin" routes={[]} title="ManFix"><EmptyState text="Admin role required. Redirecting to Unauthorized." /></PortalShell>;

  return (
    <PortalShell eyebrow="Admin Dashboard" routes={adminRoutes} title="ManFix">
      <PageHeader title={auth.profile?.full_name || "Platform Control"}>
        <div className="mh-actions">
          <Button tone="ghost" onClick={auth.refresh}>Refresh session</Button>
          <SwitchPortalButton supabase={supabase} />
          <Button tone="danger" onClick={() => void handleSignOut()}>{signingOut ? "Logging out..." : "Log out"}</Button>
        </div>
      </PageHeader>
      <Card tone="blue"><strong>{notice}</strong></Card>
      <Routes>
        <Route path="/" element={<Overview supabase={supabase} />} />
        <Route path="/partner-applications" element={<PartnerApplications run={run} supabase={supabase} />} />
        <Route path="/users" element={<Users currentRoles={auth.roles} supabase={supabase} />} />
        <Route path="/workshops" element={<StatusPage run={run} supabase={supabase} table="platform_workshops" title="Workshops" columns={["name", "city", "status", "rating"]} actions={["Verified", "Suspended"]} />} />
        <Route path="/suppliers" element={<StatusPage run={run} supabase={supabase} table="supplier_profiles" title="Suppliers" columns={["company_name", "status", "rating", "bank_name"]} actions={["Verified", "Suspended"]} />} />
        <Route path="/orders" element={<TablePage supabase={supabase} table="customer_orders" title="Customer Orders" columns={["order_number", "total", "payment_status", "status", "created_at"]} />} />
        <Route path="/payments" element={<PaymentManagement run={run} supabase={supabase} />} />
        <Route path="/withdrawals" element={<StatusPage run={run} supabase={supabase} table="supplier_withdrawals" title="Withdrawals" columns={["amount", "bank", "account_number", "status"]} actions={["Approved", "Rejected"]} />} />
        <Route path="/warranty" element={<StatusPage run={run} supabase={supabase} table="warranty_claims" title="Warranty" columns={["warranty_id", "description", "status", "submitted_at"]} actions={["Approved", "Rejected", "Inspection Requested"]} />} />
        <Route path="/analytics" element={<Analytics supabase={supabase} />} />
        <Route path="/settings" element={<Settings run={run} supabase={supabase} />} />
        <Route path="/notifications" element={<NotificationsPanel supabase={supabase} />} />
        <Route path="/profile" element={<AccessProfile profile={auth.profile} roles={auth.roles} supabase={supabase} />} />
      </Routes>
    </PortalShell>
  );
}

function AccessProfile({
  profile,
  roles,
  supabase,
}: {
  profile: ManHubProfile | null;
  roles: ManHubRole[];
  supabase: Client;
}) {
  return (
    <div className="mh-grid-2">
      <Card>
        <h2 className="mh-card-title">Admin Profile</h2>
        <div className="mh-detail-grid">
          <div className="mh-detail"><span>Name</span><strong>{profile?.full_name || profile?.email || "-"}</strong></div>
          <div className="mh-detail"><span>Email</span><strong>{profile?.email || "-"}</strong></div>
          <div className="mh-detail"><span>Status</span><strong>{profile?.status || "-"}</strong></div>
          <div className="mh-detail"><span>Assigned roles</span><strong>{roles.map(labelize).join(", ")}</strong></div>
        </div>
      </Card>
      <Card tone="blue">
        <h2 className="mh-card-title">Portal Access</h2>
        <p>Open another portal assigned to this account without signing out.</p>
        <SwitchPortalButton supabase={supabase} />
      </Card>
    </div>
  );
}

function Overview({ supabase }: { supabase: Client }) {
  const [payments] = useRows(supabase, "customer_payments");
  const [settlements] = useRows(supabase, "platform_payments");
  const [memberships] = useRows(supabase, "user_roles");
  const [orders] = useRows(supabase, "customer_orders");
  const [withdrawals] = useRows(supabase, "supplier_withdrawals");
  const [claims] = useRows(supabase, "warranty_claims");
  const today = new Date().toISOString().slice(0, 10);
  const paidPayments = payments.filter((payment) => payment.status === "Paid");
  const gmv = sumRows(paidPayments, "amount");
  const paidSettlements = settlements.filter((payment) => payment.status === "Paid");
  const commission = sumRows(paidSettlements, "commission_amount");
  const active = (role: string) => memberships.filter((membership) => membership.role === role && ["Active", "Approved", "Verified"].includes(String(membership.status))).length;
  const metrics: Array<[string, string | number]> = [
    ["Total GMV", money.format(gmv)],
    ["Platform Revenue", money.format(commission)],
    ["Commission Earned", money.format(commission)],
    ["Today's Orders", orders.filter((order) => String(order.created_at ?? "").startsWith(today)).length],
    ["Monthly Orders", orders.filter((order) => sameMonth(String(order.created_at ?? ""))).length],
    ["Active Customers", active("customer")],
    ["Active Workshops", active("workshop")],
    ["Active Suppliers", active("supplier")],
    ["Warranty Claims", claims.length],
    ["Withdrawal Requests", withdrawals.filter((item) => item.status === "Pending").length],
  ];
  return (
    <>
      <StatGrid items={metrics} />
      <div className="mh-grid-3">
        <MiniChart title="GMV by Month" data={groupRowsByMonth(paidPayments, "amount")} />
        <MiniChart title="Commission by Month" data={groupRowsByMonth(paidSettlements, "commission_amount")} />
        <MiniChart title="Supplier Net Payout by Month" data={groupRowsByMonth(paidSettlements, "supplier_net_amount")} />
      </div>
    </>
  );
}

function Users({
  currentRoles,
  supabase,
}: { currentRoles: ManHubRole[]; supabase: Client }) {
  const [profiles, setProfiles] = useState<Row[]>([]);
  const [memberships, setMemberships] = useState<Row[]>([]);

  const refresh = useCallback(async () => {
    const [profileRows, membershipRows] = await Promise.all([
      fetchRows<Row>(supabase, "profiles"),
      fetchRows<Row>(supabase, "user_roles"),
    ]);
    setProfiles(profileRows);
    setMemberships(membershipRows);
  }, [supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh().catch(() => {
        setProfiles([]);
        setMemberships([]);
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const roleLabel = (role: ManHubRole) => role === "super_admin"
    ? "Super Admin"
    : portalLabelByRole[role];

  return (
    <div className="mh-form-stack">
      <Card tone="blue">
        <h2 className="mh-card-title">Role Access Overview</h2>
        <p>Partner roles are granted only from Partner Applications after approval. This page is read-only for access control.</p>
        {currentRoles.includes("super_admin") && (
          <p>Super Admin can view every account here, but approval still flows through Partner Applications.</p>
        )}
      </Card>
      <Card>
        <h2 className="mh-card-title">Platform Accounts</h2>
        <DataTable
          headers={["Name", "Email", "Roles", "Status", "Last Portal"]}
          rows={profiles.map((profile) => {
            const accountMemberships = memberships.filter((membership) => membership.user_id === profile.id);
            return [
              String(profile.full_name || "-"),
              String(profile.email || "-"),
              accountMemberships.map((membership) => roleLabel(String(membership.role) as ManHubRole)).join(", ") || "No role",
              String(profile.status || "-"),
              String(profile.last_portal_role ? roleLabel(String(profile.last_portal_role) as ManHubRole) : "-"),
            ];
          })}
        />
      </Card>
    </div>
  );
}

type CombinedApplication = {
  record: PartnerApplicationRecord;
  type: PartnerApplicationType;
};

function PartnerApplications({ run, supabase }: ActionProps) {
  const [applications, setApplications] = useState<CombinedApplication[]>([]);
  const [selected, setSelected] = useState<CombinedApplication | null>(null);
  const [documents, setDocuments] = useState<Array<{ name: string; path: string; url: string }>>([]);
  const [notes, setNotes] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | "Pending" | "Approved" | "Rejected">("Pending");
  const [processing, setProcessing] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const types: PartnerApplicationType[] = ["supplier", "workshop", "technician"];
    const groups = await Promise.all(types.map(async (type) => ({
      rows: await listPartnerApplications(supabase, type),
      type,
    })));
    setApplications(
      groups
        .flatMap(({ rows, type }) => rows.map((record) => ({ record, type })))
        .sort((a, b) => b.record.created_at.localeCompare(a.record.created_at)),
    );
  }, [supabase]);

  useEffect(() => {
    void refresh().catch(() => setApplications([]));
  }, [refresh]);

  const view = async (application: CombinedApplication) => {
    setSelected(application);
    setNotes(application.record.admin_notes ?? "");
    setDocuments([]);
    const paths = documentPaths(application);
    if (paths.length > 0) {
      setDocuments(await createPartnerDocumentLinks(supabase, paths));
    }
  };

  const review = (application: CombinedApplication, action: "approve" | "reject") => {
    void run(async () => {
      setProcessing(application.record.id);
      try {
        await reviewPartnerApplication(
          supabase,
          application.type,
          application.record.id,
          action,
          selected?.record.id === application.record.id ? notes : application.record.admin_notes ?? "",
        );
        await refresh();
        setSelected(null);
        setDocuments([]);
      } finally {
        setProcessing(null);
      }
    }, action === "approve"
      ? "Partner approved. The password setup invitation has been sent."
      : "Partner application rejected.");
  };

  const filtered = applications.filter(({ record }) => statusFilter === "All" || record.status === statusFilter);
  const pending = (type: PartnerApplicationType) => applications.filter((item) => item.type === type && item.record.status === "Pending").length;

  return (
    <div className="mh-form-stack">
      <StatGrid items={[
        ["Pending Suppliers", pending("supplier")],
        ["Pending Workshops", pending("workshop")],
        ["Pending Technicians", pending("technician")],
        ["Total Applications", applications.length],
      ]} />
      <Card>
        <div className="mh-actions">
          {(["Pending", "Approved", "Rejected", "All"] as const).map((filter) => (
            <Button key={filter} tone={statusFilter === filter ? "primary" : "ghost"} onClick={() => setStatusFilter(filter)}>
              {filter}
            </Button>
          ))}
          <Button tone="ghost" onClick={() => void refresh()}>Refresh</Button>
        </div>
      </Card>
      <Card>
        <h2 className="mh-card-title">Partner Applications</h2>
        <DataTable
          headers={["Type", "Applicant", "Email", "Submitted", "Status", "Actions"]}
          rows={filtered.map((application) => [
            labelize(application.type),
            applicationName(application),
            application.record.email,
            new Date(application.record.created_at).toLocaleString("en-MY"),
            <span className={`mh-badge ${application.record.status === "Approved" ? "success" : application.record.status === "Rejected" ? "danger" : "warning"}`}>
              {application.record.status}
            </span>,
            <div className="mh-actions">
              <Button tone="ghost" onClick={() => void view(application)}>View documents</Button>
              {application.record.status === "Pending" && (
                <>
                  <Button disabled={processing === application.record.id} onClick={() => review(application, "approve")}>Approve</Button>
                  <Button disabled={processing === application.record.id} tone="danger" onClick={() => review(application, "reject")}>Reject</Button>
                </>
              )}
            </div>,
          ])}
        />
      </Card>
      {selected && (
        <Card>
          <h2 className="mh-card-title">{applicationName(selected)} - {labelize(selected.type)}</h2>
          <div className="mh-detail-grid">
            {applicationDetails(selected).map(([label, value]) => (
              <div className="mh-detail" key={label}><span>{label}</span><strong>{value}</strong></div>
            ))}
          </div>
          <div className="mh-form-section">
            <h3>Documents</h3>
            <div className="mh-document-list">
              {documents.length === 0 && <span className="mh-muted-note">No documents attached.</span>}
              {documents.map((document) => (
                <a className="mh-document-link" href={document.url} key={document.path} rel="noreferrer" target="_blank">
                  {document.name}
                </a>
              ))}
            </div>
          </div>
          <div className="mh-form-section">
            <TextAreaField label="Admin Notes" value={notes} onChange={setNotes} rows={5} />
            <div className="mh-actions">
              <Button tone="ghost" onClick={() => void run(async () => {
                await savePartnerApplicationNotes(supabase, selected.type, selected.record.id, notes);
                await refresh();
              }, "Application notes saved.")}>Save notes</Button>
              {selected.record.status === "Pending" && (
                <>
                  <Button disabled={processing === selected.record.id} onClick={() => review(selected, "approve")}>Approve and invite</Button>
                  <Button disabled={processing === selected.record.id} tone="danger" onClick={() => review(selected, "reject")}>Reject</Button>
                </>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function applicationName(application: CombinedApplication) {
  if (application.type === "supplier") return String(application.record.company_name ?? application.record.contact_person ?? "-");
  if (application.type === "workshop") return String(application.record.workshop_name ?? "-");
  return String(application.record.full_name ?? "-");
}

function documentPaths(application: CombinedApplication) {
  const record = application.record;
  if (application.type === "supplier") {
    return [
      record.company_logo_path,
      ...(Array.isArray(record.supporting_document_paths) ? record.supporting_document_paths : []),
    ].filter((path): path is string => typeof path === "string" && path.length > 0);
  }
  if (application.type === "workshop") {
    return (Array.isArray(record.workshop_photo_paths) ? record.workshop_photo_paths : [])
      .filter((path): path is string => typeof path === "string");
  }
  return [
    record.resume_path,
    ...(Array.isArray(record.certificate_paths) ? record.certificate_paths : []),
  ].filter((path): path is string => typeof path === "string" && path.length > 0);
}

function applicationDetails(application: CombinedApplication): Array<[string, string]> {
  const record = application.record;
  if (application.type === "supplier") {
    return [
      ["Company", String(record.company_name ?? "-")],
      ["SSM", String(record.ssm_registration_number ?? "-")],
      ["Contact", String(record.contact_person ?? "-")],
      ["Phone", String(record.phone ?? "-")],
      ["Category", String(record.business_category ?? "-")],
      ["Address", String(record.business_address ?? "-")],
    ];
  }
  if (application.type === "workshop") {
    return [
      ["Workshop", String(record.workshop_name ?? "-")],
      ["SSM", String(record.ssm_number ?? "-")],
      ["Phone", String(record.phone ?? "-")],
      ["Operating Hours", String(record.operating_hours ?? "-")],
      ["Technicians", String(record.number_of_technicians ?? "0")],
      ["Lifts", String(record.number_of_lifts ?? "0")],
    ];
  }
  return [
    ["Name", String(record.full_name ?? "-")],
    ["Phone", String(record.phone ?? "-")],
    ["Employer", String(record.current_employer ?? "-")],
    ["Experience", String(record.work_experience ?? "-")],
    ["Email", record.email],
    ["Status", record.status],
  ];
}

function PaymentManagement({ run, supabase }: ActionProps) {
  const [payments, setPayments] = useRows(supabase, "customer_payments");
  const paid = payments.filter((payment) => payment.status === "Paid");
  const pending = payments.filter((payment) => payment.status === "Pending");
  const refunded = payments.filter((payment) => payment.status === "Refunded");
  const refresh = async () => setPayments(await fetchRows<Row>(supabase, "customer_payments"));
  return (
    <div className="mh-form-stack">
      <StatGrid items={[
        ["Paid Volume", money.format(sumRows(paid, "amount"))],
        ["Pending Payments", pending.length],
        ["Refunded Volume", money.format(sumRows(refunded, "amount"))],
      ]} />
      <Card>
        <h2 className="mh-card-title">Customer Payments</h2>
        <DataTable headers={["Payment", "Order", "Amount", "Method", "Status", "Created", "Actions"]} rows={payments.map((payment) => [
          String(payment.payment_number),
          String(payment.order_id),
          money.format(Number(payment.amount)),
          String(payment.method),
          String(payment.status),
          new Date(String(payment.created_at)).toLocaleString("en-MY"),
          <div className="mh-actions">
            {payment.status === "Pending" && <>
              <Button onClick={() => void run(async () => { await updateCustomerPayment(supabase, String(payment.id), "Paid"); await refresh(); }, "Payment marked Paid.")}>Mark paid</Button>
              <Button tone="danger" onClick={() => void run(async () => { await updateCustomerPayment(supabase, String(payment.id), "Cancelled"); await refresh(); }, "Payment cancelled.")}>Cancel</Button>
            </>}
            {payment.status === "Paid" && <Button tone="danger" onClick={() => void run(async () => { await updateCustomerPayment(supabase, String(payment.id), "Refunded"); await refresh(); }, "Payment refunded.")}>Refund</Button>}
          </div>,
        ])} />
      </Card>
      <CommissionPage supabase={supabase} />
    </div>
  );
}

function CommissionPage({ supabase }: { supabase: Client }) {
  const [commissions] = useRows(supabase, "supplier_commissions");
  const [commissionRate, setCommissionRate] = useState<number | null>(null);
  const gross = sumRows(commissions, "gross_amount");
  const fees = sumRows(commissions, "commission_amount");
  const payouts = sumRows(commissions, "supplier_net_amount");

  useEffect(() => {
    void getSupplierCommissionRate(supabase).then(setCommissionRate).catch(() => setCommissionRate(null));
  }, [supabase]);

  const commissionPercent = commissionRate;
  const supplierPercent = commissionPercent === null ? null : 100 - commissionPercent;

  return (
    <div className="mh-form-stack">
      <Card tone="blue">
        <h2 className="mh-card-title">Supplier Commission</h2>
        <p>{commissionPercent === null
          ? "Loading the configured supplier commission from ManFix settings..."
          : `ManFix charges suppliers ${commissionPercent}% only when an order is delivered. The remaining ${supplierPercent}% is credited to the supplier wallet automatically.`}</p>
      </Card>
      <StatGrid items={[
        ["Supplier Gross Sales", money.format(gross)],
        [commissionPercent === null ? "ManFix Commission" : `ManFix Commission (${commissionPercent}%)`, money.format(fees)],
        ["Supplier Net Payouts", money.format(payouts)],
        ["Settled Sales", commissions.filter((item) => item.status === "Settled").length],
      ]} />
      <Card>
        <h2 className="mh-card-title">Commission Ledger</h2>
        <DataTable
          headers={["Supplier", "Order", "Invoice", "Gross Sale", "Rate", "ManFix Commission", "Supplier Payout", "Status", "Settled"]}
          rows={commissions.map((item) => [
            String(item.supplier_name ?? item.supplier_id ?? "-"),
            String(item.order_id ?? "-"),
            String(item.invoice_number ?? "-"),
            money.format(Number(item.gross_amount ?? 0)),
            `${Number(item.commission_rate ?? 20)}%`,
            money.format(Number(item.commission_amount ?? 0)),
            money.format(Number(item.supplier_net_amount ?? 0)),
            String(item.status ?? "-"),
            item.settled_at ? new Date(String(item.settled_at)).toLocaleString("en-MY") : "-",
          ])}
        />
      </Card>
    </div>
  );
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
      <TablePage supabase={supabase} table="supplier_commissions" title="Supplier Commission Revenue" columns={["supplier_name", "gross_amount", "commission_amount", "supplier_net_amount", "status", "created_at"]} />
      <TablePage supabase={supabase} table="ai_usage_events" title="AI Usage" columns={["user_id", "vehicle_label", "diagnosis", "created_at"]} />
      <TablePage supabase={supabase} table="warranty_claims" title="Warranty Claims" columns={["warranty_id", "status", "submitted_at", "reviewed_at"]} />
      <TablePage supabase={supabase} table="platform_workshops" title="Top Workshops" columns={["name", "city", "rating", "status"]} />
      <TablePage supabase={supabase} table="supplier_profiles" title="Top Suppliers" columns={["company_name", "rating", "status", "bank_name"]} />
      <TablePage supabase={supabase} table="profiles" title="Platform Accounts" columns={["full_name", "role", "status", "created_at"]} />
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

function sumRows(rows: Row[], column: string) {
  return rows.reduce((sum, row) => sum + Number(row[column] ?? 0), 0);
}

function sameMonth(value: string) {
  if (!value) return false;
  const date = new Date(value);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function groupRowsByMonth(rows: Row[], column: string) {
  const grouped = new Map<string, number>();
  rows.forEach((row) => {
    const createdAt = String(row.created_at ?? "");
    if (!createdAt) return;
    const label = new Date(createdAt).toLocaleDateString("en-MY", { month: "short" });
    grouped.set(label, (grouped.get(label) ?? 0) + Number(row[column] ?? 0));
  });
  return Array.from(grouped, ([label, value]) => ({ label, value })).slice(-6);
}

createRoot(document.getElementById("root")!).render(<StrictMode><BrowserRouter><AdminApp /></BrowserRouter></StrictMode>);
