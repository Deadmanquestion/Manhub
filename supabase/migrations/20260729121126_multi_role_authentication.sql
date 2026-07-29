alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('customer', 'supplier', 'workshop', 'technician', 'admin', 'super_admin'));

alter table public.profiles
  add column if not exists last_portal_role text;

alter table public.profiles
  drop constraint if exists profiles_last_portal_role_check;

alter table public.profiles
  add constraint profiles_last_portal_role_check
  check (
    last_portal_role is null
    or last_portal_role in ('customer', 'supplier', 'workshop', 'technician', 'admin')
  );

create table if not exists public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null
    check (role in ('customer', 'supplier', 'workshop', 'technician', 'admin', 'super_admin')),
  status text not null default 'Active'
    check (status in ('Active', 'Approved', 'Verified', 'Pending Approval', 'Suspended', 'Banned')),
  assigned_by uuid references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, role)
);

create index if not exists user_roles_role_status_idx
  on public.user_roles(role, status);

create index if not exists user_roles_user_status_idx
  on public.user_roles(user_id, status);

drop trigger if exists user_roles_touch_updated_at on public.user_roles;
create trigger user_roles_touch_updated_at
before update on public.user_roles
for each row execute function public.manhub_touch_updated_at();

insert into public.user_roles (user_id, role, status, assigned_by, assigned_at, updated_at)
select
  profile.id,
  profile.role,
  profile.status,
  profile.approved_by,
  coalesce(profile.approved_at, profile.created_at),
  profile.updated_at
from public.profiles as profile
on conflict (user_id, role) do update
set
  status = excluded.status,
  assigned_by = coalesce(public.user_roles.assigned_by, excluded.assigned_by),
  updated_at = excluded.updated_at;

alter table public.user_roles enable row level security;

grant select, insert, update, delete on table public.user_roles to authenticated;
grant all on table public.user_roles to service_role;

create or replace function private.manfix_has_approved_role(expected_role text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles as membership
    where membership.user_id = (select auth.uid())
      and membership.status in ('Active', 'Approved', 'Verified')
      and (
        membership.role = expected_role
        or (
          membership.role = 'super_admin'
          and expected_role <> 'super_admin'
        )
      )
  )
$$;

revoke all on function private.manfix_has_approved_role(text) from public;
revoke all on function private.manfix_has_approved_role(text) from anon;
grant execute on function private.manfix_has_approved_role(text) to authenticated;
grant execute on function private.manfix_has_approved_role(text) to service_role;

create or replace function private.manhub_app_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select profile.last_portal_role
      from public.profiles as profile
      where profile.id = (select auth.uid())
        and profile.last_portal_role is not null
        and (
          exists (
            select 1
            from public.user_roles as membership
            where membership.user_id = profile.id
              and membership.role = profile.last_portal_role
              and membership.status in ('Active', 'Approved', 'Verified')
          )
          or exists (
            select 1
            from public.user_roles as membership
            where membership.user_id = profile.id
              and membership.role = 'super_admin'
              and membership.status in ('Active', 'Approved', 'Verified')
          )
        )
    ),
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

drop policy if exists "Users view own role memberships" on public.user_roles;
create policy "Users view own role memberships"
on public.user_roles
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Admins view role memberships" on public.user_roles;
create policy "Admins view role memberships"
on public.user_roles
for select
to authenticated
using (private.manfix_has_approved_role('admin'));

drop policy if exists "Admins add non-privileged memberships" on public.user_roles;
create policy "Admins add non-privileged memberships"
on public.user_roles
for insert
to authenticated
with check (
  private.manfix_has_approved_role('admin')
  and role not in ('admin', 'super_admin')
);

drop policy if exists "Admins update non-privileged memberships" on public.user_roles;
create policy "Admins update non-privileged memberships"
on public.user_roles
for update
to authenticated
using (
  private.manfix_has_approved_role('admin')
  and role not in ('admin', 'super_admin')
)
with check (
  private.manfix_has_approved_role('admin')
  and role not in ('admin', 'super_admin')
);

drop policy if exists "Admins remove non-privileged memberships" on public.user_roles;
create policy "Admins remove non-privileged memberships"
on public.user_roles
for delete
to authenticated
using (
  private.manfix_has_approved_role('admin')
  and role not in ('admin', 'super_admin')
);

drop policy if exists "Super admins manage all memberships" on public.user_roles;
create policy "Super admins manage all memberships"
on public.user_roles
for all
to authenticated
using (private.manfix_has_approved_role('super_admin'))
with check (private.manfix_has_approved_role('super_admin'));

drop policy if exists "Admins manage all profiles" on public.profiles;
drop policy if exists "Admins view all profiles" on public.profiles;
create policy "Admins view all profiles"
on public.profiles
for select
to authenticated
using (private.manfix_has_approved_role('admin'));

drop policy if exists "Admins update profiles" on public.profiles;
create policy "Admins update profiles"
on public.profiles
for update
to authenticated
using (private.manfix_has_approved_role('admin'))
with check (private.manfix_has_approved_role('admin'));

create or replace function public.manfix_protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role
    and (select auth.uid()) is not null
    and not private.manfix_has_approved_role('super_admin')
  then
    raise exception 'Only a Super Admin can change the primary profile role.';
  end if;

  return new;
end;
$$;

revoke all on function public.manfix_protect_profile_role() from public;
revoke all on function public.manfix_protect_profile_role() from anon;
revoke all on function public.manfix_protect_profile_role() from authenticated;

drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role
before update of role on public.profiles
for each row execute function public.manfix_protect_profile_role();

create or replace function public.manfix_set_last_portal(selected_portal text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  if selected_portal not in ('customer', 'supplier', 'workshop', 'technician', 'admin') then
    raise exception 'Unknown ManFix portal.';
  end if;

  if not private.manfix_has_approved_role(selected_portal) then
    raise exception 'This portal is not assigned to your account.';
  end if;

  update public.profiles
  set last_portal_role = selected_portal
  where id = current_user_id
    and status in ('Active', 'Approved', 'Verified');

  if not found then
    raise exception 'Your ManFix profile is not active.';
  end if;

  return selected_portal;
end;
$$;

revoke all on function public.manfix_set_last_portal(text) from public;
revoke all on function public.manfix_set_last_portal(text) from anon;
grant execute on function public.manfix_set_last_portal(text) to authenticated;
grant execute on function public.manfix_set_last_portal(text) to service_role;

create or replace function public.manfix_sync_profile_role_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.user_roles
  set
    status = new.status,
    updated_at = now()
  where user_id = new.id;

  insert into public.user_roles (
    user_id,
    role,
    status,
    assigned_by,
    assigned_at,
    updated_at
  )
  values (
    new.id,
    new.role,
    new.status,
    new.approved_by,
    coalesce(new.approved_at, new.created_at),
    now()
  )
  on conflict (user_id, role) do update
  set
    status = excluded.status,
    assigned_by = coalesce(public.user_roles.assigned_by, excluded.assigned_by),
    updated_at = excluded.updated_at;

  return new;
end;
$$;

revoke all on function public.manfix_sync_profile_role_membership() from public;
revoke all on function public.manfix_sync_profile_role_membership() from anon;
revoke all on function public.manfix_sync_profile_role_membership() from authenticated;

drop trigger if exists profiles_sync_role_membership on public.profiles;
create trigger profiles_sync_role_membership
after insert or update of role, status, approved_by, approved_at
on public.profiles
for each row execute function public.manfix_sync_profile_role_membership();
