import { StrictMode, useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { signOut, usePortalAuth } from "@manhub/auth";
import {
  createManHubSupabaseClient,
  fetchRows,
  getLogoutUrl,
  updateStatus,
  type ManHubProfile,
} from "@manhub/backend";
import { technicianRoutes } from "@manhub/platform-config";
import { Button, Card, DataTable, EmptyState, PageHeader, PortalShell, StatGrid } from "@manhub/ui";

type Row = { id?: string; [key: string]: unknown };
type Client = NonNullable<ReturnType<typeof createManHubSupabaseClient>>;

function TechnicianApp() {
  const supabase = useMemo(() => createManHubSupabaseClient(), []);
  const auth = usePortalAuth(supabase, "workshop");
  const [notice, setNotice] = useState("Technician operations are connected.");
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

  if (!supabase) {
    return (
      <PortalShell eyebrow="Technician" routes={technicianRoutes} title="ManFix">
        <EmptyState text="Add Supabase environment variables to run Technician Operations." />
      </PortalShell>
    );
  }

  if (auth.loading || auth.redirecting) {
    return (
      <PortalShell eyebrow="Technician" routes={[]} title="ManFix">
        <EmptyState text={auth.redirecting ? "Redirecting to secure sign-in..." : "Checking workshop access..."} />
      </PortalShell>
    );
  }

  if (!auth.allowed) {
    return (
      <PortalShell eyebrow="Technician" routes={[]} title="ManFix">
        <EmptyState text="Approved workshop access is required." />
      </PortalShell>
    );
  }

  return (
    <PortalShell eyebrow="Technician Operations" routes={technicianRoutes} title="ManFix">
      <PageHeader title="Workshop Floor">
        <div className="mh-actions">
          <Button tone="ghost" onClick={auth.refresh}>Refresh</Button>
          <Button tone="danger" onClick={() => void handleSignOut()}>
            {signingOut ? "Logging out..." : "Log out"}
          </Button>
        </div>
      </PageHeader>
      <Card tone="blue"><strong>{notice}</strong></Card>
      <Routes>
        <Route path="/" element={<Today supabase={supabase} />} />
        <Route path="/orders" element={<IncomingOrders run={run} supabase={supabase} />} />
        <Route path="/jobs" element={<RepairJobs run={run} supabase={supabase} />} />
        <Route path="/schedule" element={<Schedule supabase={supabase} />} />
        <Route path="/profile" element={<Profile profile={auth.profile} />} />
      </Routes>
    </PortalShell>
  );
}

function Today({ supabase }: { supabase: Client }) {
  const [bookings, setBookings] = useState<Row[]>([]);
  const [jobs, setJobs] = useState<Row[]>([]);

  useEffect(() => {
    void Promise.all([
      fetchRows<Row>(supabase, "service_bookings"),
      fetchRows<Row>(supabase, "repair_jobs"),
    ]).then(([bookingRows, jobRows]) => {
      setBookings(bookingRows);
      setJobs(jobRows);
    }).catch(() => {
      setBookings([]);
      setJobs([]);
    });
  }, [supabase]);

  const pendingOrders = bookings.filter((booking) => booking.status === "Pending").length;
  const acceptedOrders = bookings.filter((booking) => booking.status === "Accepted").length;
  const activeJobs = jobs.filter((job) => ["Queued", "In Progress"].includes(String(job.status))).length;
  const readyJobs = jobs.filter((job) => job.status === "Ready").length;

  return (
    <>
      <StatGrid items={[
        ["Incoming Orders", pendingOrders],
        ["Accepted Today", acceptedOrders],
        ["Active Repairs", activeJobs],
        ["Ready for Pickup", readyJobs],
      ]} />
      <div className="mh-grid-2">
        <OrderTable rows={bookings.filter((booking) => booking.status === "Pending")} title="Next Orders" />
        <JobTable rows={jobs.filter((job) => job.status !== "Completed")} title="Workshop Floor" />
      </div>
    </>
  );
}

function IncomingOrders({ run, supabase }: ActionProps) {
  const [rows, setRows] = useRows(supabase, "service_bookings");

  const update = (id: string, status: "Accepted" | "Cancelled") => {
    void run(async () => {
      await updateStatus(supabase, "service_bookings", id, status);
      setRows(await fetchRows<Row>(supabase, "service_bookings"));
    }, status === "Accepted" ? "Order accepted and added to your schedule." : "Order cancelled.");
  };

  return (
    <Card>
      <h2 className="mh-card-title">Incoming Orders</h2>
      <DataTable
        headers={["Vehicle", "Problem", "Scheduled", "Status", "Actions"]}
        rows={rows.map((row) => [
          value(row.vehicle_label),
          value(row.symptom),
          formatDate(row.scheduled_at),
          value(row.status),
          row.status === "Pending" ? (
            <div className="mh-actions">
              <Button onClick={() => row.id && update(row.id, "Accepted")}>Accept</Button>
              <Button tone="danger" onClick={() => row.id && update(row.id, "Cancelled")}>Decline</Button>
            </div>
          ) : "Recorded",
        ])}
      />
    </Card>
  );
}

function RepairJobs({ run, supabase }: ActionProps) {
  const [rows, setRows] = useRows(supabase, "repair_jobs");

  const update = (id: string, status: "In Progress" | "Ready" | "Completed") => {
    void run(async () => {
      await updateStatus(supabase, "repair_jobs", id, status);
      setRows(await fetchRows<Row>(supabase, "repair_jobs"));
    }, `Repair job marked ${status}.`);
  };

  return (
    <Card>
      <h2 className="mh-card-title">Assigned Repair Jobs</h2>
      <DataTable
        headers={["Customer", "Vehicle", "Diagnosis", "Technician", "Status", "Actions"]}
        rows={rows.map((row) => [
          value(row.customer_name),
          value(row.vehicle_label),
          value(row.diagnosis),
          value(row.technician_name),
          value(row.status),
          <div className="mh-actions">
            {row.status === "Queued" && <Button onClick={() => row.id && update(row.id, "In Progress")}>Start</Button>}
            {row.status === "In Progress" && <Button onClick={() => row.id && update(row.id, "Ready")}>Mark ready</Button>}
            {row.status === "Ready" && <Button onClick={() => row.id && update(row.id, "Completed")}>Complete</Button>}
            {row.status === "Completed" && "Completed"}
          </div>,
        ])}
      />
    </Card>
  );
}

function Schedule({ supabase }: { supabase: Client }) {
  const [rows] = useRows(supabase, "service_bookings");
  const scheduled = [...rows]
    .filter((row) => row.status === "Accepted")
    .sort((a, b) => String(a.scheduled_at ?? "").localeCompare(String(b.scheduled_at ?? "")));

  return (
    <Card>
      <h2 className="mh-card-title">Accepted Schedule</h2>
      <DataTable
        headers={["Time", "Vehicle", "Problem", "Status"]}
        rows={scheduled.map((row) => [
          formatDate(row.scheduled_at),
          value(row.vehicle_label),
          value(row.symptom),
          value(row.status),
        ])}
      />
    </Card>
  );
}

function Profile({ profile }: { profile: ManHubProfile | null }) {
  return (
    <Card>
      <h2 className="mh-card-title">Workshop Access</h2>
      <div className="mh-detail-grid">
        <div className="mh-detail"><span>Name</span><strong>{profile?.full_name || "Workshop team"}</strong></div>
        <div className="mh-detail"><span>Email</span><strong>{profile?.email || "-"}</strong></div>
        <div className="mh-detail"><span>Status</span><strong>{profile?.status || "-"}</strong></div>
      </div>
    </Card>
  );
}

function OrderTable({ rows, title }: { rows: Row[]; title: string }) {
  return (
    <Card>
      <h2 className="mh-card-title">{title}</h2>
      <DataTable
        headers={["Vehicle", "Problem", "Time"]}
        rows={rows.map((row) => [value(row.vehicle_label), value(row.symptom), formatDate(row.scheduled_at)])}
      />
    </Card>
  );
}

function JobTable({ rows, title }: { rows: Row[]; title: string }) {
  return (
    <Card>
      <h2 className="mh-card-title">{title}</h2>
      <DataTable
        headers={["Vehicle", "Diagnosis", "Status"]}
        rows={rows.map((row) => [value(row.vehicle_label), value(row.diagnosis), value(row.status)])}
      />
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

function value(input: unknown) {
  return String(input ?? "-");
}

function formatDate(input: unknown) {
  if (!input) return "Not scheduled";
  const date = new Date(String(input));
  return Number.isNaN(date.getTime()) ? String(input) : date.toLocaleString("en-MY", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

type ActionProps = {
  run: (task: () => Promise<void>, success: string) => Promise<void>;
  supabase: Client;
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <TechnicianApp />
    </BrowserRouter>
  </StrictMode>,
);
