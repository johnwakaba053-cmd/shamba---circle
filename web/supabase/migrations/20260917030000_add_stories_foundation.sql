-- Farming Stories -- database foundation only. No composer, viewer,
-- carousel, notifications, or Live is part of this migration -- see the
-- Step 70 report for what's deliberately deferred.
--
-- Stories are a genuinely separate concept from Reels: temporary
-- (24-hour, DB-enforced lifetime), not community-scoped, one media item
-- per Story. This is why they get their own table rather than reusing
-- posts -- posts.community_id/body/etc. don't map cleanly onto "a
-- single ephemeral photo/video that vanishes in a day," and bending
-- posts to also mean that would make every existing posts query need to
-- start filtering Stories back out.

-- === stories ================================================================

create table public.stories (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  media_type text not null check (media_type = any (array['image', 'video'])),
  media_path text not null,
  caption text,
  topic text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  -- Postgres evaluates now() once per statement, so created_at's and
  -- expires_at's defaults resolve to the same instant -- this constraint
  -- then makes "exactly 24 hours" a hard DB invariant rather than just
  -- an app-level convention a careless future insert could drift from.
  constraint stories_expires_at_24h_check check (expires_at = created_at + interval '24 hours'),
  constraint stories_caption_check check (caption is null or char_length(caption) <= 2000),
  -- Reuses posts.topic's exact vocabulary (posts_topic_check) rather
  -- than inventing a second topic system -- keep the two lists in sync
  -- if this ever changes.
  constraint stories_topic_check check (
    topic is null
    or topic = any (array[
      'Crops',
      'Livestock',
      'Machinery',
      'Irrigation',
      'Harvesting',
      'Farming Business',
      'Farming Tips',
      'Farm Tours',
      'Farm Life'
    ])
  )
);

-- Supports both "my own stories" lookups and the expiry filter every
-- active-story read will use.
create index stories_profile_id_idx on public.stories (profile_id);
create index stories_expires_at_idx on public.stories (expires_at);

alter table public.stories enable row level security;

-- A Story is visible if it's still active (expires_at > now()), or it's
-- the caller's own -- mirroring get_public_profile's "public or self"
-- shape, so a creator can still see (and manage) their own Story after
-- it expires even though nobody else can anymore. This one RLS policy
-- is the entire "active Story" boundary: no SECURITY DEFINER function
-- is needed the way get_my_alerts() needs one, because there's no
-- per-viewer column redaction happening here (unlike profiles.phone or
-- a private display_name) -- it's a plain row filter, which is exactly
-- what RLS already does well. A plain `select * from stories` through
-- the client SDK is automatically scoped correctly.
create policy "Members can view active or their own stories"
on public.stories
for select
to authenticated
using (
  expires_at > now()
  or profile_id = (select auth.uid())
);

-- Only as yourself -- same shape as "Authenticated users can create
-- posts", minus the community_id branch, since Stories aren't
-- community-scoped at all.
create policy "Members can create their own stories"
on public.stories
for insert
to authenticated
with check (profile_id = (select auth.uid()));

-- Lets a creator remove their own Story early (not just wait for
-- expiry) -- same shape as "Authors can delete their own posts". No
-- UPDATE policy: editing a Story's caption/media after posting isn't
-- part of this foundation.
create policy "Creators can delete their own stories"
on public.stories
for delete
to authenticated
using (profile_id = (select auth.uid()));

-- === story_hashtags =========================================================
--
-- Same shape as post_hashtags -- reuses the existing public.hashtags
-- dictionary table rather than duplicating it. No separate "story
-- hashtags" vocabulary.

create table public.story_hashtags (
  story_id uuid not null references public.stories (id) on delete cascade,
  hashtag_id uuid not null references public.hashtags (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (story_id, hashtag_id)
);

alter table public.story_hashtags enable row level security;

create policy "Members can view hashtags on visible stories"
on public.story_hashtags
for select
to authenticated
using (
  exists (
    select 1
    from public.stories s
    where s.id = story_hashtags.story_id
      and (
        s.expires_at > now()
        or s.profile_id = (select auth.uid())
      )
  )
);

create policy "Creators can attach hashtags to their own stories"
on public.story_hashtags
for insert
to authenticated
with check (
  exists (
    select 1
    from public.stories s
    where s.id = story_hashtags.story_id
      and s.profile_id = (select auth.uid())
  )
);

-- === story_mentions =========================================================
--
-- Same shape as post_mentions -- a structured post -> profile
-- relationship, never free text parsed out of the caption.

create table public.story_mentions (
  story_id uuid not null references public.stories (id) on delete cascade,
  mentioned_profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (story_id, mentioned_profile_id)
);

alter table public.story_mentions enable row level security;

create policy "Members can view mentions on visible stories"
on public.story_mentions
for select
to authenticated
using (
  exists (
    select 1
    from public.stories s
    where s.id = story_mentions.story_id
      and (
        s.expires_at > now()
        or s.profile_id = (select auth.uid())
      )
  )
);

create policy "Creators can attach mentions to their own stories"
on public.story_mentions
for insert
to authenticated
with check (
  exists (
    select 1
    from public.stories s
    where s.id = story_mentions.story_id
      and s.profile_id = (select auth.uid())
  )
);

-- === story-media storage ===================================================
--
-- A separate private bucket from post-media, not a shared one: Story
-- media is ephemeral (paired 1:1 with a 24-hour-lived row) while post
-- media is permanent, and keeping them apart makes any future cleanup
-- job for expired Story files simpler and safer to reason about. Never
-- public -- same as post-media, all access goes through RLS below or a
-- signed URL derived from it.
--
-- Path shape: "{profile_id}/{story_id}/{filename}" -- scoped to the
-- creator's own profile id as the FIRST path segment specifically so
-- ownership (for INSERT/DELETE) can be checked directly from the path
-- with no join back to the stories table, per the brief. The second
-- segment (story_id) groups a Story's media together and is what the
-- general-viewer SELECT policy joins back to stories on, to enforce the
-- same active-or-own visibility rule as the stories table itself.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'story-media',
  'story-media',
  false,
  104857600, -- 100MB ceiling, matching post-media's existing bucket limit
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime']
);

create policy "Creators can upload their own story media"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'story-media'
  and (storage.foldername(objects.name))[1] = (select auth.uid())::text
);

-- The owner can always read their own media (even after the Story
-- expires); anyone else can read it only while a matching, still-active
-- stories row exists -- mirrors the "expires_at > now() or own" rule on
-- the stories table itself, applied to the actual bytes.
create policy "Members can read active story media"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'story-media'
  and (
    (storage.foldername(objects.name))[1] = (select auth.uid())::text
    or exists (
      select 1
      from public.stories s
      where s.profile_id::text = (storage.foldername(objects.name))[1]
        and s.id::text = (storage.foldername(objects.name))[2]
        and s.expires_at > now()
    )
  )
);

-- Storage automatically records the uploader as `owner` on insert --
-- same direct-ownership DELETE pattern as post-media's own policy.
create policy "Owners can delete their own story media objects"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'story-media'
  and owner = (select auth.uid())
);
