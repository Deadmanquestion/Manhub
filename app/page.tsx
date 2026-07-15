"use client";

import { FormEvent, ReactNode, useMemo, useState } from "react";

type View = "navigator" | "customer" | "technician" | "workshop" | "supplier" | "admin";
type CustomerTab = "Home" | "Workshops" | "Parts" | "Orders" | "Me";

const roleCards: Array<{
  id: View;
  role: string;
  title: string;
  summary: string;
  proof: string;
}> = [
  {
    id: "customer",
    role: "Customer",
    title: "End User App",
    summary: "Daniel describes symptoms, reviews a diagnosis-led quote, and chooses a workshop.",
    proof: "Shows customer ownership of booking and trust in diagnosis-first service.",
  },
  {
    id: "technician",
    role: "Technician",
    title: "Technician Portal",
    summary: "Certified technicians review AI pre-diagnoses, correct them, and build quotes.",
    proof: "Shows human validation and quote control before work starts.",
  },
  {
    id: "workshop",
    role: "Workshop Owner",
    title: "Workshop Owner Portal",
    summary: "Owners manage jobs, bays, technicians, billings, and platform settlement.",
    proof: "Shows capacity orchestration and workshop economics.",
  },
  {
    id: "supplier",
    role: "Supplier",
    title: "Supplier Portal",
    summary: "Suppliers list consigned parts and fulfil items once sold through service jobs.",
    proof: "Shows inventory monetization with commission only on completed sales.",
  },
  {
    id: "admin",
    role: "Super Admin",
    title: "Super Admin Portal",
    summary: "Platform operators verify partners, monitor jobs, and approve settlement runs.",
    proof: "Shows governance, marketplace health, and take-rate visibility.",
  },
];

const roleSwitcher = [
  { label: "Customer", view: "customer" as View },
  { label: "Technician", view: "technician" as View },
  { label: "Workshop Owner", view: "workshop" as View },
  { label: "Supplier", view: "supplier" as View },
  { label: "Super Admin", view: "admin" as View },
];

const customerTabs: CustomerTab[] = ["Home", "Workshops", "Parts", "Orders", "Me"];

const notes: Record<View, { proves: string; decision: string; revenue: string }> = {
  navigator: {
    proves: "ManHub can tell one connected marketplace story across customers, technicians, workshops, suppliers, and platform operators.",
    decision: "Each role has a clear reason to participate, with diagnosis as the entry point instead of generic booking.",
    revenue: "Service commissions and parts commissions are visible before diving into role screens.",
  },
  customer: {
    proves: "Customers start with the problem, receive an explainable pre-diagnosis, and still choose the workshop.",
    decision: "The platform builds trust by pairing AI speed with technician confirmation before final quote.",
    revenue: "Diagnosis drives a service job and relevant parts recommendations without turning the app into a generic storefront.",
  },
  technician: {
    proves: "AI work is reviewed by certified technicians before customers receive final pricing.",
    decision: "Technicians can confirm or correct the diagnosis and assemble a transparent quote.",
    revenue: "The quote combines labour and parts, creating commissionable service and parts value.",
  },
  workshop: {
    proves: "Workshops can manage capacity, technician assignment, and billings from one operating screen.",
    decision: "The workshop keeps 80 percent of service billings while ManHub coordinates demand and settlement.",
    revenue: "Today's jobs and billings make the platform take rate understandable at a glance.",
  },
  supplier: {
    proves: "Suppliers can list consigned parts and fulfil orders only after those parts are sold through jobs.",
    decision: "No listing fees lowers supplier friction while keeping fulfilment accountable.",
    revenue: "Each parts sale shows a 25 percent commission and supplier payout.",
  },
  admin: {
    proves: "The platform has controls for verification, settlement, disputes, and marketplace performance.",
    decision: "ManHub can scale supply quality while supervising payments across workshops and suppliers.",
    revenue: "GMV, commission earned, and settlement math show the commercial engine clearly.",
  },
};

