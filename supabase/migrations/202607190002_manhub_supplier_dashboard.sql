create table if not exists public.supplier_profiles (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null default auth.uid(),
  company_name text not null,
  contact_name text,
  email text,
  phone text,
  rating numeric(3,2) not null default 0,
  bank_name text,
  bank_account_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (supplier_id)
);

create table if not exists public.supplier_products (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null default auth.uid(),
  name text not null,
  brand text not null,
  category text not null,
  cost_price numeric(12,2) not null check (cost_price >= 0),
  selling_price numeric(12,2) not null check (selling_price >= 0),
  stock integer not null default 0 check (stock >= 0),
  incoming_stock integer not null default 0 check (incoming_stock >= 0),
  warranty_duration_months integer not null default 6 check (warranty_duration_months >= 0),
  image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.supplier_orders (
  id text primary key,
  supplier_id uuid not null default auth.uid(),
  workshop text not null,
  customer text not null,
  product_id uuid references public.supplier_products(id) on delete set null,
  product_name text not null,
  quantity integer not null check (quantity > 0),
  status text not null check (status in ('New', 'Confirmed', 'Dispatched', 'Delivered', 'Cancelled')),
  invoice_number text not null,
  amount numeric(12,2) not null default 0,
  cost_total numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.supplier_stock_history (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null default auth.uid(),
  product_id uuid references public.supplier_products(id) on delete cascade,
  product_name text not null,
  change_type text not null check (change_type in ('Sale', 'Incoming', 'Adjustment')),
  quantity integer not null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.supplier_withdrawals (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null default auth.uid(),
  amount numeric(12,2) not null check (amount > 0),
  bank text not null,
  account_number text not null,
  status text not null default 'Pending' check (status in ('Pending', 'Approved', 'Rejected', 'Paid')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists supplier_products_supplier_idx on public.supplier_products(supplier_id);
create index if not exists supplier_orders_supplier_idx on public.supplier_orders(supplier_id);
create index if not exists supplier_stock_history_supplier_idx on public.supplier_stock_history(supplier_id);
create index if not exists supplier_withdrawals_supplier_idx on public.supplier_withdrawals(supplier_id);

alter table public.supplier_profiles enable row level security;
alter table public.supplier_products enable row level security;
alter table public.supplier_orders enable row level security;
alter table public.supplier_stock_history enable row level security;
alter table public.supplier_withdrawals enable row level security;

drop policy if exists "Suppliers manage own profile" on public.supplier_profiles;
create policy "Suppliers manage own profile"
on public.supplier_profiles
for all
to authenticated
using ((select auth.uid()) = supplier_id)
with check ((select auth.uid()) = supplier_id);

drop policy if exists "Suppliers manage own products" on public.supplier_products;
create policy "Suppliers manage own products"
on public.supplier_products
for all
to authenticated
using ((select auth.uid()) = supplier_id)
with check ((select auth.uid()) = supplier_id);

drop policy if exists "Suppliers view own orders" on public.supplier_orders;
create policy "Suppliers view own orders"
on public.supplier_orders
for select
to authenticated
using ((select auth.uid()) = supplier_id);

drop policy if exists "Suppliers manage own stock history" on public.supplier_stock_history;
create policy "Suppliers manage own stock history"
on public.supplier_stock_history
for all
to authenticated
using ((select auth.uid()) = supplier_id)
with check ((select auth.uid()) = supplier_id);

drop policy if exists "Suppliers manage own withdrawals" on public.supplier_withdrawals;
create policy "Suppliers manage own withdrawals"
on public.supplier_withdrawals
for all
to authenticated
using ((select auth.uid()) = supplier_id)
with check ((select auth.uid()) = supplier_id);
