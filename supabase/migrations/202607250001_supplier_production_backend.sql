create extension if not exists pgcrypto;

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

alter table public.supplier_products add column if not exists sku text;
alter table public.supplier_products add column if not exists description text;
alter table public.supplier_products add column if not exists low_stock_threshold integer not null default 5 check (low_stock_threshold >= 0);

create unique index if not exists supplier_products_supplier_sku_idx
on public.supplier_products(supplier_id, sku)
where sku is not null and sku <> '';

create table if not exists public.supplier_wallets (
  supplier_id uuid primary key,
  available_balance numeric(12,2) not null default 0 check (available_balance >= 0),
  pending_balance numeric(12,2) not null default 0 check (pending_balance >= 0),
  currency text not null default 'MYR',
  updated_at timestamptz not null default now()
);

create table if not exists public.supplier_invoices (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null,
  order_id text references public.supplier_orders(id) on delete set null,
  invoice_number text not null,
  parts_subtotal numeric(12,2) not null default 0,
  commission_amount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  paid_amount numeric(12,2) not null default 0,
  status text not null default 'Pending' check (status in ('Pending', 'Paid', 'Refunded', 'Escrow')),
  pdf_url text,
  issued_at timestamptz not null default now(),
  unique (supplier_id, invoice_number)
);

create index if not exists supplier_invoices_supplier_idx on public.supplier_invoices(supplier_id);
create index if not exists supplier_invoices_order_idx on public.supplier_invoices(order_id);

alter table public.product_categories enable row level security;
alter table public.supplier_wallets enable row level security;
alter table public.supplier_invoices enable row level security;

drop policy if exists "Authenticated users read product categories" on public.product_categories;
create policy "Authenticated users read product categories"
on public.product_categories for select to authenticated
using (true);

drop policy if exists "Admins manage product categories" on public.product_categories;
create policy "Admins manage product categories"
on public.product_categories for all to authenticated
using (public.manhub_app_role() = 'admin')
with check (public.manhub_app_role() = 'admin');

drop policy if exists "Suppliers read own wallet" on public.supplier_wallets;
create policy "Suppliers read own wallet"
on public.supplier_wallets for select to authenticated
using ((select auth.uid()) = supplier_id or public.manhub_app_role() = 'admin');

drop policy if exists "Admins manage supplier wallets" on public.supplier_wallets;
create policy "Admins manage supplier wallets"
on public.supplier_wallets for all to authenticated
using (public.manhub_app_role() = 'admin')
with check (public.manhub_app_role() = 'admin');

drop policy if exists "Suppliers read own invoices" on public.supplier_invoices;
create policy "Suppliers read own invoices"
on public.supplier_invoices for select to authenticated
using ((select auth.uid()) = supplier_id or public.manhub_app_role() = 'admin');

drop policy if exists "Admins manage supplier invoices" on public.supplier_invoices;
create policy "Admins manage supplier invoices"
on public.supplier_invoices for all to authenticated
using (public.manhub_app_role() = 'admin')
with check (public.manhub_app_role() = 'admin');

drop policy if exists "Suppliers read own supplied claims" on public.warranty_claims;
create policy "Suppliers read own supplied claims"
on public.warranty_claims for select to authenticated
using (
  supplier_id = (select auth.uid())::text
  or exists (
    select 1
    from public.warranties
    where warranties.id = warranty_claims.warranty_id
      and warranties.supplier_id = (select auth.uid())::text
  )
  or public.manhub_app_role() = 'admin'
);

create or replace function public.manhub_supplier_submit_withdrawal(
  requested_amount numeric,
  requested_bank text,
  requested_account_number text
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_supplier uuid := auth.uid();
  wallet_available numeric(12,2);
  withdrawal_id uuid;
begin
  if current_supplier is null then
    raise exception 'Authentication required';
  end if;

  if requested_amount is null or requested_amount <= 0 then
    raise exception 'Withdrawal amount must be greater than zero';
  end if;

  insert into public.supplier_wallets (supplier_id)
  values (current_supplier)
  on conflict (supplier_id) do nothing;

  select available_balance into wallet_available
  from public.supplier_wallets
  where supplier_id = current_supplier
  for update;

  if wallet_available < requested_amount then
    raise exception 'Withdrawal amount exceeds available balance';
  end if;

  insert into public.supplier_withdrawals (supplier_id, amount, bank, account_number, status)
  values (current_supplier, requested_amount, requested_bank, requested_account_number, 'Pending')
  returning id into withdrawal_id;

  update public.supplier_wallets
  set available_balance = available_balance - requested_amount,
      pending_balance = pending_balance + requested_amount,
      updated_at = now()
  where supplier_id = current_supplier;

  return withdrawal_id;
end;
$$;

create or replace function public.manhub_supplier_update_order_status(
  target_order_id text,
  next_status text
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_supplier uuid := auth.uid();
begin
  if next_status not in ('New', 'Confirmed', 'Dispatched', 'Delivered', 'Cancelled') then
    raise exception 'Unsupported order status';
  end if;

  update public.supplier_orders
  set status = next_status
  where id = target_order_id
    and supplier_id = current_supplier;

  if not found then
    raise exception 'Order not found';
  end if;
end;
$$;

create or replace function public.manhub_supplier_adjust_stock(
  target_product_id uuid,
  movement_type text,
  movement_quantity integer,
  movement_note text default null
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_supplier uuid := auth.uid();
  current_product record;
  next_stock integer;
begin
  if movement_type not in ('Sale', 'Incoming', 'Adjustment') then
    raise exception 'Unsupported stock movement';
  end if;

  if movement_quantity = 0 then
    raise exception 'Stock movement quantity cannot be zero';
  end if;

  select * into current_product
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
  where id = target_product_id
    and supplier_id = current_supplier;

  insert into public.supplier_stock_history (supplier_id, product_id, product_name, change_type, quantity, note)
  values (current_supplier, target_product_id, current_product.name, movement_type, movement_quantity, movement_note);
end;
$$;

create or replace function public.manhub_supplier_review_warranty_claim(
  target_claim_id text,
  next_status text
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_supplier uuid := auth.uid();
begin
  if next_status not in ('Approved', 'Rejected', 'Inspection Requested') then
    raise exception 'Unsupported warranty claim status';
  end if;

  update public.warranty_claims
  set status = next_status,
      reviewed_at = now()
  where id = target_claim_id
    and (
      supplier_id = current_supplier::text
      or exists (
        select 1
        from public.warranties
        where warranties.id = warranty_claims.warranty_id
          and warranties.supplier_id = current_supplier::text
      )
    );

  if not found then
    raise exception 'Warranty claim not found';
  end if;
end;
$$;

insert into storage.buckets (id, name, public)
values ('supplier-product-images', 'supplier-product-images', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Suppliers upload own product images" on storage.objects;
create policy "Suppliers upload own product images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'supplier-product-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Suppliers update own product images" on storage.objects;
create policy "Suppliers update own product images"
on storage.objects for update to authenticated
using (
  bucket_id = 'supplier-product-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'supplier-product-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Suppliers delete own product images" on storage.objects;
create policy "Suppliers delete own product images"
on storage.objects for delete to authenticated
using (
  bucket_id = 'supplier-product-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Authenticated users read product images" on storage.objects;
create policy "Authenticated users read product images"
on storage.objects for select to authenticated
using (bucket_id = 'supplier-product-images');