export default function Home() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [view, setView] = useState<View>("navigator");
  const [customerTab, setCustomerTab] = useState<CustomerTab>("Home");
  const [diagnosisOpen, setDiagnosisOpen] = useState(true);

  const activeRole = useMemo(
    () => roleCards.find((role) => role.id === view),
    [view],
  );

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoggedIn(true);
    setView("navigator");
  }

  if (!loggedIn) {
    return <LoginScreen onSubmit={handleLogin} />;
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand-lockup" onClick={() => setView("navigator")} aria-label="Go to Demo Navigator">
          <span className="brand-mark">MH</span>
          <span>
            <strong>ManHub</strong>
            <small>Diagnosis-first automotive service platform</small>
          </span>
        </button>
        <nav className="role-switcher" aria-label="Role switcher">
          {roleSwitcher.map((role) => (
            <button
              key={role.view}
              className={view === role.view ? "active" : ""}
              onClick={() => setView(role.view)}
            >
              {role.label}
            </button>
          ))}
        </nav>
      </header>

      {view === "navigator" && <Navigator setView={setView} />}
      {view === "customer" && (
        <section className="demo-stage phone-stage">
          <div className="stage-copy">
            <p className="eyebrow">End User App</p>
            <h1>Diagnosis starts the job, then Daniel chooses where to repair.</h1>
            <p>
              The customer app keeps the flow simple: describe symptoms, receive a reviewed diagnosis, choose a
              workshop, and track the repair.
            </p>
            <InvestorNotes view="customer" />
          </div>
          <PhoneApp
            activeTab={customerTab}
            setActiveTab={setCustomerTab}
            diagnosisOpen={diagnosisOpen}
            setDiagnosisOpen={setDiagnosisOpen}
          />
        </section>
      )}
      {view === "technician" && (
        <TechnicianPortal notes={<InvestorNotes view="technician" compact />} />
      )}
      {view === "workshop" && <WorkshopPortal notes={<InvestorNotes view="workshop" compact />} />}
      {view === "supplier" && <SupplierPortal notes={<InvestorNotes view="supplier" compact />} />}
      {view === "admin" && <AdminPortal notes={<InvestorNotes view="admin" compact />} />}

      {activeRole && view !== "navigator" && (
        <footer className="presenter-strip">
          <span>{activeRole.role}</span>
          <strong>{activeRole.proof}</strong>
          <button onClick={() => setView("navigator")}>Back to navigator</button>
        </footer>
      )}
    </main>
  );
}

function LoginScreen({ onSubmit }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <main className="login-screen">
      <section className="login-panel">
        <div className="login-visual" aria-hidden="true">
          <div className="visual-grid">
            <div className="flow-card large">
              <span>1</span>
              <strong>Symptom</strong>
              <small>Brake squeal reported</small>
            </div>
            <div className="flow-card">
              <span>2</span>
              <strong>AI pre-diagnosis</strong>
              <small>87% confidence</small>
            </div>
            <div className="flow-card">
              <span>3</span>
              <strong>Technician review</strong>
              <small>Quote confirmed</small>
            </div>
          </div>
        </div>
        <form className="login-card" onSubmit={onSubmit}>
          <span className="brand-mark">MH</span>
          <p className="eyebrow">Investor Demo</p>
          <h1>ManHub</h1>
          <p>Diagnosis-first automotive service, from customer symptom to workshop job and parts commission.</p>
          <label>
            Email
            <input type="email" defaultValue="investor@manhub.my" aria-label="Email" />
          </label>
          <label>
            Password
            <input type="password" defaultValue="manhub" aria-label="Password" />
          </label>
          <button className="primary-button" type="submit">
            Enter demo
          </button>
        </form>
      </section>
    </main>
  );
}

