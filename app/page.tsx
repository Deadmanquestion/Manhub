"use client";

import { useMemo, useState } from "react";

type CustomerTab = "Home" | "Workshops" | "Parts" | "Orders" | "Me";
type AppView = CustomerTab | "Diagnosis" | "WorkshopDetail" | "QuoteReview" | "OrderDetail" | "ServiceRecord";

type Part = {
  diagnosis: boolean;
  fit: string;
  kind: string;
  name: string;
  price: number;
};

type Workshop = {
  name: string;
  distance: string;
  rating: string;
  count: string;
  tags: string;
  hours: string;
};

const tabs: CustomerTab[] = ["Home", "Workshops", "Parts", "Orders", "Me"];
const filters = ["Nearest", "Top rated", "Brake service", "Open now"];

const workshops: Workshop[] = [
  {
    name: "AutoFix Pro",
    distance: "1.2 km",
    rating: "4.8",
    count: "(234)",
    tags: "Oil - Brakes - Tyres",
    hours: "8:30 AM - 7:00 PM",
  },
  {
    name: "QuickCare Motors",
    distance: "2.5 km",
    rating: "4.6",
    count: "(158)",
    tags: "General - AC - Battery",
    hours: "9:00 AM - 6:30 PM",
  },
  {
    name: "Evergreen Auto Centre",
    distance: "3.1 km",
    rating: "4.5",
    count: "(96)",
    tags: "Engine - Diagnostics",
    hours: "8:00 AM - 6:00 PM",
  },
];

const parts: Part[] = [
  { kind: "brake", name: "Brake pad set (front) - Bendix", fit: "Fits Vios 1.5G 2021", price: 168, diagnosis: true },
  { kind: "fluid", name: "Brake fluid DOT4 1L", fit: "Fits all models", price: 32, diagnosis: true },
  { kind: "oil", name: "Engine oil 5W-30 fully syn 4L", fit: "Fits Vios 1.5G 2021", price: 189, diagnosis: false },
  { kind: "battery", name: "Battery NS60L - Century", fit: "Fits Vios 1.5G 2021", price: 245, diagnosis: false },
];

const labourPrice = 112;

