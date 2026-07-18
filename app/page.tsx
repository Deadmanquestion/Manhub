"use client";

import { useMemo, useState } from "react";

type CustomerTab = "Home" | "Workshops" | "Parts" | "Orders" | "Me";
type AppView =
  | CustomerTab
  | "Diagnosis"
  | "WorkshopDetail"
  | "SupportCenter"
  | "QuoteReview"
  | "Payment"
  | "PaymentSuccess"
  | "Invoice"
  | "ServiceRecord"
  | "PartDetail"
  | "PartReservationSummary"
  | "PaymentReview"
  | "OrderDetail";
type PartStatus = "Recommended" | "Soft reserved" | "Added to quote" | "Confirmed" | "Installed";
type QuoteStatus = "Pending technician confirmation" | "Quote ready" | "Approved";
type PaymentStatus = "Not required yet" | "Deposit pending" | "Deposit paid" | "Fully paid";
type OrderStatus =
  | "Booking confirmed"
  | "Diagnosis confirmed"
  | "Quote approved"
  | "Deposit paid"
  | "Repair in progress"
  | "Ready for pickup"
  | "Completed";

type Part = {
  brand: string;
  description: string;
  diagnosis: boolean;
  fit: string;
  includedWith: string;
  kind: string;
  name: string;
  normalUse: string;
  price: number;
  serviceLife: string;
  supplier: string;
};

type Workshop = {
  name: string;
  distance: string;
  rating: string;
  count: string;
  tags: string;
  hours: string;
};

type ReceiptRecord = {
  amount: number;
  method: string;
  receiptNo: string;
};

type PendingPayment = {
  amount: number;
  fullPayment: boolean;
  method: string;
};

const tabs: CustomerTab[] = ["Home", "Workshops", "Parts", "Orders", "Me"];
const filters = ["Nearest", "Top rated", "Brake service", "Open now"];
const vehicle = "Toyota Vios 1.5G";
const jobNo = "MF-08471";
const quoteNo = "Q-08471";
const invoiceNo = "INV-08471";
const receiptNo = "RCPT-08471";
const technician = "Ahmad F.";
const diagnosis = "Front brake pads worn";
const labourPrice = 112;
const depositAmount = 50;

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
  {
    brand: "Bendix",
    description: "Front brake pad set for safe daily stopping, city driving, and highway braking.",
    kind: "brake",
    name: "Brake pad set front Bendix",
    fit: "Fits Toyota Vios 1.5G 2021",
    includedWith: "Front left and front right pads",
    normalUse: "Used every time the driver brakes. Technician installs it after confirming pad thickness and rotor condition.",
    price: 168,
    serviceLife: "Usually checked every 10,000 km and replaced when worn below safe thickness.",
    diagnosis: true,
    supplier: "PartsHub Trading Sdn Bhd",
  },
  {
    brand: "Bosch service grade",
    description: "DOT4 brake fluid for hydraulic brake pressure and consistent pedal feel.",
    kind: "fluid",
    name: "Brake fluid DOT4 1L",
    fit: "Fits all models",
    includedWith: "1 litre sealed bottle",
    normalUse: "Used during brake service to top up or refresh the hydraulic brake system.",
    price: 32,
    serviceLife: "Normally inspected during brake jobs and refreshed when fluid condition is poor.",
    diagnosis: true,
    supplier: "AutoParts2U Sdn Bhd",
  },
  {
    brand: "Shell Helix",
    description: "Fully synthetic engine oil for smoother daily engine operation.",
    kind: "oil",
    name: "Engine oil 5W-30 fully syn 4L",
    fit: "Fits Toyota Vios 1.5G 2021",
    includedWith: "4 litre bottle",
    normalUse: "Used during scheduled oil change service to protect moving engine parts.",
    price: 189,
    serviceLife: "Usually replaced every 7,000 to 10,000 km depending on driving condition.",
    diagnosis: false,
    supplier: "PartsHub Trading Sdn Bhd",
  },
  {
    brand: "Century",
    description: "NS60L battery for engine starting and vehicle electrical systems.",
    kind: "battery",
    name: "Battery NS60L - Century",
    fit: "Fits Toyota Vios 1.5G 2021",
    includedWith: "One NS60L battery unit",
    normalUse: "Used to start the car and support lights, infotainment, and basic electronics.",
    price: 245,
    serviceLife: "Commonly lasts around 18 to 30 months depending on heat and usage.",
    diagnosis: false,
    supplier: "Century Battery Partner",
  },
];

