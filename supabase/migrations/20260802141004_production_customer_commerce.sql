create extension if not exists pgcrypto;

alter table public.profiles
  add column if not exists phone text,
  add column if not exists avatar_url text;

alter table public.cars
  add column if not exists mileage integer check (mileage is null or mileage >= 0),
  add column if not exists vin text,
  add column if not exists engine text;

create unique index if not exists cars_user_plate_unique
  on public.cars (user_id, lower(license_plate))
  where license_plate is not null and btrim(license_plate) <> '';

create table if not exists public.shopping_carts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'Active'
    check (status in ('Active', 'Checked Out', 'Abandoned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists shopping_carts_one_active_per_customer
  on public.shopping_carts (customer_id)
  where status = 'Active';

create table if not exists public.shopping_cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.shopping_carts(id) on delete cascade,
  product_id uuid not null references public.supplier_products(id) on delete cascade,
  quantity integer not null default 1 check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cart_id, product_id)
);

create table if not exists public.customer_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_id uuid not null references auth.users(id) on delete restrict,
  subtotal numeric(12,2) not null check (subtotal >= 0),
  total numeric(12,2) not null check (total >= 0),
  currency text not null default 'MYR',
  status text not null default 'Pending Supplier Acceptance'
    check (status in (
      'Pending Supplier Acceptance', 'Processing', 'Partially Rejected',
      'Dispatched', 'Completed', 'Cancelled'
    )),
  payment_status text not null default 'Pending'
    check (payment_status in ('Pending', 'Paid', 'Cancelled', 'Refunded')),
  checked_out_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.customer_orders(id) on delete cascade,
  product_id uuid references public.supplier_products(id) on delete set null,
  supplier_id uuid not null references auth.users(id) on delete restrict,
  product_name text not null,
  product_brand text not null,
  sku text,
  unit_price numeric(12,2) not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  line_total numeric(12,2) not null check (line_total >= 0),
  status text not null default 'New'
    check (status in ('New', 'Accepted', 'Rejected', 'Preparing', 'Dispatched', 'Delivered', 'Cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_payments (
  id uuid primary key default gen_random_uuid(),
  payment_number text not null unique,
  order_id uuid not null references public.customer_orders(id) on delete restrict,
  customer_id uuid not null references auth.users(id) on delete restrict,
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'MYR',
  method text not null,
  status text not null default 'Pending'
    check (status in ('Pending', 'Paid', 'Cancelled', 'Refunded')),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  title text not null,
  message text not null,
  kind text not null default 'system',
  entity_type text,
  entity_id text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists shopping_cart_items_cart_idx on public.shopping_cart_items(cart_id);
create index if not exists customer_orders_customer_created_idx on public.customer_orders(customer_id, created_at desc);
create index if not exists customer_order_items_order_idx on public.customer_order_items(order_id);
create index if not exists customer_order_items_supplier_status_idx on public.customer_order_items(supplier_id, status);
create index if not exists customer_payments_customer_created_idx on public.customer_payments(customer_id, created_at desc);
create index if not exists notifications_recipient_created_idx on public.notifications(recipient_id, created_at desc);
create index if not exists notifications_recipient_unread_idx on public.notifications(recipient_id) where read_at is null;

alter table public.supplier_orders
  add column if not exists customer_id uuid references auth.users(id) on delete set null,
  add column if not exists customer_order_id uuid references public.customer_orders(id) on delete set null,
  add column if not exists order_item_id uuid references public.customer_order_items(id) on delete set null,
  add column if not exists stock_restored_at timestamptz;

alter table public.supplier_orders drop constraint if exists supplier_orders_status_check;
alter table public.supplier_orders
  add constraint supplier_orders_status_check
  check (status in ('New', 'Accepted', 'Rejected', 'Preparing', 'Dispatched', 'Delivered', 'Cancelled'));

alter table public.supplier_stock_history drop constraint if exists supplier_stock_history_change_type_check;
alter table public.supplier_stock_history
  add constraint supplier_stock_history_change_type_check
  check (change_type in ('Opening', 'Sale', 'Restock', 'Incoming', 'Adjustment'));

create sequence if not exists private.manfix_order_number_seq start 1000;

create or replace function public.manfix_protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null
    and not private.manfix_has_approved_role('admin')
    and (
      new.role is distinct from old.role
      or new.status is distinct from old.status
      or new.approved_by is distinct from old.approved_by
      or new.approved_at is distinct from old.approved_at
      or new.email is distinct from old.email
    )
  then
    raise exception 'Profile access fields can only be changed by an administrator.';
  end if;
  return new;
end;
$$;

revoke all on function public.manfix_protect_profile_role() from public, anon, authenticated;

drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile"
on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-avatars',
  'profile-avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users upload own avatar" on storage.objects;
create policy "Users upload own avatar"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users update own avatar" on storage.objects;
create policy "Users update own avatar"
on storage.objects for update to authenticated
using (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users delete own avatar" on storage.objects;
create policy "Users delete own avatar"
on storage.objects for delete to authenticated
using (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

alter table public.shopping_carts enable row level security;
alter table public.shopping_cart_items enable row level security;
alter table public.customer_orders enable row level security;
alter table public.customer_order_items enable row level security;
alter table public.customer_payments enable row level security;
alter table public.notifications enable row level security;

create policy "Customers manage own carts"
on public.shopping_carts for all to authenticated
using ((select auth.uid()) = customer_id)
with check ((select auth.uid()) = customer_id);

create policy "Customers manage own cart items"
on public.shopping_cart_items for all to authenticated
using (exists (
  select 1 from public.shopping_carts cart
  where cart.id = shopping_cart_items.cart_id
    and cart.customer_id = (select auth.uid())
))
with check (exists (
  select 1 from public.shopping_carts cart
  where cart.id = shopping_cart_items.cart_id
    and cart.customer_id = (select auth.uid())
));

create policy "Customers view own orders"
on public.customer_orders for select to authenticated
using ((select auth.uid()) = customer_id or private.manfix_has_approved_role('admin'));

create policy "Admins manage customer orders"
on public.customer_orders for all to authenticated
using (private.manfix_has_approved_role('admin'))
with check (private.manfix_has_approved_role('admin'));

create policy "Customers and suppliers view order items"
on public.customer_order_items for select to authenticated
using (
  supplier_id = (select auth.uid())
  or exists (
    select 1 from public.customer_orders customer_order
    where customer_order.id = customer_order_items.order_id
      and customer_order.customer_id = (select auth.uid())
  )
  or private.manfix_has_approved_role('admin')
);

create policy "Admins manage customer order items"
on public.customer_order_items for all to authenticated
using (private.manfix_has_approved_role('admin'))
with check (private.manfix_has_approved_role('admin'));

create policy "Customers view own payments"
on public.customer_payments for select to authenticated
using ((select auth.uid()) = customer_id or private.manfix_has_approved_role('admin'));

create policy "Admins manage customer payments"
on public.customer_payments for all to authenticated
using (private.manfix_has_approved_role('admin'))
with check (private.manfix_has_approved_role('admin'));

create policy "Users view own notifications"
on public.notifications for select to authenticated
using ((select auth.uid()) = recipient_id or private.manfix_has_approved_role('admin'));

create policy "Users update own notifications"
on public.notifications for update to authenticated
using ((select auth.uid()) = recipient_id)
with check ((select auth.uid()) = recipient_id);

create policy "Admins manage notifications"
on public.notifications for all to authenticated
using (private.manfix_has_approved_role('admin'))
with check (private.manfix_has_approved_role('admin'));

drop policy if exists "Authenticated users view active products" on public.supplier_products;
create policy "Authenticated users view active products"
on public.supplier_products for select to authenticated
using (active);

drop policy if exists "Customers view supplier order lines" on public.supplier_orders;
create policy "Customers view supplier order lines"
on public.supplier_orders for select to authenticated
using (customer_id = (select auth.uid()));

revoke all on public.shopping_carts, public.shopping_cart_items, public.customer_orders,
  public.customer_order_items, public.customer_payments, public.notifications from anon;
grant select, insert, update, delete on public.shopping_carts, public.shopping_cart_items to authenticated;
grant select on public.customer_orders, public.customer_order_items, public.customer_payments to authenticated;
grant select, update on public.notifications to authenticated;
grant select on public.supplier_products, public.platform_workshops, public.service_catalog to authenticated;
grant select, insert, update, delete on public.cars to authenticated;
grant select, update on public.profiles to authenticated;

create or replace function private.manfix_notify(
  target_user uuid,
  notification_title text,
  notification_message text,
  notification_kind text,
  target_type text default null,
  target_id text default null,
  source_user uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if target_user is null then
    return;
  end if;
  insert into public.notifications (
    recipient_id, actor_id, title, message, kind, entity_type, entity_id
  ) values (
    target_user, source_user, notification_title, notification_message,
    notification_kind, target_type, target_id
  );
end;
$$;

revoke all on function private.manfix_notify(uuid, text, text, text, text, text, uuid)
  from public, anon, authenticated;

create or replace function public.manfix_add_cart_item(target_product_id uuid, requested_quantity integer default 1)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_customer uuid := auth.uid();
  target_cart uuid;
  available_stock integer;
  saved_item uuid;
begin
  if current_customer is null or not private.manfix_has_approved_role('customer') then
    raise exception 'An active customer account is required.';
  end if;
  if requested_quantity <= 0 then
    raise exception 'Quantity must be greater than zero.';
  end if;

  select stock into available_stock
  from public.supplier_products
  where id = target_product_id and active
  for update;
  if not found then raise exception 'This product is not available.'; end if;

  select id into target_cart
  from public.shopping_carts
  where customer_id = current_customer and status = 'Active'
  for update;

  if target_cart is null then
    insert into public.shopping_carts (customer_id)
    values (current_customer)
    returning id into target_cart;
  end if;

  insert into public.shopping_cart_items (cart_id, product_id, quantity)
  values (target_cart, target_product_id, requested_quantity)
  on conflict (cart_id, product_id) do update
  set quantity = public.shopping_cart_items.quantity + excluded.quantity,
      updated_at = now()
  returning id into saved_item;

  if (select quantity from public.shopping_cart_items where id = saved_item) > available_stock then
    raise exception 'Only % unit(s) are currently available.', available_stock;
  end if;

  return saved_item;
end;
$$;

create or replace function public.manfix_set_cart_quantity(target_item_id uuid, requested_quantity integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_customer uuid := auth.uid();
  available_stock integer;
begin
  if current_customer is null then raise exception 'Authentication required.'; end if;
  if requested_quantity <= 0 then
    delete from public.shopping_cart_items item
    using public.shopping_carts cart
    where item.id = target_item_id
      and cart.id = item.cart_id
      and cart.customer_id = current_customer
      and cart.status = 'Active';
    if not found then raise exception 'Cart item not found.'; end if;
    return;
  end if;

  select product.stock into available_stock
  from public.shopping_cart_items item
  join public.shopping_carts cart on cart.id = item.cart_id
  join public.supplier_products product on product.id = item.product_id
  where item.id = target_item_id
    and cart.customer_id = current_customer
    and cart.status = 'Active'
    and product.active
  for update of product;
  if not found then raise exception 'Cart item is no longer available.'; end if;
  if requested_quantity > available_stock then
    raise exception 'Only % unit(s) are currently available.', available_stock;
  end if;

  update public.shopping_cart_items
  set quantity = requested_quantity, updated_at = now()
  where id = target_item_id;
end;
$$;

create or replace function private.manfix_recompute_customer_order(target_order uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_order_status text;
begin
  select case
    when bool_and(status in ('Rejected', 'Cancelled')) then 'Cancelled'
    when bool_and(status = 'Delivered') then 'Completed'
    when bool_or(status = 'Dispatched') then 'Dispatched'
    when bool_or(status in ('Accepted', 'Preparing', 'Delivered'))
      and bool_or(status in ('Rejected', 'Cancelled')) then 'Partially Rejected'
    when bool_or(status in ('Accepted', 'Preparing', 'Delivered')) then 'Processing'
    else 'Pending Supplier Acceptance'
  end
  into next_order_status
  from public.customer_order_items
  where order_id = target_order;

  update public.customer_orders
  set status = coalesce(next_order_status, status), updated_at = now()
  where id = target_order;
end;
$$;

revoke all on function private.manfix_recompute_customer_order(uuid) from public, anon, authenticated;

create or replace function public.manfix_checkout_cart(payment_method text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_customer uuid := auth.uid();
  active_cart uuid;
  created_order uuid;
  created_item uuid;
  order_sequence bigint;
  order_code text;
  invoice_code text;
  customer_label text;
  order_total numeric(12,2) := 0;
  item_count integer := 0;
  item_number integer := 0;
  line record;
  admin_user record;
begin
  if current_customer is null or not private.manfix_has_approved_role('customer') then
    raise exception 'An active customer account is required.';
  end if;
  if nullif(btrim(payment_method), '') is null then
    raise exception 'Select a payment method.';
  end if;

  select id into active_cart
  from public.shopping_carts
  where customer_id = current_customer and status = 'Active'
  for update;
  if active_cart is null then raise exception 'Your cart is empty.'; end if;

  for line in
    select item.id as cart_item_id, item.quantity, product.*
    from public.shopping_cart_items item
    join public.supplier_products product on product.id = item.product_id
    where item.cart_id = active_cart
    order by item.created_at
    for update of product
  loop
    if not line.active then raise exception '% is no longer available.', line.name; end if;
    if line.stock < line.quantity then
      raise exception 'Only % unit(s) of % remain in stock.', line.stock, line.name;
    end if;
    item_count := item_count + 1;
    order_total := order_total + round(line.selling_price * line.quantity, 2);
  end loop;
  if item_count = 0 then raise exception 'Your cart is empty.'; end if;

  order_sequence := nextval('private.manfix_order_number_seq');
  order_code := 'MF-' || lpad(order_sequence::text, 8, '0');
  invoice_code := 'INV-' || lpad(order_sequence::text, 8, '0');

  select coalesce(nullif(full_name, ''), email, current_customer::text)
  into customer_label from public.profiles where id = current_customer;

  insert into public.customer_orders (
    order_number, customer_id, subtotal, total
  ) values (
    order_code, current_customer, order_total, order_total
  ) returning id into created_order;

  for line in
    select item.quantity, product.*
    from public.shopping_cart_items item
    join public.supplier_products product on product.id = item.product_id
    where item.cart_id = active_cart
    order by item.created_at
  loop
    item_number := item_number + 1;
    insert into public.customer_order_items (
      order_id, product_id, supplier_id, product_name, product_brand,
      sku, unit_price, quantity, line_total
    ) values (
      created_order, line.id, line.supplier_id, line.name, line.brand,
      line.sku, line.selling_price, line.quantity,
      round(line.selling_price * line.quantity, 2)
    ) returning id into created_item;

    update public.supplier_products
    set stock = stock - line.quantity, updated_at = now()
    where id = line.id and stock >= line.quantity;
    if not found then raise exception 'Stock changed while checkout was processing.'; end if;

    insert into public.supplier_orders (
      id, supplier_id, workshop, customer, customer_id, customer_order_id,
      order_item_id, product_id, product_name, quantity, status,
      invoice_number, amount, cost_total, stock_deducted_at
    ) values (
      'SO-' || lpad(order_sequence::text, 8, '0') || '-' || lpad(item_number::text, 2, '0'),
      line.supplier_id, 'Customer online order', customer_label, current_customer,
      created_order, created_item, line.id, line.name, line.quantity, 'New',
      invoice_code || '-' || lpad(item_number::text, 2, '0'),
      round(line.selling_price * line.quantity, 2),
      round(line.cost_price * line.quantity, 2), now()
    );

    insert into public.supplier_stock_history (
      supplier_id, product_id, order_id, product_name, change_type, quantity, note
    ) values (
      line.supplier_id, line.id,
      'SO-' || lpad(order_sequence::text, 8, '0') || '-' || lpad(item_number::text, 2, '0'),
      line.name, 'Sale', -line.quantity, 'Reserved by customer checkout'
    );

    perform private.manfix_notify(
      line.supplier_id, 'New customer order',
      order_code || ' includes ' || line.quantity || ' x ' || line.name || '.',
      'supplier_order', 'supplier_order',
      'SO-' || lpad(order_sequence::text, 8, '0') || '-' || lpad(item_number::text, 2, '0'),
      current_customer
    );
  end loop;

  insert into public.customer_payments (
    payment_number, order_id, customer_id, amount, method
  ) values (
    'PAY-' || lpad(order_sequence::text, 8, '0'), created_order,
    current_customer, order_total, btrim(payment_method)
  );

  update public.shopping_carts set status = 'Checked Out', updated_at = now()
  where id = active_cart;

  perform private.manfix_notify(
    current_customer, 'Order placed',
    order_code || ' was sent to the supplier for acceptance.',
    'customer_order', 'customer_order', created_order::text, null
  );

  for admin_user in
    select distinct user_id from public.user_roles
    where role in ('admin', 'super_admin') and status in ('Active', 'Approved', 'Verified')
  loop
    perform private.manfix_notify(
      admin_user.user_id, 'New platform order', order_code || ' was placed.',
      'admin_order', 'customer_order', created_order::text, current_customer
    );
  end loop;

  return created_order;
end;
$$;

create or replace function public.manhub_supplier_update_order_status(target_order_id text, next_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_supplier uuid := auth.uid();
  current_order public.supplier_orders%rowtype;
begin
  if current_supplier is null or not private.manfix_has_approved_role('supplier') then
    raise exception 'Approved supplier account required.';
  end if;
  if next_status not in ('Accepted', 'Rejected', 'Preparing', 'Dispatched', 'Delivered', 'Cancelled') then
    raise exception 'Unsupported order status.';
  end if;

  select * into current_order from public.supplier_orders
  where id = target_order_id and supplier_id = current_supplier for update;
  if not found then raise exception 'Order not found.'; end if;

  if not (
    (current_order.status = 'New' and next_status in ('Accepted', 'Rejected'))
    or (current_order.status = 'Accepted' and next_status in ('Preparing', 'Rejected'))
    or (current_order.status = 'Preparing' and next_status in ('Dispatched', 'Cancelled'))
    or (current_order.status = 'Dispatched' and next_status in ('Delivered', 'Cancelled'))
  ) then
    raise exception 'Order cannot move from % to %.', current_order.status, next_status;
  end if;

  if next_status in ('Rejected', 'Cancelled')
    and current_order.product_id is not null
    and current_order.stock_deducted_at is not null
    and current_order.stock_restored_at is null
  then
    update public.supplier_products
    set stock = stock + current_order.quantity, updated_at = now()
    where id = current_order.product_id and supplier_id = current_supplier;
    insert into public.supplier_stock_history (
      supplier_id, product_id, order_id, product_name, change_type, quantity, note
    ) values (
      current_supplier, current_order.product_id, current_order.id,
      current_order.product_name, 'Restock', current_order.quantity,
      'Stock restored after supplier order ' || lower(next_status)
    );
  end if;

  update public.supplier_orders
  set status = next_status,
      stock_restored_at = case
        when next_status in ('Rejected', 'Cancelled') and stock_deducted_at is not null
          then coalesce(stock_restored_at, now())
        else stock_restored_at
      end,
      updated_at = now()
  where id = target_order_id and supplier_id = current_supplier;

  if current_order.order_item_id is not null then
    update public.customer_order_items
    set status = next_status, updated_at = now()
    where id = current_order.order_item_id;
  end if;
  if current_order.customer_order_id is not null then
    perform private.manfix_recompute_customer_order(current_order.customer_order_id);
  end if;
  perform private.manfix_notify(
    current_order.customer_id, 'Order status updated',
    current_order.product_name || ' is now ' || next_status || '.',
    'supplier_order', 'supplier_order', current_order.id, current_supplier
  );
end;
$$;

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
    raise exception 'Delivered orders cannot be moved to another status.';
  end if;
  if new.status <> 'Delivered' or old.status = 'Delivered' then
    new.updated_at := now();
    return new;
  end if;

  select supplier_commission_percent into fee_percent
  from public.platform_settings where id = 'platform';
  fee_percent := coalesce(fee_percent, 20);
  fee_amount := round(new.amount * fee_percent / 100, 2);
  net_amount := new.amount - fee_amount;

  select coalesce(sp.company_name, p.full_name, p.email, new.supplier_id::text)
  into supplier_display_name
  from public.profiles p
  left join public.supplier_profiles sp on sp.supplier_id = p.id
  where p.id = new.supplier_id;

  if new.product_id is not null and new.stock_deducted_at is null then
    update public.supplier_products
    set stock = stock - new.quantity, updated_at = now()
    where id = new.product_id and supplier_id = new.supplier_id and stock >= new.quantity;
    if not found then raise exception 'Not enough stock to deliver order %.', new.id; end if;
    insert into public.supplier_stock_history (
      supplier_id, product_id, order_id, product_name, change_type, quantity, note
    ) values (
      new.supplier_id, new.product_id, new.id, new.product_name,
      'Sale', -new.quantity, 'Stock deducted when the order was delivered'
    ) on conflict (order_id) where order_id is not null and change_type = 'Sale' do nothing;
    new.stock_deducted_at := now();
  end if;

  new.commission_rate := fee_percent;
  new.commission_amount := fee_amount;
  new.supplier_net_amount := net_amount;
  new.settled_at := now();
  new.updated_at := now();

  insert into public.supplier_commissions (
    supplier_id, supplier_name, order_id, invoice_number, gross_amount,
    commission_rate, commission_amount, supplier_net_amount, status, settled_at
  ) values (
    new.supplier_id, supplier_display_name, new.id, new.invoice_number, new.amount,
    fee_percent, fee_amount, net_amount, 'Settled', now()
  ) on conflict (order_id) do nothing;

  insert into public.supplier_wallets (
    supplier_id, available_balance, pending_balance, currency, updated_at
  ) values (new.supplier_id, net_amount, 0, 'MYR', now())
  on conflict (supplier_id) do update
  set available_balance = public.supplier_wallets.available_balance + excluded.available_balance,
      updated_at = now();

  insert into public.supplier_invoices (
    supplier_id, order_id, invoice_number, parts_subtotal, commission_rate,
    commission_amount, supplier_net_amount, total, paid_amount, status, issued_at
  ) values (
    new.supplier_id, new.id, new.invoice_number, new.amount, fee_percent,
    fee_amount, net_amount, new.amount, new.amount, 'Paid', now()
  ) on conflict (order_id) do nothing;

  insert into public.platform_payments (
    order_id, invoice_number, supplier_id, supplier_name, payer_name, payee_name,
    amount, commission_rate, commission_amount, supplier_net_amount, status,
    method, created_at, updated_at
  ) values (
    new.id, new.invoice_number, new.supplier_id, supplier_display_name,
    new.customer, supplier_display_name, new.amount, fee_percent, fee_amount,
    net_amount, 'Paid', 'ManFix settlement', now(), now()
  ) on conflict (order_id) do nothing;

  return new;
end;
$$;

create or replace function public.manfix_update_customer_payment(target_payment_id uuid, next_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user uuid := auth.uid();
  target_payment public.customer_payments%rowtype;
  is_admin boolean := private.manfix_has_approved_role('admin');
begin
  if current_user is null then raise exception 'Authentication required.'; end if;
  if next_status not in ('Paid', 'Cancelled', 'Refunded') then
    raise exception 'Unsupported payment status.';
  end if;

  select * into target_payment from public.customer_payments
  where id = target_payment_id for update;
  if not found then raise exception 'Payment not found.'; end if;
  if target_payment.customer_id <> current_user and not is_admin then
    raise exception 'Payment access denied.';
  end if;
  if not is_admin and not (target_payment.status = 'Pending' and next_status = 'Cancelled') then
    raise exception 'Payment confirmation requires an administrator or payment provider.';
  end if;
  if not (
    (target_payment.status = 'Pending' and next_status in ('Paid', 'Cancelled'))
    or (target_payment.status = 'Paid' and next_status = 'Refunded')
  ) then
    raise exception 'Payment cannot move from % to %.', target_payment.status, next_status;
  end if;

  update public.customer_payments
  set status = next_status,
      paid_at = case when next_status = 'Paid' then now() else paid_at end,
      updated_at = now()
  where id = target_payment_id;
  update public.customer_orders
  set payment_status = next_status, updated_at = now()
  where id = target_payment.order_id;
  perform private.manfix_notify(
    target_payment.customer_id, 'Payment status updated',
    target_payment.payment_number || ' is now ' || next_status || '.',
    'payment', 'customer_payment', target_payment.id::text, current_user
  );
end;
$$;

create or replace function public.manfix_mark_notification_read(target_notification_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.notifications
  set read_at = coalesce(read_at, now())
  where id = target_notification_id and recipient_id = (select auth.uid())
$$;

create or replace function public.manfix_assign_repair_technician(target_repair_job_id uuid, target_technician_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_workshop uuid := auth.uid();
  selected_technician public.technicians%rowtype;
  selected_job public.repair_jobs%rowtype;
begin
  if current_workshop is null or not private.manfix_has_approved_role('workshop') then
    raise exception 'Approved workshop access required.';
  end if;
  select * into selected_technician from public.technicians
  where id = target_technician_id and workshop_owner_id = current_workshop;
  if not found then raise exception 'Technician not found for this workshop.'; end if;
  select * into selected_job from public.repair_jobs
  where id = target_repair_job_id and workshop_owner_id = current_workshop for update;
  if not found then raise exception 'Repair job not found.'; end if;

  update public.repair_jobs
  set technician_user_id = selected_technician.user_id,
      technician_name = selected_technician.name,
      updated_at = now()
  where id = target_repair_job_id;
  perform private.manfix_notify(
    selected_technician.user_id, 'Repair job assigned',
    selected_job.vehicle_label || ': ' || selected_job.diagnosis,
    'repair_job', 'repair_job', selected_job.id::text, current_workshop
  );
  perform private.manfix_notify(
    selected_job.customer_id, 'Technician assigned',
    selected_technician.name || ' was assigned to your repair.',
    'repair_job', 'repair_job', selected_job.id::text, current_workshop
  );
end;
$$;

grant execute on function public.manfix_add_cart_item(uuid, integer) to authenticated;
grant execute on function public.manfix_set_cart_quantity(uuid, integer) to authenticated;
grant execute on function public.manfix_checkout_cart(text) to authenticated;
grant execute on function public.manhub_supplier_update_order_status(text, text) to authenticated;
grant execute on function public.manfix_update_customer_payment(uuid, text) to authenticated;
grant execute on function public.manfix_mark_notification_read(uuid) to authenticated;
grant execute on function public.manfix_assign_repair_technician(uuid, uuid) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then alter publication supabase_realtime add table public.notifications; end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'customer_orders'
  ) then alter publication supabase_realtime add table public.customer_orders; end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'customer_order_items'
  ) then alter publication supabase_realtime add table public.customer_order_items; end if;
end;
$$;
