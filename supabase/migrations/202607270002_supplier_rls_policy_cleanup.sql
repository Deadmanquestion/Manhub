create index if not exists profiles_approved_by_idx on public.profiles(approved_by);

drop policy if exists "Admins manage platform commission" on public.platform_settings;

create policy "Admins insert platform commission"
on public.platform_settings for insert to authenticated
with check (private.manfix_has_approved_role('admin'));

create policy "Admins update platform commission"
on public.platform_settings for update to authenticated
using (private.manfix_has_approved_role('admin'))
with check (private.manfix_has_approved_role('admin'));

create policy "Admins delete platform commission"
on public.platform_settings for delete to authenticated
using (private.manfix_has_approved_role('admin'));

grant insert, update, delete on public.platform_settings to authenticated;

drop policy if exists "Admins manage product categories" on public.product_categories;

create policy "Admins insert product categories"
on public.product_categories for insert to authenticated
with check (private.manfix_has_approved_role('admin'));

create policy "Admins update product categories"
on public.product_categories for update to authenticated
using (private.manfix_has_approved_role('admin'))
with check (private.manfix_has_approved_role('admin'));

create policy "Admins delete product categories"
on public.product_categories for delete to authenticated
using (private.manfix_has_approved_role('admin'));

drop policy if exists "Suppliers read own orders" on public.supplier_orders;
drop policy if exists "Admins manage supplier orders" on public.supplier_orders;

create policy "Authorized users read supplier orders"
on public.supplier_orders for select to authenticated
using (
  (supplier_id = (select auth.uid()) and private.manfix_has_approved_role('supplier'))
  or private.manfix_has_approved_role('admin')
);

create policy "Admins insert supplier orders"
on public.supplier_orders for insert to authenticated
with check (private.manfix_has_approved_role('admin'));

create policy "Admins update supplier orders"
on public.supplier_orders for update to authenticated
using (private.manfix_has_approved_role('admin'))
with check (private.manfix_has_approved_role('admin'));

create policy "Admins delete supplier orders"
on public.supplier_orders for delete to authenticated
using (private.manfix_has_approved_role('admin'));

drop policy if exists "Suppliers read own withdrawals" on public.supplier_withdrawals;
drop policy if exists "Admins manage supplier withdrawals" on public.supplier_withdrawals;

create policy "Authorized users read supplier withdrawals"
on public.supplier_withdrawals for select to authenticated
using (
  (supplier_id = (select auth.uid()) and private.manfix_has_approved_role('supplier'))
  or private.manfix_has_approved_role('admin')
);

create policy "Admins insert supplier withdrawals"
on public.supplier_withdrawals for insert to authenticated
with check (private.manfix_has_approved_role('admin'));

create policy "Admins update supplier withdrawals"
on public.supplier_withdrawals for update to authenticated
using (private.manfix_has_approved_role('admin'))
with check (private.manfix_has_approved_role('admin'));

create policy "Admins delete supplier withdrawals"
on public.supplier_withdrawals for delete to authenticated
using (private.manfix_has_approved_role('admin'));
