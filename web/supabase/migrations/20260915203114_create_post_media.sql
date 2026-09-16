-- Post media: photo/video attachments. Unlike post text (openly readable
-- to any authenticated user), media is "protected" per the product spec
-- — non-members may browse and read posts but must not access media —
-- so both the tracking table and the underlying Storage objects are
-- membership-gated for read, not open-read like posts/post_comments.

-- Private bucket: never public. Actual byte access is only ever granted
-- through RLS on storage.objects (below) or a signed URL derived from it
-- — never a public/CDN-style URL.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'post-media',
  'post-media',
  false,
  104857600, -- 100MB ceiling (covers video; images are additionally capped
             -- tighter client-side, since a bucket has only one size limit)
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime']
);

-- Tracking table: one row per uploaded file, path-linked to its Storage
-- object. storage_path is a path inside the post-media bucket, shaped
-- "{post_id}/{filename}" — the leading folder segment is what the
-- storage.objects policies below match against post_id.
create table public.post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null,
  media_type text not null check (media_type in ('image', 'video')),
  created_at timestamptz not null default now()
);

create index post_media_post_id_idx on public.post_media (post_id);

alter table public.post_media enable row level security;

-- Read is membership-gated (the "protected media" requirement) — a
-- direct EXISTS check through posts -> community_memberships, same
-- pattern already used for posts/post_likes/post_comments INSERT
-- policies, not a security definer function: the caller's own membership
-- row is already readable to them, so no RLS bypass is needed.
create policy "Members can view media in their communities"
on public.post_media
for select
to authenticated
using (
  exists (
    select 1
    from public.posts p
    join public.community_memberships m on m.community_id = p.community_id
    where p.id = post_media.post_id
      and m.profile_id = (select auth.uid())
  )
);

-- Only the post's own author may attach media to it, and only while they
-- are a member of that post's community (same rule as creating the post
-- itself).
create policy "Authors can attach media to their own posts"
on public.post_media
for insert
to authenticated
with check (
  profile_id = (select auth.uid())
  and exists (
    select 1
    from public.posts p
    join public.community_memberships m on m.community_id = p.community_id
    where p.id = post_media.post_id
      and p.profile_id = (select auth.uid())
      and m.profile_id = (select auth.uid())
  )
);

-- Author may remove their own attached media rows (used both for
-- deliberate removal and for cleanup if an upload attempt fails midway).
create policy "Authors can delete their own post media rows"
on public.post_media
for delete
to authenticated
using (profile_id = (select auth.uid()));

-- Storage RLS on the actual bytes: mirrors the post_media table policies
-- above, matched via the object's path (storage.foldername picks out the
-- leading "{post_id}" segment). This is the real access boundary for
-- downloading/viewing a file; the tracking table alone doesn't gate the
-- bytes themselves.
create policy "Members can read post media objects"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'post-media'
  and exists (
    select 1
    from public.posts p
    join public.community_memberships m on m.community_id = p.community_id
    where p.id::text = (storage.foldername(name))[1]
      and m.profile_id = (select auth.uid())
  )
);

create policy "Authors can upload media to their own posts"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'post-media'
  and exists (
    select 1
    from public.posts p
    join public.community_memberships m on m.community_id = p.community_id
    where p.id::text = (storage.foldername(name))[1]
      and p.profile_id = (select auth.uid())
      and m.profile_id = (select auth.uid())
  )
);

-- Storage automatically records the uploader as `owner` on insert, so
-- this is the direct-ownership analogue of the other "own row" DELETE
-- policies elsewhere in this schema.
create policy "Owners can delete their post media objects"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'post-media'
  and owner = (select auth.uid())
);
