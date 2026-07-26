create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon;
grant usage on schema private to authenticated;
grant usage on schema private to service_role;

create or replace function private.manhub_app_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select profile.role
      from public.profiles as profile
      where profile.id = (select auth.uid())
    ),
    ''
  )
$$;

revoke all on function private.manhub_app_role() from public;
revoke all on function private.manhub_app_role() from anon;
grant execute on function private.manhub_app_role() to authenticated;
grant execute on function private.manhub_app_role() to service_role;

drop policy if exists "Admins manage all profiles" on public.profiles;
create policy "Admins manage all profiles"
on public.profiles
for all
to authenticated
using (private.manhub_app_role() = 'admin')
with check (private.manhub_app_role() = 'admin');

drop function if exists public.manhub_app_role();
