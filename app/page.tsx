const authUrl = process.env.NEXT_PUBLIC_MANFIX_AUTH_URL
  ?? process.env.NEXT_PUBLIC_MANHUB_AUTH_URL
  ?? "https://manhub-auth.onrender.com/login";
const supplierUrl = process.env.NEXT_PUBLIC_MANFIX_SUPPLIER_URL
  ?? process.env.NEXT_PUBLIC_MANHUB_SUPPLIER_URL
  ?? authUrl;
const workshopUrl = process.env.NEXT_PUBLIC_MANFIX_WORKSHOP_URL
  ?? process.env.NEXT_PUBLIC_MANHUB_WORKSHOP_URL
  ?? "https://manhub-workshop.onrender.com";
const technicianUrl = process.env.NEXT_PUBLIC_MANFIX_TECH_URL
  ?? "https://manfix-tech.onrender.com";
const adminUrl = process.env.NEXT_PUBLIC_MANFIX_ADMIN_URL
  ?? process.env.NEXT_PUBLIC_MANHUB_ADMIN_URL
  ?? authUrl;

const deliverables = [
  {
    eyebrow: "01",
    title: "Landing Website",
    body: "Public ManFix site that explains the platform and sends every user to the single login.",
    status: "Active",
  },
  {
    eyebrow: "02",
    title: "Authentication",
    body: "One Supabase Auth login. Users never choose a role manually.",
    status: "SSO",
  },
  {
    eyebrow: "03",
    title: "Role Detection",
    body: "After login, ManFix reads public.profiles.role and redirects to the correct portal.",
    status: "Supabase",
  },
  {
    eyebrow: "04",
    title: "Independent Portals",
    body: "Supplier, Workshop, and Admin are separate React applications with their own routing.",
    status: "Split",
  },
];

const portals = [
  {
    label: "Supplier Web Portal",
    description: "Products, inventory, orders, warranty claims, withdrawals, analytics, and profile.",
    path: "apps/supplier",
    url: supplierUrl,
  },
  {
    label: "Workshop Owner Dashboard",
    description: "Workshop management, customers, technicians, invoices, warranty inspections, and analytics.",
    path: "apps/workshop",
    url: workshopUrl,
  },
  {
    label: "Technician Operations",
    description: "Incoming bookings, assigned repair orders, daily schedule, and live job progress.",
    path: "apps/technician",
    url: technicianUrl,
  },
  {
    label: "Admin Dashboard",
    description: "Users, workshops, suppliers, orders, payments, withdrawals, warranty, analytics, and settings.",
    path: "apps/admin",
    url: adminUrl,
  },
];

const flow = ["Supabase Auth", "profiles.role", "Role guard", "Correct portal"];

export default function LandingWebsite() {
  return (
    <main className="platform-page">
      <nav className="platform-nav" aria-label="ManFix platform navigation">
        <a className="brand" href="#top" aria-label="ManFix home">
          <span>MF</span>
          <strong>ManFix</strong>
        </a>
        <div>
          <a href="#architecture">Architecture</a>
          <a href="#portals">Portals</a>
          <a className="login-link" href={authUrl}>Single Login</a>
        </div>
      </nav>

      <section className="hero" id="top">
        <div className="hero-copy">
          <span className="eyebrow">Multi-portal automotive SaaS</span>
          <h1>One backend. One login. Separate portals for every ManFix role.</h1>
          <p>
            ManFix is structured as a platform first: public landing website, Supabase single sign-on,
            automatic role detection, and independent web portals for suppliers, workshops, and admins.
          </p>
          <div className="hero-actions">
            <a className="primary-action" href={authUrl}>Open Single Login</a>
            <a className="secondary-action" href="#portals">View Portals</a>
          </div>
        </div>
        <aside className="system-panel" aria-label="ManFix architecture status">
          <div className="panel-header">
            <span>Platform Status</span>
            <b>Architecture First</b>
          </div>
          <div className="flow-line">
            {flow.map((item) => (
              <article key={item}>
                <i />
                <strong>{item}</strong>
              </article>
            ))}
          </div>
        </aside>
      </section>

      <section className="deliverables" id="architecture" aria-labelledby="architecture-title">
        <header className="section-header">
          <span>Required Deliverables</span>
          <h2 id="architecture-title">Customer App work is paused until this foundation is complete.</h2>
        </header>
        <div className="deliverable-grid">
          {deliverables.map((item) => (
            <article key={item.title} className="deliverable-card">
              <span>{item.eyebrow}</span>
              <b>{item.status}</b>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="portal-section" id="portals" aria-labelledby="portals-title">
        <header className="section-header">
          <span>Independent React Applications</span>
          <h2 id="portals-title">Each role gets a separate deployable frontend.</h2>
        </header>
        <div className="portal-grid">
          {portals.map((portal) => (
            <article key={portal.label} className="portal-card">
              <small>{portal.path}</small>
              <h3>{portal.label}</h3>
              <p>{portal.description}</p>
              <a href={portal.url}>Open portal</a>
            </article>
          ))}
        </div>
      </section>

      <section className="backend-band" aria-label="Shared backend">
        <div>
          <span>Shared Backend</span>
          <h2>All portals use the same Supabase project.</h2>
        </div>
        <p>
          Supabase Auth, PostgreSQL, Row Level Security, storage, and API access are shared.
          Frontends are separate; business identity and data rules are central.
        </p>
      </section>
    </main>
  );
}