function Navigator({ setView }: { setView: (view: View) => void }) {
  return (
    <section className="navigator">
      <div className="navigator-hero">
        <div>
          <p className="eyebrow">Demo Navigator</p>
          <h1>ManHub turns car problems into reviewed jobs, parts sales, and clear settlements.</h1>
          <p>
            Present the full marketplace in one flow: customer demand, technician confidence, workshop operations,
            supplier fulfilment, and platform control.
          </p>
        </div>
        <div className="market-map" aria-label="ManHub marketplace flow">
          <div>Customer</div>
          <div>AI Diagnosis</div>
          <div>Technician</div>
          <div>Workshop</div>
          <div>Supplier</div>
          <div>Settlement</div>
        </div>
      </div>
      <div className="navigator-grid">
        {roleCards.map((card) => (
          <article className="role-card" key={card.id}>
            <span>{card.role}</span>
            <h2>{card.title}</h2>
            <p>{card.summary}</p>
            <button onClick={() => setView(card.id)}>View {card.title}</button>
          </article>
        ))}
      </div>
      <InvestorNotes view="navigator" />
    </section>
  );
}

function PhoneApp({
  activeTab,
  setActiveTab,
  diagnosisOpen,
  setDiagnosisOpen,
}: {
  activeTab: CustomerTab;
  setActiveTab: (tab: CustomerTab) => void;
  diagnosisOpen: boolean;
  setDiagnosisOpen: (open: boolean) => void;
}) {
  return (
    <div className="phone-frame">
      <div className="phone-status">
        <span>9:41</span>
        <span>ManHub</span>
      </div>
      <div className="phone-screen">
        {activeTab === "Home" && (
          <CustomerHome diagnosisOpen={diagnosisOpen} setDiagnosisOpen={setDiagnosisOpen} />
        )}
        {activeTab === "Workshops" && <CustomerWorkshops />}
        {activeTab === "Parts" && <CustomerParts />}
        {activeTab === "Orders" && <CustomerOrders />}
        {activeTab === "Me" && <CustomerMe />}
      </div>
      <nav className="bottom-tabs" aria-label="End user app tabs">
        {customerTabs.map((tab) => (
          <button key={tab} className={activeTab === tab ? "active" : ""} onClick={() => setActiveTab(tab)}>
            <span className="tab-dot" />
            {tab}
          </button>
        ))}
      </nav>
    </div>
  );
}

function CustomerHome({
  diagnosisOpen,
  setDiagnosisOpen,
}: {
  diagnosisOpen: boolean;
  setDiagnosisOpen: (open: boolean) => void;
}) {
  return (
    <div className="phone-content">
      <div className="phone-header">
        <div>
          <small>Good morning</small>
          <h2>Hi Daniel</h2>
        </div>
        <span className="avatar">DT</span>
      </div>
      <article className="vehicle-card">
        <div className="car-art" aria-hidden="true">
          <span />
          <span />
        </div>
        <div>
          <strong>Toyota Vios 1.5G</strong>
          <p>WXY 4321 - 2021 - 68,420 km</p>
        </div>
      </article>
      <button className="primary-button wide" onClick={() => setDiagnosisOpen(!diagnosisOpen)}>
        Describe a problem
      </button>
      {diagnosisOpen && <DiagnosisFlow />}
      <div className="quick-actions">
        {["Find workshop", "Spare parts", "My records"].map((item) => (
          <button key={item}>{item}</button>
        ))}
      </div>
      <section className="mini-list">
        <h3>Reminders</h3>
        <div><strong>Engine oil change due</strong><span>Due in 1,200 km</span></div>
        <div><strong>Brake pads replaced</strong><span>Last service record</span></div>
      </section>
    </div>
  );
}

