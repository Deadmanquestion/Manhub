"use client";

import { useMemo, useState } from "react";

type CustomerTab = "Home" | "Workshops" | "Parts" | "Orders" | "Me";
type AppView =
  | CustomerTab
  | "Diagnosis"
  | "WorkshopDetail"
  | "MyVehicles"
  | "AddVehicle"
  | "VehicleDetail"
  | "SparePartDetail"
  | "PartReservationSummary"
  | "Notifications"
  | "QuoteReview"
  | "Payment"
  | "PaymentSuccess"
  | "Invoice"
  | "ServiceRecord"
  | "SupportCenter"
  | "OrderDetail";

type VehicleRecord = {
  engine: string;
  fuelType: string;
  id: string;
  isDefault: boolean;
  lastServiceDate: string;
  make: string;
  mileage: string;
  model: string;
  nextServiceReminder: string;
  notes: string;
  plate: string;
  transmission: string;
  year: string;
};

type SparePart = {
  brand: string;
  compatibleVehicleId: string;
  compatibleWith: string;
  description: string;
  id: string;
  installationRecommendation: string;
  kind: string;
  linkedDiagnosis?: string;
  name: string;
  normalUsage: string;
  price: number;
  stockStatus: string;
  supplier: string;
  warranty: string;
};

type ReservedPart = {
  createdAt: string;
  depositAmount: number;
  diagnosis: string;
  id: string;
  jobNo: string;
  partId: string;
  status: "Soft reserved" | "Added to quote" | "Deposit paid" | "Fully paid" | "Installed";
  vehicleId: string;
};

type OrderRecord = {
  diagnosis: string;
  id: string;
  jobNo: string;
  status: "Booking confirmed" | "Diagnosis confirmed" | "Quote approved" | "Deposit paid" | "Repair in progress" | "Completed";
  technician: string;
  vehicleId: string;
  workshop: string;
};

type NotificationRecord = {
  action: "reserved-part";
  id: string;
  message: string;
  reservedPartId: string;
  status: "Unread" | "Read";
  title: string;
};

type PaymentRecord = {
  amount: number;
  method: string;
  reservedPartId: string;
  status: "Deposit paid" | "Fully paid";
};

type ReceiptRecord = {
  amount: number;
  id: string;
  method: string;
  reservedPartId: string;
};

type DiagnosisResult = {
  confidence: number;
  diagnosis: string;
  estimated_cost_range: string;
  possible_causes: string[];
  recommended_actions: string[];
  recommended_parts: string[];
};

type MockStore = {
  notifications: NotificationRecord[];
  orders: OrderRecord[];
  payments: PaymentRecord[];
  receipts: ReceiptRecord[];
  reservedParts: ReservedPart[];
  selectedPartId: string;
  selectedReservedPartId: string;
  selectedVehicleId: string;
  vehicles: VehicleRecord[];
};

const tabs: CustomerTab[] = ["Home", "Workshops", "Parts", "Orders", "Me"];
const filters = ["Nearest", "Top rated", "Brake service", "Open now"];
const jobNo = "MF-08471";
const quoteNo = "Q-08471";
const invoiceNo = "INV-08471";
const receiptNo = "RCPT-08471";
const customerName = "Daniel Tan";
const diagnosis = "Front brake pads worn";
const workshopName = "AutoFix Pro";
const technician = "Ahmad F.";
const labourSubtotal = 112;
const reservationDeposit = 30;

const workshops = [
  { name: "AutoFix Pro", distance: "1.2 km", rating: "4.8", count: "(234)", tags: "Oil - Brakes - Tyres", hours: "8:30 AM - 7:00 PM" },
  { name: "QuickCare Motors", distance: "2.5 km", rating: "4.6", count: "(158)", tags: "General - AC - Battery", hours: "9:00 AM - 6:30 PM" },
  { name: "Evergreen Auto Centre", distance: "3.1 km", rating: "4.5", count: "(96)", tags: "Engine - Diagnostics", hours: "8:00 AM - 6:00 PM" },
];

const spareParts: SparePart[] = [
  {
    brand: "Bendix",
    compatibleVehicleId: "vios",
    compatibleWith: "Toyota Vios 1.5G 2021",
    description: "Front brake pad set recommended after brake squealing diagnosis.",
    id: "bendix-front-brake",
    installationRecommendation: "Install after technician confirms pad thickness and rotor condition.",
    kind: "brake",
    linkedDiagnosis: diagnosis,
    name: "Brake pad set front",
    normalUsage: "Around 30,000-50,000 km depending on driving style.",
    price: 168,
    stockStatus: "Available for soft reservation",
    supplier: "PartsHub Trading Sdn Bhd",
    warranty: "6 months supplier warranty",
  },
  {
    brand: "Bosch service grade",
    compatibleVehicleId: "vios",
    compatibleWith: "Toyota Vios 1.5G 2021",
    description: "DOT4 brake fluid for hydraulic brake pressure and consistent pedal feel.",
    id: "dot4-brake-fluid",
    installationRecommendation: "Use during brake service if fluid condition is weak.",
    kind: "fluid",
    linkedDiagnosis: diagnosis,
    name: "Brake fluid DOT4 1L",
    normalUsage: "Normally inspected during brake work and refreshed when condition is poor.",
    price: 32,
    stockStatus: "Available",
    supplier: "AutoParts2U Sdn Bhd",
    warranty: "Supplier sealed-bottle warranty",
  },
  {
    brand: "Shell Helix",
    compatibleVehicleId: "vios",
    compatibleWith: "Toyota Vios 1.5G 2021",
    description: "Fully synthetic engine oil for scheduled servicing.",
    id: "shell-5w30-oil",
    installationRecommendation: "Use with oil filter replacement during scheduled maintenance.",
    kind: "oil",
    name: "Engine oil 5W-30 fully syn 4L",
    normalUsage: "Usually replaced every 7,000-10,000 km.",
    price: 189,
    stockStatus: "Available",
    supplier: "PartsHub Trading Sdn Bhd",
    warranty: "Original supplier product warranty",
  },
  {
    brand: "Century",
    compatibleVehicleId: "myvi",
    compatibleWith: "Perodua Myvi 1.5 2020",
    description: "NS60L battery for starting and vehicle electrical systems.",
    id: "century-ns60l",
    installationRecommendation: "Test current battery health before installation.",
    kind: "battery",
    name: "Battery NS60L",
    normalUsage: "Commonly lasts around 18-30 months depending on heat and usage.",
    price: 245,
    stockStatus: "Limited stock",
    supplier: "Century Battery Partner",
    warranty: "12 months supplier warranty",
  },
];

