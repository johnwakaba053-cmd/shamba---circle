-- Community Membership, first slice: a user may join/leave any number of
-- communities. Deliberately separate from user_roles — no shared columns,
-- no auto-join based on role.
create table public.community_memberships (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  community_id text not null references public.communities(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, community_id)
);

alter table public.community_memberships enable row level security;

-- No UPDATE policy: membership is binary (join = insert, leave = delete).
create policy "Users can view their own memberships"
on public.community_memberships
for select
to authenticated
using (profile_id = (select auth.uid()));

create policy "Users can join a community"
on public.community_memberships
for insert
to authenticated
with check (profile_id = (select auth.uid()));

create policy "Users can leave a community"
on public.community_memberships
for delete
to authenticated
using (profile_id = (select auth.uid()));

-- Aggregate member count without exposing individual membership rows to
-- other users. security definer bypasses RLS internally so the count
-- reflects all members, not just the caller's own rows — but the function
-- only ever returns a single number, never row data. This is the
-- documented Supabase pattern for RLS-safe aggregates (see "Use security
-- definer functions" in the RLS guide).
create function public.community_member_count(p_community_id text)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)
  from public.community_memberships
  where community_id = p_community_id;
$$;

-- Explicitly scope who can call it via RPC (default grants EXECUTE to
-- PUBLIC, which would include anon) — matches the same hardening already
-- applied to handle_new_user.
revoke execute on function public.community_member_count(text) from public;
grant execute on function public.community_member_count(text) to authenticated;
