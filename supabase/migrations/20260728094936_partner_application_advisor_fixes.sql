create index supplier_applications_reviewed_by_idx
  on public.supplier_applications(reviewed_by)
  where reviewed_by is not null;
create index workshop_applications_reviewed_by_idx
  on public.workshop_applications(reviewed_by)
  where reviewed_by is not null;
create index technician_applications_reviewed_by_idx
  on public.technician_applications(reviewed_by)
  where reviewed_by is not null;

drop policy if exists "Admins review supplier applications"
  on public.supplier_applications;
drop policy if exists "Admins review workshop applications"
  on public.workshop_applications;
drop policy if exists "Admins review technician applications"
  on public.technician_applications;

create policy "Admins read supplier applications"
on public.supplier_applications for select to authenticated
using (private.manfix_has_approved_role('admin'));

create policy "Admins update supplier applications"
on public.supplier_applications for update to authenticated
using (private.manfix_has_approved_role('admin'))
with check (private.manfix_has_approved_role('admin'));

create policy "Admins delete supplier applications"
on public.supplier_applications for delete to authenticated
using (private.manfix_has_approved_role('admin'));

create policy "Admins read workshop applications"
on public.workshop_applications for select to authenticated
using (private.manfix_has_approved_role('admin'));

create policy "Admins update workshop applications"
on public.workshop_applications for update to authenticated
using (private.manfix_has_approved_role('admin'))
with check (private.manfix_has_approved_role('admin'));

create policy "Admins delete workshop applications"
on public.workshop_applications for delete to authenticated
using (private.manfix_has_approved_role('admin'));

create policy "Admins read technician applications"
on public.technician_applications for select to authenticated
using (private.manfix_has_approved_role('admin'));

create policy "Admins update technician applications"
on public.technician_applications for update to authenticated
using (private.manfix_has_approved_role('admin'))
with check (private.manfix_has_approved_role('admin'));

create policy "Admins delete technician applications"
on public.technician_applications for delete to authenticated
using (private.manfix_has_approved_role('admin'));