const initialStore: MockStore = {
  notifications: [],
  orders: [
    {
      diagnosis,
      id: "order-08471",
      jobNo,
      status: "Diagnosis confirmed",
      technician,
      vehicleId: "vios",
      workshop: workshopName,
    },
  ],
  payments: [],
  receipts: [],
  reservedParts: [],
  selectedPartId: "bendix-front-brake",
  selectedReservedPartId: "",
  selectedVehicleId: "vios",
  vehicles: [
    {
      engine: "1.5L petrol",
      fuelType: "Petrol",
      id: "vios",
      isDefault: true,
      lastServiceDate: "12 May 2026",
      make: "Toyota",
      mileage: "68,420 km",
      model: "Vios 1.5G",
      nextServiceReminder: "Engine oil change at 70,000 km",
      notes: "Daily city car, brake squeal reported in the morning.",
      plate: "WXY 4321",
      transmission: "Automatic",
      year: "2021",
    },
    {
      engine: "1.5L petrol",
      fuelType: "Petrol",
      id: "myvi",
      isDefault: false,
      lastServiceDate: "04 June 2026",
      make: "Perodua",
      mileage: "52,800 km",
      model: "Myvi 1.5",
      nextServiceReminder: "Aircon service due next month",
      notes: "Family second car.",
      plate: "VBK 9902",
      transmission: "Automatic",
      year: "2020",
    },
  ],
};