export default function Home() {
  const [view, setView] = useState<AppView>("Home");
  const [activeFilter, setActiveFilter] = useState("Nearest");
  const [selectedWorkshop, setSelectedWorkshop] = useState("AutoFix Pro");
  const [reservedParts, setReservedParts] = useState<string[]>([
    "Brake pad set (front) - Bendix",
    "Brake fluid DOT4 1L",
  ]);
  const [profilePanel, setProfilePanel] = useState("My vehicles");
  const [problem, setProblem] = useState("High-pitched squeal when braking, worse in the morning.");
  const [photoAttached, setPhotoAttached] = useState(false);
  const [noiseRecorded, setNoiseRecorded] = useState(false);
  const [aiDone, setAiDone] = useState(false);
  const [sentToTech, setSentToTech] = useState(false);
  const [quoteApproved, setQuoteApproved] = useState(false);
  const [questionAsked, setQuestionAsked] = useState(false);

  const selectedWorkshopData = workshops.find((workshop) => workshop.name === selectedWorkshop) ?? workshops[0];
  const reservedPartDetails = parts.filter((part) => reservedParts.includes(part.name));
  const quoteTotal = reservedPartDetails.reduce((sum, part) => sum + part.price, labourPrice);

  function navigateTab(tab: CustomerTab) {
    setView(tab);
  }

  function reservePart(name: string) {
    setReservedParts((current) =>
      current.includes(name) ? current.filter((item) => item !== name) : [...current, name],
    );
  }

  function bookWorkshop(name: string) {
    setSelectedWorkshop(name);
    setView("WorkshopDetail");
  }

  const activeTab = tabs.includes(view as CustomerTab) ? (view as CustomerTab) : viewToTab(view);

  return (
    <main className="app-page">
      <section className="phone-app" aria-label="ManHub customer app">
        <div className="status-bar">
          <span>9:41</span>
          <span className="status-icons">LTE 100%</span>
        </div>

        <div className="app-content">
          {view === "Home" && (
            <HomeTab
              aiDone={aiDone}
              quoteApproved={quoteApproved}
              setView={setView}
              selectedWorkshop={selectedWorkshop}
            />
          )}
          {view === "Diagnosis" && (
            <DiagnosisFlowPage
              aiDone={aiDone}
              noiseRecorded={noiseRecorded}
              photoAttached={photoAttached}
              problem={problem}
              sentToTech={sentToTech}
              setAiDone={setAiDone}
              setNoiseRecorded={setNoiseRecorded}
              setPhotoAttached={setPhotoAttached}
              setProblem={setProblem}
              setSentToTech={setSentToTech}
              setView={setView}
              workshop={selectedWorkshopData}
            />
          )}
          {view === "Workshops" && (
            <WorkshopsTab
              activeFilter={activeFilter}
              bookWorkshop={bookWorkshop}
              selectedWorkshop={selectedWorkshop}
              setActiveFilter={setActiveFilter}
              setView={setView}
            />
          )}
          {view === "WorkshopDetail" && (
            <WorkshopDetailPage
              bookWorkshop={bookWorkshop}
              selectedWorkshop={selectedWorkshop}
              setView={setView}
              workshop={selectedWorkshopData}
            />
          )}
          {view === "Parts" && (
            <PartsTab
              reservePart={reservePart}
              reservedParts={reservedParts}
              setView={setView}
            />
          )}
          {view === "Orders" && (
            <OrdersTab
              quoteApproved={quoteApproved}
              reservedParts={reservedParts}
              selectedWorkshop={selectedWorkshop}
              setView={setView}
            />
          )}
          {view === "QuoteReview" && (
            <QuoteReviewPage
              quoteApproved={quoteApproved}
              questionAsked={questionAsked}
              reservedPartDetails={reservedPartDetails}
              setQuestionAsked={setQuestionAsked}
              setQuoteApproved={setQuoteApproved}
              setView={setView}
              total={quoteTotal}
            />
          )}
          {view === "OrderDetail" && (
            <OrderDetailPage
              quoteApproved={quoteApproved}
              reservedPartDetails={reservedPartDetails}
              selectedWorkshop={selectedWorkshop}
              setView={setView}
              total={quoteTotal}
            />
          )}
          {view === "ServiceRecord" && (
            <ServiceRecordPage
              reservedPartDetails={reservedPartDetails}
              selectedWorkshop={selectedWorkshop}
              setView={setView}
            />
          )}
          {view === "Me" && (
            <MeTab
              profilePanel={profilePanel}
              setProfilePanel={setProfilePanel}
              setView={setView}
            />
          )}
        </div>

        <nav className="bottom-tabs" aria-label="Main tabs">
          {tabs.map((tab) => (
            <button
              key={tab}
              className={activeTab === tab ? "active" : ""}
              onClick={() => navigateTab(tab)}
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

function viewToTab(view: AppView): CustomerTab {
  if (view === "Diagnosis") return "Home";
  if (view === "WorkshopDetail") return "Workshops";
  if (view === "QuoteReview" || view === "OrderDetail") return "Orders";
  if (view === "ServiceRecord") return "Me";
  return "Home";
}

function BackButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button className="back-button" onClick={onClick} type="button">
      <span>&lt;</span>
      {label}
    </button>
  );
}

function HomeTab({
  aiDone,
  quoteApproved,
  selectedWorkshop,
  setView,
}: {
  aiDone: boolean;
  quoteApproved: boolean;
  selectedWorkshop: string;
  setView: (view: AppView) => void;
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

      <button className="diagnosis-cta" onClick={() => setView("Diagnosis")} type="button">
        <span className="cta-icon" />
        <strong>Describe your car problem</strong>
        <small>Upload photo, record noise, get AI pre-diagnosis</small>
      </button>

      <article className="ai-card">
        <span>{aiDone ? "AI PRE-DIAGNOSIS READY" : "DIAGNOSIS-FIRST FLOW"}</span>
        <strong>{aiDone ? "Front brake pads worn, likely under 3mm" : "ManHub starts with the problem, not parts"}</strong>
        <p>{aiDone ? `Workshop selected: ${selectedWorkshop}. Quote review is ready.` : "The app guides the customer from symptom to workshop to technician confirmation."}</p>
        <div className="inline-actions">
          <button type="button" onClick={() => setView("Diagnosis")}>Open diagnosis</button>
          <button type="button" onClick={() => setView(quoteApproved ? "OrderDetail" : "QuoteReview")}>
            {quoteApproved ? "Track job" : "Review quote"}
          </button>
        </div>
      </article>

      <div className="quick-actions">
        <button type="button" onClick={() => setView("Workshops")}><span className="quick-icon search" />Find workshop</button>
        <button type="button" onClick={() => setView("Parts")}><span className="quick-icon wheel" />Spare parts</button>
        <button type="button" onClick={() => setView("ServiceRecord")}><span className="quick-icon record" />Service record</button>
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

function DiagnosisFlowPage({
  aiDone,
  noiseRecorded,
  photoAttached,
  problem,
  sentToTech,
  setAiDone,
  setNoiseRecorded,
  setPhotoAttached,
  setProblem,
  setSentToTech,
  setView,
  workshop,
}: {
  aiDone: boolean;
  noiseRecorded: boolean;
  photoAttached: boolean;
  problem: string;
  sentToTech: boolean;
  setAiDone: (done: boolean) => void;
  setNoiseRecorded: (recorded: boolean) => void;
  setPhotoAttached: (attached: boolean) => void;
  setProblem: (problem: string) => void;
  setSentToTech: (sent: boolean) => void;
  setView: (view: AppView) => void;
  workshop: Workshop;
}) {
  const aiSummary = useMemo(() => {
    const signal = problem.toLowerCase();
    if (signal.includes("battery")) {
      return {
        title: "Battery health low or charging issue",
        confidence: "82%",
        range: "RM 220-360",
        next: "Ask workshop to test battery and alternator before quote.",
      };
    }
    if (signal.includes("oil") || signal.includes("smell")) {
      return {
        title: "Oil service or minor leak inspection needed",
        confidence: "78%",
        range: "RM 160-280",
        next: "Technician checks oil level, filter, and underside leak marks.",
      };
    }
    return {
      title: "Front brake pads worn, likely under 3mm",
      confidence: "87%",
      range: "RM 280-420",
      next: "Technician confirms pad thickness before final quote.",
    };
  }, [problem]);

  function runAi() {
    setAiDone(true);
    setSentToTech(false);
  }

  return (
    <>
      <BackButton label="Home" onClick={() => setView("Home")} />
      <header className="page-header">
        <h1>Diagnosis flow</h1>
        <p>Describe the issue first. ManHub turns symptoms into a technician-ready job card.</p>
      </header>

      <article className="form-card">
        <label>
          Describe your car problem
          <textarea
            aria-label="Describe your car problem"
            onChange={(event) => setProblem(event.target.value)}
            value={problem}
          />
        </label>
        <div className="media-actions">
          <button className={photoAttached ? "done" : ""} onClick={() => setPhotoAttached(!photoAttached)} type="button">
            {photoAttached ? "Photo uploaded" : "Upload photo"}
          </button>
          <button className={noiseRecorded ? "done" : ""} onClick={() => setNoiseRecorded(!noiseRecorded)} type="button">
            {noiseRecorded ? "Noise recorded" : "Record noise"}
          </button>
        </div>
        <button className="wide-action" onClick={runAi} type="button">Run AI pre-diagnosis</button>
      </article>

      <article className={`diagnosis-result ${aiDone ? "ready" : ""}`}>
        <span>AI pre-diagnosis</span>
        <strong>{aiDone ? aiSummary.title : "Waiting for symptom input"}</strong>
        <p>{aiDone ? `Confidence ${aiSummary.confidence}. ${aiSummary.next}` : "Upload a photo or record the noise to make the pre-check more credible."}</p>
      </article>

      <article className="estimate-card">
        <span>Estimated range</span>
        <strong>{aiDone ? aiSummary.range : "RM --"}</strong>
        <small>Range only. Technician confirms before quote.</small>
      </article>

      <section className="step-stack">
        <button type="button" onClick={() => setView("Workshops")}>
          <span>Choose workshop</span>
          <strong>{workshop.name} - {workshop.distance}</strong>
        </button>
        <button
          className={sentToTech ? "sent" : ""}
          disabled={!aiDone}
          onClick={() => setSentToTech(true)}
          type="button"
        >
          <span>Send to technician</span>
          <strong>{sentToTech ? "Sent to Ahmad F. for confirmation" : "Create technician review card"}</strong>
        </button>
      </section>
    </>
  );
}

function WorkshopsTab({
  activeFilter,
  bookWorkshop,
  selectedWorkshop,
  setActiveFilter,
  setView,
}: {
  activeFilter: string;
  bookWorkshop: (name: string) => void;
  selectedWorkshop: string;
  setActiveFilter: (filter: string) => void;
  setView: (view: AppView) => void;
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
                {selectedWorkshop === workshop.name ? "Open" : "Book"}
              </button>
              <button className="text-link" type="button" onClick={() => setView("WorkshopDetail")}>Details</button>
            </aside>
          </article>
        ))}
      </div>
    </>
  );
}

function WorkshopDetailPage({
  bookWorkshop,
  selectedWorkshop,
  setView,
  workshop,
}: {
  bookWorkshop: (name: string) => void;
  selectedWorkshop: string;
  setView: (view: AppView) => void;
  workshop: Workshop;
}) {
  return (
    <>
      <BackButton label="Workshops" onClick={() => setView("Workshops")} />
      <article className="detail-hero">
        <span>Recommended workshop</span>
        <h1>{workshop.name}</h1>
        <p><b>{workshop.rating}</b> {workshop.count} - {workshop.distance}</p>
        <em>Offers brake pad replacement</em>
      </article>

      <div className="info-grid">
        <article><span>Working hours</span><strong>{workshop.hours}</strong></article>
        <article><span>Services</span><strong>Brakes, tyres, oil, diagnostics</strong></article>
        <article><span>Technicians</span><strong>Ahmad F., Lim W., Ravi K.</strong></article>
        <article><span>Reviews</span><strong>"Fast diagnosis and clear quote."</strong></article>
      </div>

      <button className="wide-action" onClick={() => bookWorkshop(workshop.name)} type="button">
        {selectedWorkshop === workshop.name ? "Booked with this workshop" : "Book with this workshop"}
      </button>
      <button className="secondary-wide" onClick={() => setView("Diagnosis")} type="button">
        Send diagnosis to this workshop
      </button>
    </>
  );
}

function PartsTab({
  reservePart,
  reservedParts,
  setView,
}: {
  reservePart: (name: string) => void;
  reservedParts: string[];
  setView: (view: AppView) => void;
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
              <b>RM {part.price}</b>
              {part.diagnosis && <em>FROM DIAGNOSIS</em>}
              <button type="button" onClick={() => reservePart(part.name)}>
                {reserved ? "Reserved" : "Reserve"}
              </button>
            </article>
          );
        })}
      </div>

      <button className="wide-action" type="button" onClick={() => setView("QuoteReview")}>
        Review quote
      </button>
    </>
  );
}

