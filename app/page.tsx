"use client";

import { FormEvent, ReactNode, useState } from "react";

type View = "navigator" | "customer" | "technician" | "workshop" | "supplier" | "admin";
type CustomerTab = "Home" | "Workshops" | "Parts" | "Orders" | "Me";

const roleCards: Array<{ id: View; title: string; text: string }> = [
  { id: "customer", title: "End User App", text: "Clickable five-tab phone flow for customers." },
  { id: "technician", title: "Technician Portal", text: "Diagnosis review before a quote reaches the customer." },
  { id: "workshop", title: "Workshop Owner Portal", text: "Today floor, bays, billings, and workshop share." },
  { id: "supplier", title: "Supplier Portal", text: "Consignment orders, fulfilment, and 75% payout." },
  { id: "admin", title: "Super Admin Portal", text: "Verification, settlement, commission, and platform health." },
];

const customerTabs: CustomerTab[] = ["Home", "Workshops", "Parts", "Orders", "Me"];

const proofCards = [
  {
    tag: "服务优先",
    title: "The home screen sells diagnosis, not products.",
    text: 'The biggest element is "Describe a problem" - the parts tab exists but never competes for the first tap.',
  },
  {
    tag: "签名元素",
    title: "The AI job card.",
    text: "Urgency is a workshop gauge, cost is a range not a price, and the amber line says a technician confirms before quoting.",
  },
  {
    tag: "配件漏斗",
    title: "Parts ride on the diagnosis.",
    text: 'The two recommended parts reappear in the Parts tab marked "FROM DIAGNOSIS" - the 25% commission funnel works without a storefront push.',
  },
  {
    tag: "车主主选",
    title: "Workshops are chosen, not assigned.",
    text: 'Sorted by distance with a green "offers your service" match badge - exactly the proximity + service-match logic.',
  },
];

export default function Home() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [view, setView] = useState<View>("navigator");
  const [customerTab, setCustomerTab] = useState<CustomerTab>("Home");
  const [diagnosisOpen, setDiagnosisOpen] = useState(false);

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoggedIn(true);
  }

  if (!loggedIn) {
    return <LoginScreen onSubmit={handleLogin} />;
  }

  return (
    <main className="presentation-shell">
      {view === "navigator" && <Navigator setView={setView} />}
      {view === "customer" && (
        <EndUserSlide
          activeTab={customerTab}
          setActiveTab={setCustomerTab}
          diagnosisOpen={diagnosisOpen}
          setDiagnosisOpen={setDiagnosisOpen}
          setView={setView}
        />
      )}
      {view === "technician" && <TechnicianSlide setView={setView} />}
      {view === "workshop" && <WorkshopSlide setView={setView} />}
      {view === "supplier" && <SupplierSlide setView={setView} />}
      {view === "admin" && <AdminSlide setView={setView} />}
    </main>
  );
}

function LoginScreen({ onSubmit }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <main className="login-screen">
      <form className="login-card" onSubmit={onSubmit}>
        <span className="brand-mark">MH</span>
        <p className="eyebrow">Investor presentation</p>
        <h1>ManHub</h1>
        <p>Diagnosis-first automotive service demo, rebranded from the reference structure into a ManHub product story.</p>
        <label>
          Email
          <input type="email" defaultValue="investor@manhub.my" aria-label="Email" />
        </label>
        <label>
          Password
          <input type="password" defaultValue="manhub" aria-label="Password" />
        </label>
        <button className="primary-button" type="submit">Enter demo</button>
      </form>
    </main>
  );
}

function Navigator({ setView }: { setView: (view: View) => void }) {
  return (
    <section className="navigator-slide">
      <div className="slide-header wide">
        <p className="eyebrow">Demo Navigator</p>
        <h1>ManHub investor demo</h1>
        <p>Open each presentation slide and walk through the same five-role structure as the reference, with ManHub branding and mock marketplace data.</p>
      </div>
      <div className="navigator-grid">
        {roleCards.map((card) => (
          <article className="nav-card" key={card.id}>
            <span>{card.title}</span>
            <p>{card.text}</p>
            <button onClick={() => setView(card.id)}>View {card.title}</button>
          </article>
        ))}
      </div>
    </section>
  );
}