function DiagnosisFlow() {
  return (
    <section className="diagnosis-flow">
      <label>
        Customer symptom
        <textarea defaultValue="High-pitched squeal when braking, worse in the morning" />
      </label>
      <div className="photo-row">
        <span>Photo attached</span>
        <span>Brake area</span>
      </div>
      <article className="ai-card">
        <span>AI pre-diagnosis</span>
        <h3>Front brake pads worn, likely less than 3mm</h3>
        <div className="confidence"><i style={{ width: "87%" }} /></div>
        <p>Confidence 87%</p>
        <strong>Estimated quote range RM 280-420</strong>
        <small>Technician will confirm before final quote.</small>
      </article>
    </section>
  );
}

function CustomerWorkshops() {
  return (
    <div className="phone-content">
      <h2>Workshops</h2>
      <input className="search" defaultValue="Brake service near me" aria-label="Search workshops" />
      <div className="chips">
        {["Nearest", "Top rated", "Brake service", "Open now"].map((chip) => <span key={chip}>{chip}</span>)}
      </div>
      {[
        ["AutoFix Pro", "1.2 km", "4.8 rating", "offers brake pad replacement"],
        ["QuickCare Motors", "2.5 km", "4.6 rating", "same-day slot available"],
        ["Evergreen Auto Centre", "3.1 km", "4.5 rating", "trusted Toyota service"],
      ].map(([name, distance, rating, detail]) => (
        <article className="workshop-card" key={name}>
          <div><strong>{name}</strong><p>{detail}</p></div>
          <span>{distance}</span>
          <small>{rating}</small>
          <button>Choose workshop</button>
        </article>
      ))}
      <p className="helper-note">Workshops are chosen by the customer, not auto-assigned.</p>
    </div>
  );
}

function CustomerParts() {
  const parts = [
    ["Brake pad set front Bendix", "RM168", "FROM DIAGNOSIS"],
    ["Brake fluid DOT4 1L", "RM32", "FROM DIAGNOSIS"],
    ["Engine oil 5W-30", "RM189", ""],
    ["Battery NS60L", "RM245", ""],
  ];
  return (
    <div className="phone-content">
      <h2>Parts</h2>
      <p className="subtle">Recommended for your Vios from today's diagnosis.</p>
      {parts.map(([name, price, tag]) => (
        <article className="part-card" key={name}>
          <div><strong>{name}</strong>{tag && <span>{tag}</span>}</div>
          <b>{price}</b>
        </article>
      ))}
      <p className="helper-note">Recommendations are diagnosis-led, not pushed as a storefront.</p>
    </div>
  );
}

