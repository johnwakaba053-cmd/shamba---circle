-- Feed architecture, Stage A continued — Feed-level engagement + media.
--
-- Stage A (previous migration) made posts.community_id nullable and
-- let a Feed-level post (community_id IS NULL) be created. It did not
-- touch post_likes / post_comments / post_media / the post-media
-- Storage bucket, whose own RLS independently re-checks community
-- membership via their own posts JOIN community_memberships -- meaning
-- a Feed-level post could be created, but nobody (not even its author)
-- could like it, comment on it, or attach/view media on it. This
-- migration closes that gap.
--
-- Every policy below follows the same shape: the existing membership
-- check is preserved byte-for-byte for community_id IS NOT NULL, with
-- one added allowance -- community_id IS NULL requires no membership
-- check at all, since there is no community to be a member of. No
-- policy is loosened for the community_id IS NOT NULL case; every
-- existing Community behavior is unchanged.

-- === post_likes ===========================================================

drop policy "Members can like posts in their communities" on public.post_likes;

create policy "Authenticated users can like posts"
on public.post_likes
for insert
to authenticated
with check (
  profile_id = (select auth.uid())
  and exists (
    select 1
    from public.posts p
    where p.id = post_likes.post_id
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

-- SELECT/DELETE on post_likes are already own-row, no community
-- dependency -- untouched.

-- === post_comments =========================================================

drop policy "Members can comment on posts in their communities" on public.post_comments;

create policy "Authenticated users can comment on posts"
on public.post_comments
for insert
to authenticated
with check (
  profile_id = (select auth.uid())
  and exists (
    select 1
    from public.posts p
    where p.id = post_comments.post_id
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

-- SELECT was already `using (true)` (open to any authenticated user);
-- UPDATE/DELETE are already own-row -- untouched.

-- === post_media (table) ====================================================

drop policy "Authors can attach media to their own posts" on public.post_media;

create policy "Authors can attach media to their own posts"
on public.post_media
for insert
to authenticated
with check (
  profile_id = (select auth.uid())
  and exists (
    select 1
    from public.posts p
    where p.id = post_media.post_id
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

drop policy "Members can view media in their communities" on public.post_media;

create policy "Authenticated users can view post media"
on public.post_media
for select
to authenticated
using (
  exists (
    select 1
    from public.posts p
    where p.id = post_media.post_id
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

-- DELETE on post_media is already own-row (profile_id = auth.uid()),
-- no community dependency -- untouched.

-- === storage.objects (post-media bucket) ===================================
--
-- The actual file bytes live behind their own, separate RLS on
-- storage.objects (not just the post_media table row) -- this is the
-- private-bucket + signed-URL architecture itself, unchanged: still
-- private, still requires an authorization check per object, still the
-- same signed-URL minting path in lib/postMedia.ts. Only the
-- authorization predicate gains the identical community_id IS NULL
-- allowance as above. storage.foldername(objects.name))[1] is the
-- post id encoded as the first path segment of the object key (see
-- PostComposer.tsx's upload path), unchanged.

drop policy "Authors can upload media to their own posts" on storage.objects;

create policy "Authors can upload media to their own posts"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'post-media'
  and exists (
    select 1
    from public.posts p
    where p.id::text = (storage.foldername(objects.name))[1]
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

drop policy "Members can read post media objects" on storage.objects;

create policy "Authenticated users can read post media objects"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'post-media'
  and exists (
    select 1
    from public.posts p
    where p.id::text = (storage.foldername(objects.name))[1]
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

-- "Owners can delete their post media objects" (DELETE) checks only
-- `owner = auth.uid()` on the storage object itself, with no community
-- join at all -- untouched, unaffected either way.
