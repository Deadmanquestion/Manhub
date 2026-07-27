create extension if not exists pgcrypto;

create or replace function private.manfix_has_approved_role(expected_role text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = expected_role
      and status in ('Active', 'Approved', 'Verified')
  )
$$;

revoke all on function private.manfix_has_approved_role(text) from public;
revoke all on function private.manfix_has_approved_role(text) from anon;
grant execute on function private.manfix_has_approved_role(text) to authenticated;
grant execute on function private.manfix_has_approved_role(text) to service_role;

create table if not exists public.platform_settings (
  id text primary key default 'platform',
  supplier_commission_percent numeric(5,2) not null default 20
    check (supplier_commission_percent >= 0 and supplier_commission_percent <= 100),
  updated_at timestamptz not null default now()
);

insert into public.platform_settings (id, supplier_commission_percent)
values ('platform', 20)
on conflict (id) do update
set supplier_commission_percent = 20,
    updated_at = now();

create table if not exists public.supplier_profiles (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  company_name text not null,
  contact_name text,
  email text,
  phone text,
  bank_name text,
  bank_account_number text,
  rating numeric(3,2) not null default 0 check (rating >= 0 and rating <= 5),
  status text not null default 'Pending Approval'
    check (status in ('Active', 'Approved', 'Verified', 'Pending Approval', 'Suspended', 'Banned')),
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (supplier_id)
);

create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

insert into public.product_categories (name)
values
  ('Brake'),
  ('Engine Oil'),
  ('Battery'),
  ('Filter'),
  ('Tyre'),
  ('Suspension'),
  ('Air Conditioning'),
  ('Electrical')
on conflict (name) do nothing;

