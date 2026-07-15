"use client";

import { useMemo, useState } from "react";

type CustomerTab = "Home" | "Workshops" | "Parts" | "Orders" | "Me";

type Part = {
  diagnosis: boolean;
  fit: string;
  kind: string;
  name: string;
  price: string;
};

const tabs: CustomerTab[] = ["Home", "Workshops", "Parts", "Orders", "Me"];
const filters = ["Nearest", "Top rated", "Brake service", "Open now"];

const workshops = [
  { name: "AutoFix Pro", distance: "1.2 km", rating: "4.8", count: "(234)", tags: "Oil - Brakes - Tyres" },
  { name: "QuickCare Motors", distance: "2.5 km", rating: "4.6", count: "(158)", tags: "General - AC - Battery" },
  { name: "Evergreen Auto Centre", distance: "3.1 km", rating: "4.5", count: "(96)", tags: "Engine - Diagnostics" },
];

const parts: Part[] = [
  { kind: "brake", name: "Brake pad set (front) - Bendix", fit: "Fits Vios 1.5G 2021", price: "RM 168", diagnosis: true },
  { kind: "fluid", name: "Brake fluid DOT4 1L", fit: "Fits all models", price: "RM 32", diagnosis: true },
  { kind: "oil", name: "Engine oil 5W-30 fully syn 4L", fit: "Fits Vios 1.5G 2021", price: "RM 189", diagnosis: false },
  { kind: "battery", name: "Battery NS60L - Century", fit: "Fits Vios 1.5G 2021", price: "RM 245", diagnosis: false },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState<CustomerTab>("Home");
  const [diagnosisOpen, setDiagnosisOpen] = useState(false);
  const [precheckSent, setPrecheckSent] = useState(false);
  const [activeFilter, setActiveFilter] = useState("Nearest");
  const [selectedWorkshop, setSelectedWorkshop] = useState("AutoFix Pro");
  const [reservedParts, setReservedParts] = useState<string[]>([
    "Brake pad set (front) - Bendix",
    "Brake fluid DOT4 1L",
  ]);
  const [profilePanel, setProfilePanel] = useState("My vehicles");

  function reservePart(name: string) {
    setReservedParts((current) =>
      current.includes(name) ? current.filter((item) => item !== name) : [...current, name],
    );
  }

  function bookWorkshop(name: string) {
    setSelectedWorkshop(name);
    setActiveTab("Orders");
  }

  return (
    <main className="app-page">
      <section className="phone-app" aria-label="ManHub customer app">
        <div className="status-bar">
          <span>9:41</span>
          <span className="status-icons">LTE 100%</span>
        </div>

        <div className="app-content">
          {activeTab === "Home" && (
            <HomeTab
              diagnosisOpen={diagnosisOpen}
              precheckSent={precheckSent}
              setActiveTab={setActiveTab}
              setDiagnosisOpen={setDiagnosisOpen}
              setPrecheckSent={setPrecheckSent}
            />
          )}
          {activeTab === "Workshops" && (
            <WorkshopsTab
              activeFilter={activeFilter}
              bookWorkshop={bookWorkshop}
              selectedWorkshop={selectedWorkshop}
              setActiveFilter={setActiveFilter}
            />
          )}
          {activeTab === "Parts" && (
            <PartsTab
              reservePart={reservePart}
              reservedParts={reservedParts}
              setActiveTab={setActiveTab}
            />
          )}
          {activeTab === "Orders" && (
            <OrdersTab
              reservedParts={reservedParts}
              selectedWorkshop={selectedWorkshop}
              setActiveTab={setActiveTab}
            />
          )}
          {activeTab === "Me" && (
            <MeTab
              profilePanel={profilePanel}
              setProfilePanel={setProfilePanel}
            />
          )}
        </div>

        <nav className="bottom-tabs" aria-label="Main tabs">
          {tabs.map((tab) => (
            <button
              key={tab}
              className={activeTab === tab ? "active" : ""}
              onClick={() => setActiveTab(tab)}
              type="button"
            >
              <span className={`tab-icon ${tab.toLowerCase()}`} />
              {tab}
            </button>
          ))}
        </nav>
      </section>
    </main>
  );
}

