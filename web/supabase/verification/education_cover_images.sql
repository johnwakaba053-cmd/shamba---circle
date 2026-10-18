-- Verification script for 20261012120000_add_education_cover_images.sql
--
-- Run in the Supabase SQL editor (or via the Supabase MCP execute_sql).
-- It is NOT a migration and changes nothing: it creates a farmer F and a
-- throwaway unpublished guide, tries good and bad covers, simulates
-- uploaded files by inserting storage.objects rows (which runs the same
-- policies the Storage API does), checks what anon and F can read and
-- write, then ALWAYS ends with RAISE EXCEPTION, which rolls every change
-- back. To test the migration before it is applied, send
-- `begin; <migration> <this script>` in one call.
--
-- Expected output:
--    1 education-media bucket public / size limit / types: false / 307200 / {image/jpeg,image/webp}
--    2 education-media policies: SELECT {authenticated} (exactly one)
--    3 pilot guides found / published / Shamba Space Original: 5 / 5 / 5
--      (avocado / bees / maize / poultry / rabbits topics)
--    4 guides with any cover field set: 0
--    5 rejected covers (each 23514):
--      no credit / other guide's folder / '..' / uppercase / .png /
--      NonCommercial licence / http source / thumb without cover /
--      credit without cover
--    6 complete valid cover accepted: true
--    7 farmer sees the published guide's file / the unpublished guide's file: 1 / 0
--    8 anon sees education-media files: 0 (or DENIED 42501)
--    9 farmer uploads to education-media: DENIED 42501
--   10 farmer updates / deletes an education-media file: 0 / 0 rows
--   11 farmer sets a guide's cover: 0 rows (no update policy)
--   12 storage.objects policies without a bucket_id filter (any bucket,
--      including ones made in the dashboard): none
--
-- Line 10 may read "DENIED <sqlstate>" instead of "0" on projects whose
-- Storage blocks direct UPDATE/DELETE on storage tables with a trigger;
-- either way the farmer changed nothing.
--
-- Uses phone number 19990000998 (no other verification script uses it),
-- which must not belong to a real account.
do $$
declare
  f uuid := gen_random_uuid();
  pilot text[] := array[
    'shamba-space-indigenous-chicken-guide',
    'shamba-space-rabbits-guide',
    'shamba-space-beekeeping-guide',
    'shamba-space-avocado-guide',
    'shamba-space-maize-guide'
  ];
  draft text := 'verify-cover-unpublished-guide';
  n int; n2 int; n3 int;
  t text;
  r text := '';

  -- One bad cover attempt on the maize guide: reports the SQLSTATE.
  bad text;
