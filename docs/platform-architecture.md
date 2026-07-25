# ManHub Multi-Portal Architecture

ManHub is now organized as independent deployable React frontends that share one Supabase backend.

## Frontends

- `app`: Landing Website for `manhub.my`
- `apps/auth`: Single Login for `auth.manhub.my`
- `apps/supplier`: Supplier Portal for `supplier.manhub.my`
- `apps/workshop`: Workshop Portal for `workshop.manhub.my`
- `apps/admin`: Admin Dashboard for `admin.manhub.my`

Each app owns its routing and can be built or deployed separately.

Paused surface:

- `apps/customer`: Customer Mobile App for `app.manhub.my`

The Customer App is intentionally frozen while the platform architecture is completed. Do not add new customer features until the landing website, SSO, role detection, and web portals are stable.

## Shared Packages

- `packages/backend`: Supabase client, role routing, shared reads, inserts, deletes, and status updates
- `packages/auth`: shared role-aware authentication hook
- `packages/ui`: shared buttons, cards, charts, forms, tables, typography, and dark automotive theme
- `packages/platform-config`: route and metric definitions for each portal

## Backend Contract

All portals use the same Supabase project:

- Auth: one user identity system
- Database: one PostgreSQL schema
- Storage: one storage layer, tracked by `file_assets`
- Realtime/API: one backend contract through shared Supabase queries and API routes

Vite portal environment variables:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

The existing Next customer preview can still use:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## Role Routing

After login, the shared auth layer reads the user's role from `public.profiles`.

- `customer` routes to the Customer App
- `supplier` routes to the Supplier Portal
- `workshop` routes to the Workshop Portal
- `admin` routes to the Admin Dashboard

There is one login app: `apps/auth`.

Customers can self-register from this page. Supplier, workshop, and admin accounts are not exposed in self-registration; admin creates or approves those profiles.

## RBAC

The migration `202607200001_manhub_multi_portal_rbac.sql` adds the missing multi-portal tables and policies.

- Customers can manage their own vehicles, notifications, bookings, AI usage, and warranties.
- Suppliers can manage their own products, stock, orders, withdrawals, and warranty claims.
- Workshops can manage assigned bookings, repair jobs, technicians, invoices, and warranty inspection work.
- Admins can access and control all platform records.

## Commands

```bash
npm run dev:landing
npm run dev:auth
npm run dev:supplier
npm run dev:workshop
npm run dev:admin
npm run build:platform
npm run typecheck:platform
```