function HomeTab({
  diagnosisOpen,
  precheckSent,
  setActiveTab,
  setDiagnosisOpen,
  setPrecheckSent,
}: {
  diagnosisOpen: boolean;
  precheckSent: boolean;
  setActiveTab: (tab: CustomerTab) => void;
  setDiagnosisOpen: (open: boolean) => void;
  setPrecheckSent: (sent: boolean) => void;
}) {
  return (
    <>
      <h1>Hi Daniel</h1>

      <article className="vehicle-card">
        <div>
          <strong>Toyota Vios 1.5G</strong>
          <span>WXY 4321 - 2021</span>
        </div>
        <div>
          <small>Mileage</small>
          <b>68,420 km</b>
        </div>
      </article>

      <button className="diagnosis-cta" onClick={() => setDiagnosisOpen(!diagnosisOpen)} type="button">
        <span className="cta-icon" />
        <strong>Describe a problem</strong>
        <small>Type it, snap a photo or record the noise - AI pre-checks it</small>
      </button>

      {diagnosisOpen && (
        <article className="ai-card">
          <span>{precheckSent ? "AI pre-check ready" : "Describe symptom"}</span>
          <strong>{precheckSent ? "Front brake pads worn, likely < 3mm" : "High-pitched squeal when braking"}</strong>
          <p>{precheckSent ? "Confidence 87% - estimated range RM 280-420" : "Worse in the morning. Photo and sound note attached."}</p>
          <small>{precheckSent ? "Technician confirms before the final quote." : "Tap send to generate the ManHub pre-check."}</small>
          <div className="inline-actions">
            <button type="button" onClick={() => setPrecheckSent(true)}>
              {precheckSent ? "Pre-check sent" : "Send pre-check"}
            </button>
            <button type="button" onClick={() => setActiveTab("Parts")}>View parts</button>
          </div>
        </article>
      )}

      <div className="quick-actions">
        <button type="button" onClick={() => setActiveTab("Workshops")}><span className="quick-icon search" />Find workshop</button>
        <button type="button" onClick={() => setActiveTab("Parts")}><span className="quick-icon wheel" />Spare parts</button>
        <button type="button" onClick={() => setActiveTab("Me")}><span className="quick-icon record" />My records</button>
      </div>

      <section className="reminders">
        <h2>REMINDERS</h2>
        <article className="reminder warning">
          <strong>Engine oil change due</strong>
          <span>Next service at 70,000 km - about 1,580 km to go</span>
        </article>
        <article className="reminder success">
          <strong>Brake pads replaced</strong>
          <span>Done 12 May at AutoFix Pro - in your service record</span>
        </article>
      </section>
    </>
  );
}

function WorkshopsTab({
  activeFilter,
  bookWorkshop,
  selectedWorkshop,
  setActiveFilter,
}: {
  activeFilter: string;
  bookWorkshop: (name: string) => void;
  selectedWorkshop: string;
  setActiveFilter: (filter: string) => void;
}) {
  const sortedWorkshops = useMemo(() => {
    if (activeFilter === "Top rated") {
      return [...workshops].sort((a, b) => Number(b.rating) - Number(a.rating));
    }
    if (activeFilter === "Open now") {
      return [...workshops].reverse();
    }
    return workshops;
  }, [activeFilter]);

  return (
    <>
      <h1>Find a workshop</h1>
      <label className="search-box">
        <input defaultValue="Brake service near Bandar Sunway..." aria-label="Search workshops" />
      </label>

      <div className="filter-row">
        {filters.map((filter) => (
          <button
            className={activeFilter === filter ? "selected" : ""}
            key={filter}
            onClick={() => setActiveFilter(filter)}
            type="button"
          >
            {filter}
          </button>
        ))}
      </div>

      <div className="workshop-list">
        {sortedWorkshops.map((workshop) => (
          <article className="workshop-card" key={workshop.name}>
            <div>
              <strong>{workshop.name}</strong>
              <p><b>{workshop.rating}</b> {workshop.count} - {workshop.tags}</p>
              <em>{selectedWorkshop === workshop.name ? "Selected for this job" : "Offers brake pad replacement"}</em>
            </div>
            <aside>
              <span>{workshop.distance}</span>
              <button type="button" onClick={() => bookWorkshop(workshop.name)}>
                {selectedWorkshop === workshop.name ? "Booked" : "Book"}
              </button>
            </aside>
          </article>
        ))}
      </div>
    </>
  );
}

