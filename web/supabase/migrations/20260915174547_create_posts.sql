-- Community Posts foundation: schema + RLS only, no UI, no images, no
-- comments/likes. A post belongs to a community and an author, is
-- readable by any authenticated user, and can only be created by a
-- current member of that community.
--
-- No FK to community_memberships: membership is checked at insert time
-- (via RLS below), not stored as a durable link, so a post survives the
-- author later leaving the community.
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  community_id text not null references public.communities (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  author_display_name text not null,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Primary read path is "posts for this community, newest first".
create index posts_community_id_created_at_idx
  on public.posts (community_id, created_at desc);

-- author_display_name is a denormalized snapshot, not a client-supplied
-- value: profiles RLS only lets a user read their own row, so a posts
-- feed has no other way to resolve profile_id -> display_name for any
-- author but the viewer themselves. This trigger derives the name
-- server-side from auth.uid() directly (ignoring whatever profile_id the
-- client sent), so a forged author_display_name in the insert payload is
-- always overwritten before the row is ever validated or stored.
--
-- Deliberately NOT security definer: it must run as the inserting role
-- so it stays subject to profiles' existing "view own profile" RLS
-- policy, which is exactly the guarantee that makes it safe — it can
-- only ever read the caller's own display_name, never anyone else's.
create function public.set_post_author_display_name()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select display_name into new.author_display_name
  from public.profiles
  where id = auth.uid();

  return new;
end;
$$;

create trigger set_post_author_display_name
  before insert on public.posts
  for each row
  execute function public.set_post_author_display_name();

alter table public.posts enable row level security;

-- Any authenticated user may read posts, matching the existing open-read
-- policy on communities (browsing a community's posts doesn't require
-- membership, same as browsing the communities directory itself).
create policy "Authenticated users can view posts"
on public.posts
for select
to authenticated
using (true);

-- A user may only post as themselves, and only into a community they
-- currently belong to. Direct EXISTS check, not a security definer
-- function: the subquery only needs to see the caller's own membership
-- row, which their existing community_memberships SELECT policy
-- (profile_id = auth.uid()) already permits, so no RLS bypass is needed.
create policy "Members can create posts in their communities"
on public.posts
for insert
to authenticated
with check (
  profile_id = (select auth.uid())
  and exists (
    select 1
    from public.community_memberships m
    where m.profile_id = (select auth.uid())
      and m.community_id = posts.community_id
  )
);

-- A user may update or delete only their own posts, regardless of
-- current membership status (ownership of your own content persists
-- independently of whether you're still a member).
create policy "Authors can update their own posts"
on public.posts
for update
to authenticated
using (profile_id = (select auth.uid()))
with check (profile_id = (select auth.uid()));

create policy "Authors can delete their own posts"
on public.posts
for delete
to authenticated
using (profile_id = (select auth.uid()));