export default function Home() {
  const [store, setStore] = useState<MockStore>(initialStore);
  const [view, setView] = useState<AppView>("Home");
  const [activeFilter, setActiveFilter] = useState("Nearest");
  const [notice, setNotice] = useState("");
  const [problem, setProblem] = useState("High-pitched squeal when braking, worse in the morning.");
  const [photoAttached, setPhotoAttached] = useState(false);
  const [noiseRecorded, setNoiseRecorded] = useState(false);
  const [aiDone, setAiDone] = useState(false);
  const [diagnosisLoading, setDiagnosisLoading] = useState(false);
  const [diagnosisResult, setDiagnosisResult] = useState<DiagnosisResult | null>(null);
  const [supportNotice, setSupportNotice] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Touch 'n Go eWallet");
  const [profilePanel, setProfilePanel] = useState("My vehicles");

  const selectedVehicle = store.vehicles.find((item) => item.id === store.selectedVehicleId) ?? store.vehicles[0];
  const selectedPart = spareParts.find((item) => item.id === store.selectedPartId) ?? spareParts[0];
  const selectedReservedPart = store.reservedParts.find((item) => item.id === store.selectedReservedPartId) ?? store.reservedParts[0];
  const selectedOrder = store.orders[0];
  const relatedReservedParts = store.reservedParts.filter((item) => item.vehicleId === selectedVehicle.id);
  const unreadCount = store.notifications.filter((item) => item.status === "Unread").length;
  const activeTab = tabs.includes(view as CustomerTab) ? (view as CustomerTab) : viewToTab(view);

  function updateStore(updater: (current: MockStore) => MockStore) {
    setStore(updater);
  }

  function selectVehicle(vehicleId: string, nextView: AppView) {
    updateStore((current) => ({ ...current, selectedVehicleId: vehicleId }));
    setView(nextView);
  }

  function selectPart(partId: string, nextView: AppView) {
    updateStore((current) => ({ ...current, selectedPartId: partId }));
    setView(nextView);
  }

  function addVehicle(vehicle: Omit<VehicleRecord, "id" | "isDefault" | "lastServiceDate" | "nextServiceReminder">) {
    const id = `${vehicle.plate.toLowerCase().replace(/[^a-z0-9]/g, "")}-${Date.now()}`;
    const nextVehicle: VehicleRecord = {
      ...vehicle,
      id,
      isDefault: false,
      lastServiceDate: "No service record yet",
      nextServiceReminder: "Book first inspection with ManHub",
    };
    updateStore((current) => ({
      ...current,
      selectedVehicleId: id,
      vehicles: [...current.vehicles, nextVehicle],
    }));
    setNotice("Vehicle added successfully");
    setView("MyVehicles");
  }

  function reservePart(partId: string, mode: "reserve" | "quote" = "reserve") {
    const part = spareParts.find((item) => item.id === partId) ?? spareParts[0];
    const linkedVehicleId = part.compatibleVehicleId;
    const existing = store.reservedParts.find((item) => item.partId === partId && item.vehicleId === linkedVehicleId);
    const reservedId = existing?.id ?? `reserved-${partId}`;
    const status = mode === "quote" ? "Added to quote" : "Soft reserved";

    updateStore((current) => {
      const withoutExisting = current.reservedParts.filter((item) => item.id !== reservedId);
      const nextReserved: ReservedPart = {
        createdAt: "Today 10:42 AM",
        depositAmount: reservationDeposit,
        diagnosis: part.linkedDiagnosis ?? diagnosis,
        id: reservedId,
        jobNo,
        partId,
        status,
        vehicleId: linkedVehicleId,
      };
      const nextNotification: NotificationRecord = {
        action: "reserved-part",
        id: `notif-${reservedId}`,
        message: `${part.brand} ${part.name} has been soft reserved for Job #${jobNo}.`,
        reservedPartId: reservedId,
        status: "Unread",
        title: "Part reserved",
      };
      const notifications = current.notifications.some((item) => item.id === nextNotification.id)
        ? current.notifications
        : [nextNotification, ...current.notifications];
      return {
        ...current,
        notifications,
        reservedParts: [nextReserved, ...withoutExisting],
        selectedPartId: partId,
        selectedReservedPartId: reservedId,
        selectedVehicleId: linkedVehicleId,
      };
    });

    setNotice(mode === "quote" ? `${part.brand} ${part.name} added to quote` : `${part.brand} ${part.name} soft reserved`);
    setView(mode === "quote" ? "QuoteReview" : "PartReservationSummary");
  }

  function selectReservedPart(reservedPartId: string, nextView: AppView) {
    const reserved = store.reservedParts.find((item) => item.id === reservedPartId);
    updateStore((current) => ({
      ...current,
      notifications: nextView === "PartReservationSummary"
        ? current.notifications.map((item) => item.reservedPartId === reservedPartId ? { ...item, status: "Read" } : item)
        : current.notifications,
      selectedPartId: reserved?.partId ?? current.selectedPartId,
      selectedReservedPartId: reservedPartId,
      selectedVehicleId: reserved?.vehicleId ?? current.selectedVehicleId,
    }));
    setView(nextView);
  }

  function payReservedPart(fullPayment: boolean) {
    if (!selectedReservedPart) return;
    const part = spareParts.find((item) => item.id === selectedReservedPart.partId) ?? spareParts[0];
    const amount = fullPayment ? part.price : selectedReservedPart.depositAmount;
    const paymentStatus = fullPayment ? "Fully paid" : "Deposit paid";
    const receipt: ReceiptRecord = {
      amount,
      id: receiptNo,
      method: paymentMethod,
      reservedPartId: selectedReservedPart.id,
    };

    updateStore((current) => ({
      ...current,
      orders: current.orders.map((order) => order.jobNo === selectedReservedPart.jobNo ? { ...order, status: fullPayment ? "Repair in progress" : "Deposit paid" } : order),
      payments: [
        ...current.payments.filter((item) => item.reservedPartId !== selectedReservedPart.id),
        { amount, method: paymentMethod, reservedPartId: selectedReservedPart.id, status: paymentStatus },
      ],
      receipts: [
        ...current.receipts.filter((item) => item.reservedPartId !== selectedReservedPart.id),
        receipt,
      ],
      reservedParts: current.reservedParts.map((item) => item.id === selectedReservedPart.id ? { ...item, status: paymentStatus } : item),
    }));
    setNotice("Payment successful");
    setView("PaymentSuccess");
  }

  async function runAiDiagnosis() {
    setDiagnosisLoading(true);
    try {
      const response = await fetch("/api/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carModel: `${selectedVehicle.make} ${selectedVehicle.model}`,
          mileage: selectedVehicle.mileage,
          symptom: problem,
        }),
      });
      const result = await response.json() as DiagnosisResult;
      setDiagnosisResult(result);
      setAiDone(true);
      setNotice("AI pre-diagnosis ready");
    } catch {
      setDiagnosisResult({
        confidence: 87,
        diagnosis,
        estimated_cost_range: "RM 280-420",
        possible_causes: ["Front brake pads worn", "Brake dust buildup", "Rotor surface needs inspection"],
        recommended_actions: ["Inspect front brake pad thickness", "Check rotor surface", "Confirm final quote with a certified technician"],
        recommended_parts: ["Bendix front brake pad set", "DOT4 brake fluid"],
      });
      setAiDone(true);
      setNotice("AI pre-diagnosis ready");
    } finally {
      setDiagnosisLoading(false);
    }
  }

  return (
    <main className="app-page">
      <section className="phone-app" aria-label="ManHub customer app">
        <div className="status-bar">
          <span>9:41</span>
          <button className="status-notification" onClick={() => setView("Notifications")} type="button">
            Notifications {unreadCount > 0 ? unreadCount : ""}
          </button>
        </div>

        <div className="app-content">
          {notice && <article className="notice-card">{notice}</article>}
          {view === "Home" && <HomeTab order={selectedOrder} setView={setView} vehicle={selectedVehicle} />}
          {view === "Diagnosis" && (
            <DiagnosisFlowPage
              aiDone={aiDone}
              diagnosisLoading={diagnosisLoading}
              diagnosisResult={diagnosisResult}
              noiseRecorded={noiseRecorded}
              photoAttached={photoAttached}
              problem={problem}
              runAiDiagnosis={runAiDiagnosis}
              setNoiseRecorded={setNoiseRecorded}
              setPhotoAttached={setPhotoAttached}
              setProblem={setProblem}
              setView={setView}
              vehicle={selectedVehicle}
            />
          )}
          {view === "Workshops" && (
            <WorkshopsTab
              activeFilter={activeFilter}
              setActiveFilter={setActiveFilter}
              setView={setView}
            />
          )}
          {view === "WorkshopDetail" && <WorkshopDetailPage setView={setView} />}
          {view === "MyVehicles" && (
            <MyVehiclesPage
              relatedReservedParts={relatedReservedParts}
              selectVehicle={selectVehicle}
              setView={setView}
              vehicles={store.vehicles}
            />
          )}
          {view === "AddVehicle" && <AddVehiclePage addVehicle={addVehicle} setView={setView} />}
          {view === "VehicleDetail" && (
            <VehicleDetailPage
              orders={store.orders.filter((order) => order.vehicleId === selectedVehicle.id)}
              reservedParts={relatedReservedParts}
              selectReservedPart={selectReservedPart}
              setView={setView}
              vehicle={selectedVehicle}
            />
          )}
          {view === "Parts" && <PartsTab selectPart={selectPart} />}
          {view === "SparePartDetail" && (
            <SparePartDetailPage
              part={selectedPart}
              reservePart={reservePart}
              setView={setView}
              vehicle={store.vehicles.find((item) => item.id === selectedPart.compatibleVehicleId) ?? selectedVehicle}
            />
          )}
          {view === "PartReservationSummary" && (
            <PartReservationSummaryPage
              part={selectedPart}
              reservedPart={selectedReservedPart}
              setView={setView}
              vehicle={store.vehicles.find((item) => item.id === selectedReservedPart?.vehicleId) ?? selectedVehicle}
            />
          )}
          {view === "Orders" && (
            <OrdersTab
              orders={store.orders}
              reservedParts={store.reservedParts}
              selectReservedPart={selectReservedPart}
              setView={setView}
              vehicles={store.vehicles}
            />
          )}
          {view === "OrderDetail" && (
            <OrderDetailPage
              order={selectedOrder}
              reservedParts={store.reservedParts}
              selectReservedPart={selectReservedPart}
              setView={setView}
              vehicle={selectedVehicle}
            />
          )}
          {view === "Notifications" && (
            <NotificationsPage
              notifications={store.notifications}
              selectReservedPart={selectReservedPart}
              setView={setView}
            />
          )}
          {view === "QuoteReview" && (
            <QuoteReviewPage
              part={selectedPart}
              reservePart={reservePart}
              reservedPart={selectedReservedPart}
              setView={setView}
              vehicle={selectedVehicle}
            />
          )}
          {view === "Payment" && (
            <PaymentPage
              method={paymentMethod}
              part={selectedPart}
              payReservedPart={payReservedPart}
              reservedPart={selectedReservedPart}
              setMethod={setPaymentMethod}
              setView={setView}
              vehicle={selectedVehicle}
            />
          )}
          {view === "PaymentSuccess" && (
            <PaymentSuccessPage
              receipt={store.receipts.find((item) => item.reservedPartId === selectedReservedPart?.id)}
              setView={setView}
            />
          )}
          {view === "Invoice" && (
            <InvoicePage
              part={selectedPart}
              payment={store.payments.find((item) => item.reservedPartId === selectedReservedPart?.id)}
              receipt={store.receipts.find((item) => item.reservedPartId === selectedReservedPart?.id)}
              setNotice={setNotice}
              setView={setView}
              vehicle={selectedVehicle}
            />
          )}
          {view === "ServiceRecord" && (
            <ServiceRecordPage
              reservedParts={store.reservedParts.filter((item) => item.vehicleId === selectedVehicle.id)}
              setView={setView}
              vehicle={selectedVehicle}
            />
          )}
          {view === "SupportCenter" && (
            <SupportCenterPage
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
              unreadCount={unreadCount}
              vehicleCount={store.vehicles.length}
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
  if (view === "Diagnosis" || view === "Notifications") return "Home";
  if (view === "WorkshopDetail") return "Workshops";
  if (view === "SparePartDetail" || view === "PartReservationSummary") return "Parts";
  if (view === "Orders" || view === "OrderDetail" || view === "QuoteReview" || view === "Payment" || view === "PaymentSuccess" || view === "Invoice") return "Orders";
  if (view === "MyVehicles" || view === "AddVehicle" || view === "VehicleDetail" || view === "ServiceRecord" || view === "SupportCenter") return "Me";
  return "Home";
}

function partById(partId: string) {
  return spareParts.find((part) => part.id === partId) ?? spareParts[0];
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

function HomeTab({ order, setView, vehicle }: { order: OrderRecord; setView: (view: AppView) => void; vehicle: VehicleRecord }) {
  return (
    <>
      <h1>Hi Daniel</h1>
      <article className="vehicle-card">
        <div>
          <strong>{vehicle.make} {vehicle.model}</strong>
          <span>{vehicle.plate} - {vehicle.year}</span>
        </div>
        <div>
          <small>Mileage</small>
          <b>{vehicle.mileage}</b>
        </div>
      </article>
      <button className="diagnosis-cta" onClick={() => setView("Diagnosis")} type="button">
        <span className="cta-icon" />
        <strong>Describe your car problem</strong>
        <small>Upload photo, record noise, get AI pre-diagnosis</small>
      </button>
      <article className="ai-card">
        <span>Current job</span>
        <strong>Job #{order.jobNo}</strong>
        <p>{order.diagnosis} - {order.status}</p>
        <div className="inline-actions">
          <button type="button" onClick={() => setView("OrderDetail")}>View order</button>
          <button type="button" onClick={() => setView("Notifications")}>Notifications</button>
        </div>
      </article>
      <div className="quick-actions">
        <button type="button" onClick={() => setView("MyVehicles")}><span className="quick-icon record" />My vehicles</button>
        <button type="button" onClick={() => setView("Parts")}><span className="quick-icon wheel" />Spare parts</button>
        <button type="button" onClick={() => setView("Orders")}><span className="quick-icon search" />Orders</button>
      </div>
    </>
  );
}

function DiagnosisFlowPage({
  aiDone,
  diagnosisLoading,
  diagnosisResult,
  noiseRecorded,
  photoAttached,
  problem,
  runAiDiagnosis,
  setNoiseRecorded,
  setPhotoAttached,
  setProblem,
  setView,
  vehicle,
}: {
  aiDone: boolean;
  diagnosisLoading: boolean;
  diagnosisResult: DiagnosisResult | null;
  noiseRecorded: boolean;
  photoAttached: boolean;
  problem: string;
  runAiDiagnosis: () => Promise<void>;
  setNoiseRecorded: (recorded: boolean) => void;
  setPhotoAttached: (attached: boolean) => void;
  setProblem: (problem: string) => void;
  setView: (view: AppView) => void;
  vehicle: VehicleRecord;
}) {
  return (
    <>
      <BackButton label="Home" onClick={() => setView("Home")} />
      <header className="page-header">
        <h1>Diagnosis flow</h1>
        <p>{vehicle.make} {vehicle.model} - {vehicle.plate}</p>
      </header>
      <article className="form-card">
        <label>
          Describe your car problem
          <textarea aria-label="Describe your car problem" onChange={(event) => setProblem(event.target.value)} value={problem} />
        </label>
        <div className="media-actions">
          <button className={photoAttached ? "done" : ""} onClick={() => setPhotoAttached(!photoAttached)} type="button">{photoAttached ? "Photo uploaded" : "Upload photo"}</button>
          <button className={noiseRecorded ? "done" : ""} onClick={() => setNoiseRecorded(!noiseRecorded)} type="button">{noiseRecorded ? "Noise recorded" : "Record noise"}</button>
        </div>
        <button className="wide-action" disabled={diagnosisLoading} onClick={runAiDiagnosis} type="button">
          {diagnosisLoading ? "Checking symptom..." : "Run AI pre-diagnosis"}
        </button>
      </article>
      <article className={`diagnosis-result ${aiDone ? "ready" : ""}`}>
        <span>AI pre-diagnosis</span>
        <strong>{diagnosisResult?.diagnosis ?? (aiDone ? diagnosis : "Waiting for symptom input")}</strong>
        <p>
          {diagnosisResult
            ? `Confidence ${diagnosisResult.confidence}%. Cost estimate ${diagnosisResult.estimated_cost_range}.`
            : "Add photo or sound note to strengthen the pre-check."}
        </p>
      </article>
      {diagnosisResult && (
        <section className="diagnosis-breakdown">
          <article>
            <h2>Recommended actions</h2>
            {diagnosisResult.recommended_actions.map((item) => <p key={item}>{item}</p>)}
          </article>
          <article>
            <h2>Recommended parts</h2>
            {diagnosisResult.recommended_parts.map((item) => <p key={item}>{item}</p>)}
          </article>
          <article>
            <h2>Possible causes</h2>
            {diagnosisResult.possible_causes.map((item) => <p key={item}>{item}</p>)}
          </article>
          <small>This is an AI pre-diagnosis. A certified technician will confirm before final quote.</small>
        </section>
      )}
      <div className="button-stack">
        <button className="wide-action" type="button" onClick={() => setView("Workshops")}>Choose workshop</button>
        <button className="secondary-wide" type="button" onClick={() => setView("QuoteReview")}>Send to technician</button>
      </div>
    </>
  );
}

function WorkshopsTab({
  activeFilter,
  setActiveFilter,
  setView,
}: {
  activeFilter: string;
  setActiveFilter: (filter: string) => void;
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
          <button className={activeFilter === filter ? "selected" : ""} key={filter} onClick={() => setActiveFilter(filter)} type="button">{filter}</button>
        ))}
      </div>
      <div className="workshop-list">
        {sortedWorkshops.map((workshop) => (
          <article className="workshop-card" key={workshop.name}>
            <div>
              <strong>{workshop.name}</strong>
              <p><b>{workshop.rating}</b> {workshop.count} - {workshop.tags}</p>
              <em>Offers brake pad replacement</em>
            </div>
            <aside>
              <span>{workshop.distance}</span>
              <button type="button" onClick={() => setView("WorkshopDetail")}>Details</button>
            </aside>
          </article>
        ))}
      </div>
    </>
  );
}