function PartsTab({
  reservePart,
  reservedParts,
  setActiveTab,
}: {
  reservePart: (name: string) => void;
  reservedParts: string[];
  setActiveTab: (tab: CustomerTab) => void;
}) {
  return (
    <>
      <h1>Spare parts</h1>
      <article className="parts-banner">
        <strong>Recommended for your Vios - from today's diagnosis</strong>
        <span>{reservedParts.length} parts reserved. Pay only when the job is confirmed.</span>
      </article>

      <div className="parts-grid">
        {parts.map((part) => {
          const reserved = reservedParts.includes(part.name);
          return (
            <article className={`part-card ${reserved ? "reserved" : ""}`} key={part.name}>
              <div className={`part-image ${part.kind}`} />
              <strong>{part.name}</strong>
              <span>{part.fit}</span>
              <b>{part.price}</b>
              {part.diagnosis && <em>FROM DIAGNOSIS</em>}
              <button type="button" onClick={() => reservePart(part.name)}>
                {reserved ? "Reserved" : "Reserve"}
              </button>
            </article>
          );
        })}
      </div>

      <button className="wide-action" type="button" onClick={() => setActiveTab("Orders")}>
        View order
      </button>
    </>
  );
}

function OrdersTab({
  reservedParts,
  selectedWorkshop,
  setActiveTab,
}: {
  reservedParts: string[];
  selectedWorkshop: string;
  setActiveTab: (tab: CustomerTab) => void;
}) {
  return (
    <>
      <h1>My orders</h1>
      <article className="order-card">
        <header>
          <div>
            <strong>Brake pad replacement</strong>
            <span>{selectedWorkshop} - Tech Ahmad F.</span>
          </div>
          <aside>
            <b>IN PROGRESS</b>
            <span>#MF-08471</span>
          </aside>
        </header>

        <div className="reserved-summary">
          <strong>{reservedParts.length} reserved parts</strong>
          <span>{reservedParts.slice(0, 2).join(", ") || "No parts reserved yet"}</span>
        </div>

        <div className="timeline">
          <TimelineStep state="done" title="Booking confirmed" detail={`Today 10:05 - ${selectedWorkshop}`} />
          <TimelineStep state="done" title="Diagnosis confirmed by technician" detail="Today 11:20 - quote approved RM 312" />
          <TimelineStep state="active" title="Repair in progress" detail="Started 11:45 - est. 1 hr remaining" />
          <TimelineStep title="Ready for pickup" detail="You'll get a notification" />
        </div>
      </article>

      <div className="inline-actions bottom-actions">
        <button type="button" onClick={() => setActiveTab("Workshops")}>Change workshop</button>
        <button type="button" onClick={() => setActiveTab("Parts")}>Edit parts</button>
      </div>
    </>
  );
}

function TimelineStep({
  title,
  detail,
  state,
}: {
  title: string;
  detail: string;
  state?: "done" | "active";
}) {
  return (
    <div className={`timeline-step ${state ?? ""}`}>
      <i />
      <p>
        <strong>{title}</strong>
        <span>{detail}</span>
      </p>
    </div>
  );
}

function MeTab({
  profilePanel,
  setProfilePanel,
}: {
  profilePanel: string;
  setProfilePanel: (panel: string) => void;
}) {
  const panelText: Record<string, string> = {
    "My vehicles": "Toyota Vios 1.5G - WXY 4321 and Perodua Myvi - VBK 9902.",
    "Digital service records": "12 completed services, including brake pads, oil changes, and battery replacement.",
    "Payment methods": "Visa ending 2488 is ready for workshop deposits and pickup payment.",
    "Help & support": "ManHub support is available daily from 9:00 AM to 9:00 PM.",
  };

  return (
    <>
      <section className="profile">
        <span>D</span>
        <div>
          <h1>Daniel Tan</h1>
          <p>daniel.t@email.com</p>
        </div>
      </section>

      <div className="stats">
        <article><strong>2</strong><span>Vehicles</span></article>
        <article><strong>12</strong><span>Services</span></article>
        <article><strong>840</strong><span>Points</span></article>
      </div>

      <div className="menu-list">
        {Object.keys(panelText).map((item) => (
          <button
            className={profilePanel === item ? "active" : ""}
            key={item}
            onClick={() => setProfilePanel(item)}
            type="button"
          >
            {item}<span>&gt;</span>
          </button>
        ))}
      </div>

      <article className="detail-panel">
        <strong>{profilePanel}</strong>
        <span>{panelText[profilePanel]}</span>
      </article>
    </>
  );
}
