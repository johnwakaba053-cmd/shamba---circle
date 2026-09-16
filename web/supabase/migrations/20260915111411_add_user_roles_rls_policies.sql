-- Minimum RLS for public.user_roles: a user may read, add, and remove
-- their own role rows. No UPDATE policy — role is part of the primary
-- key, so "changing" a role is a delete + insert (toggle membership),
-- not an in-place update.
create policy "Users can view their own roles"
on public.user_roles
for select
to authenticated
using (profile_id = (select auth.uid()));

create policy "Users can add their own roles"
on public.user_roles
for insert
to authenticated
with check (profile_id = (select auth.uid()));

create policy "Users can remove their own roles"
on public.user_roles
for delete
to authenticated
using (profile_id = (select auth.uid()));
