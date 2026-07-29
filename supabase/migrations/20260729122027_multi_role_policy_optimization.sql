create index if not exists user_roles_assigned_by_idx
  on public.user_roles(assigned_by);

drop policy if exists "Users view own role memberships" on public.user_roles;
drop policy if exists "Admins view role memberships" on public.user_roles;
drop policy if exists "Admins add non-privileged memberships" on public.user_roles;
drop policy if exists "Admins update non-privileged memberships" on public.user_roles;
drop policy if exists "Admins remove non-privileged memberships" on public.user_roles;
drop policy if exists "Super admins manage all memberships" on public.user_roles;

create policy "Users view allowed role memberships"
on public.user_roles
for select
to authenticated
using (
  (select auth.uid()) = user_id
  or private.manfix_has_approved_role('admin')
);

create policy "Administrators add role memberships"
on public.user_roles
for insert
to authenticated
with check (
  private.manfix_has_approved_role('super_admin')
  or (
    private.manfix_has_approved_role('admin')
    and role not in ('admin', 'super_admin')
  )
);

create policy "Administrators update role memberships"
on public.user_roles
for update
to authenticated
using (
  private.manfix_has_approved_role('super_admin')
  or (
    private.manfix_has_approved_role('admin')
    and role not in ('admin', 'super_admin')
  )
)
with check (
  private.manfix_has_approved_role('super_admin')
  or (
    private.manfix_has_approved_role('admin')
    and role not in ('admin', 'super_admin')
  )
);

create policy "Administrators remove role memberships"
on public.user_roles
for delete
to authenticated
using (
  private.manfix_has_approved_role('super_admin')
  or (
    private.manfix_has_approved_role('admin')
    and role not in ('admin', 'super_admin')
  )
);

drop policy if exists "Users view own profile" on public.profiles;
drop policy if exists "Admins view all profiles" on public.profiles;

create policy "Users view allowed profiles"
on public.profiles
for select
to authenticated
using (
  (select auth.uid()) = id
  or private.manfix_has_approved_role('admin')
);