begin
  insert into auth.users (id, aud, role, phone, created_at, updated_at) values
    (f, 'authenticated', 'authenticated', '19990000998', now(), now());

  insert into public.education_resources (id, category_id, title, summary, content, is_published)
  values (draft, 'crop-farming', 'Unpublished test guide', 'Not published.', 'Test.', false);

  -- 1-2: bucket and policies.
  select public::text || ' / ' || file_size_limit || ' / ' || allowed_mime_types::text
  into t from storage.buckets where id = 'education-media';
  r := r || E'\n 1 education-media bucket public / size limit / types: ' || coalesce(t, 'MISSING');

  select string_agg(cmd || ' ' || roles::text, ', '), count(*)
  into t, n
  from pg_policies
  where schemaname = 'storage' and tablename = 'objects'
    and (qual like '%education-media%' or with_check like '%education-media%');
  r := r || E'\n 2 education-media policies: ' || coalesce(t, 'none') || ' (' || n || ')';

  -- 3-4: the pilot guides as they exist.
  select count(*), count(*) filter (where is_published), count(*) filter (where origin = 'shamba_original'),
         string_agg(topic_id, ' / ' order by topic_id)
  into n, n2, n3, t
  from public.education_resources where id = any (pilot);
  r := r || E'\n 3 pilot guides found / published / Shamba Space Original: ' || n || ' / ' || n2 || ' / ' || n3
    || E'\n     (' || coalesce(t, '') || ' topics)';

  select count(*) into n from public.education_resources
  where cover_image_path is not null or cover_thumb_path is not null or cover_image_alt is not null
     or cover_image_credit is not null or cover_image_licence is not null or cover_image_source_url is not null;
  r := r || E'\n 4 guides with any cover field set: ' || n;

  -- 5: every rule rejects a bad cover.
  t := '';
  foreach bad in array array[
    -- no credit
    $q$update public.education_resources set cover_image_path = 'shamba-space-maize-guide/cover.webp',
       cover_image_alt = 'Maize', cover_image_licence = 'cc-by-4.0',
       cover_image_source_url = 'https://commons.wikimedia.org/wiki/File:X.jpg'
       where id = 'shamba-space-maize-guide'$q$,
    -- another guide's folder
    $q$update public.education_resources set cover_image_path = 'shamba-space-rabbits-guide/cover.webp',
       cover_image_alt = 'Maize', cover_image_credit = 'A', cover_image_licence = 'cc-by-4.0',
       cover_image_source_url = 'https://commons.wikimedia.org/wiki/File:X.jpg'
       where id = 'shamba-space-maize-guide'$q$,
    -- '..'
    $q$update public.education_resources set cover_image_path = 'shamba-space-maize-guide/../x.webp',
       cover_image_alt = 'Maize', cover_image_credit = 'A', cover_image_licence = 'cc-by-4.0',
       cover_image_source_url = 'https://commons.wikimedia.org/wiki/File:X.jpg'
       where id = 'shamba-space-maize-guide'$q$,
    -- uppercase file name
    $q$update public.education_resources set cover_image_path = 'shamba-space-maize-guide/Cover.webp',
       cover_image_alt = 'Maize', cover_image_credit = 'A', cover_image_licence = 'cc-by-4.0',
       cover_image_source_url = 'https://commons.wikimedia.org/wiki/File:X.jpg'
       where id = 'shamba-space-maize-guide'$q$,
    -- .png
    $q$update public.education_resources set cover_image_path = 'shamba-space-maize-guide/cover.png',
       cover_image_alt = 'Maize', cover_image_credit = 'A', cover_image_licence = 'cc-by-4.0',
       cover_image_source_url = 'https://commons.wikimedia.org/wiki/File:X.jpg'
       where id = 'shamba-space-maize-guide'$q$,
    -- NonCommercial licence
    $q$update public.education_resources set cover_image_path = 'shamba-space-maize-guide/cover.webp',
       cover_image_alt = 'Maize', cover_image_credit = 'A', cover_image_licence = 'cc-by-nc-4.0',
       cover_image_source_url = 'https://commons.wikimedia.org/wiki/File:X.jpg'
       where id = 'shamba-space-maize-guide'$q$,
    -- http source
    $q$update public.education_resources set cover_image_path = 'shamba-space-maize-guide/cover.webp',
       cover_image_alt = 'Maize', cover_image_credit = 'A', cover_image_licence = 'cc-by-4.0',
       cover_image_source_url = 'http://commons.wikimedia.org/wiki/File:X.jpg'
       where id = 'shamba-space-maize-guide'$q$,
    -- thumb without cover
    $q$update public.education_resources set cover_thumb_path = 'shamba-space-maize-guide/thumb.webp'
       where id = 'shamba-space-maize-guide'$q$,
    -- credit without cover
    $q$update public.education_resources set cover_image_credit = 'A'
       where id = 'shamba-space-maize-guide'$q$
  ] loop
    begin
      execute bad;
      t := t || ' ACCEPTED';
    exception when others then
      t := t || ' ' || sqlstate;
    end;
  end loop;
  r := r || E'\n 5 rejected covers:' || t;

  -- 6: a complete cover is accepted.
  update public.education_resources set
    cover_image_path = 'shamba-space-maize-guide/cover-1280.webp',
    cover_thumb_path = 'shamba-space-maize-guide/cover-640.webp',
    cover_image_alt = 'Maize plants with tassels in a field',
    cover_image_credit = 'Test Author',
    cover_image_licence = 'cc-by-sa-4.0',
    cover_image_source_url = 'https://commons.wikimedia.org/wiki/File:Example.jpg'
  where id = 'shamba-space-maize-guide';
  get diagnostics n = row_count;
  r := r || E'\n 6 complete valid cover accepted: ' || (n = 1);

  -- Simulated uploads (as the owner, like a dashboard upload).
  insert into storage.objects (bucket_id, name, metadata) values
    ('education-media', 'shamba-space-maize-guide/cover-1280.webp', '{"mimetype":"image/webp","size":150000}'),
    ('education-media', draft || '/cover-1280.webp', '{"mimetype":"image/webp","size":150000}');

  -- 7, 9-11: a signed-in farmer.
  perform set_config('request.jwt.claims', json_build_object('sub', f, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from storage.objects
  where bucket_id = 'education-media' and name like 'shamba-space-maize-guide/%';
  select count(*) into n2 from storage.objects
  where bucket_id = 'education-media' and name like draft || '/%';
  r := r || E'\n 7 farmer sees the published guide''s file / the unpublished guide''s file: ' || n || ' / ' || n2;

  begin
    insert into storage.objects (bucket_id, name, owner, owner_id, metadata)
    values ('education-media', 'shamba-space-maize-guide/evil.webp', f, f::text, '{"mimetype":"image/webp","size":1}');
    r := r || E'\n 9 farmer uploads to education-media: ALLOWED';
  exception when others then
    r := r || E'\n 9 farmer uploads to education-media: DENIED ' || sqlstate;
  end;

  t := '';
  begin
    update storage.objects set name = 'shamba-space-maize-guide/moved.webp'
    where bucket_id = 'education-media' and name = 'shamba-space-maize-guide/cover-1280.webp';
    get diagnostics n = row_count;
    t := t || ' ' || n;
  exception when others then
    t := t || ' DENIED ' || sqlstate;
  end;
  begin
    delete from storage.objects
    where bucket_id = 'education-media' and name = 'shamba-space-maize-guide/cover-1280.webp';
    get diagnostics n = row_count;
    t := t || ' / ' || n || ' rows';
  exception when others then
    t := t || ' / DENIED ' || sqlstate;
  end;
  r := r || E'\n10 farmer updates / deletes an education-media file:' || t;

  begin
    update public.education_resources set cover_image_alt = 'Changed by a farmer'
    where id = 'shamba-space-maize-guide';
    get diagnostics n = row_count;
    r := r || E'\n11 farmer sets a guide''s cover: ' || n || ' rows';
  exception when others then
    r := r || E'\n11 farmer sets a guide''s cover: DENIED ' || sqlstate;
  end;
  reset role;

  -- 8: signed out.
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  set local role anon;
  begin
    select count(*) into n from storage.objects where bucket_id = 'education-media';
    r := r || E'\n 8 anon sees education-media files: ' || n;
  exception when others then
    r := r || E'\n 8 anon sees education-media files: DENIED ' || sqlstate;
  end;
  reset role;

  -- 12: no storage rule anywhere reaches across buckets.
  select string_agg(policyname, ', ') into t
  from pg_policies
  where schemaname = 'storage' and tablename = 'objects'
    and coalesce(qual, '') not like '%bucket_id%'
    and coalesce(with_check, '') not like '%bucket_id%';
  r := r || E'\n12 storage.objects policies without a bucket_id filter: ' || coalesce(t, 'none');

  raise exception 'VERIFY_RESULTS (rolled back):%', r;
end $$;
