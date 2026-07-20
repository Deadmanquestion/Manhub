import type { MetricQuery, PortalRoute } from "@manhub/backend";

export const customerRoutes: PortalRoute[] = [
  { label: "Home", path: "/" },
  { label: "AI Diagnosis", path: "/diagnosis" },
  { label: "My Vehicles", path: "/vehicles" },
  { label: "Spare Parts", path: "/parts" },
  { label: "Orders", path: "/orders" },
  { label: "Warranty+", path: "/warranty" },
  { label: "Notifications", path: "/notifications" },
  { label: "Profile", path: "/profile" },
];

export const supplierRoutes: PortalRoute[] = [
  { label: "Dashboard", path: "/" },
  { label: "Products", path: "/products" },
  { label: "Inventory", path: "/inventory" },
  { label: "Orders", path: "/orders" },
  { label: "Warranty", path: "/warranty" },
  { label: "Withdrawals", path: "/withdrawals" },
  { label: "Analytics", path: "/analytics" },
  { label: "Profile", path: "/profile" },
];

export const workshopRoutes: PortalRoute[] = [
  { label: "Dashboard", path: "/" },
  { label: "Bookings", path: "/bookings" },
  { label: "Repair Queue", path: "/repair-queue" },
  { label: "Customers", path: "/customers" },
  { label: "Technicians", path: "/technicians" },
  { label: "Invoices", path: "/invoices" },
  { label: "Warranty", path: "/warranty" },
  { label: "Analytics", path: "/analytics" },
];

export const adminRoutes: PortalRoute[] = [
  { label: "Overview", path: "/" },
  { label: "Users", path: "/users" },
  { label: "Workshops", path: "/workshops" },
  { label: "Suppliers", path: "/suppliers" },
  { label: "Orders", path: "/orders" },
  { label: "Payments", path: "/payments" },
  { label: "Withdrawals", path: "/withdrawals" },
  { label: "Warranty", path: "/warranty" },
  { label: "Analytics", path: "/analytics" },
  { label: "Settings", path: "/settings" },
];

export const adminMetrics: MetricQuery[] = [
  { label: "Total GMV", table: "platform_payments", type: "sum", column: "amount" },
  { label: "Commission Earned", table: "platform_payments", type: "sum", column: "commission_amount" },
  { label: "Active Customers", table: "app_users", type: "count", filter: { account_type: "Customer" } },
  { label: "Active Workshops", table: "platform_workshops", type: "count", filter: { status: "Active" } },
  { label: "Active Suppliers", table: "supplier_profiles", type: "count", filter: { status: "Active" } },
  { label: "Warranty Claims", table: "warranty_claims", type: "count" },
  { label: "Withdrawal Requests", table: "supplier_withdrawals", type: "count", filter: { status: "Pending" } },
];

export const supplierMetrics: MetricQuery[] = [
  { label: "Monthly Revenue", table: "supplier_orders", type: "sum", column: "amount" },
  { label: "Products", table: "supplier_products", type: "count" },
  { label: "Low Stock", table: "supplier_products", type: "count" },
  { label: "Warranty Claims", table: "warranty_claims", type: "count" },
];

export const workshopMetrics: MetricQuery[] = [
  { label: "Bookings", table: "service_bookings", type: "count" },
  { label: "Repair Queue", table: "repair_jobs", type: "count" },
  { label: "Invoices", table: "platform_payments", type: "count" },
  { label: "Warranty Jobs", table: "warranty_claims", type: "count", filter: { status: "Inspection Requested" } },
];
