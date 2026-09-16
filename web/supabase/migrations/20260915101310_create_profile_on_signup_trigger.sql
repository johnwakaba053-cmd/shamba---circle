-- Profile foundation, step 2: auto-create a profile row on signup, plus
-- the minimum RLS a user needs to see/edit their own profile.
--
-- Scope, deliberately: no user_roles row is created here (role selection
-- is a later slice), no extra profile columns, no public/broad SELECT
-- access. See project planning docs for what's deferred and why.

-- Runs as the function owner (security definer), not as the inserting
-- role, so it isn't subject to profiles' RLS policies (which otherwise
-- have no INSERT grant for anyone — this trigger is the only writer of
-- new profile rows).
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, phone)
  values (new.id, new.phone);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- A user may read their own profile row.
create policy "Users can view their own profile"
on public.profiles
for select
to authenticated
using (id = (select auth.uid()));

-- A user may update their own profile row (e.g. display_name later).
-- No INSERT policy: the trigger above is the only writer of new rows.
create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));
