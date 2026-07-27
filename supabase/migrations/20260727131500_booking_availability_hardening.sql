alter table public.technicians
  alter column workshop_owner_id set default auth.uid();

create or replace function public.manfix_list_lift_busy_slots(
  target_lift_id uuid,
  range_start timestamptz,
  range_end timestamptz
)
returns table (
  starts_at timestamptz,
  ends_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select requested_start_at, requested_end_at + interval '15 minutes'
  from public.lift_bookings
  where lift_id = target_lift_id
    and status in ('pending', 'approved', 'completed')
    and requested_start_at < range_end
    and requested_end_at + interval '15 minutes' > range_start
  union all
  select blocked_start_at, blocked_end_at
  from public.lift_unavailable_slots
  where lift_id = target_lift_id
    and blocked_start_at < range_end
    and blocked_end_at > range_start
$$;

revoke all on function public.manfix_list_lift_busy_slots(uuid, timestamptz, timestamptz)
  from public, anon;
grant execute on function public.manfix_list_lift_busy_slots(uuid, timestamptz, timestamptz)
  to authenticated;