export default function Home() {
  const [view, setView] = useState<AppView>("Home");
  const [activeFilter, setActiveFilter] = useState("Nearest");
  const [selectedWorkshop, setSelectedWorkshop] = useState("AutoFix Pro");
  const [selectedPartName, setSelectedPartName] = useState(parts[0].name);
  const [partStatuses, setPartStatuses] = useState<Record<string, PartStatus>>(
    Object.fromEntries(parts.map((part) => [part.name, part.diagnosis ? "Recommended" : "Recommended"])) as Record<
      string,
      PartStatus
    >,
  );
  const [profilePanel, setProfilePanel] = useState("My vehicles");
  const [problem, setProblem] = useState("High-pitched squeal when braking, worse in the morning.");
  const [photoAttached, setPhotoAttached] = useState(false);
  const [noiseRecorded, setNoiseRecorded] = useState(false);
  const [aiDone, setAiDone] = useState(false);
  const [sentToTech, setSentToTech] = useState(false);
  const [quoteStatus, setQuoteStatus] = useState<QuoteStatus>("Quote ready");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("Deposit pending");
  const [orderStatus, setOrderStatus] = useState<OrderStatus>("Diagnosis confirmed");
  const [questionAsked, setQuestionAsked] = useState(false);
  const [supportNotice, setSupportNotice] = useState("");
  const [appNotice, setAppNotice] = useState("");
  const [pendingPayment, setPendingPayment] = useState<PendingPayment | null>(null);
  const [lastPayment, setLastPayment] = useState<ReceiptRecord | null>(null);

  const selectedWorkshopData = workshops.find((workshop) => workshop.name === selectedWorkshop) ?? workshops[0];
  const selectedPart = parts.find((part) => part.name === selectedPartName) ?? parts[0];
  const quotedParts = parts.filter((part) => partStatuses[part.name] !== "Recommended");
  const quoteParts = quotedParts.length > 0 ? quotedParts : parts.filter((part) => part.diagnosis);
  const partsSubtotal = quoteParts.reduce((sum, part) => sum + part.price, 0);
  const quoteTotal = partsSubtotal + labourPrice;
  const paidAmount = paymentStatus === "Fully paid" ? quoteTotal : paymentStatus === "Deposit paid" ? depositAmount : 0;
  const balance = quoteTotal - paidAmount;
  const activeTab = tabs.includes(view as CustomerTab) ? (view as CustomerTab) : viewToTab(view);

  function setPartStatus(name: string, status: PartStatus) {
    setPartStatuses((current) => ({ ...current, [name]: status }));
  }

  function openPartReservation(part: Part) {
    setSelectedPartName(part.name);
    setPartStatus(part.name, "Soft reserved");
    setAppNotice(`${part.name} is soft reserved for Job #${jobNo}. No payment collected yet.`);
    setView("PartReservationSummary");
  }

  function openPartDetail(part: Part) {
    setSelectedPartName(part.name);
    setView("PartDetail");
  }

  function addPartToQuote(part: Part) {
    setPartStatus(part.name, "Added to quote");
    setAppNotice(`${part.name} added to Quote #${quoteNo}.`);
    setQuoteStatus("Quote ready");
    setPaymentStatus("Deposit pending");
    setOrderStatus("Diagnosis confirmed");
    setView("QuoteReview");
  }

  function approveQuote() {
    setQuoteStatus("Approved");
    setPaymentStatus("Deposit pending");
    setOrderStatus("Quote approved");
    quoteParts.forEach((part) => setPartStatus(part.name, "Confirmed"));
    setView("Payment");
  }

  function completePayment(amount: number, method: string, fullPayment: boolean) {
    setPaymentStatus(fullPayment ? "Fully paid" : "Deposit paid");
    setOrderStatus(fullPayment ? "Repair in progress" : "Deposit paid");
    setLastPayment({ amount, method, receiptNo });
    setPendingPayment(null);
    setView("PaymentSuccess");
  }

  function reviewPayment(amount: number, method: string, fullPayment: boolean) {
    setPendingPayment({ amount, method, fullPayment });
    setView("PaymentReview");
  }

  function bookWorkshop(name: string) {
    setSelectedWorkshop(name);
    setOrderStatus("Booking confirmed");
    setView("WorkshopDetail");
  }

  function markCompletedAndOpenRecord() {
    quoteParts.forEach((part) => setPartStatus(part.name, "Installed"));
    setOrderStatus("Completed");
    setView("ServiceRecord");
  }

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
              orderStatus={orderStatus}
              paymentStatus={paymentStatus}
              quoteStatus={quoteStatus}
              selectedWorkshop={selectedWorkshop}
              setView={setView}
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
              setOrderStatus={setOrderStatus}
              setPhotoAttached={setPhotoAttached}
              setProblem={setProblem}
              setQuoteStatus={setQuoteStatus}
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
              setSelectedWorkshop={setSelectedWorkshop}
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
              appNotice={appNotice}
              openPartDetail={openPartDetail}
              openPartReservation={openPartReservation}
              partStatuses={partStatuses}
              quoteParts={quoteParts}
              setView={setView}
            />
          )}
          {view === "PartDetail" && (
            <PartDetailPage
              openPartReservation={openPartReservation}
              part={selectedPart}
              partStatus={partStatuses[selectedPart.name]}
              setView={setView}
            />
          )}
          {view === "PartReservationSummary" && (
            <PartReservationSummaryPage
              addPartToQuote={addPartToQuote}
              appNotice={appNotice}
              openPartDetail={openPartDetail}
              part={selectedPart}
              partStatus={partStatuses[selectedPart.name]}
              setSupportNotice={setSupportNotice}
              setView={setView}
              workshop={selectedWorkshop}
            />
          )}
          {view === "Orders" && (
            <OrdersTab
              orderStatus={orderStatus}
              partStatuses={partStatuses}
              paymentStatus={paymentStatus}
              quoteParts={quoteParts}
              quoteStatus={quoteStatus}
              selectedWorkshop={selectedWorkshop}
              setView={setView}
            />
          )}
          {view === "OrderDetail" && (
            <OrderDetailPage
              balance={balance}
              openPartDetail={openPartDetail}
              orderStatus={orderStatus}
              partStatuses={partStatuses}
              paidAmount={paidAmount}
              paymentStatus={paymentStatus}
              quoteParts={quoteParts}
              quoteStatus={quoteStatus}
              selectedWorkshop={selectedWorkshop}
              setOrderStatus={setOrderStatus}
              setSupportNotice={setSupportNotice}
              setView={setView}
              total={quoteTotal}
            />
          )}
          {view === "QuoteReview" && (
            <QuoteReviewPage
              approveQuote={approveQuote}
              questionAsked={questionAsked}
              quoteParts={quoteParts}
              quoteStatus={quoteStatus}
              selectedWorkshop={selectedWorkshop}
              setQuestionAsked={setQuestionAsked}
              setSelectedWorkshop={setSelectedWorkshop}
              setView={setView}
              total={quoteTotal}
            />
          )}
          {view === "Payment" && (
            <PaymentPage
              paymentStatus={paymentStatus}
              quoteParts={quoteParts}
              reviewPayment={reviewPayment}
              setView={setView}
              total={quoteTotal}
            />
          )}
          {view === "PaymentReview" && (
            <PaymentReviewPage
              completePayment={completePayment}
              pendingPayment={pendingPayment}
              quoteParts={quoteParts}
              selectedWorkshop={selectedWorkshop}
              setView={setView}
              total={quoteTotal}
            />
          )}
          {view === "PaymentSuccess" && (
            <PaymentSuccessPage
              lastPayment={lastPayment}
              setView={setView}
            />
          )}
          {view === "Invoice" && (
            <InvoicePage
              balance={balance}
              markCompletedAndOpenRecord={markCompletedAndOpenRecord}
              paidAmount={paidAmount}
              partsSubtotal={partsSubtotal}
              setSupportNotice={setSupportNotice}
              setView={setView}
              total={quoteTotal}
            />
          )}
          {view === "ServiceRecord" && (
            <ServiceRecordPage
              orderStatus={orderStatus}
              quoteParts={quoteParts}
              selectedWorkshop={selectedWorkshop}
              setOrderStatus={setOrderStatus}
              setSupportNotice={setSupportNotice}
              setView={setView}
            />
          )}
          {view === "SupportCenter" && (
            <SupportCenterPage
              paymentStatus={paymentStatus}
              setSupportNotice={setSupportNotice}
              setView={setView}
              supportNotice={supportNotice}
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
              onClick={() => setView(tab)}
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
  if (view === "QuoteReview" || view === "Payment" || view === "PaymentReview" || view === "PaymentSuccess" || view === "Invoice" || view === "OrderDetail") return "Orders";
  if (view === "PartDetail" || view === "PartReservationSummary") return "Parts";
  if (view === "ServiceRecord" || view === "SupportCenter") return "Me";
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

function StatusPill({ label }: { label: string }) {
  return <span className="status-pill">{label}</span>;
}

function HomeTab({
  aiDone,
  orderStatus,
  paymentStatus,
  quoteStatus,
  selectedWorkshop,
  setView,
}: {
  aiDone: boolean;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  quoteStatus: QuoteStatus;
  selectedWorkshop: string;
  setView: (view: AppView) => void;
}) {
  return (
    <>
      <h1>Hi Daniel</h1>
      <article className="vehicle-card">
        <div>
          <strong>{vehicle}</strong>
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
        <strong>{aiDone ? diagnosis : "ManHub starts with the problem, not parts"}</strong>
        <p>Workshop: {selectedWorkshop}. Quote: {quoteStatus}. Payment: {paymentStatus}.</p>
        <StatusPill label={orderStatus} />
        <div className="inline-actions">
          <button type="button" onClick={() => setView("Diagnosis")}>Open diagnosis</button>
          <button type="button" onClick={() => setView("OrderDetail")}>Track job</button>
        </div>
      </article>

      <div className="quick-actions">
        <button type="button" onClick={() => setView("Workshops")}><span className="quick-icon search" />Find workshop</button>
        <button type="button" onClick={() => setView("Parts")}><span className="quick-icon wheel" />Spare parts</button>
        <button type="button" onClick={() => setView("ServiceRecord")}><span className="quick-icon record" />Service record</button>
      </div>
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
  setOrderStatus,
  setPhotoAttached,
  setProblem,
  setQuoteStatus,
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
  setOrderStatus: (status: OrderStatus) => void;
  setPhotoAttached: (attached: boolean) => void;
  setProblem: (problem: string) => void;
  setQuoteStatus: (status: QuoteStatus) => void;
  setSentToTech: (sent: boolean) => void;
  setView: (view: AppView) => void;
  workshop: Workshop;
}) {
  const aiSummary = useMemo(() => {
    const signal = problem.toLowerCase();
    if (signal.includes("battery")) {
      return { title: "Battery health low or charging issue", confidence: "82%", range: "RM 220-360" };
    }
    if (signal.includes("oil") || signal.includes("smell")) {
      return { title: "Oil service or minor leak inspection needed", confidence: "78%", range: "RM 160-280" };
    }
    return { title: diagnosis, confidence: "87%", range: "RM 280-420" };
  }, [problem]);

  function sendToTechnician() {
    setSentToTech(true);
    setQuoteStatus("Quote ready");
    setOrderStatus("Diagnosis confirmed");
    setView("QuoteReview");
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
          <textarea aria-label="Describe your car problem" onChange={(event) => setProblem(event.target.value)} value={problem} />
        </label>
        <div className="media-actions">
          <button className={photoAttached ? "done" : ""} onClick={() => setPhotoAttached(!photoAttached)} type="button">
            {photoAttached ? "Photo uploaded" : "Upload photo"}
          </button>
          <button className={noiseRecorded ? "done" : ""} onClick={() => setNoiseRecorded(!noiseRecorded)} type="button">
            {noiseRecorded ? "Noise recorded" : "Record noise"}
          </button>
        </div>
        <button className="wide-action" onClick={() => setAiDone(true)} type="button">Run AI pre-diagnosis</button>
      </article>

      <article className={`diagnosis-result ${aiDone ? "ready" : ""}`}>
        <span>AI pre-diagnosis</span>
        <strong>{aiDone ? aiSummary.title : "Waiting for symptom input"}</strong>
        <p>{aiDone ? `Confidence ${aiSummary.confidence}. Technician confirms before quote.` : "Add a photo or sound note to make the pre-check stronger."}</p>
      </article>

      <article className="estimate-card">
        <span>Estimated range</span>
        <strong>{aiDone ? aiSummary.range : "RM --"}</strong>
        <small>Range only. Final quote comes after workshop confirmation.</small>
      </article>

      <section className="step-stack">
        <button type="button" onClick={() => setView("Workshops")}>
          <span>Choose workshop</span>
          <strong>{workshop.name} - {workshop.distance}</strong>
        </button>
        <button className={sentToTech ? "sent" : ""} disabled={!aiDone} onClick={sendToTechnician} type="button">
          <span>Send to technician</span>
          <strong>{sentToTech ? "Diagnosis sent" : "Create quote review"}</strong>
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
  setSelectedWorkshop,
  setView,
}: {
  activeFilter: string;
  bookWorkshop: (name: string) => void;
  selectedWorkshop: string;
  setActiveFilter: (filter: string) => void;
  setSelectedWorkshop: (name: string) => void;
  setView: (view: AppView) => void;
}) {
  const sortedWorkshops = useMemo(() => {
    if (activeFilter === "Top rated") return [...workshops].sort((a, b) => Number(b.rating) - Number(a.rating));
    if (activeFilter === "Open now") return [...workshops].reverse();
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
          <button className={activeFilter === filter ? "selected" : ""} key={filter} onClick={() => setActiveFilter(filter)} type="button">
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
              <button type="button" onClick={() => bookWorkshop(workshop.name)}>{selectedWorkshop === workshop.name ? "Open" : "Book"}</button>
              <button className="text-link" type="button" onClick={() => { setSelectedWorkshop(workshop.name); setView("WorkshopDetail"); }}>Details</button>
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
        <span>Customer-selected workshop</span>
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
        {selectedWorkshop === workshop.name ? "Booking confirmed" : "Book with this workshop"}
      </button>
      <button className="secondary-wide" onClick={() => setView("Diagnosis")} type="button">Send diagnosis to this workshop</button>
    </>
  );
}

function PartsTab({
  appNotice,
  openPartDetail,
  openPartReservation,
  partStatuses,
  quoteParts,
  setView,
}: {
  appNotice: string;
  openPartDetail: (part: Part) => void;
  openPartReservation: (part: Part) => void;
  partStatuses: Record<string, PartStatus>;
  quoteParts: Part[];
  setView: (view: AppView) => void;
}) {
  return (
    <>
      <h1>Spare parts</h1>
      <article className="parts-banner">
        <strong>Recommended from today's diagnosis</strong>
        <span>{quoteParts.length} parts linked to Job #{jobNo}. Charged only after technician confirms the quote.</span>
      </article>
      {appNotice && <article className="notice-card">{appNotice}</article>}
      <div className="parts-grid">
        {parts.map((part) => (
          <article className={`part-card ${partStatuses[part.name] !== "Recommended" ? "reserved" : ""}`} key={part.name}>
            <div className={`part-image ${part.kind}`} />
            <strong>{part.name}</strong>
            <small>{part.brand}</small>
            <span>{part.fit}</span>
            <b>RM {part.price}</b>
            <em>{partStatuses[part.name]}</em>
            <div className="part-actions">
              <button type="button" onClick={() => openPartDetail(part)}>Details</button>
              <button type="button" onClick={() => openPartReservation(part)}>
                {partStatuses[part.name] === "Recommended" ? "Reserve" : "View"}
              </button>
            </div>
          </article>
        ))}
      </div>
      <button className="wide-action" type="button" onClick={() => setView("QuoteReview")}>Review quote</button>
    </>
  );
}

function PartDetailPage({
  openPartReservation,
  part,
  partStatus,
  setView,
}: {
  openPartReservation: (part: Part) => void;
  part: Part;
  partStatus: PartStatus;
  setView: (view: AppView) => void;
}) {
  return (
    <>
      <BackButton label="Parts" onClick={() => setView("Parts")} />
      <header className="page-header">
        <h1>Part detail</h1>
        <p>Check the part before reserving it for Job #{jobNo}.</p>
      </header>
      <article className="detail-hero part-hero">
        <span>{part.brand}</span>
        <h1>{part.name}</h1>
        <p>RM {part.price} - {part.fit}</p>
        <em>{partStatus}</em>
      </article>
      <div className="job-meta">
        <p><span>Description</span><strong>{part.description}</strong></p>
        <p><span>Normal use</span><strong>{part.normalUse}</strong></p>
        <p><span>Included</span><strong>{part.includedWith}</strong></p>
        <p><span>Service life</span><strong>{part.serviceLife}</strong></p>
        <p><span>Supplier</span><strong>{part.supplier}</strong></p>
      </div>
      <div className="button-stack">
        <button className="wide-action" type="button" onClick={() => openPartReservation(part)}>
          {partStatus === "Recommended" ? "Reserve this part" : "View reservation"}
        </button>
        <button className="secondary-wide" type="button" onClick={() => setView("QuoteReview")}>View quote</button>
      </div>
    </>
  );
}

function PartReservationSummaryPage({
  addPartToQuote,
  appNotice,
  openPartDetail,
  part,
  partStatus,
  setSupportNotice,
  setView,
  workshop,
}: {
  addPartToQuote: (part: Part) => void;
  appNotice: string;
  openPartDetail: (part: Part) => void;
  part: Part;
  partStatus: PartStatus;
  setSupportNotice: (notice: string) => void;
  setView: (view: AppView) => void;
  workshop: string;
}) {
  return (
    <>
      <BackButton label="Parts" onClick={() => setView("Parts")} />
      <header className="page-header">
        <h1>Part reservation</h1>
        <p>No payment collected yet. This part will be charged only after technician confirms the quote.</p>
      </header>
      {appNotice && <article className="notice-card">{appNotice}</article>}
      <article className="record-card">
        <span>Reservation status: {partStatus}</span>
        <strong>{part.name}</strong>
        <p>{part.brand} - RM {part.price} - {part.fit}</p>
      </article>
      <div className="job-meta">
        <p><span>Normal use</span><strong>{part.normalUse}</strong></p>
        <p><span>Linked diagnosis</span><strong>{diagnosis}</strong></p>
        <p><span>Supplier</span><strong>{part.supplier}</strong></p>
        <p><span>Workshop</span><strong>{workshop}</strong></p>
      </div>
      <div className="button-stack">
        <button className="wide-action" type="button" onClick={() => addPartToQuote(part)}>Add to quote</button>
        <button className="secondary-wide" type="button" onClick={() => openPartDetail(part)}>View part detail</button>
        <button className="secondary-wide" type="button" onClick={() => setView("OrderDetail")}>View order</button>
        <button className="secondary-wide" type="button" onClick={() => { setSupportNotice(`${workshop} received your parts question.`); setView("SupportCenter"); }}>Contact workshop</button>
      </div>
    </>
  );
}

function OrdersTab({
  orderStatus,
  partStatuses,
  paymentStatus,
  quoteParts,
  quoteStatus,
  selectedWorkshop,
  setView,
}: {
  orderStatus: OrderStatus;
  partStatuses: Record<string, PartStatus>;
  paymentStatus: PaymentStatus;
  quoteParts: Part[];
  quoteStatus: QuoteStatus;
  selectedWorkshop: string;
  setView: (view: AppView) => void;
}) {
  return (
    <>
      <h1>My orders</h1>
      <article className="order-card">
        <header>
          <div>
            <strong>Job #{jobNo}</strong>
            <span>Brake pad replacement</span>
          </div>
          <aside>
            <b>{orderStatus}</b>
            <span>{selectedWorkshop}</span>
          </aside>
        </header>
        <div className="reserved-summary">
          <strong>{quoteStatus}</strong>
          <span>{quoteParts.map((part) => part.name).join(", ")}</span>
          <StatusPill label={paymentStatus} />
        </div>
        <section className="mini-list">
          <h2>Reserved spare parts</h2>
          {quoteParts.map((part) => (
            <article key={part.name}>
              <span>{part.brand}</span>
              <strong>{part.name}</strong>
              <small>{partStatuses[part.name]} - RM {part.price}</small>
            </article>
          ))}
        </section>
        <div className="inline-actions bottom-actions">
          <button type="button" onClick={() => setView("OrderDetail")}>View order</button>
          <button type="button" onClick={() => setView("QuoteReview")}>View quote</button>
        </div>
      </article>
    </>
  );
}

function QuoteReviewPage({
  approveQuote,
  questionAsked,
  quoteParts,
  quoteStatus,
  selectedWorkshop,
  setQuestionAsked,
  setSelectedWorkshop,
  setView,
  total,
}: {
  approveQuote: () => void;
  questionAsked: boolean;
  quoteParts: Part[];
  quoteStatus: QuoteStatus;
  selectedWorkshop: string;
  setQuestionAsked: (asked: boolean) => void;
  setSelectedWorkshop: (name: string) => void;
  setView: (view: AppView) => void;
  total: number;
}) {
  return (
    <>
      <BackButton label="Orders" onClick={() => setView("Orders")} />
      <header className="page-header">
        <h1>Quote #{quoteNo}</h1>
        <p>Job #{jobNo} - {vehicle}</p>
      </header>
      <article className="review-card">
        <span>{quoteStatus}</span>
        <strong>{diagnosis}</strong>
        <small>Workshop: {selectedWorkshop} - Technician: {technician}</small>
      </article>
      <div className="quote-lines">
        {quoteParts.map((part) => (
          <div key={part.name}><span>{part.name}</span><strong>RM {part.price}</strong></div>
        ))}
        <div><span>Brake pad replacement 1.5 hr</span><strong>RM {labourPrice}</strong></div>
        <div className="total-row"><span>Total</span><strong>RM {total}</strong></div>
      </div>
      <div className="button-stack">
        <button className="wide-action" type="button" onClick={approveQuote}>Approve quote</button>
        <button className="secondary-wide" type="button" onClick={() => setQuestionAsked(true)}>{questionAsked ? "Technician question sent" : "Ask technician"}</button>
        <button className="secondary-wide" type="button" onClick={() => { setSelectedWorkshop("QuickCare Motors"); setView("Workshops"); }}>Choose another workshop</button>
      </div>
    </>
  );
}

function PaymentPage({
  paymentStatus,
  quoteParts,
  reviewPayment,
  setView,
  total,
}: {
  paymentStatus: PaymentStatus;
  quoteParts: Part[];
  reviewPayment: (amount: number, method: string, fullPayment: boolean) => void;
  setView: (view: AppView) => void;
  total: number;
}) {
  const [method, setMethod] = useState("Online banking");
  const methods = ["Online banking", "Touch 'n Go eWallet", "Card", "Pay at workshop"];

  return (
    <>
      <BackButton label="Quote" onClick={() => setView("QuoteReview")} />
      <header className="page-header">
        <h1>Payment</h1>
        <p>Amount due: RM {total}. Deposit required: RM {depositAmount}.</p>
      </header>
      <article className="estimate-card">
        <span>Payment status</span>
        <strong>{paymentStatus}</strong>
        <small>Receipt is created after payment.</small>
      </article>
      <section className="mini-list payment-items">
        <h2>Purchase summary</h2>
        {quoteParts.map((part) => (
          <article key={part.name}>
            <span>{part.brand}</span>
            <strong>{part.name}</strong>
            <small>RM {part.price}</small>
          </article>
        ))}
        <article>
          <span>Labour</span>
          <strong>Brake pad replacement 1.5 hr</strong>
          <small>RM {labourPrice}</small>
        </article>
      </section>
      <div className="option-list">
        {methods.map((item) => (
          <button className={method === item ? "selected" : ""} key={item} onClick={() => setMethod(item)} type="button">
            {item}
          </button>
        ))}
      </div>
      <div className="button-stack">
        <button className="wide-action" type="button" onClick={() => reviewPayment(depositAmount, method, false)}>Review deposit payment</button>
        <button className="secondary-wide" type="button" onClick={() => reviewPayment(total, method, true)}>Review full payment</button>
      </div>
    </>
  );
}

function PaymentReviewPage({
  completePayment,
  pendingPayment,
  quoteParts,
  selectedWorkshop,
  setView,
  total,
}: {
  completePayment: (amount: number, method: string, fullPayment: boolean) => void;
  pendingPayment: PendingPayment | null;
  quoteParts: Part[];
  selectedWorkshop: string;
  setView: (view: AppView) => void;
  total: number;
}) {
  const payment = pendingPayment ?? { amount: depositAmount, method: "Online banking", fullPayment: false };
  const balanceAfterPayment = total - payment.amount;

  return (
    <>
      <BackButton label="Payment" onClick={() => setView("Payment")} />
      <header className="page-header">
        <h1>Review payment</h1>
        <p>Confirm what you selected before ManHub creates the mock receipt.</p>
      </header>
      <article className="review-card">
        <span>{payment.fullPayment ? "Full payment" : "Deposit payment"}</span>
        <strong>RM {payment.amount}</strong>
        <small>{payment.method} - Job #{jobNo} at {selectedWorkshop}</small>
      </article>
      <div className="quote-lines">
        {quoteParts.map((part) => (
          <div key={part.name}><span>{part.name}</span><strong>RM {part.price}</strong></div>
        ))}
        <div><span>Brake pad replacement 1.5 hr</span><strong>RM {labourPrice}</strong></div>
        <div><span>Order total</span><strong>RM {total}</strong></div>
        <div><span>Pay now</span><strong>RM {payment.amount}</strong></div>
        <div className="total-row"><span>Balance after payment</span><strong>RM {balanceAfterPayment}</strong></div>
      </div>
      <div className="button-stack">
        <button className="wide-action" type="button" onClick={() => completePayment(payment.amount, payment.method, payment.fullPayment)}>Confirm payment</button>
        <button className="secondary-wide" type="button" onClick={() => setView("Payment")}>Change method</button>
        <button className="secondary-wide" type="button" onClick={() => setView("OrderDetail")}>View order first</button>
      </div>
    </>
  );
}

function PaymentSuccessPage({
  lastPayment,
  setView,
}: {
  lastPayment: ReceiptRecord | null;
  setView: (view: AppView) => void;
}) {
  return (
    <>
      <header className="success-panel">
        <span>Payment successful</span>
        <h1>{lastPayment?.receiptNo ?? receiptNo}</h1>
        <p>Amount paid: RM {lastPayment?.amount ?? depositAmount}</p>
        <small>Payment method: {lastPayment?.method ?? "Online banking"}</small>
      </header>
      <div className="button-stack">
        <button className="wide-action" type="button" onClick={() => setView("OrderDetail")}>View order</button>
        <button className="secondary-wide" type="button" onClick={() => setView("Invoice")}>View receipt</button>
      </div>
    </>
  );
}

function InvoicePage({
  balance,
  markCompletedAndOpenRecord,
  paidAmount,
  partsSubtotal,
  setSupportNotice,
  setView,
  total,
}: {
  balance: number;
  markCompletedAndOpenRecord: () => void;
  paidAmount: number;
  partsSubtotal: number;
  setSupportNotice: (notice: string) => void;
  setView: (view: AppView) => void;
  total: number;
}) {
  return (
    <>
      <BackButton label="Order" onClick={() => setView("OrderDetail")} />
      <header className="page-header">
        <h1>Invoice #{invoiceNo}</h1>
        <p>Job: Brake pad replacement</p>
      </header>
      <div className="quote-lines">
        <div><span>Parts subtotal</span><strong>RM {partsSubtotal}</strong></div>
        <div><span>Labour subtotal</span><strong>RM {labourPrice}</strong></div>
        <div><span>Total</span><strong>RM {total}</strong></div>
        <div><span>Paid amount</span><strong>RM {paidAmount}</strong></div>
        <div className="total-row"><span>Balance</span><strong>RM {balance}</strong></div>
      </div>
      <div className="button-stack">
        <button className="wide-action" type="button" onClick={() => setSupportNotice("Invoice saved to Daniel's records.")}>Download invoice</button>
        <button className="secondary-wide" type="button" onClick={() => setSupportNotice(`Receipt ${receiptNo} ready to share.`)}>Share receipt</button>
        <button className="secondary-wide" type="button" onClick={markCompletedAndOpenRecord}>View service record</button>
      </div>
    </>
  );
}

function OrderDetailPage({
  balance,
  openPartDetail,
  orderStatus,
  partStatuses,
  paidAmount,
  paymentStatus,
  quoteParts,
  quoteStatus,
  selectedWorkshop,
  setOrderStatus,
  setSupportNotice,
  setView,
  total,
}: {
  balance: number;
  openPartDetail: (part: Part) => void;
  orderStatus: OrderStatus;
  partStatuses: Record<string, PartStatus>;
  paidAmount: number;
  paymentStatus: PaymentStatus;
  quoteParts: Part[];
  quoteStatus: QuoteStatus;
  selectedWorkshop: string;
  setOrderStatus: (status: OrderStatus) => void;
  setSupportNotice: (notice: string) => void;
  setView: (view: AppView) => void;
  total: number;
}) {
  const timeline: OrderStatus[] = [
    "Booking confirmed",
    "Diagnosis confirmed",
    "Quote approved",
    "Deposit paid",
    "Repair in progress",
    "Ready for pickup",
    "Completed",
  ];
  const currentIndex = timeline.indexOf(orderStatus);

  return (
    <>
      <BackButton label="Orders" onClick={() => setView("Orders")} />
      <article className="order-card">
        <header>
          <div>
            <strong>Job #{jobNo}</strong>
            <span>{vehicle}</span>
          </div>
          <aside>
            <b>{orderStatus}</b>
            <span>RM {total}</span>
          </aside>
        </header>
        <div className="job-meta">
          <p><span>Workshop</span><strong>{selectedWorkshop}</strong></p>
          <p><span>Technician</span><strong>{technician}</strong></p>
          <p><span>Quote</span><strong>{quoteStatus}</strong></p>
          <p><span>Payment</span><strong>{paymentStatus}</strong></p>
        </div>
        <div className="timeline">
          {timeline.map((step, index) => (
            <TimelineStep
              detail={index <= currentIndex ? "Recorded in job timeline" : "Next step"}
              key={step}
              state={index < currentIndex ? "done" : index === currentIndex ? "active" : undefined}
              title={step}
            />
          ))}
        </div>
      </article>
      <section className="service-list">
        <h2>Reserved spare parts</h2>
        {quoteParts.map((part) => (
          <article key={part.name}>
            <strong>{part.name}</strong>
            <span>{part.brand} - {partStatuses[part.name]} - RM {part.price}</span>
            <button className="text-link inline-link" type="button" onClick={() => openPartDetail(part)}>View part detail</button>
          </article>
        ))}
      </section>
      <div className="quote-lines compact">
        <div><span>Parts and labour</span><strong>RM {total}</strong></div>
        <div><span>Paid amount</span><strong>RM {paidAmount}</strong></div>
        <div className="total-row"><span>Balance</span><strong>RM {balance}</strong></div>
      </div>
      <div className="button-stack">
        <button className="wide-action" type="button" onClick={() => setView("QuoteReview")}>View quote</button>
        {paymentStatus === "Deposit pending" && <button className="secondary-wide" type="button" onClick={() => setView("Payment")}>Pay deposit</button>}
        <button className="secondary-wide" type="button" onClick={() => { setSupportNotice(`${selectedWorkshop} received your message about Job #${jobNo}.`); setView("SupportCenter"); }}>Contact workshop</button>
        <button className="secondary-wide" type="button" onClick={() => setView("Invoice")}>View invoice</button>
        <button className="secondary-wide" type="button" onClick={() => { setOrderStatus("Completed"); setView("ServiceRecord"); }}>View service record</button>
      </div>
    </>
  );
}

function TimelineStep({ title, detail, state }: { title: string; detail: string; state?: "done" | "active" }) {
  return (
    <div className={`timeline-step ${state ?? ""}`}>
      <i />
      <p><strong>{title}</strong><span>{detail}</span></p>
    </div>
  );
}

function ServiceRecordPage({
  orderStatus,
  quoteParts,
  selectedWorkshop,
  setOrderStatus,
  setSupportNotice,
  setView,
}: {
  orderStatus: OrderStatus;
  quoteParts: Part[];
  selectedWorkshop: string;
  setOrderStatus: (status: OrderStatus) => void;
  setSupportNotice: (notice: string) => void;
  setView: (view: AppView) => void;
}) {
  return (
    <>
      <BackButton label="Me" onClick={() => setView("Me")} />
      <header className="page-header">
        <h1>Service record</h1>
        <p>{vehicle} - 12 May 2026</p>
      </header>
      <article className="record-card">
        <span>{orderStatus === "Completed" ? "Completed service" : "Service record preview"}</span>
        <strong>Brake pads replaced</strong>
        <p>{selectedWorkshop} - Technician {technician}</p>
      </article>
      <div className="job-meta">
        <p><span>Vehicle</span><strong>{vehicle}</strong></p>
        <p><span>Diagnosis</span><strong>{diagnosis}</strong></p>
        <p><span>Work completed</span><strong>Front brake pad replacement and brake fluid top-up</strong></p>
        <p><span>Warranty</span><strong>6 months / 10,000 km</strong></p>
        <p><span>Next reminder</span><strong>Brake inspection at 78,000 km</strong></p>
      </div>
      <section className="service-list">
        <h2>Parts used</h2>
        {quoteParts.map((part) => (
          <article key={part.name}><strong>{part.name}</strong><span>{part.fit}</span></article>
        ))}
      </section>
      <div className="button-stack">
        <button className="wide-action" type="button" onClick={() => setSupportNotice("Service record saved for download.")}>Download record</button>
        <button className="secondary-wide" type="button" onClick={() => { setOrderStatus("Booking confirmed"); setView("Diagnosis"); }}>Book next service</button>
      </div>
    </>
  );
}

function SupportCenterPage({
  paymentStatus,
  setSupportNotice,
  setView,
  supportNotice,
}: {
  paymentStatus: PaymentStatus;
  setSupportNotice: (notice: string) => void;
  setView: (view: AppView) => void;
  supportNotice: string;
}) {
  const supportItems = [
    { label: "My booking", detail: `Check Job #${jobNo}`, action: () => setView("OrderDetail") },
    { label: "My quote", detail: `Open Quote #${quoteNo}`, action: () => setView("QuoteReview") },
    { label: "Payment / refund", detail: paymentStatus === "Deposit pending" ? "Pay deposit" : "View invoice", action: () => setView(paymentStatus === "Deposit pending" ? "Payment" : "Invoice") },
    { label: "Parts reservation", detail: "Review reserved Bendix brake pads", action: () => setView("PartReservationSummary") },
    { label: "Workshop issue", detail: "Message AutoFix Pro about this job", action: () => setSupportNotice("Workshop issue note added to Job #MF-08471.") },
    { label: "General question", detail: "Send a question to ManHub support", action: () => setSupportNotice("General question saved. ManHub support will reply in-app.") },
  ];

  return (
    <>
      <BackButton label="Me" onClick={() => setView("Me")} />
      <header className="page-header">
        <h1>Support center</h1>
        <p>Choose the issue so ManHub opens the right record first.</p>
      </header>
      <div className="support-list">
        {supportItems.map((item) => (
          <button key={item.label} onClick={item.action} type="button">
            <strong>{item.label}</strong>
            <span>{item.detail}</span>
          </button>
        ))}
      </div>
      <article className="emergency-card">
        <span>Emergency assistance</span>
        <strong>Need urgent help?</strong>
        <p>Use these only for urgent roadside or safety issues.</p>
        <div className="inline-actions">
          <button type="button" onClick={() => setSupportNotice("WhatsApp assistance opened for emergency support.")}>WhatsApp</button>
          <button type="button" onClick={() => setSupportNotice("Call request prepared for ManHub emergency line.")}>Call</button>
        </div>
      </article>
      {supportNotice && <article className="notice-card">{supportNotice}</article>}
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
  const menu = [
    { label: "My vehicles", action: () => setProfilePanel("My vehicles") },
    { label: "Digital service records", action: () => setView("ServiceRecord") },
    { label: "Payment methods", action: () => setView("Payment") },
    { label: "Help & support", action: () => setView("SupportCenter") },
  ];

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
        {menu.map((item) => (
          <button className={profilePanel === item.label ? "active" : ""} key={item.label} onClick={() => { setProfilePanel(item.label); item.action(); }} type="button">
            {item.label}<span>&gt;</span>
          </button>
        ))}
      </div>
      <article className="detail-panel">
        <strong>{profilePanel}</strong>
        <span>{profilePanel === "My vehicles" ? "Toyota Vios 1.5G - WXY 4321 and Perodua Myvi - VBK 9902." : "Open a customer record to continue."}</span>
      </article>
    </>
  );
}