function CustomerOrders() {
  return (
    <div className="phone-content">
      <h2>Orders</h2>
      <article className="order-summary">
        <span>Job ID #MF-08471</span>
        <strong>In progress</strong>
      </article>
      <div className="timeline">
        {["Booking confirmed", "Diagnosis confirmed by technician", "Repair in progress", "Ready for pickup"].map((step, index) => (
          <div className={index < 3 ? "done" : ""} key={step}>
            <span />
            <p>{step}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function CustomerMe() {
  return (
    <div className="phone-content">
      <div className="profile-block">
        <span className="avatar large">DT</span>
        <h2>Daniel Tan</h2>
      </div>
      <div className="stats-row">
        <div><strong>2</strong><span>vehicles</span></div>
        <div><strong>12</strong><span>services</span></div>
        <div><strong>840</strong><span>points</span></div>
      </div>
      {["My vehicles", "Digital service records", "Payment methods", "Help & support"].map((item) => (
        <button className="menu-row" key={item}>{item}<span>View</span></button>
      ))}
    </div>
  );
}

function TechnicianPortal({ notes }: { notes: ReactNode }) {
  return (
    <PortalFrame
      title="ManHub · Technician"
      sidebar={["Job inbox", "My schedule", "Earnings", "Training", "Profile"]}
      notes={notes}
    >
      <div className="portal-heading">
        <p className="eyebrow">Job inbox</p>
        <h1>Job #MF-08471 - Toyota Vios 1.5G (WXY 4321)</h1>
      </div>
      <div className="portal-grid two">
        <article className="panel highlight">
          <span>AI PRE-DIAGNOSIS - NEEDS YOUR REVIEW</span>
          <h2>Front brake pads worn, likely less than 3mm</h2>
          <div className="metric-line"><strong>Confidence</strong><span>87%</span></div>
          <div className="metric-line"><strong>Source</strong><span>customer photo + squealing when braking</span></div>
          <div className="metric-line"><strong>Estimated quote</strong><span>RM 280-420</span></div>
          <div className="button-row">
            <button className="primary-button">Confirm diagnosis</button>
            <button>Correct it</button>
          </div>
        </article>
        <article className="panel">
          <h2>Customer input</h2>
          <InfoRows rows={[
            ["Symptom", "High-pitched squeal when braking, worse in the morning"],
            ["Photos", "2 brake area images"],
            ["Vehicle history", "68,420 km, last brake inspection 9 months ago"],
          ]} />
        </article>
      </div>
      <article className="panel">
        <div className="section-title">
          <h2>Build quote</h2>
          <span>Quote total RM312</span>
        </div>
        <DataTable
          columns={["Line item", "Price"]}
          rows={[
            ["Brake pad set front Bendix", "RM168"],
            ["Brake fluid DOT4 1L", "RM32"],
            ["Labour pad replacement 1.5 hr", "RM112"],
          ]}
        />
        <div className="button-row">
          <button className="primary-button">Send quote to customer</button>
          <button>Save draft</button>
        </div>
      </article>
    </PortalFrame>
  );
}

function WorkshopPortal({ notes }: { notes: ReactNode }) {
  return (
    <PortalFrame
      title="ManHub · Workshop Owner"
      sidebar={["Today's jobs", "Bays & capacity", "Technicians", "Settlement", "Reviews"]}
      notes={notes}
    >
      <KpiGrid items={[
        ["7", "Jobs today"],
        ["3 / 4", "Bays occupied"],
        ["RM 1,864", "Today's billings"],
        ["RM 1,491", "Your 80% share"],
      ]} />
      <article className="panel">
        <div className="section-title">
          <h2>Job board</h2>
          <span>Live operations view</span>
        </div>
        <DataTable
          columns={["Job", "Vehicle", "Technician", "Bay", "Status", "Bill"]}
          rows={[
            ["#08471 Brake pads", "Vios WXY4321", "Ahmad F.", "Bay 2", "In progress", "RM312"],
            ["#08465 Oil change", "Myvi VBK9902", "Lim W.", "Bay 1", "Ready", "RM226"],
            ["#08469 Battery swap", "X70 WC5511", "Ravi K.", "Bay 3", "In progress", "RM388"],
            ["#08474 Aircon service", "City BNV7733", "unassigned", "booked 3:00 PM", "est. RM280"],
          ]}
        />
      </article>
    </PortalFrame>
  );
}

function SupplierPortal({ notes }: { notes: ReactNode }) {
  return (
    <PortalFrame
      title="ManHub · Supplier"
      sidebar={["Orders to fulfil", "My catalogue", "Stock flags", "Payouts", "Analytics"]}
      notes={notes}
    >
      <KpiGrid items={[
        ["142", "Listed SKUs"],
        ["38", "Sold this month"],
        ["RM 4,212", "Pending payout"],
      ]} />
      <article className="panel">
        <div className="section-title">
          <h2>Orders to fulfil</h2>
          <span>Consignment sales</span>
        </div>
        <DataTable
          columns={["Order", "Part", "Deliver to", "Sold at", "Your payout", "Action"]}
          rows={[
            ["#P-2231", "Brake pad set front Bendix", "AutoFix Pro Sunway", "RM168", "RM126", "Confirm dispatch"],
            ["#P-2232", "Brake fluid DOT4 1L", "AutoFix Pro Sunway", "RM32", "RM24", "Confirm dispatch"],
            ["#P-2228", "Air filter K&N", "QuickCare Motors PJ", "RM89", "Paid RM66.75", "Delivered"],
          ]}
        />
        <p className="panel-note">You are paid only when an item sells. No listing fees. 25% platform commission per sale.</p>
      </article>
    </PortalFrame>
  );
}

function AdminPortal({ notes }: { notes: ReactNode }) {
  return (
    <PortalFrame
      title="ManHub · Super Admin"
      sidebar={["Overview", "Verification", "Jobs monitor", "Settlement", "Disputes", "Config"]}
      notes={notes}
    >
      <KpiGrid items={[
        ["RM 86,420", "GMV this month"],
        ["RM 18,930", "Commission earned"],
        ["214", "Jobs this week"],
        ["4.7", "Platform rating"],
      ]} />
      <div className="portal-grid two">
        <article className="panel">
          <div className="section-title">
            <h2>Verification queue</h2>
            <span>Partner trust</span>
          </div>
          <DataTable
            columns={["Type", "Name", "Status", "Action"]}
            rows={[
              ["Workshop", "Mega Auto Klang", "Docs review", "Open"],
              ["Technician", "Tan C.W.", "cert upload, Pending", "Open"],
              ["Supplier", "AutoParts2U Sdn Bhd", "New", "Open"],
            ]}
          />
        </article>
        <article className="panel">
          <div className="section-title">
            <h2>Settlement run</h2>
            <span>Ready for approval</span>
          </div>
          <InfoRows rows={[
            ["Workshops payout 80% of bills", "RM41,210"],
            ["Suppliers payout 75% of parts", "RM9,640"],
            ["Gateway fees 2%", "-RM1,272"],
            ["Platform net commission", "RM12,480"],
          ]} />
          <button className="primary-button wide">Approve settlement run</button>
        </article>
      </div>
    </PortalFrame>
  );
}

function PortalFrame({
  title,
  sidebar,
  children,
  notes,
}: {
  title: string;
  sidebar: string[];
  children: ReactNode;
  notes: ReactNode;
}) {
  return (
    <section className="portal-shell">
      <aside className="portal-sidebar">
        <div className="brand-lockup static">
          <span className="brand-mark">MH</span>
          <span><strong>ManHub</strong><small>Portal</small></span>
        </div>
        {sidebar.map((item, index) => (
          <button key={item} className={index === 0 ? "active" : ""}>{item}</button>
        ))}
      </aside>
      <div className="portal-main">
        <header className="portal-header">
          <h1>{title}</h1>
          <span>Live demo data</span>
        </header>
        <div className="portal-content">
          <div className="portal-workspace">{children}</div>
          <aside className="notes-rail">{notes}</aside>
        </div>
      </div>
    </section>
  );
}

function InvestorNotes({ view, compact = false }: { view: View; compact?: boolean }) {
  const note = notes[view];
  return (
    <aside className={compact ? "investor-notes compact" : "investor-notes"}>
      <h2>Investor Notes</h2>
      <div>
        <strong>What this screen proves</strong>
        <p>{note.proves}</p>
      </div>
      <div>
        <strong>Business decision shown</strong>
        <p>{note.decision}</p>
      </div>
      <div>
        <strong>Revenue logic shown</strong>
        <p>{note.revenue}</p>
      </div>
    </aside>
  );
}

function KpiGrid({ items }: { items: string[][] }) {
  return (
    <div className="kpi-grid">
      {items.map(([value, label]) => (
        <article className="kpi-card" key={label}>
          <strong>{value}</strong>
          <span>{label}</span>
        </article>
      ))}
    </div>
  );
}

function DataTable({ columns, rows }: { columns: string[]; rows: string[][] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.join("-")}>
              {row.map((cell, index) => <td key={`${cell}-${index}`}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InfoRows({ rows }: { rows: string[][] }) {
  return (
    <div className="info-rows">
      {rows.map(([label, value]) => (
        <div key={label}>
          <strong>{label}</strong>
          <span>{value}</span>
        </div>
      ))}
    </div>
  );
}
