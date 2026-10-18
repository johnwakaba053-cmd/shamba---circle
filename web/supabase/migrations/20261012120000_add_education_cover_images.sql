-- Education: cover photographs for guides (Stage 2, step 1 -- schema only).
--
-- Adds an optional, openly licensed cover photo to education_resources,
-- and a private 'education-media' bucket to hold the files. This
-- migration sets no cover on any guide and uploads nothing: the pilot
-- covers (indigenous chicken, rabbits, beekeeping, avocado, maize) are a
-- later, separately reviewed data migration, once each photo's licence
-- has been checked on its source page.
--
-- Rules the database enforces, so a cover can never appear without what
-- its licence requires:
--
--  * A cover is all-or-nothing: the large image, alt text, credit
--    (author), licence and the https link to the original file are set
--    together or not at all. The card-size image is optional, but only
--    alongside a cover.
--  * Licences are an allow-list of open licences that permit commercial
--    reuse with attribution (CC0, public domain, CC BY, CC BY-SA).
--    NonCommercial and NoDerivatives licences are not accepted.
--  * Files sit under the guide's own folder, '<resource id>/<file>',
--    with a lowercase .webp/.jpg/.jpeg name and no '..'.
--
-- Storage:
--
--  * 'education-media' is PRIVATE (like 'news-media' since
--    20261009110000): no public URLs. The app signs short-lived URLs with
--    the reader's own session.
--  * 300 KB per file, JPEG/WebP only (no SVG, PNG or anything that can
--    carry script). Covers are optimised and stripped of EXIF/GPS
--    metadata before upload.
--  * Read: a signed-in user can read a file only when its folder is a
--    guide they can see -- the subquery runs under education_resources'
--    own RLS, so that means published guides only. Anon reads nothing.
--  * Write: deliberately NO insert/update/delete policy, matching
--    education_resources and 'education-documents' (content is managed
--    by migration, not from the app). Authorised administrators upload
--    through the Supabase dashboard, which uses the service role.
--
-- Existing rows and pages: every new column is NULL for every guide, and
-- the app selects education columns by name, so nothing changes on any
-- page until step 2's code and a reviewed data migration land.

-- === guide covers ============================================================

alter table public.education_resources
  add column cover_image_path text check (
    cover_image_path is null
    or (char_length(cover_image_path) <= 300
        and cover_image_path ~ '^[a-z0-9]+(-[a-z0-9]+)*/[a-z0-9]+(-[a-z0-9]+)*\.(webp|jpg|jpeg)$'
        and cover_image_path !~ '\.\.')
  ),
  add column cover_thumb_path text check (
    cover_thumb_path is null
    or (char_length(cover_thumb_path) <= 300
        and cover_thumb_path ~ '^[a-z0-9]+(-[a-z0-9]+)*/[a-z0-9]+(-[a-z0-9]+)*\.(webp|jpg|jpeg)$'
        and cover_thumb_path !~ '\.\.')
  ),
  add column cover_image_alt text
    check (cover_image_alt is null or char_length(btrim(cover_image_alt)) between 1 and 300),
  add column cover_image_credit text
    check (cover_image_credit is null or char_length(btrim(cover_image_credit)) between 1 and 200),
  add column cover_image_licence text check (
    cover_image_licence is null
    or cover_image_licence in (
      'cc0-1.0',
      'public-domain',
      'cc-by-2.0', 'cc-by-3.0', 'cc-by-4.0',
      'cc-by-sa-2.0', 'cc-by-sa-3.0', 'cc-by-sa-4.0'
    )
  ),
  -- The original file's page (e.g. its Wikimedia Commons file page): the
  -- "source" part of the attribution, and the evidence for the licence.
  add column cover_image_source_url text check (
    cover_image_source_url is null
    or (char_length(cover_image_source_url) <= 500
        and cover_image_source_url ~ '^https://[A-Za-z0-9.-]+(/[^[:space:]<>"]*)?$')
  ),

  -- All-or-nothing: a cover always carries alt text, credit, licence and
  -- source; and no orphaned credit/licence without a cover.
  add constraint education_resources_cover_complete check (
    (cover_image_path is null
      and cover_thumb_path is null
      and cover_image_alt is null
      and cover_image_credit is null
      and cover_image_licence is null
      and cover_image_source_url is null)
    or
    (cover_image_path is not null
      and cover_image_alt is not null
      and cover_image_credit is not null
      and cover_image_licence is not null
      and cover_image_source_url is not null)
  ),

  -- A guide's files can only live in its own folder.
  add constraint education_resources_cover_in_own_folder check (
    (cover_image_path is null or split_part(cover_image_path, '/', 1) = id)
    and (cover_thumb_path is null or split_part(cover_thumb_path, '/', 1) = id)
  );

-- === education-media storage =================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'education-media',
  'education-media',
  false,
  307200, -- 300 KB: an optimised 1280px WebP cover is ~120-180 KB
  array['image/jpeg', 'image/webp']
);

-- Files of guides the reader can see. The subquery runs with the
-- reader's education_resources RLS ("published only"), so a cover
-- uploaded for an unpublished guide stays unreadable until it is
-- published. Deliberately no INSERT/UPDATE/DELETE policy (see header).
create policy "Signed-in users can view media of published education resources"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'education-media'
  and exists (
    select 1
    from public.education_resources r
    where r.id = (storage.foldername(name))[1]
  )
);