function WorkshopDetailPage({ setView }: { setView: (view: AppView) => void }) {
  return (
    <>
      <BackButton label="Workshops" onClick={() => setView("Workshops")} />
      <article className="detail-hero">
        <span>Customer-selected workshop</span>
        <h1>AutoFix Pro</h1>
        <p><b>4.8</b> (234) - 1.2 km</p>
        <em>Offers brake pad replacement</em>
      </article>
      <div className="info-grid">
        <article><span>Working hours</span><strong>8:30 AM - 7:00 PM</strong></article>
        <article><span>Services</span><strong>Brakes, tyres, oil, diagnostics</strong></article>
        <article><span>Technicians</span><strong>Ahmad F., Lim W., Ravi K.</strong></article>
        <article><span>Reviews</span><strong>"Fast diagnosis and clear quote."</strong></article>
      </div>
      <button className="wide-action" onClick={() => setView("QuoteReview")} type="button">Book with this workshop</button>
    </>
  );
}

function MyVehiclesPage({
  relatedReservedParts,
  selectVehicle,
  setView,
  vehicles,
}: {
  relatedReservedParts: ReservedPart[];
  selectVehicle: (vehicleId: string, nextView: AppView) => void;
  setView: (view: AppView) => void;
  vehicles: VehicleRecord[];
}) {
  return (
    <>
      <BackButton label="Me" onClick={() => setView("Me")} />
      <header className="page-header">
        <h1>My vehicles</h1>
        <p>Manage vehicles linked to ManHub orders, parts, and service records.</p>
      </header>
      <div className="vehicle-list">
        {vehicles.map((item) => (
          <button key={item.id} onClick={() => selectVehicle(item.id, "VehicleDetail")} type="button">
            <strong>{item.make} {item.model} {item.isDefault && <em>Default</em>}</strong>
            <span>{item.plate} - {item.year} - {item.mileage}</span>
            <small>Last service: {item.lastServiceDate}</small>
          </button>
        ))}
      </div>
      <div className="button-stack">
        <button className="wide-action" type="button" onClick={() => setView("AddVehicle")}>Add Vehicle</button>
        <button className="secondary-wide" type="button" onClick={() => setView("ServiceRecord")}>View service records</button>
        <button className="secondary-wide" type="button" onClick={() => setView(relatedReservedParts.length > 0 ? "Orders" : "Parts")}>View reserved parts / orders for this vehicle</button>
      </div>
    </>
  );
}