function OrdersTab({
  quoteApproved,
  reservedParts,
  selectedWorkshop,
  setView,
}: {
  quoteApproved: boolean;
  reservedParts: string[];
  selectedWorkshop: string;
  setView: (view: AppView) => void;
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
            <b>{quoteApproved ? "IN PROGRESS" : "QUOTE READY"}</b>
            <span>#MF-08471</span>
          </aside>
        </header>

        <div className="reserved-summary">
          <strong>{reservedParts.length} reserved parts</strong>
          <span>{reservedParts.slice(0, 2).join(", ") || "No parts reserved yet"}</span>
        </div>

        <div className="inline-actions bottom-actions">
          <button type="button" onClick={() => setView("QuoteReview")}>Quote review</button>
          <button type="button" onClick={() => setView("OrderDetail")}>Order detail</button>
        </div>
      </article>
    </>
  );
}

function QuoteReviewPage({
  quoteApproved,
  questionAsked,
  reservedPartDetails,
  setQuestionAsked,
  setQuoteApproved,
  setView,
  total,
}: {
  quoteApproved: boolean;
  questionAsked: boolean;
  reservedPartDetails: Part[];
  setQuestionAsked: (asked: boolean) => void;
  setQuoteApproved: (approved: boolean) => void;
  setView: (view: AppView) => void;
  total: number;
}) {
  return (
    <>
      <BackButton label="Orders" onClick={() => setView("Orders")} />
      <header className="page-header">
        <h1>Quote review</h1>
        <p>Technician confirmed diagnosis before the customer approves payment.</p>
      </header>

      <article className="review-card">
        <span>Technician confirmed diagnosis</span>
        <strong>Front brake pads worn, replacement recommended</strong>
        <small>Ahmad F. - IMI Certified - confidence 87%</small>
      </article>

      <div className="quote-lines">
        {reservedPartDetails.map((part) => (
          <div key={part.name}>
            <span>{part.name}</span>
            <strong>RM {part.price}</strong>
          </div>
        ))}
        <div>
          <span>Labour - pad replacement (1.5 hr)</span>
          <strong>RM {labourPrice}</strong>
        </div>
        <div className="total-row">
          <span>Total</span>
          <strong>RM {total}</strong>
        </div>
      </div>

      <div className="inline-actions quote-actions">
        <button type="button" onClick={() => setQuoteApproved(true)}>
          {quoteApproved ? "Quote approved" : "Approve quote"}
        </button>
        <button type="button" onClick={() => setQuestionAsked(true)}>
          {questionAsked ? "Question sent" : "Ask question"}
        </button>
      </div>
      {quoteApproved && (
        <button className="wide-action" type="button" onClick={() => setView("OrderDetail")}>Track job lifecycle</button>
      )}
    </>
  );
}

