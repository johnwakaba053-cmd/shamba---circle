-- Marketplace listing photos -- database + Storage foundation only
-- (Stage 1). No composer UI, no browse-page rendering, no detail page --
-- see the accompanying inspection report for what's deliberately
-- deferred to later stages. This migration adds nothing that changes
-- how existing listings behave: a listing with zero attached media rows
-- renders exactly as it does today.
--
-- listing_media is its own table, not a reuse of post_media: listings
-- aren't community-scoped and have no membership concept at all (RLS on
-- public.listings is a plain `using (true)` open read), so the
-- membership-EXISTS-join shape that post_media needs would be pure dead
-- weight here. The actual shape this table needs -- "any authenticated
-- user may read; only the owning profile may attach/remove" -- is much
-- closer to story_hashtags/story_mentions' ownership checks than to
-- post_media's community join.

-- === listing_media ==========================================================

create table public.listing_media (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  -- Owner/uploader of this media row. Always set from auth.uid() server-
  -- side by the caller's own insert (enforced by the INSERT policy
  -- below, never trusted as freeform client input) -- same convention as
  -- post_media.profile_id/stories.profile_id.
  profile_id uuid not null references public.profiles (id) on delete cascade,
  -- Path inside the listing-media bucket, shaped
  -- "{profile_id}/{listing_id}/{filename}" -- see the Storage section
  -- below for why.
  storage_path text not null check (char_length(storage_path) > 0),
  -- Stores the actual MIME type rather than post_media/stories' collapsed
  -- 'image'/'video' category, because this stage is images-only (the
  -- listing-media bucket itself only accepts these three types below) --
  -- there is no video branch to collapse into a shared 'image' label for.
  media_type text not null check (
    media_type = any (array['image/jpeg', 'image/png', 'image/webp'])
  ),
  created_at timestamptz not null default now()
);

-- listing_id: the standard "media for this listing" lookup, same shape
-- as post_media_post_id_idx. profile_id: supports an owner's own
-- "my uploaded listing photos" queries and matches every other media
-- table's own-profile index. created_at: deterministic display ordering
-- (oldest-first, matching fetchPostMediaByPostId/fetchCreatorActiveStories'
-- own `.order("created_at", { ascending: true })` convention) without a
-- table scan once a listing has more than a couple of photos.
create index listing_media_listing_id_idx on public.listing_media (listing_id);
create index listing_media_profile_id_idx on public.listing_media (profile_id);
create index listing_media_created_at_idx on public.listing_media (created_at);

alter table public.listing_media enable row level security;

-- Listings themselves are openly readable to any authenticated user (see
-- "Authenticated users can view listings" on public.listings) -- no
-- membership, no visibility toggle, no ownership check of any kind.
-- Listing media inherits that exact same openness: unlike post_media
-- (which must re-derive posts' membership gate via an EXISTS join) there
-- is no gate to re-derive here, so a plain `using (true)` is the
-- correct, narrowest-possible mirror of listings' own policy -- not a
-- looser rule than the table it describes.
create policy "Authenticated users can view listing media"
on public.listing_media
for select
to authenticated
using (true);

-- A user may attach media only as themselves, and only to a listing they
-- themselves own -- both halves required. The second half is what stops
-- an authenticated caller from attaching a row to someone else's listing
-- even though they got profile_id = auth.uid() right; the first half is
-- what stops them inserting a row under someone else's profile_id even
-- for their own listing. Same two-part shape as post_media's own INSERT
-- policy, minus the community-membership branch that doesn't apply here.
create policy "Owners can attach media to their own listings"
on public.listing_media
for insert
to authenticated
with check (
  profile_id = (select auth.uid())
  and exists (
    select 1
    from public.listings l
    where l.id = listing_media.listing_id
      and l.profile_id = (select auth.uid())
  )
);

-- Lets an owner remove their own attached photo -- same shape as
-- post_media's own DELETE policy (direct own-row check, no join needed
-- since profile_id already identifies the owner on this table itself).
create policy "Owners can delete their own listing media rows"
on public.listing_media
for delete
to authenticated
using (profile_id = (select auth.uid()));

-- No UPDATE policy -- same precedent as stories (no UPDATE policy at
-- all): editing a photo in place isn't part of this foundation, and
-- with no policy granted, RLS denies every UPDATE by default. Swapping
-- a photo is remove-then-re-add, identical to how every other media
-- table in this schema already works.

-- === listing-media storage ==================================================
--
-- A separate private bucket from post-media/story-media, not a shared
-- one: listing photos are neither community-membership-gated (post-media)
-- nor ephemeral (story-media) -- they're permanent and globally readable,
-- closer in spirit to post-media's permanence but with none of its
-- membership plumbing. Never public -- same as every other media bucket
-- in this schema: all access goes through the RLS below or a signed URL
-- derived from it, never a public/CDN-style URL.
--
-- Path shape: "{profile_id}/{listing_id}/{filename}" -- identical
-- convention to story-media, and for the identical reason: scoping
-- ownership to the FIRST path segment lets INSERT/DELETE be authorized
-- directly from the path itself, with no join back to any table and no
-- trust placed in a client-supplied profile_id anywhere -- the only
-- identity that ever matters is auth.uid(), checked against the path
-- Storage itself recorded the object under. The second segment
-- (listing_id) groups a listing's photos together, matching what the
-- listing_media table's own listing_id column groups rows by.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'listing-media',
  'listing-media',
  false,
  10485760, -- 10MB per image, per the product requirement for this stage
  array['image/jpeg', 'image/png', 'image/webp']
);

-- Ownership is enforced entirely from the path's own first segment, not
-- from anything in the request body -- identical mechanism to
-- story-media's "Creators can upload their own story media" policy. A
-- caller cannot upload into another profile's folder no matter what
-- profile_id they claim elsewhere, because this check never reads one.
create policy "Owners can upload their own listing media"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'listing-media'
  and (storage.foldername(objects.name))[1] = (select auth.uid())::text
);

-- Listing photos are as openly readable as the listings they belong to
-- (see the table-level SELECT policy above) -- no "active or own" branch
-- is needed here the way story-media needs one, since there's no expiry
-- concept for a listing photo.
create policy "Authenticated users can read listing media objects"
on storage.objects
for select
to authenticated
using (bucket_id = 'listing-media');

-- Storage automatically records the uploader as `owner` on insert --
-- identical direct-ownership DELETE pattern as post-media/story-media's
-- own policies.
create policy "Owners can delete their own listing media objects"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'listing-media'
  and owner = (select auth.uid())
);