function SlideHeader({
  title,
  subtitle,
  decision,
  setView,
}: {
  title: string;
  subtitle: string;
  decision: string;
  setView: (view: View) => void;
}) {
  return (
    <header className="slide-header">
      <button className="back-button" onClick={() => setView("navigator")}>Demo Navigator</button>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      <span className="decision-chip">Decision shown: {decision}</span>
    </header>
  );
}

function EndUserSlide({
  activeTab,
  setActiveTab,
  diagnosisOpen,
  setDiagnosisOpen,
  setView,
}: {
  activeTab: CustomerTab;
  setActiveTab: (tab: CustomerTab) => void;
  diagnosisOpen: boolean;
  setDiagnosisOpen: (open: boolean) => void;
  setView: (view: View) => void;
}) {
  return (
    <section className="reference-slide">
      <SlideHeader
        title="End User App - service-first home"
        subtitle="The phone is clickable: use the bottom tabs to walk through the five-tab structure. The diagnosis flow opens from the big blue button."
        decision="服务优先首页 · 配件独立 tab 但由诊断驱动"
        setView={setView}
      />
      <div className="phone-proof-layout">
        <PhoneApp
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          diagnosisOpen={diagnosisOpen}
          setDiagnosisOpen={setDiagnosisOpen}
        />
        <ProofPanel />
      </div>
    </section>
  );
}

function ProofPanel() {
  return (
    <aside className="proof-panel">
      <h2>What this screen proves</h2>
      {proofCards.map((card) => (
        <article className="proof-card" key={card.tag}>
          <span>{card.tag}</span>
          <p><strong>{card.title}</strong> {card.text}</p>
        </article>
      ))}
    </aside>
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
      <div className="phone-screen">
        <div className="phone-status"><span>9:41</span><span>▣ ▮</span></div>
        <div className="phone-content">
          {activeTab === "Home" && <HomeTab diagnosisOpen={diagnosisOpen} setDiagnosisOpen={setDiagnosisOpen} />}
          {activeTab === "Workshops" && <WorkshopsTab />}
          {activeTab === "Parts" && <PartsTab />}
          {activeTab === "Orders" && <OrdersTab />}
          {activeTab === "Me" && <MeTab />}
        </div>
      </div>
      <nav className="bottom-tabs" aria-label="End user app tabs">
        {customerTabs.map((tab) => (
          <button key={tab} className={activeTab === tab ? "active" : ""} onClick={() => setActiveTab(tab)}>
            <span>{tabIcon(tab)}</span>
            {tab}
          </button>
        ))}
      </nav>
    </div>
  );
}

function tabIcon(tab: CustomerTab) {
  return ({ Home: "⌂", Workshops: "●", Parts: "◉", Orders: "◼", Me: "♟" } as Record<CustomerTab, string>)[tab];
}

function HomeTab({
  diagnosisOpen,
  setDiagnosisOpen,
}: {
  diagnosisOpen: boolean;
  setDiagnosisOpen: (open: boolean) => void;
}) {
  return (
    <>
      <h2>Hi Daniel 👋</h2>
      <article className="vehicle-tile">
        <div><strong>Toyota Vios 1.5G</strong><span>WXY 4321 · 2021</span></div>
        <div><small>Mileage</small><b>68,420 km</b></div>
      </article>
      <button className="diagnosis-button" onClick={() => setDiagnosisOpen(!diagnosisOpen)}>
        <span>🧰</span>
        <strong>Describe a problem</strong>
        <small>Type it, snap a photo or record the noise - AI pre-checks it</small>
      </button>
      {diagnosisOpen && (
        <article className="ai-job-card">
          <b>AI pre-check</b>
          <strong>Front brake pads worn, likely &lt; 3mm</strong>
          <p>Confidence 87% · quote range RM 280-420 · technician confirms before final quote</p>
        </article>
      )}
      <div className="quick-actions">
        <button><span>⌕</span>Find workshop</button>
        <button><span>◉</span>Spare parts</button>
        <button><span>▤</span>My records</button>
      </div>
      <section className="reminders">
        <h3>REMINDERS</h3>
        <article className="reminder warn"><strong>Engine oil change due</strong><span>Next service at 70,000 km - about 1,580 km to go</span></article>
        <article className="reminder ok"><strong>Brake pads replaced ✓</strong><span>Done 12 May at AutoFix Pro · in your service record</span></article>
      </section>
    </>
  );
}