function AddVehiclePage({
  addVehicle,
  setView,
}: {
  addVehicle: (vehicle: Omit<VehicleRecord, "id" | "isDefault" | "lastServiceDate" | "nextServiceReminder">) => void;
  setView: (view: AppView) => void;
}) {
  const [form, setForm] = useState({
    engine: "1.5L petrol",
    fuelType: "Petrol",
    make: "Honda",
    mileage: "54,200 km",
    model: "City 1.5",
    notes: "Customer-added vehicle",
    plate: "JQR 2281",
    transmission: "Automatic",
    year: "2020",
  });

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  return (
    <>
      <BackButton label="My vehicles" onClick={() => setView("MyVehicles")} />
      <header className="page-header">
        <h1>Add vehicle</h1>
        <p>Save another car to this customer profile.</p>
      </header>
      <article className="vehicle-form">
        <label>Brand<input value={form.make} onChange={(event) => updateField("make", event.target.value)} /></label>
        <label>Model<input value={form.model} onChange={(event) => updateField("model", event.target.value)} /></label>
        <label>Plate number<input value={form.plate} onChange={(event) => updateField("plate", event.target.value)} /></label>
        <label>Year<input value={form.year} onChange={(event) => updateField("year", event.target.value)} /></label>
        <label>Mileage<input value={form.mileage} onChange={(event) => updateField("mileage", event.target.value)} /></label>
        <label>Fuel type<input value={form.fuelType} onChange={(event) => updateField("fuelType", event.target.value)} /></label>
        <label>Transmission<input value={form.transmission} onChange={(event) => updateField("transmission", event.target.value)} /></label>
        <label>Notes<input value={form.notes} onChange={(event) => updateField("notes", event.target.value)} /></label>
        <button className="wide-action" type="button" onClick={() => addVehicle(form)}>Save Vehicle</button>
      </article>
    </>
  );
}

