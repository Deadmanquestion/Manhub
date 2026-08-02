-- Keep production workflow RPCs behind an authenticated Supabase session.
revoke all on function public.manfix_add_cart_item(uuid, integer) from public, anon;
revoke all on function public.manfix_set_cart_quantity(uuid, integer) from public, anon;
revoke all on function public.manfix_checkout_cart(text) from public, anon;
revoke all on function public.manfix_update_customer_payment(uuid, text) from public, anon;
revoke all on function public.manfix_assign_repair_technician(uuid, uuid) from public, anon;

grant execute on function public.manfix_add_cart_item(uuid, integer) to authenticated;
grant execute on function public.manfix_set_cart_quantity(uuid, integer) to authenticated;
grant execute on function public.manfix_checkout_cart(text) to authenticated;
grant execute on function public.manfix_update_customer_payment(uuid, text) to authenticated;
grant execute on function public.manfix_assign_repair_technician(uuid, uuid) to authenticated;