function WorkshopsTab() {
  const shops = [
    ["AutoFix Pro", "1.2 km", "4.8", "(234)", "Oil · Brakes · Tyres"],
    ["QuickCare Motors", "2.5 km", "4.6", "(158)", "General · AC · Battery"],
    ["Evergreen Auto Centre", "3.1 km", "4.5", "(96)", "Engine · Diagnostics"],
  ];
  return (
    <>
      <h2>Find a workshop</h2>
      <div className="phone-search">⌕ Brake service near Bandar Sunway...</div>
      <div className="chips">
        {["Nearest", "Top rated", "Brake service", "Open now"].map((chip, index) => (
          <span className={index === 0 ? "active" : ""} key={chip}>{chip}</span>
        ))}
      </div>
      <div className="shop-list">
        {shops.map(([name, distance, rating, count, tags]) => (
          <article className="shop-card" key={name}>
            <div><strong>{name}</strong><p>★ {rating} {count} · {tags}</p><em>✓ Offers brake pad replacement</em></div>
            <aside><span>{distance}</span><button>Book</button></aside>
          </article>
        ))}
      </div>
    </>
  );
}

function PartsTab() {
  const parts = [
    ["🛑", "Brake pad set (front) - Bendix", "Fits Vios 1.5G 2021", "RM 168", true],
    ["🧴", "Brake fluid DOT4 1L", "Fits all models", "RM 32", true],
    ["🛢", "Engine oil 5W-30 fully syn 4L", "Fits Vios 1.5G 2021", "RM 189", false],
    ["🔋", "Battery NS60L - Century", "Fits Vios 1.5G 2021", "RM 245", false],
  ];
  return (
    <>
      <h2>Spare parts</h2>
      <article className="parts-hero">
        <strong>Recommended for your Vios - from today's diagnosis</strong>
        <span>Parts are reserved at the workshop. Pay only when the job is confirmed.</span>
      </article>
      <div className="parts-grid">
        {parts.map(([icon, name, fit, price, diagnosis]) => (
          <article className="product-card" key={name}>
            <div className="product-image">{icon}</div>
            <strong>{name}</strong>
            <span>✓ {fit}</span>
            <b>{price}</b>
            {diagnosis && <em>FROM DIAGNOSIS</em>}
          </article>
        ))}
      </div>
    </>
  );
}

function OrdersTab() {
  return (
    <>
      <h2>My orders</h2>
      <article className="order-card">
        <header>
          <div><strong>Brake pad replacement</strong><span>AutoFix Pro · Tech Ahmad F.</span></div>
          <aside><b>IN PROGRESS</b><span>#MF-08471</span></aside>
        </header>
        <div className="order-timeline">
          <Step done title="Booking confirmed" detail="Today 10:05" />
          <Step done title="Diagnosis confirmed by technician" detail="Today 11:20 · quote approved RM 312" />
          <Step active title="Repair in progress" detail="Started 11:45 · est. 1 hr remaining" />
          <Step title="Ready for pickup" detail="You'll get a notification" />
        </div>
      </article>
    </>
  );
}

function Step({ title, detail, done, active }: { title: string; detail: string; done?: boolean; active?: boolean }) {
  return (
    <div className={`step ${done ? "done" : ""} ${active ? "active" : ""}`}>
      <i />
      <p><strong>{title}</strong><span>{detail}</span></p>
    </div>
  );
}

function MeTab() {
  return (
    <>
      <div className="profile-head">
        <span>D</span>
        <div><h2>Daniel Tan</h2><p>daniel.t@email.com</p></div>
      </div>
      <div className="stat-grid">
        <article><strong>2</strong><span>Vehicles</span></article>
        <article><strong>12</strong><span>Services</span></article>
        <article><strong>840</strong><span>Points</span></article>
      </div>
      <div className="menu-list">
        {["My vehicles", "Digital service records", "Payment methods", "Help & support"].map((item) => (
          <button key={item}>{item}<span>›</span></button>
        ))}
      </div>
    </>
  );
}

