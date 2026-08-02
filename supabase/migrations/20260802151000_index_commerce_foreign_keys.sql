create index if not exists shopping_cart_items_product_idx
  on public.shopping_cart_items(product_id);

create index if not exists customer_order_items_product_idx
  on public.customer_order_items(product_id);

create index if not exists customer_payments_order_idx
  on public.customer_payments(order_id);

create index if not exists notifications_actor_idx
  on public.notifications(actor_id) where actor_id is not null;

create index if not exists supplier_orders_customer_idx
  on public.supplier_orders(customer_id) where customer_id is not null;

create index if not exists supplier_orders_customer_order_idx
  on public.supplier_orders(customer_order_id) where customer_order_id is not null;

create index if not exists supplier_orders_order_item_idx
  on public.supplier_orders(order_item_id) where order_item_id is not null;

create index if not exists warranty_claims_warranty_idx
  on public.warranty_claims(warranty_id);
