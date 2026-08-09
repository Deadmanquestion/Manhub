create or replace function public.manfix_protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_user_id uuid := (select auth.uid());
  request_role text := nullif((select auth.jwt() ->> 'role'), '');
  protected_fields_changed boolean := (
    new.role is distinct from old.role
    or new.status is distinct from old.status
    or new.approved_by is distinct from old.approved_by
    or new.approved_at is distinct from old.approved_at
    or new.email is distinct from old.email
  );
begin
  if protected_fields_changed
    and request_role = 'authenticated'
    and request_user_id = old.id
  then
    raise exception 'Profile access fields can only be changed through ManFix approval workflows.';
  end if;

  return new;
end;
$$;

revoke all on function public.manfix_protect_profile_role() from public, anon, authenticated;