function TechnicianSlide({ setView }: { setView: (view: View) => void }) {
  return (
    <section className="reference-slide">
      <SlideHeader
        title="Technician Portal - diagnosis review"
        subtitle="The heart of the semi-automatic model: the technician sees the AI's pre-diagnosis and must confirm or correct it before the quote goes to the customer."
        decision="半自动诊断 - AI 建议, 技师确认"
        setView={setView}
      />
      <PortalBoard title="ManHub · Technician" right="Ahmad Faizal · ★ 4.9 · IMI Certified" sidebar={["Job inbox 3", "My schedule", "Earnings", "Training", "Profile"]}>
        <div className="tech-layout">
          <section>
            <h2>Job #MF-08471 - Toyota Vios 1.5G (WXY 4321)</h2>
            <article className="review-card">
              <span>⚡ AI PRE-DIAGNOSIS - NEEDS YOUR REVIEW</span>
              <strong>Front brake pads worn (likely &lt; 3mm)</strong>
              <p>Confidence 87% · from customer photo + "squealing when braking" · est. RM 280-420</p>
              <div><button className="primary-button small">✓ Confirm diagnosis</button><button className="ghost-button">✎ Correct it</button></div>
            </article>
            <h3>Customer input</h3>
            <InfoTable rows={[
              ["Symptom", '"High-pitched squeal when braking, worse in the morning"'],
              ["Photos", "2 attached · front-left wheel"],
              ["Vehicle history", "Last brake service 28,000 km ago"],
            ]} />
          </section>
          <section>
            <h3>Build quote</h3>
            <QuoteRows rows={[
              ["Brake pad set (front) · Bendix", "RM 168.00"],
              ["Brake fluid DOT4 1L", "RM 32.00"],
              ["Labour - pad replacement (1.5 hr)", "RM 112.00"],
            ]} />
            <div className="quote-total"><strong>Quote total</strong><b>RM 312.00</b></div>
            <div className="button-row"><button className="primary-button small">Send quote to customer</button><button className="ghost-button">Save draft</button></div>
          </section>
        </div>
      </PortalBoard>
    </section>
  );
}

function WorkshopSlide({ setView }: { setView: (view: View) => void }) {
  return (
    <section className="reference-slide">
      <SlideHeader
        title="Workshop Owner Portal - today's floor"
        subtitle="The franchise owner's view: jobs flowing through the bays, the technicians on shift, and the 80% settlement after platform commission."
        decision="80/20 分润 · 工位/技师管理"
        setView={setView}
      />
      <PortalBoard title="ManHub · Workshop Owner" right="AutoFix Pro, Bandar Sunway" sidebar={["Today's jobs", "Bays & capacity", "Technicians", "Settlement", "Reviews"]}>
        <Kpis items={[["7", "Jobs today"], ["3 / 4", "Bays occupied"], ["RM 1,864", "Today's billings"], ["RM 1,491", "Your 80% share"]]} />
        <h2>Job board</h2>
        <DataTable columns={["Job", "Vehicle", "Technician", "Bay", "Status", "Bill"]} rows={[
          ["#08471 · Brake pads", "Vios · WXY 4321", "Ahmad F.", "2", "In progress", "RM 312"],
          ["#08465 · Oil change", "Myvi · VBK 9902", "Lim W.", "1", "Ready", "RM 226"],
          ["#08469 · Battery swap", "X70 · WC 5511", "Ravi K.", "3", "In progress", "RM 388"],
          ["#08474 · Aircon service", "City · BNV 7733", "-", "-", "Booked 3:00 PM", "est. RM 280"],
        ]} />
      </PortalBoard>
    </section>
  );
}

function SupplierSlide({ setView }: { setView: (view: View) => void }) {
  return (
    <section className="reference-slide">
      <SlideHeader
        title="Supplier Portal - consignment"
        subtitle='The platform holds no stock. Suppliers list parts, get a "fulfil on sale" alert when something sells, and are paid per sale after the 25% commission.'
        decision="Consignment 寄售 · 卖出才结算"
        setView={setView}
      />
      <PortalBoard title="ManHub · Supplier" right="PartsHub Trading Sdn Bhd" sidebar={["Orders to fulfil 2", "My catalogue", "Stock flags", "Payouts", "Analytics"]}>
        <Kpis items={[["142", "Listed SKUs"], ["38", "Sold this month"], ["RM 4,212", "Pending payout (75%)"]]} />
        <h2>Sold - ship now</h2>
        <DataTable columns={["Order", "Part", "Deliver to", "Sold at", "Your payout", ""]} rows={[
          ["#P-2231", "Brake pad set (front) · Bendix", "AutoFix Pro, Sunway", "RM 168", "RM 126.00", "Confirm dispatch"],
          ["#P-2232", "Brake fluid DOT4 1L", "AutoFix Pro, Sunway", "RM 32", "RM 24.00", "Confirm dispatch"],
          ["#P-2228", "Air filter · K&N", "QuickCare Motors, PJ", "RM 89", "Paid RM 66.75", "Delivered"],
        ]} />
        <p className="portal-footnote">You are paid only when an item sells. No listing fees · 25% platform commission per sale.</p>
      </PortalBoard>
    </section>
  );
}