create table if not exists public.supplier_products (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  name text not null,
  brand text not null,
  sku text,
  category text not null,
  description text,
  cost_price numeric(12,2) not null check (cost_price >= 0),
  selling_price numeric(12,2) not null check (selling_price >= 0),
  stock integer not null default 0 check (stock >= 0),
  incoming_stock integer not null default 0 check (incoming_stock >= 0),
  low_stock_threshold integer not null default 5 check (low_stock_threshold >= 0),
  warranty_duration_months integer not null default 6 check (warranty_duration_months >= 0),
  image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists supplier_products_supplier_sku_idx
on public.supplier_products(supplier_id, sku)
where sku is not null and sku <> '';

create table if not exists public.supplier_orders (
  id text primary key,
  supplier_id uuid not null references public.profiles(id) on delete restrict,
  workshop text not null,
  customer text not null,
  product_id uuid references public.supplier_products(id) on delete set null,
  product_name text not null,
  quantity integer not null check (quantity > 0),
  status text not null default 'New'
    check (status in ('New', 'Confirmed', 'Dispatched', 'Delivered', 'Cancelled')),
  invoice_number text not null,
  amount numeric(12,2) not null default 0 check (amount >= 0),
  cost_total numeric(12,2) not null default 0 check (cost_total >= 0),
  commission_rate numeric(5,2) not null default 20
    check (commission_rate >= 0 and commission_rate <= 100),
  commission_amount numeric(12,2) not null default 0 check (commission_amount >= 0),
  supplier_net_amount numeric(12,2) not null default 0 check (supplier_net_amount >= 0),
  stock_deducted_at timestamptz,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.supplier_stock_history (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid references public.supplier_products(id) on delete set null,
  order_id text references public.supplier_orders(id) on delete set null,
  product_name text not null,
  change_type text not null check (change_type in ('Opening', 'Sale', 'Incoming', 'Adjustment')),
  quantity integer not null check (quantity <> 0),
  note text,
  created_at timestamptz not null default now()
);

create unique index if not exists supplier_stock_history_order_sale_idx
on public.supplier_stock_history(order_id)
where order_id is not null and change_type = 'Sale';

create table if not exists public.supplier_commissions (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.profiles(id) on delete restrict,
  supplier_name text not null,
  order_id text not null references public.supplier_orders(id) on delete restrict,
  invoice_number text not null,
  gross_amount numeric(12,2) not null check (gross_amount >= 0),
  commission_rate numeric(5,2) not null check (commission_rate >= 0 and commission_rate <= 100),
  commission_amount numeric(12,2) not null check (commission_amount >= 0),
  supplier_net_amount numeric(12,2) not null check (supplier_net_amount >= 0),
  status text not null default 'Settled' check (status in ('Pending', 'Settled', 'Reversed')),
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  unique (order_id)
);

create table if not exists public.supplier_wallets (
  supplier_id uuid primary key references public.profiles(id) on delete cascade,
  available_balance numeric(12,2) not null default 0 check (available_balance >= 0),
  pending_balance numeric(12,2) not null default 0 check (pending_balance >= 0),
  currency text not null default 'MYR',
  updated_at timestamptz not null default now()
);

create table if not exists public.supplier_withdrawals (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  bank text not null,
  account_number text not null,
  status text not null default 'Pending' check (status in ('Pending', 'Approved', 'Rejected', 'Paid')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table if not exists public.supplier_invoices (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.profiles(id) on delete restrict,
  order_id text not null references public.supplier_orders(id) on delete restrict,
  invoice_number text not null,
  parts_subtotal numeric(12,2) not null default 0 check (parts_subtotal >= 0),
  commission_rate numeric(5,2) not null default 20
    check (commission_rate >= 0 and commission_rate <= 100),
  commission_amount numeric(12,2) not null default 0 check (commission_amount >= 0),
  supplier_net_amount numeric(12,2) not null default 0 check (supplier_net_amount >= 0),
  total numeric(12,2) not null default 0 check (total >= 0),
  paid_amount numeric(12,2) not null default 0 check (paid_amount >= 0),
  status text not null default 'Pending' check (status in ('Pending', 'Paid', 'Refunded', 'Escrow')),
  pdf_url text,
  issued_at timestamptz not null default now(),
  unique (order_id),
  unique (supplier_id, invoice_number)
);

create table if not exists public.platform_payments (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references public.supplier_orders(id) on delete restrict,
  invoice_number text not null,
  supplier_id uuid not null references public.profiles(id) on delete restrict,
  supplier_name text not null,
  payer_name text not null,
  payee_name text not null,
  amount numeric(12,2) not null check (amount >= 0),
  commission_rate numeric(5,2) not null default 20
    check (commission_rate >= 0 and commission_rate <= 100),
  commission_amount numeric(12,2) not null default 0 check (commission_amount >= 0),
  supplier_net_amount numeric(12,2) not null default 0 check (supplier_net_amount >= 0),
  status text not null default 'Paid' check (status in ('Pending', 'Paid', 'Refunded', 'Escrow')),
  method text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id)
);

create index if not exists supplier_profiles_supplier_idx on public.supplier_profiles(supplier_id);
create index if not exists supplier_products_supplier_idx on public.supplier_products(supplier_id);
create index if not exists supplier_orders_supplier_idx on public.supplier_orders(supplier_id);
create index if not exists supplier_orders_product_idx on public.supplier_orders(product_id);
create index if not exists supplier_orders_status_idx on public.supplier_orders(status);
create index if not exists supplier_stock_history_supplier_idx on public.supplier_stock_history(supplier_id);
create index if not exists supplier_stock_history_product_idx on public.supplier_stock_history(product_id);
create index if not exists supplier_commissions_supplier_idx on public.supplier_commissions(supplier_id);
create index if not exists supplier_commissions_created_idx on public.supplier_commissions(created_at desc);
create index if not exists supplier_withdrawals_supplier_idx on public.supplier_withdrawals(supplier_id);
create index if not exists supplier_invoices_supplier_idx on public.supplier_invoices(supplier_id);
create index if not exists platform_payments_supplier_idx on public.platform_payments(supplier_id);
create index if not exists platform_payments_created_idx on public.platform_payments(created_at desc);

create or replace function private.manfix_record_opening_stock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.stock > 0 then
    insert into public.supplier_stock_history (
      supplier_id,
      product_id,
      product_name,
      change_type,
      quantity,
      note
    )
    values (
      new.supplier_id,
      new.id,
      new.name,
      'Opening',
      new.stock,
      'Opening stock entered when the product was created'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists supplier_product_opening_stock on public.supplier_products;
create trigger supplier_product_opening_stock
after insert on public.supplier_products
for each row
execute function private.manfix_record_opening_stock();

create or replace function private.manfix_process_supplier_sale()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  fee_percent numeric(5,2);
  fee_amount numeric(12,2);
  net_amount numeric(12,2);
  supplier_display_name text;
begin
  if old.status = 'Delivered' and new.status <> 'Delivered' then
    raise exception 'Delivered orders cannot be moved to another status';
  end if;

  if old.status = 'Cancelled' and new.status <> 'Cancelled' then
    raise exception 'Cancelled orders cannot be reopened';
  end if;

  if new.status <> 'Delivered' or old.status = 'Delivered' then
    new.updated_at := now();
    return new;
  end if;

  select supplier_commission_percent
  into fee_percent
  from public.platform_settings
  where id = 'platform';

  fee_percent := coalesce(fee_percent, 20);
  fee_amount := round(new.amount * fee_percent / 100, 2);
  net_amount := new.amount - fee_amount;

  select coalesce(sp.company_name, p.full_name, p.email, 'Supplier')
  into supplier_display_name
  from public.profiles p
  left join public.supplier_profiles sp on sp.supplier_id = p.id
  where p.id = new.supplier_id;

  supplier_display_name := coalesce(supplier_display_name, 'Supplier');

  if new.product_id is not null then
    update public.supplier_products
    set stock = stock - new.quantity,
        updated_at = now()
    where id = new.product_id
      and supplier_id = new.supplier_id
      and stock >= new.quantity;

    if not found then
      raise exception 'Not enough stock to deliver order %', new.id;
    end if;

    insert into public.supplier_stock_history (
      supplier_id,
      product_id,
      order_id,
      product_name,
      change_type,
      quantity,
      note
    )
    values (
      new.supplier_id,
      new.product_id,
      new.id,
      new.product_name,
      'Sale',
      -new.quantity,
      'Stock deducted automatically when the order was delivered'
    )
    on conflict (order_id) where order_id is not null and change_type = 'Sale'
    do nothing;
  end if;

  new.commission_rate := fee_percent;
  new.commission_amount := fee_amount;
  new.supplier_net_amount := net_amount;
  new.stock_deducted_at := case when new.product_id is null then null else now() end;
  new.settled_at := now();
  new.updated_at := now();

  insert into public.supplier_commissions (
    supplier_id,
    supplier_name,
    order_id,
    invoice_number,
    gross_amount,
    commission_rate,
    commission_amount,
    supplier_net_amount,
    status,
    settled_at
  )
  values (
    new.supplier_id,
    supplier_display_name,
    new.id,
    new.invoice_number,
    new.amount,
    fee_percent,
    fee_amount,
    net_amount,
    'Settled',
    now()
  )
  on conflict (order_id) do nothing;

  insert into public.supplier_wallets (
    supplier_id,
    available_balance,
    pending_balance,
    currency,
    updated_at
  )
  values (new.supplier_id, net_amount, 0, 'MYR', now())
  on conflict (supplier_id) do update
  set available_balance = public.supplier_wallets.available_balance + excluded.available_balance,
      updated_at = now();

  insert into public.supplier_invoices (
    supplier_id,
    order_id,
    invoice_number,
    parts_subtotal,
    commission_rate,
    commission_amount,
    supplier_net_amount,
    total,
    paid_amount,
    status,
    issued_at
  )
  values (
    new.supplier_id,
    new.id,
    new.invoice_number,
    new.amount,
    fee_percent,
    fee_amount,
    net_amount,
    new.amount,
    new.amount,
    'Paid',
    now()
  )
  on conflict (order_id) do nothing;

  insert into public.platform_payments (
    order_id,
    invoice_number,
    supplier_id,
    supplier_name,
    payer_name,
    payee_name,
    amount,
    commission_rate,
    commission_amount,
    supplier_net_amount,
    status,
    method,
    created_at,
    updated_at
  )
  values (
    new.id,
    new.invoice_number,
    new.supplier_id,
    supplier_display_name,
    new.customer,
    supplier_display_name,
    new.amount,
    fee_percent,
    fee_amount,
    net_amount,
    'Paid',
    'ManFix settlement',
    now(),
    now()
  )
  on conflict (order_id) do nothing;

  return new;
end;
$$;

drop trigger if exists supplier_order_sale_settlement on public.supplier_orders;
create trigger supplier_order_sale_settlement
before update of status on public.supplier_orders
for each row
execute function private.manfix_process_supplier_sale();

create or replace function public.manhub_supplier_adjust_stock(
  target_product_id uuid,
  movement_type text,
  movement_quantity integer,
  movement_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_supplier uuid := auth.uid();
  current_product public.supplier_products%rowtype;
  next_stock integer;
begin
  if current_supplier is null or not private.manfix_has_approved_role('supplier') then
    raise exception 'Approved supplier account required';
  end if;

  if movement_type not in ('Incoming', 'Adjustment') then
    raise exception 'Sales are recorded automatically when an order is delivered';
  end if;

  if movement_quantity = 0 then
    raise exception 'Stock movement quantity cannot be zero';
  end if;

  if movement_type = 'Incoming' and movement_quantity < 1 then
    raise exception 'Added stock must be greater than zero';
  end if;

  select *
  into current_product
  from public.supplier_products
  where id = target_product_id
    and supplier_id = current_supplier
  for update;

  if not found then
    raise exception 'Product not found';
  end if;

  next_stock := current_product.stock + movement_quantity;
  if next_stock < 0 then
    raise exception 'Stock cannot become negative';
  end if;

  update public.supplier_products
  set stock = next_stock,
      updated_at = now()
  where id = target_product_id;

  insert into public.supplier_stock_history (
    supplier_id,
    product_id,
    product_name,
    change_type,
    quantity,
    note
  )
  values (
    current_supplier,
    target_product_id,
    current_product.name,
    movement_type,
    movement_quantity,
    nullif(trim(movement_note), '')
  );
end;
$$;

create or replace function public.manhub_supplier_update_order_status(
  target_order_id text,
  next_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_supplier uuid := auth.uid();
  current_status text;
begin
  if current_supplier is null or not private.manfix_has_approved_role('supplier') then
    raise exception 'Approved supplier account required';
  end if;

  if next_status not in ('Confirmed', 'Dispatched', 'Delivered', 'Cancelled') then
    raise exception 'Unsupported order status';
  end if;

  select status
  into current_status
  from public.supplier_orders
  where id = target_order_id
    and supplier_id = current_supplier
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if not (
    (current_status = 'New' and next_status in ('Confirmed', 'Cancelled'))
    or (current_status = 'Confirmed' and next_status in ('Dispatched', 'Cancelled'))
    or (current_status = 'Dispatched' and next_status in ('Delivered', 'Cancelled'))
  ) then
    raise exception 'Order cannot move from % to %', current_status, next_status;
  end if;

  update public.supplier_orders
  set status = next_status
  where id = target_order_id
    and supplier_id = current_supplier;
end;
$$;

create or replace function public.manhub_supplier_submit_withdrawal(
  requested_amount numeric,
  requested_bank text,
  requested_account_number text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_supplier uuid := auth.uid();
  wallet_available numeric(12,2);
  withdrawal_id uuid;
begin
  if current_supplier is null or not private.manfix_has_approved_role('supplier') then
    raise exception 'Approved supplier account required';
  end if;

  if requested_amount is null or requested_amount <= 0 then
    raise exception 'Withdrawal amount must be greater than zero';
  end if;

  if nullif(trim(requested_bank), '') is null or nullif(trim(requested_account_number), '') is null then
    raise exception 'Bank and account number are required';
  end if;

  insert into public.supplier_wallets (supplier_id)
  values (current_supplier)
  on conflict (supplier_id) do nothing;

  select available_balance
  into wallet_available
  from public.supplier_wallets
  where supplier_id = current_supplier
  for update;

  if wallet_available < requested_amount then
    raise exception 'Withdrawal amount exceeds available balance';
  end if;

  insert into public.supplier_withdrawals (
    supplier_id,
    amount,
    bank,
    account_number,
    status
  )
  values (
    current_supplier,
    requested_amount,
    trim(requested_bank),
    trim(requested_account_number),
    'Pending'
  )
  returning id into withdrawal_id;

  update public.supplier_wallets
  set available_balance = available_balance - requested_amount,
      pending_balance = pending_balance + requested_amount,
      updated_at = now()
  where supplier_id = current_supplier;

  return withdrawal_id;
end;
$$;

revoke all on function public.manhub_supplier_adjust_stock(uuid, text, integer, text) from public;
revoke all on function public.manhub_supplier_adjust_stock(uuid, text, integer, text) from anon;
grant execute on function public.manhub_supplier_adjust_stock(uuid, text, integer, text) to authenticated;

revoke all on function public.manhub_supplier_update_order_status(text, text) from public;
revoke all on function public.manhub_supplier_update_order_status(text, text) from anon;
grant execute on function public.manhub_supplier_update_order_status(text, text) to authenticated;

revoke all on function public.manhub_supplier_submit_withdrawal(numeric, text, text) from public;
revoke all on function public.manhub_supplier_submit_withdrawal(numeric, text, text) from anon;
grant execute on function public.manhub_supplier_submit_withdrawal(numeric, text, text) to authenticated;

alter table public.platform_settings enable row level security;
alter table public.supplier_profiles enable row level security;
alter table public.product_categories enable row level security;
alter table public.supplier_products enable row level security;
alter table public.supplier_orders enable row level security;
alter table public.supplier_stock_history enable row level security;
alter table public.supplier_commissions enable row level security;
alter table public.supplier_wallets enable row level security;
alter table public.supplier_withdrawals enable row level security;
alter table public.supplier_invoices enable row level security;
alter table public.platform_payments enable row level security;

drop policy if exists "Authenticated users read platform commission" on public.platform_settings;
create policy "Authenticated users read platform commission"
on public.platform_settings for select to authenticated
using (true);

drop policy if exists "Admins manage platform commission" on public.platform_settings;
create policy "Admins manage platform commission"
on public.platform_settings for all to authenticated
using (private.manfix_has_approved_role('admin'))
with check (private.manfix_has_approved_role('admin'));

drop policy if exists "Suppliers manage own profile" on public.supplier_profiles;
create policy "Suppliers manage own profile"
on public.supplier_profiles for all to authenticated
using (
  (supplier_id = (select auth.uid()) and private.manfix_has_approved_role('supplier'))
  or private.manfix_has_approved_role('admin')
)
with check (
  (supplier_id = (select auth.uid()) and private.manfix_has_approved_role('supplier'))
  or private.manfix_has_approved_role('admin')
);

drop policy if exists "Authenticated users read product categories" on public.product_categories;
create policy "Authenticated users read product categories"
on public.product_categories for select to authenticated
using (true);

drop policy if exists "Admins manage product categories" on public.product_categories;
create policy "Admins manage product categories"
on public.product_categories for all to authenticated
using (private.manfix_has_approved_role('admin'))
with check (private.manfix_has_approved_role('admin'));

drop policy if exists "Suppliers manage own products" on public.supplier_products;
create policy "Suppliers manage own products"
on public.supplier_products for all to authenticated
using (
  (supplier_id = (select auth.uid()) and private.manfix_has_approved_role('supplier'))
  or private.manfix_has_approved_role('admin')
)
with check (
  (supplier_id = (select auth.uid()) and private.manfix_has_approved_role('supplier'))
  or private.manfix_has_approved_role('admin')
);

drop policy if exists "Suppliers read own orders" on public.supplier_orders;
create policy "Suppliers read own orders"
on public.supplier_orders for select to authenticated
using (
  (supplier_id = (select auth.uid()) and private.manfix_has_approved_role('supplier'))
  or private.manfix_has_approved_role('admin')
);

drop policy if exists "Admins manage supplier orders" on public.supplier_orders;
create policy "Admins manage supplier orders"
on public.supplier_orders for all to authenticated
using (private.manfix_has_approved_role('admin'))
with check (private.manfix_has_approved_role('admin'));

drop policy if exists "Suppliers read own stock history" on public.supplier_stock_history;
create policy "Suppliers read own stock history"
on public.supplier_stock_history for select to authenticated
using (
  (supplier_id = (select auth.uid()) and private.manfix_has_approved_role('supplier'))
  or private.manfix_has_approved_role('admin')
);

drop policy if exists "Suppliers read own commissions" on public.supplier_commissions;
create policy "Suppliers read own commissions"
on public.supplier_commissions for select to authenticated
using (
  (supplier_id = (select auth.uid()) and private.manfix_has_approved_role('supplier'))
  or private.manfix_has_approved_role('admin')
);

drop policy if exists "Suppliers read own wallet" on public.supplier_wallets;
create policy "Suppliers read own wallet"
on public.supplier_wallets for select to authenticated
using (
  (supplier_id = (select auth.uid()) and private.manfix_has_approved_role('supplier'))
  or private.manfix_has_approved_role('admin')
);

drop policy if exists "Suppliers read own withdrawals" on public.supplier_withdrawals;
create policy "Suppliers read own withdrawals"
on public.supplier_withdrawals for select to authenticated
using (
  (supplier_id = (select auth.uid()) and private.manfix_has_approved_role('supplier'))
  or private.manfix_has_approved_role('admin')
);

drop policy if exists "Admins manage supplier withdrawals" on public.supplier_withdrawals;
create policy "Admins manage supplier withdrawals"
on public.supplier_withdrawals for all to authenticated
using (private.manfix_has_approved_role('admin'))
with check (private.manfix_has_approved_role('admin'));

drop policy if exists "Suppliers read own invoices" on public.supplier_invoices;
create policy "Suppliers read own invoices"
on public.supplier_invoices for select to authenticated
using (
  (supplier_id = (select auth.uid()) and private.manfix_has_approved_role('supplier'))
  or private.manfix_has_approved_role('admin')
);

drop policy if exists "Admins manage platform payments" on public.platform_payments;
create policy "Admins manage platform payments"
on public.platform_payments for all to authenticated
using (private.manfix_has_approved_role('admin'))
with check (private.manfix_has_approved_role('admin'));

grant select on public.platform_settings to authenticated;
grant select, insert, update, delete on public.supplier_profiles to authenticated;
grant select, insert, update, delete on public.product_categories to authenticated;
grant select, insert, update, delete on public.supplier_products to authenticated;
grant select, insert, update, delete on public.supplier_orders to authenticated;
grant select on public.supplier_stock_history to authenticated;
grant select on public.supplier_commissions to authenticated;
grant select on public.supplier_wallets to authenticated;
grant select, update on public.supplier_withdrawals to authenticated;
grant select, update on public.supplier_invoices to authenticated;
grant select, insert, update, delete on public.platform_payments to authenticated;

insert into storage.buckets (id, name, public)
values ('supplier-product-images', 'supplier-product-images', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Suppliers upload own product images" on storage.objects;
create policy "Suppliers upload own product images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'supplier-product-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and private.manfix_has_approved_role('supplier')
);

drop policy if exists "Suppliers update own product images" on storage.objects;
create policy "Suppliers update own product images"
on storage.objects for update to authenticated
using (
  bucket_id = 'supplier-product-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and private.manfix_has_approved_role('supplier')
)
with check (
  bucket_id = 'supplier-product-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and private.manfix_has_approved_role('supplier')
);

drop policy if exists "Suppliers delete own product images" on storage.objects;
create policy "Suppliers delete own product images"
on storage.objects for delete to authenticated
using (
  bucket_id = 'supplier-product-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and private.manfix_has_approved_role('supplier')
);
