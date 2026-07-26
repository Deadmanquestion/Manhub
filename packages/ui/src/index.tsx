import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import type { PortalRoute } from "@manhub/backend";
import "./theme.css";

export function PortalShell({
  children,
  eyebrow,
  routes,
  title,
}: {
  children: ReactNode;
  eyebrow: string;
  routes: PortalRoute[];
  title: string;
}) {
  return (
    <main className="mh-shell">
      <aside className="mh-sidebar">
        <div className="mh-brand">
          <span>{eyebrow}</span>
          <strong>{title}</strong>
        </div>
        <nav className="mh-nav">
          {routes.map((route) => (
            <NavLink className={({ isActive }) => `mh-nav-link ${isActive ? "active" : ""}`} key={route.path} to={route.path}>
              {route.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <section className="mh-main">{children}</section>
    </main>
  );
}

export function MobileShell({ children }: { children: ReactNode }) {
  return <main className="mh-mobile-shell"><section className="mh-phone">{children}</section></main>;
}

export function PageHeader({ children, title }: { children?: ReactNode; title: string }) {
  return (
    <header className="mh-page-header">
      <h1>{title}</h1>
      {children}
    </header>
  );
}

export function Card({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "blue" | "amber" }) {
  return <article className={`mh-card ${tone}`}>{children}</article>;
}

export function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <span className="mh-stat-label">{label}</span>
      <strong className="mh-stat-value">{value}</strong>
    </Card>
  );
}

export function StatGrid({ items }: { items: Array<[string, string | number]> }) {
  return <div className="mh-stat-grid">{items.map(([label, value]) => <StatCard key={label} label={label} value={value} />)}</div>;
}

export function Button({
  children,
  onClick,
  tone = "primary",
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: "primary" | "ghost" | "danger";
  type?: "button" | "submit" | "reset";
}) {
  return <button className={`mh-button ${tone}`} onClick={onClick} type={type}>{children}</button>;
}

export function DataTable({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  return (
    <div className="mh-table-wrap">
      <table className="mh-table">
        <thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={headers.length}>No records found.</td></tr>}
          {rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}

export function MiniChart({ data, title }: { data: Array<{ label: string; value: number }>; title: string }) {
  const max = Math.max(1, ...data.map((item) => item.value));
  return (
    <Card>
      <h2 className="mh-card-title">{title}</h2>
      <div className="mh-chart">
        {data.map((item) => (
          <div className="mh-chart-row" key={item.label}>
            <span>{item.label}</span>
            <b><i style={{ width: `${Math.max(8, (item.value / max) * 100)}%` }} /></b>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function FormField({ label, onChange, type = "text", value }: { label: string; onChange: (value: string) => void; type?: string; value: string }) {
  return <label className="mh-field">{label}<input onChange={(event) => onChange(event.target.value)} type={type} value={value} /></label>;
}

export function EmptyState({ text }: { text: string }) {
  return <p className="mh-empty">{text}</p>;
}