function AdminSlide({ setView }: { setView: (view: View) => void }) {
  return (
    <section className="reference-slide">
      <SlideHeader
        title="Super Admin Portal - platform control"
        subtitle="Verification queues, the commission engine and global job health - the operator's cockpit for the whole ecosystem."
        decision="20% / 25% 抽成结算 · 审核队列"
        setView={setView}
      />
      <PortalBoard title="ManHub · Super Admin" right="Operations · HQ" sidebar={["Overview", "Verification 6", "Jobs monitor", "Settlement", "Disputes 1", "Config"]}>
        <Kpis items={[["RM 86,420", "GMV this month"], ["RM 18,930", "Commission earned"], ["214", "Jobs this week"], ["4.7 ★", "Avg. platform rating"]]} />
        <div className="admin-grid">
          <section>
            <h2>Verification queue</h2>
            <DataTable columns={["", "", ""]} rows={[
              ["Workshop · Mega Auto, Klang", "Docs review", "Open"],
              ["Technician · Tan C.W. (cert upload)", "Pending", "Open"],
              ["Supplier · AutoParts2U Sdn Bhd", "New", "Open"],
            ]} />
          </section>
          <section>
            <h2>Settlement run - this week</h2>
            <QuoteRows rows={[
              ["Workshops payout (80% of bills)", "RM 41,210"],
              ["Suppliers payout (75% of parts)", "RM 9,640"],
              ["Gateway fees (2%)", "- RM 1,272"],
            ]} />
            <div className="quote-total"><strong>Platform net commission</strong><b>RM 12,480</b></div>
            <button className="primary-button small">Approve settlement run</button>
          </section>
        </div>
      </PortalBoard>
    </section>
  );
}

function PortalBoard({
  title,
  right,
  sidebar,
  children,
}: {
  title: string;
  right: string;
  sidebar: string[];
  children: ReactNode;
}) {
  return (
    <article className="portal-board">
      <header><strong>⌁ {title}</strong><span>{right}</span></header>
      <div className="portal-body">
        <aside>
          {sidebar.map((item, index) => <button className={index === 0 ? "active" : ""} key={item}>{item}</button>)}
        </aside>
        <main>{children}</main>
      </div>
    </article>
  );
}

function Kpis({ items }: { items: string[][] }) {
  return (
    <div className="kpi-grid">
      {items.map(([value, label]) => <article key={label}><strong>{value}</strong><span>{label}</span></article>)}
    </div>
  );
}

function DataTable({ columns, rows }: { columns: string[]; rows: string[][] }) {
  return (
    <table className="data-table">
      <thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
      <tbody>
        {rows.map((row) => <tr key={row.join("")}>{row.map((cell, index) => <td key={`${cell}-${index}`}>{renderCell(cell)}</td>)}</tr>)}
      </tbody>
    </table>
  );
}

function renderCell(cell: string) {
  if (["In progress", "Ready", "Booked 3:00 PM", "Docs review", "Pending", "New", "Open", "Confirm dispatch", "Delivered", "Paid RM 66.75"].includes(cell)) {
    return <span className={`pill ${cell.toLowerCase().replaceAll(" ", "-").replaceAll(":", "")}`}>{cell}</span>;
  }
  return cell;
}

function InfoTable({ rows }: { rows: string[][] }) {
  return <div className="info-table">{rows.map(([a, b]) => <div key={a}><span>{a}</span><strong>{b}</strong></div>)}</div>;
}

function QuoteRows({ rows }: { rows: string[][] }) {
  return <div className="quote-rows">{rows.map(([a, b]) => <div key={a}><span>{a}</span><strong>{b}</strong></div>)}</div>;
}