function OrderDetailPage({
  quoteApproved,
  reservedPartDetails,
  selectedWorkshop,
  setView,
  total,
}: {
  quoteApproved: boolean;
  reservedPartDetails: Part[];
  selectedWorkshop: string;
  setView: (view: AppView) => void;
  total: number;
}) {
  return (
    <>
      <BackButton label="Orders" onClick={() => setView("Orders")} />
      <article className="order-card">
        <header>
          <div>
            <strong>Job #MF-08471</strong>
            <span>Brake pad replacement</span>
          </div>
          <aside>
            <b>{quoteApproved ? "IN PROGRESS" : "WAITING APPROVAL"}</b>
            <span>RM {total}</span>
          </aside>
        </header>

        <div className="job-meta">
          <p><span>Technician</span><strong>Ahmad F.</strong></p>
          <p><span>Workshop</span><strong>{selectedWorkshop}</strong></p>
          <p><span>Diagnosis</span><strong>Confirmed</strong></p>
          <p><span>Quote</span><strong>RM {total}</strong></p>
        </div>

        <div className="timeline">
          <TimelineStep state="done" title="Booking confirmed" detail={`Today 10:05 - ${selectedWorkshop}`} />
          <TimelineStep state="done" title="Diagnosis confirmed" detail="Today 11:20 - technician verified brake pads" />
          <TimelineStep state={quoteApproved ? "done" : "active"} title="Quote RM312" detail={quoteApproved ? "Customer approved quote" : "Waiting for customer approval"} />
          <TimelineStep state={quoteApproved ? "active" : undefined} title="Repair in progress" detail="Started 11:45 - est. 1 hr remaining" />
        </div>
      </article>

      <section className="service-list">
        <h2>Parts used</h2>
        {reservedPartDetails.map((part) => (
          <article key={part.name}>
            <strong>{part.name}</strong>
            <span>RM {part.price} - warranty eligible</span>
          </article>
        ))}
      </section>
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

function ServiceRecordPage({
  reservedPartDetails,
  selectedWorkshop,
  setView,
}: {
  reservedPartDetails: Part[];
  selectedWorkshop: string;
  setView: (view: AppView) => void;
}) {
  return (
    <>
      <BackButton label="Me" onClick={() => setView("Me")} />
      <header className="page-header">
        <h1>Service record</h1>
        <p>Long-term ownership data keeps the customer returning to ManHub.</p>
      </header>

      <article className="record-card">
        <span>Completed service</span>
        <strong>Brake pads replaced</strong>
        <p>12 May 2026 - {selectedWorkshop}</p>
      </article>

      <div className="job-meta">
        <p><span>Workshop</span><strong>{selectedWorkshop}</strong></p>
        <p><span>Technician</span><strong>Ahmad F.</strong></p>
        <p><span>Warranty</span><strong>6 months / 10,000 km</strong></p>
        <p><span>Next reminder</span><strong>Brake inspection at 78,000 km</strong></p>
      </div>

      <section className="service-list">
        <h2>Parts used</h2>
        {reservedPartDetails.map((part) => (
          <article key={part.name}>
            <strong>{part.name}</strong>
            <span>{part.fit}</span>
          </article>
        ))}
      </section>
    </>
  );
}

function MeTab({
  profilePanel,
  setProfilePanel,
  setView,
}: {
  profilePanel: string;
  setProfilePanel: (panel: string) => void;
  setView: (view: AppView) => void;
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
            onClick={() => {
              setProfilePanel(item);
              if (item === "Digital service records") {
                setView("ServiceRecord");
              }
            }}
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
