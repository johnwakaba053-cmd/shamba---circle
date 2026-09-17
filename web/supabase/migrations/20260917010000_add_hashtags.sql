-- Optional, unbounded, user-created hashtags for Feed-level Reels.
-- Deliberately separate from posts.topic (a single, curated,
-- CHECK-constrained classification, added in the prior migration) --
-- a Reel may have zero, one, or many hashtags, and the vocabulary is
-- not a fixed list, per product requirement. Not wired up to
-- Communities in this stage (FeedComposer.tsx is the only writer), but
-- the schema/RLS below is already fully general -- a Community
-- composer could reuse the same tables/policies later with no further
-- migration, the same way post_media/post_likes/post_comments already
-- support both cases today.

create table public.hashtags (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text not null unique,
  created_at timestamptz not null default now(),
  constraint hashtags_normalized_name_check check (normalized_name ~ '^[a-z0-9_]{1,50}$')
);

alter table public.hashtags enable row level security;

-- Hashtags carry no ownership or sensitive data -- just a term -- so
-- any authenticated user may read the dictionary, and any authenticated
-- user may create a new term: this table is intentionally
-- user-extensible (per product requirement), not a curated/admin-only
-- list like communities. Actual access control lives on post_hashtags
-- below, which gates who may attach a term to which post. There is no
-- UPDATE or DELETE policy here at all -- renaming or removing a shared
-- hashtag term is out of scope for this stage, and omitting the policy
-- is a hard "nobody can" by default under RLS.
create policy "Authenticated users can view hashtags"
on public.hashtags
for select
to authenticated
using (true);

create policy "Authenticated users can create hashtags"
on public.hashtags
for insert
to authenticated
with check (true);

create table public.post_hashtags (
  post_id uuid not null references public.posts (id) on delete cascade,
  hashtag_id uuid not null references public.hashtags (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, hashtag_id)
);

alter table public.post_hashtags enable row level security;

-- Same shape as "Authenticated users can view post media" -- readable
-- by any authenticated user for a Feed-level post, or by community
-- members for a community post. Matches the existing Feed-level
-- engagement security model exactly, so a community post's hashtags
-- are never exposed to a non-member.
create policy "Authenticated users can view post hashtags"
on public.post_hashtags
for select
to authenticated
using (
  exists (
    select 1
    from public.posts p
    where p.id = post_hashtags.post_id
      and (
        p.community_id is null
        or exists (
          select 1
          from public.community_memberships m
          where m.community_id = p.community_id
            and m.profile_id = (select auth.uid())
        )
      )
  )
);

-- Same shape as "Authors can attach media to their own posts" -- only
-- the post's own author may attach a hashtag to it, and only if they
-- still satisfy the community's membership rule (community_id IS NULL
-- covers every Feed-level post FeedComposer.tsx creates today).
create policy "Authors can attach hashtags to their own posts"
on public.post_hashtags
for insert
to authenticated
with check (
  exists (
    select 1
    from public.posts p
    where p.id = post_hashtags.post_id
      and p.profile_id = (select auth.uid())
      and (
        p.community_id is null
        or exists (
          select 1
          from public.community_memberships m
          where m.community_id = p.community_id
            and m.profile_id = (select auth.uid())
        )
      )
  )
);
