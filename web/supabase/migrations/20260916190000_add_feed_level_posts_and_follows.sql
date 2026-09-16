-- Feed architecture, Stage A — database foundation only.
--
-- Two independent pieces:
-- 1. posts.community_id becomes nullable, so a post can exist without
--    belonging to any community ("Feed-level" content, the eventual
--    basis for Reels) -- existing community posts and every existing
--    RLS/query that already filters `where community_id = :id` are
--    completely unaffected, since no existing row changes.
-- 2. public.follows -- a new, independent primitive (farmer follows
--    farmer), unrelated to community membership.
--
-- Deliberately out of scope here (see the Stage A plan): hashtags,
-- mentions, Stories, Live, Discovery, the vertical Reels UI, and
-- engagement (likes/comments/media) on Feed-level posts specifically --
-- post_likes/post_comments/post_media's own RLS still require a
-- non-null community_id via community_memberships, unchanged by this
-- migration. A Feed-level post can be created by this stage's policy,
-- but liking/commenting on one is intentionally not wired up until the
-- Feed composer/engagement UI stage.

alter table public.posts alter column community_id drop not null;

-- Replaces the INSERT policy, not just adds to it: the existing rule
-- (profile_id = caller AND caller is a member of that community) is
-- preserved byte-for-byte for community_id IS NOT NULL, with one
-- additional allowance -- community_id IS NULL requires no membership
-- check at all, since there is no community to be a member of. Every
-- other posts policy (SELECT/UPDATE/DELETE) is untouched: SELECT was
-- already `using (true)` for any authenticated user (so Feed-level
-- posts are automatically visible, no change needed), and UPDATE/DELETE
-- were already plain profile_id-ownership checks with no community
-- dependency.
drop policy "Members can create posts in their communities" on public.posts;

create policy "Authenticated users can create posts"
on public.posts
for insert
to authenticated
with check (
  profile_id = (select auth.uid())
  and (
    community_id is null
    or exists (
      select 1
      from public.community_memberships m
      where m.profile_id = (select auth.uid())
        and m.community_id = posts.community_id
    )
  )
);

-- public.follows: one row per (follower, followed) pair -- same
-- composite-PK shape as community_memberships (a farmer "joining"
-- another farmer's audience). The CHECK constraint blocks self-follows
-- structurally, regardless of which role performs the insert (RLS or a
-- future trusted server job), not only via the RLS policy below.
create table public.follows (
  follower_profile_id uuid not null references public.profiles (id) on delete cascade,
  followed_profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_profile_id, followed_profile_id),
  constraint follows_no_self_follow check (follower_profile_id <> followed_profile_id)
);

alter table public.follows enable row level security;

-- "Owner-aware" extended to both sides of the relationship: a farmer
-- may see rows where they are the follower (who they follow) or the
-- followed party (who follows them) -- their own two-sided
-- relationship data -- but never someone else's unrelated follow graph.
-- Public-facing aggregate counts are exposed separately below via
-- security definer functions, the same split already used for
-- community membership vs. community_member_count.
create policy "Users can view their own follow relationships"
on public.follows
for select
to authenticated
using (
  follower_profile_id = (select auth.uid())
  or followed_profile_id = (select auth.uid())
);

-- A user may only follow as themselves. The self-follow check is
-- duplicated from the table CHECK constraint here too (belt and
-- suspenders, matching this schema's existing style): the constraint
-- alone protects every future writer regardless of RLS, and the
-- with_check alone is what actually verifies caller identity, so both
-- are load-bearing for different reasons.
create policy "Users can follow as themselves"
on public.follows
for insert
to authenticated
with check (
  follower_profile_id = (select auth.uid())
  and follower_profile_id <> followed_profile_id
);

-- Only the follower can remove their own follow -- mirrors "Users can
-- leave a community" exactly: unfollowing is the follower's action, the
-- followed party has no delete right over someone else's row.
create policy "Users can unfollow"
on public.follows
for delete
to authenticated
using (follower_profile_id = (select auth.uid()));

-- Secure aggregate counts, same pattern as community_member_count /
-- post_like_count: security definer so any authenticated user can see
-- a profile's counts regardless of their own relationship to it, but
-- returning only a scalar, never row-level follower/following identity.
create function public.follower_count(p_profile_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)
  from public.follows
  where followed_profile_id = p_profile_id;
$$;

revoke execute on function public.follower_count(uuid) from public;
revoke execute on function public.follower_count(uuid) from anon;
grant execute on function public.follower_count(uuid) to authenticated;

create function public.following_count(p_profile_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)
  from public.follows
  where follower_profile_id = p_profile_id;
$$;

revoke execute on function public.following_count(uuid) from public;
revoke execute on function public.following_count(uuid) from anon;
grant execute on function public.following_count(uuid) to authenticated;
