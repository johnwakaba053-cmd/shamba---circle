-- Trust & Safety Step 1: admin / moderator foundation.
--
-- Staff roles live in their own table, NOT in public.user_roles: farmers
-- can insert their own user_roles rows (20260915111411), so adding
-- 'admin' or 'moderator' to that check constraint would let anyone make
-- themselves an admin. public.staff_roles has no INSERT/UPDATE/DELETE
-- policy at all, and those privileges are revoked from anon and
-- authenticated too, so a role can only be granted or removed by the
-- project owner (Supabase SQL editor / service role), e.g.:
--
--   insert into public.staff_roles (profile_id, role)
--   values ('<profile uuid>', 'admin');
--
-- Future moderation tables gate access in their RLS policies with the two
-- helpers below, e.g. `using (public.can_moderate())`.
--
-- Nothing else changes: user_roles, profiles and every existing policy
-- are untouched, and no existing user gets a staff role.

create table public.staff_roles (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('admin', 'moderator')),
  created_at timestamptz not null default now(),
  primary key (profile_id, role)
);

alter table public.staff_roles enable row level security;

-- Belt and braces alongside RLS: Supabase's default privileges grant anon
-- and authenticated everything on a new table, so reset both. anon gets
-- nothing; authenticated gets SELECT only (still filtered by the policies
-- below), so no API role can write staff roles.
revoke all on public.staff_roles from anon;
revoke all on public.staff_roles from authenticated;
grant select on public.staff_roles to authenticated;

-- Helpers for RLS policies. SECURITY DEFINER so they can read
-- staff_roles regardless of the caller's own access to it; they only
-- ever answer about the caller (auth.uid()), so they reveal nothing about
-- anyone else.
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff_roles
    where profile_id = (select auth.uid())
      and role = 'admin'
  );
$$;

-- Admins can do everything moderators can.
create function public.can_moderate()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff_roles
    where profile_id = (select auth.uid())
      and role in ('admin', 'moderator')
  );
$$;

-- Same explicit revoke/grant sequence as every function in this project:
-- `revoke ... from public` alone doesn't remove Supabase's default direct
-- grant to anon on a new function.
revoke all on function public.is_admin() from public;
revoke execute on function public.is_admin() from anon;
grant execute on function public.is_admin() to authenticated;

revoke all on function public.can_moderate() from public;
revoke execute on function public.can_moderate() from anon;
grant execute on function public.can_moderate() to authenticated;

-- Staff can see their own staff roles (e.g. to show a future admin
-- link); admins can see the whole staff list. Farmers see nothing.
create policy "Staff can view their own staff roles"
on public.staff_roles
for select
to authenticated
using (profile_id = (select auth.uid()));

create policy "Admins can view all staff roles"
on public.staff_roles
for select
to authenticated
using ((select public.is_admin()));
