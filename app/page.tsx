"use client";

import { useState } from "react";

type CustomerTab = "Home" | "Workshops" | "Parts" | "Orders" | "Me";

const tabs: CustomerTab[] = ["Home", "Workshops", "Parts", "Orders", "Me"];

export default function Home() {
  const [activeTab, setActiveTab] = useState<CustomerTab>("Home");
  const [diagnosisOpen, setDiagnosisOpen] = useState(false);

  return (
    <main className="app-page">
      <section className="phone-app" aria-label="ManHub customer app">
        <div className="status-bar">
          <span>9:41</span>
          <span className="status-icons">LTE 100%</span>
        </div>

        <div className="app-content">
          {activeTab === "Home" && (
            <HomeTab diagnosisOpen={diagnosisOpen} setDiagnosisOpen={setDiagnosisOpen} />
          )}
          {activeTab === "Workshops" && <WorkshopsTab />}
          {activeTab === "Parts" && <PartsTab />}
          {activeTab === "Orders" && <OrdersTab />}
          {activeTab === "Me" && <MeTab />}
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
  setDiagnosisOpen,
}: {
  diagnosisOpen: boolean;
  setDiagnosisOpen: (open: boolean) => void;
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
          <span>AI pre-check</span>
          <strong>Front brake pads worn, likely &lt; 3mm</strong>
          <p>Confidence 87% - estimated range RM 280-420</p>
          <small>Technician confirms before the final quote.</small>
        </article>
      )}

      <div className="quick-actions">
        <button type="button"><span className="quick-icon search" />Find workshop</button>
        <button type="button"><span className="quick-icon wheel" />Spare parts</button>
        <button type="button"><span className="quick-icon record" />My records</button>
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

function WorkshopsTab() {
  const workshops = [
    ["AutoFix Pro", "1.2 km", "4.8", "(234)", "Oil - Brakes - Tyres"],
    ["QuickCare Motors", "2.5 km", "4.6", "(158)", "General - AC - Battery"],
    ["Evergreen Auto Centre", "3.1 km", "4.5", "(96)", "Engine - Diagnostics"],
  ];

  return (
    <>
      <h1>Find a workshop</h1>
      <div className="search-box">Brake service near Bandar Sunway...</div>

      <div className="filter-row">
        {["Nearest", "Top rated", "Brake service", "Open now"].map((filter, index) => (
          <span className={index === 0 ? "selected" : ""} key={filter}>{filter}</span>
        ))}
      </div>

      <div className="workshop-list">
        {workshops.map(([name, distance, rating, count, tags]) => (
          <article className="workshop-card" key={name}>
            <div>
              <strong>{name}</strong>
              <p><b>{rating}</b> {count} - {tags}</p>
              <em>Offers brake pad replacement</em>
            </div>
            <aside>
              <span>{distance}</span>
              <button type="button">Book</button>
            </aside>
          </article>
        ))}
      </div>
    </>
  );
}

function PartsTab() {
  const parts = [
    ["brake", "Brake pad set (front) - Bendix", "Fits Vios 1.5G 2021", "RM 168", true],
    ["fluid", "Brake fluid DOT4 1L", "Fits all models", "RM 32", true],
    ["oil", "Engine oil 5W-30 fully syn 4L", "Fits Vios 1.5G 2021", "RM 189", false],
    ["battery", "Battery NS60L - Century", "Fits Vios 1.5G 2021", "RM 245", false],
  ];

  return (
    <>
      <h1>Spare parts</h1>
      <article className="parts-banner">
        <strong>Recommended for your Vios - from today's diagnosis</strong>
        <span>Parts are reserved at the workshop. Pay only when the job is confirmed.</span>
      </article>

      <div className="parts-grid">
        {parts.map(([kind, name, fit, price, diagnosis]) => (
          <article className="part-card" key={name}>
            <div className={`part-image ${kind}`} />
            <strong>{name}</strong>
            <span>{fit}</span>
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
      <h1>My orders</h1>
      <article className="order-card">
        <header>
          <div>
            <strong>Brake pad replacement</strong>
            <span>AutoFix Pro - Tech Ahmad F.</span>
          </div>
          <aside>
            <b>IN PROGRESS</b>
            <span>#MF-08471</span>
          </aside>
        </header>

        <div className="timeline">
          <TimelineStep state="done" title="Booking confirmed" detail="Today 10:05" />
          <TimelineStep state="done" title="Diagnosis confirmed by technician" detail="Today 11:20 - quote approved RM 312" />
          <TimelineStep state="active" title="Repair in progress" detail="Started 11:45 - est. 1 hr remaining" />
          <TimelineStep title="Ready for pickup" detail="You'll get a notification" />
        </div>
      </article>
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

function MeTab() {
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
        {["My vehicles", "Digital service records", "Payment methods", "Help & support"].map((item) => (
          <button key={item} type="button">{item}<span>&gt;</span></button>
        ))}
      </div>
    </>
  );
}