function VehicleDetailPage({
  orders,
  reservedParts,
  selectReservedPart,
  setView,
  vehicle,
}: {
  orders: OrderRecord[];
  reservedParts: ReservedPart[];
  selectReservedPart: (reservedPartId: string, nextView: AppView) => void;
  setView: (view: AppView) => void;
  vehicle: VehicleRecord;
}) {
  return (
    <>
      <BackButton label="My vehicles" onClick={() => setView("MyVehicles")} />
      <article className="vehicle-detail-card">
        <span>{vehicle.isDefault ? "Default vehicle" : "Saved vehicle"}</span>
        <strong>{vehicle.make} {vehicle.model}</strong>
        <div className="job-meta">
          <p><span>Plate</span><strong>{vehicle.plate}</strong></p>
          <p><span>Mileage</span><strong>{vehicle.mileage}</strong></p>
          <p><span>Last service</span><strong>{vehicle.lastServiceDate}</strong></p>
          <p><span>Next service due</span><strong>{vehicle.nextServiceReminder}</strong></p>
          <p><span>Health summary</span><strong>Brake service active, no critical alerts</strong></p>
        </div>
      </article>
      <section className="mini-list">
        <h2>Related orders</h2>
        {orders.map((order) => <article key={order.id}><strong>Job #{order.jobNo}</strong><small>{order.status} - {order.workshop}</small></article>)}
      </section>
      <section className="mini-list">
        <h2>Reserved parts linked to this vehicle</h2>
        {reservedParts.length === 0 && <article><strong>No reserved parts yet</strong><small>Reserve a part from the Parts tab.</small></article>}
        {reservedParts.map((reserved) => {
          const part = partById(reserved.partId);
          return (
            <article key={reserved.id}>
              <strong>{part.brand} {part.name}</strong>
              <small>{reserved.status} - Job #{reserved.jobNo}</small>
              <button className="text-link inline-link" type="button" onClick={() => selectReservedPart(reserved.id, "PartReservationSummary")}>View reserved part</button>
            </article>
          );
        })}
      </section>
      <section className="mini-list">
        <h2>Service records</h2>
        <article><strong>{vehicle.lastServiceDate}</strong><small>{vehicle.notes}</small></article>
      </section>
      <div className="button-stack">
        <button className="wide-action" type="button" onClick={() => setView("Diagnosis")}>Book service for this vehicle</button>
        <button className="secondary-wide" type="button" onClick={() => setView("Orders")}>View orders</button>
        <button className="secondary-wide" type="button" onClick={() => setView("ServiceRecord")}>View service records</button>
      </div>
    </>
  );
}

function PartsTab({ selectPart }: { selectPart: (partId: string, nextView: AppView) => void }) {
  return (
    <>
      <h1>Spare parts</h1>
      <article className="parts-banner">
        <strong>Recommended from diagnosis</strong>
        <span>Tap a part card to view compatibility, lifespan, warranty, and reservation options.</span>
      </article>
      <div className="parts-grid">
        {spareParts.map((part) => (
          <button className="part-card part-card-button" key={part.id} onClick={() => selectPart(part.id, "SparePartDetail")} type="button">
            <div className={`part-image ${part.kind}`} />
            <strong>{part.name}</strong>
            <small>{part.brand}</small>
            <span>{part.compatibleWith}</span>
            <b>RM {part.price}</b>
            <em>{part.stockStatus}</em>
          </button>
        ))}
      </div>
    </>
  );
}

function SparePartDetailPage({
  part,
  reservePart,
  setView,
  vehicle,
}: {
  part: SparePart;
  reservePart: (partId: string, mode?: "reserve" | "quote") => void;
  setView: (view: AppView) => void;
  vehicle: VehicleRecord;
}) {
  return (
    <>
      <BackButton label="Parts" onClick={() => setView("Parts")} />
      <article className="detail-hero part-hero">
        <span>{part.brand}</span>
        <h1>{part.name}</h1>
        <p>RM {part.price} - Compatible with {part.compatibleWith}</p>
        <em>{part.stockStatus}</em>
      </article>
      <div className="job-meta">
        <p><span>Supplier</span><strong>{part.supplier}</strong></p>
        <p><span>Description</span><strong>{part.description}</strong></p>
        <p><span>Normal usage</span><strong>{part.normalUsage}</strong></p>
        <p><span>Warranty</span><strong>{part.warranty}</strong></p>
        <p><span>Install advice</span><strong>{part.installationRecommendation}</strong></p>
        <p><span>Linked diagnosis</span><strong>{part.linkedDiagnosis ?? "Not linked yet"}</strong></p>
        <p><span>Vehicle</span><strong>{vehicle.make} {vehicle.model} - {vehicle.plate}</strong></p>
      </div>
      <div className="button-stack">
        <button className="wide-action" type="button" onClick={() => reservePart(part.id, "reserve")}>Reserve for this repair</button>
        <button className="secondary-wide" type="button" onClick={() => reservePart(part.id, "quote")}>Add to quote</button>
        <button className="secondary-wide" type="button" onClick={() => setView("Parts")}>Back to Parts</button>
      </div>
    </>
  );
}

function PartReservationSummaryPage({
  part,
  reservedPart,
  setView,
  vehicle,
}: {
  part: SparePart;
  reservedPart?: ReservedPart;
  setView: (view: AppView) => void;
  vehicle: VehicleRecord;
}) {
  if (!reservedPart) {
    return (
      <>
        <BackButton label="Parts" onClick={() => setView("Parts")} />
        <article className="record-card"><span>No reservation yet</span><strong>Reserve a part first</strong><p>Open the Parts tab and select Bendix brake pad.</p></article>
      </>
    );
  }

  return (
    <>
      <BackButton label="Parts" onClick={() => setView("Parts")} />
      <header className="page-header">
        <h1>Part reservation</h1>
        <p>No payment collected yet. This part will be charged only after technician confirms the quote.</p>
      </header>
      <article className="record-card">
        <span>Reservation status: {reservedPart.status}</span>
        <strong>{part.brand} {part.name}</strong>
        <p>RM {part.price} - {vehicle.make} {vehicle.model}</p>
      </article>
      <div className="job-meta">
        <p><span>Vehicle</span><strong>{vehicle.make} {vehicle.model} - {vehicle.plate}</strong></p>
        <p><span>Linked job</span><strong>Job #{reservedPart.jobNo}</strong></p>
        <p><span>Diagnosis</span><strong>{reservedPart.diagnosis}</strong></p>
        <p><span>Deposit</span><strong>RM {reservedPart.depositAmount}</strong></p>
      </div>
      <div className="button-stack">
        <button className="wide-action" type="button" onClick={() => setView("OrderDetail")}>View order</button>
        <button className="secondary-wide" type="button" onClick={() => setView("Payment")}>Continue to payment</button>
        <button className="secondary-wide" type="button" onClick={() => setView("Parts")}>Back to Parts</button>
      </div>
    </>
  );
}

function OrdersTab({
  orders,
  reservedParts,
  selectReservedPart,
  setView,
  vehicles,
}: {
  orders: OrderRecord[];
  reservedParts: ReservedPart[];
  selectReservedPart: (reservedPartId: string, nextView: AppView) => void;
  setView: (view: AppView) => void;
  vehicles: VehicleRecord[];
}) {
  return (
    <>
      <h1>My orders</h1>
      <section className="mini-list">
        <h2>Service orders</h2>
        {orders.map((order) => (
          <article key={order.id}>
            <strong>Job #{order.jobNo}</strong>
            <small>{order.status} - {order.workshop}</small>
            <button className="text-link inline-link" type="button" onClick={() => setView("OrderDetail")}>View order</button>
          </article>
        ))}
      </section>
      <section className="mini-list">
        <h2>Reserved parts</h2>
        {reservedParts.length === 0 && <article><strong>No reserved parts yet</strong><small>Reserve one from the Parts tab.</small></article>}
        {reservedParts.map((reserved) => {
          const part = partById(reserved.partId);
          const vehicle = vehicles.find((item) => item.id === reserved.vehicleId);
          return (
            <article key={reserved.id}>
              <strong>{part.brand} {part.name}</strong>
              <small>{vehicle?.make} {vehicle?.model} - RM {part.price} - {reserved.status} - Job #{reserved.jobNo}</small>
              <div className="inline-actions">
                <button type="button" onClick={() => selectReservedPart(reserved.id, "PartReservationSummary")}>View details</button>
                <button type="button" onClick={() => selectReservedPart(reserved.id, "Payment")}>Continue payment</button>
              </div>
            </article>
          );
        })}
      </section>
      <section className="mini-list">
        <h2>Completed records</h2>
        <article><strong>Brake pads replaced</strong><small>12 May 2026 - AutoFix Pro</small></article>
      </section>
    </>
  );
}

function NotificationsPage({
  notifications,
  selectReservedPart,
  setView,
}: {
  notifications: NotificationRecord[];
  selectReservedPart: (reservedPartId: string, nextView: AppView) => void;
  setView: (view: AppView) => void;
}) {
  return (
    <>
      <BackButton label="Home" onClick={() => setView("Home")} />
      <header className="page-header">
        <h1>Notifications</h1>
        <p>Reservation and payment updates appear here.</p>
      </header>
      <div className="support-list">
        {notifications.length === 0 && <button type="button" onClick={() => setView("Parts")}><strong>No notifications yet</strong><span>Reserve a part to create one.</span></button>}
        {notifications.map((item) => (
          <button key={item.id} onClick={() => selectReservedPart(item.reservedPartId, "PartReservationSummary")} type="button">
            <strong>{item.title}</strong>
            <span>{item.message}</span>
            <StatusPill label={item.status} />
          </button>
        ))}
      </div>
    </>
  );
}

function OrderDetailPage({
  order,
  reservedParts,
  selectReservedPart,
  setView,
  vehicle,
}: {
  order: OrderRecord;
  reservedParts: ReservedPart[];
  selectReservedPart: (reservedPartId: string, nextView: AppView) => void;
  setView: (view: AppView) => void;
  vehicle: VehicleRecord;
}) {
  return (
    <>
      <BackButton label="Orders" onClick={() => setView("Orders")} />
      <article className="order-card">
        <header>
          <div><strong>Job #{order.jobNo}</strong><span>{vehicle.make} {vehicle.model} - {vehicle.plate}</span></div>
          <aside><b>{order.status}</b><span>{order.workshop}</span></aside>
        </header>
        <div className="job-meta">
          <p><span>Technician</span><strong>{order.technician}</strong></p>
          <p><span>Diagnosis</span><strong>{order.diagnosis}</strong></p>
          <p><span>Vehicle</span><strong>{vehicle.mileage}</strong></p>
        </div>
      </article>
      <section className="mini-list">
        <h2>Reserved parts</h2>
        {reservedParts.length === 0 && <article><strong>No reserved parts yet</strong><small>Reserve one from the Parts tab.</small></article>}
        {reservedParts.map((reserved) => {
          const part = partById(reserved.partId);
          return (
            <article key={reserved.id}>
              <strong>{part.brand} {part.name}</strong>
              <small>{reserved.status} - RM {part.price}</small>
              <div className="inline-actions">
                <button type="button" onClick={() => selectReservedPart(reserved.id, "PartReservationSummary")}>View reserved part</button>
                <button type="button" onClick={() => selectReservedPart(reserved.id, "Payment")}>Continue payment</button>
              </div>
            </article>
          );
        })}
      </section>
      <div className="button-stack">
        <button className="wide-action" type="button" onClick={() => setView("QuoteReview")}>View quote</button>
        <button className="secondary-wide" type="button" onClick={() => setView("Invoice")}>View receipt / invoice</button>
        <button className="secondary-wide" type="button" onClick={() => setView("ServiceRecord")}>View service record</button>
      </div>
    </>
  );
}

function QuoteReviewPage({
  part,
  reservePart,
  reservedPart,
  setView,
  vehicle,
}: {
  part: SparePart;
  reservePart: (partId: string, mode?: "reserve" | "quote") => void;
  reservedPart?: ReservedPart;
  setView: (view: AppView) => void;
  vehicle: VehicleRecord;
}) {
  const activePart = reservedPart ? partById(reservedPart.partId) : part;
  const total = activePart.price + labourSubtotal;

  return (
    <>
      <BackButton label="Orders" onClick={() => setView("Orders")} />
      <header className="page-header"><h1>Quote #{quoteNo}</h1><p>Job #{jobNo} - {vehicle.make} {vehicle.model}</p></header>
      <article className="review-card"><span>Quote ready</span><strong>{diagnosis}</strong><small>Workshop: {workshopName} - Technician: {technician}</small></article>
      <div className="quote-lines">
        <div><span>{activePart.brand} {activePart.name}</span><strong>RM {activePart.price}</strong></div>
        <div><span>Brake pad replacement 1.5 hr</span><strong>RM {labourSubtotal}</strong></div>
        <div className="total-row"><span>Total</span><strong>RM {total}</strong></div>
      </div>
      <div className="button-stack">
        <button className="wide-action" type="button" onClick={() => reservePart(activePart.id, "quote")}>Add to quote</button>
        <button className="secondary-wide" type="button" onClick={() => setView("Payment")}>Continue to payment</button>
        <button className="secondary-wide" type="button" onClick={() => setView("Workshops")}>Choose another workshop</button>
      </div>
    </>
  );
}

function PaymentPage({
  method,
  part,
  payReservedPart,
  reservedPart,
  setMethod,
  setView,
  vehicle,
}: {
  method: string;
  part: SparePart;
  payReservedPart: (fullPayment: boolean) => void;
  reservedPart?: ReservedPart;
  setMethod: (method: string) => void;
  setView: (view: AppView) => void;
  vehicle: VehicleRecord;
}) {
  const activePart = reservedPart ? partById(reservedPart.partId) : part;
  const deposit = reservedPart?.depositAmount ?? reservationDeposit;
  const total = activePart.price + (reservedPart ? 0 : labourSubtotal);
  const balance = activePart.price - deposit;
  const methods = ["Touch 'n Go eWallet", "Online banking", "Card", "Pay at workshop"];

  return (
    <>
      <BackButton label="Order" onClick={() => setView("OrderDetail")} />
      <header className="page-header"><h1>Payment</h1><p>Review what you selected before payment.</p></header>
      <article className="review-card">
        <span>Selected item</span>
        <strong>{activePart.brand} {activePart.name}</strong>
        <small>{vehicle.make} {vehicle.model} - Job #{reservedPart?.jobNo ?? jobNo}</small>
      </article>
      <div className="quote-lines">
        <div><span>Part subtotal</span><strong>RM {activePart.price}</strong></div>
        <div><span>Labour subtotal</span><strong>{reservedPart ? "After technician confirmation" : `RM ${labourSubtotal}`}</strong></div>
        <div><span>Reservation deposit</span><strong>RM {deposit}</strong></div>
        <div><span>Total amount</span><strong>RM {total}</strong></div>
        <div className="total-row"><span>Balance after deposit</span><strong>RM {balance}</strong></div>
      </div>
      <div className="option-list">
        {methods.map((item) => <button className={method === item ? "selected" : ""} key={item} onClick={() => setMethod(item)} type="button">{item}</button>)}
      </div>
      <div className="button-stack">
        <button className="wide-action" type="button" onClick={() => payReservedPart(false)}>Pay deposit</button>
        <button className="secondary-wide" type="button" onClick={() => payReservedPart(true)}>Pay full amount</button>
        <button className="secondary-wide" type="button" onClick={() => setView("OrderDetail")}>Back to order</button>
      </div>
    </>
  );
}

function PaymentSuccessPage({
  receipt,
  setView,
}: {
  receipt?: ReceiptRecord;
  setView: (view: AppView) => void;
}) {
  return (
    <>
      <header className="success-panel">
        <span>Payment successful</span>
        <h1>{receipt?.id ?? receiptNo}</h1>
        <p>Amount paid: RM {receipt?.amount ?? reservationDeposit}</p>
        <small>Payment method: {receipt?.method ?? "Touch 'n Go eWallet"} - Linked order #{jobNo}</small>
      </header>
      <div className="button-stack">
        <button className="wide-action" type="button" onClick={() => setView("Invoice")}>View receipt</button>
        <button className="secondary-wide" type="button" onClick={() => setView("OrderDetail")}>View order</button>
        <button className="secondary-wide" type="button" onClick={() => setView("Home")}>Back home</button>
      </div>
    </>
  );
}

function InvoicePage({
  part,
  payment,
  receipt,
  setNotice,
  setView,
  vehicle,
}: {
  part: SparePart;
  payment?: PaymentRecord;
  receipt?: ReceiptRecord;
  setNotice: (notice: string) => void;
  setView: (view: AppView) => void;
  vehicle: VehicleRecord;
}) {
  const paid = receipt?.amount ?? 0;
  const balance = Math.max(part.price - paid, 0);

  return (
    <>
      <BackButton label="Order" onClick={() => setView("OrderDetail")} />
      <header className="page-header"><h1>Receipt / Invoice</h1><p>{receipt?.id ?? invoiceNo}</p></header>
      <div className="quote-lines">
        <div><span>Customer</span><strong>{customerName}</strong></div>
        <div><span>Vehicle</span><strong>{vehicle.make} {vehicle.model} - {vehicle.plate}</strong></div>
        <div><span>Job number</span><strong>{jobNo}</strong></div>
        <div><span>Item purchased / reserved</span><strong>{part.brand} {part.name}</strong></div>
        <div><span>Part price</span><strong>RM {part.price}</strong></div>
        <div><span>Deposit paid</span><strong>RM {paid}</strong></div>
        <div><span>Balance</span><strong>RM {balance}</strong></div>
        <div className="total-row"><span>Payment status</span><strong>{payment?.status ?? "Deposit pending"}</strong></div>
      </div>
      <div className="button-stack">
        <button className="wide-action" type="button" onClick={() => setNotice("Receipt saved to customer records")}>Download receipt</button>
        <button className="secondary-wide" type="button" onClick={() => setNotice("Receipt ready to share")}>Share receipt</button>
        <button className="secondary-wide" type="button" onClick={() => setView("ServiceRecord")}>View service record</button>
      </div>
    </>
  );
}

function ServiceRecordPage({
  reservedParts,
  setView,
  vehicle,
}: {
  reservedParts: ReservedPart[];
  setView: (view: AppView) => void;
  vehicle: VehicleRecord;
}) {
  return (
    <>
      <BackButton label="Me" onClick={() => setView("Me")} />
      <header className="page-header"><h1>Service records</h1><p>{vehicle.make} {vehicle.model} - {vehicle.plate}</p></header>
      <article className="record-card"><span>Latest record</span><strong>{vehicle.lastServiceDate}</strong><p>{vehicle.nextServiceReminder}</p></article>
      <section className="mini-list">
        <h2>Reserved parts in service history</h2>
        {reservedParts.length === 0 && <article><strong>No reserved parts yet</strong><small>Reservations will appear here.</small></article>}
        {reservedParts.map((reserved) => {
          const part = partById(reserved.partId);
          return <article key={reserved.id}><strong>{part.brand} {part.name}</strong><small>{reserved.status} - Job #{reserved.jobNo}</small></article>;
        })}
      </section>
    </>
  );
}

function SupportCenterPage({
  setSupportNotice,
  setView,
  supportNotice,
}: {
  setSupportNotice: (notice: string) => void;
  setView: (view: AppView) => void;
  supportNotice: string;
}) {
  const supportItems = [
    { label: "My booking", detail: `Check Job #${jobNo}`, action: () => setView("OrderDetail") },
    { label: "My quote", detail: `Open Quote #${quoteNo}`, action: () => setView("QuoteReview") },
    { label: "Payment / refund", detail: "Open payment or receipt", action: () => setView("Payment") },
    { label: "Parts reservation", detail: "Review reserved Bendix brake pad", action: () => setView("PartReservationSummary") },
    { label: "Workshop issue", detail: "Message AutoFix Pro", action: () => setSupportNotice("Workshop issue note added to Job #MF-08471.") },
    { label: "General question", detail: "Ask ManHub support", action: () => setSupportNotice("General question saved. ManHub support will reply in-app.") },
  ];
  return (
    <>
      <BackButton label="Me" onClick={() => setView("Me")} />
      <header className="page-header"><h1>Support center</h1><p>Open the right customer record first.</p></header>
      <div className="support-list">
        {supportItems.map((item) => <button key={item.label} onClick={item.action} type="button"><strong>{item.label}</strong><span>{item.detail}</span></button>)}
      </div>
      <article className="emergency-card">
        <span>Emergency assistance</span><strong>Need urgent help?</strong><p>Use these only for urgent roadside or safety issues.</p>
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
  unreadCount,
  vehicleCount,
}: {
  profilePanel: string;
  setProfilePanel: (panel: string) => void;
  setView: (view: AppView) => void;
  unreadCount: number;
  vehicleCount: number;
}) {
  const menu = [
    { label: "My vehicles", action: () => setView("MyVehicles") },
    { label: "Digital service records", action: () => setView("ServiceRecord") },
    { label: "Notifications", action: () => setView("Notifications") },
    { label: "Payment methods", action: () => setView("Payment") },
    { label: "Help & support", action: () => setView("SupportCenter") },
  ];

  return (
    <>
      <section className="profile"><span>D</span><div><h1>Daniel Tan</h1><p>daniel.t@email.com</p></div></section>
      <div className="stats">
        <article><strong>{vehicleCount}</strong><span>Vehicles</span></article>
        <article><strong>12</strong><span>Services</span></article>
        <article><strong>{unreadCount}</strong><span>Alerts</span></article>
      </div>
      <div className="menu-list">
        {menu.map((item) => (
          <button className={profilePanel === item.label ? "active" : ""} key={item.label} onClick={() => { setProfilePanel(item.label); item.action(); }} type="button">
            {item.label}<span>&gt;</span>
          </button>
        ))}
      </div>
      <article className="detail-panel"><strong>{profilePanel}</strong><span>Open a customer record to continue.</span></article>
    </>
  );
}
