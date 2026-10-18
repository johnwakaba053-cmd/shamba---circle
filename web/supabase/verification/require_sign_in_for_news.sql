-- Verification script for 20261009110000_require_sign_in_for_news.sql
--
-- Run in the Supabase SQL editor (or via the Supabase MCP execute_sql).
-- It is NOT a migration and changes nothing: it creates a farmer F and an
-- admin A, has A build and publish a photo story (with uploaded files)
-- and keep a draft with a file, checks what anon, F and A can read, then
-- ALWAYS ends with RAISE EXCEPTION, which rolls every change back.
-- Storage files are simulated by inserting storage.objects rows, which
-- runs the same policies the Storage API does. To test the migration
-- before it is applied, send `begin; <migration> <this script>` in one
-- call.
--
-- Expected output:
--    1 news-media bucket public: false
--    2 anon holds any grant on the 5 news tables (table or column): false
--    3 anon reads articles / media / price links / categories / sources:
--      DENIED 42501 x5
--    4 farmer reads published seed articles / categories / sources: 5 / 5 / 14
--    5 admin publishes a photo story with 2 uploaded images: published
--    6 farmer sees the photo story / its media / its files: 1 / 2 / 2
--    7 farmer sees the draft / the draft's file: 0 / 0
--    8 admin sees the draft / the draft's file: 1 / 1
--    9 anon sees news-media files: 0
--   10 farmer sees price links of live stories (none linked): 0
--   11 admin reads every article (matches the owner's count): true
--   12 import_news_draft: service_role yes, anon no, signed-in no: true / false / false
--   13 counties still readable signed out: true
--   14 reader policies now for signed-in users only:
--      (5 "Signed-in users can view ..." policies, roles {authenticated})
--
-- Uses phone numbers 19990000991-992, which must not belong to real
-- accounts.
do $$
declare
  f uuid := gen_random_uuid();
  a uuid := gen_random_uuid();
  photo uuid;
  draft uuid;
  importer oid;
  n int; n2 int; n3 int;
  t text;
  r text := '';
begin
  insert into auth.users (id, aud, role, phone, created_at, updated_at) values
    (f, 'authenticated', 'authenticated', '19990000991', now(), now()),
    (a, 'authenticated', 'authenticated', '19990000992', now(), now());
  insert into public.staff_roles (profile_id, role) values (a, 'admin');

  select public::text into t from storage.buckets where id = 'news-media';
  r := r || E'\n 1 news-media bucket public: ' || t;

  r := r || E'\n 2 anon holds any grant on the 5 news tables (table or column): ' || (
    exists (
      select 1 from information_schema.role_table_grants
      where table_schema = 'public' and grantee = 'anon'
        and table_name in ('news_articles', 'news_media', 'news_article_price_products', 'news_categories', 'news_sources')
    )
    or exists (
      select 1 from information_schema.column_privileges
      where table_schema = 'public' and grantee = 'anon'
        and table_name in ('news_articles', 'news_media', 'news_article_price_products', 'news_categories', 'news_sources')
    )
  );

  -- Signed out (the public API with the anon key).
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  set local role anon;
  t := '';
  begin select count(*) into n from public.news_articles; t := t || ' rows ' || n;
  exception when others then t := t || ' DENIED ' || sqlstate; end;
  begin select count(*) into n from public.news_media; t := t || ' rows ' || n;
  exception when others then t := t || ' DENIED ' || sqlstate; end;
  begin select count(*) into n from public.news_article_price_products; t := t || ' rows ' || n;
  exception when others then t := t || ' DENIED ' || sqlstate; end;
  begin select count(*) into n from public.news_categories; t := t || ' rows ' || n;
  exception when others then t := t || ' DENIED ' || sqlstate; end;
  begin select count(*) into n from public.news_sources; t := t || ' rows ' || n;
  exception when others then t := t || ' DENIED ' || sqlstate; end;
  r := r || E'\n 3 anon reads articles / media / price links / categories / sources:' || t;
  reset role;

  -- A signed-in farmer.
  perform set_config('request.jwt.claims', json_build_object('sub', f, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.news_articles
  where slug in ('welcome-to-agriculture-today', 'how-to-read-market-prices', 'understanding-agriculture-stocks',
                 'farm-technology-for-smallholders', 'ai-in-farming-what-to-expect');
  select count(*) into n2 from public.news_categories;
  select count(*) into n3 from public.news_sources;
  r := r || E'\n 4 farmer reads published seed articles / categories / sources: ' || n || ' / ' || n2 || ' / ' || n3;
  reset role;

  -- The admin: a published photo story with two files, and a draft with
  -- one file.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  photo := public.admin_save_news_article(
    null, 'verify-signed-in-photo-story', 'agriculture', 'kenya', 'Harvest in pictures', 'A photo story.',
    'shamba_original', 'Intro text.', 'shamba-space', null, null, null, null, null, 'photo_story', null
  );
  draft := public.admin_save_news_article(
    null, 'verify-signed-in-draft', 'agriculture', 'kenya', 'A draft', 'Not published.',
    'shamba_original', 'Draft text.', 'shamba-space', null, null, null, null, null, 'photo_story', null
  );
  insert into storage.objects (bucket_id, name, owner, owner_id, metadata) values
    ('news-media', photo || '/one.webp', a, a::text, '{"mimetype":"image/webp","size":1000}'),
    ('news-media', photo || '/two.webp', a, a::text, '{"mimetype":"image/webp","size":1000}'),
    ('news-media', draft || '/draft.webp', a, a::text, '{"mimetype":"image/webp","size":1000}');
  perform public.admin_add_news_media(photo, 'image', photo || '/one.webp', null, 'First', null, 'Credit');
  perform public.admin_add_news_media(photo, 'image', photo || '/two.webp', null, 'Second', null, 'Credit');
  perform public.admin_publish_news_article(photo);
  select status into t from public.news_articles where id = photo;
  r := r || E'\n 5 admin publishes a photo story with 2 uploaded images: ' || t;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', f, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.news_articles where id = photo;
  select count(*) into n2 from public.news_media where article_id = photo;
  select count(*) into n3 from storage.objects where bucket_id = 'news-media' and name like photo || '/%';
  r := r || E'\n 6 farmer sees the photo story / its media / its files: ' || n || ' / ' || n2 || ' / ' || n3;
  select count(*) into n from public.news_articles where id = draft;
  select count(*) into n2 from storage.objects where bucket_id = 'news-media' and name like draft || '/%';
  r := r || E'\n 7 farmer sees the draft / the draft''s file: ' || n || ' / ' || n2;
  select count(*) into n from public.news_article_price_products;
  r := r || E'\n10 farmer sees price links of live stories (none linked): ' || n;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.news_articles where id = draft;
  select count(*) into n2 from storage.objects where bucket_id = 'news-media' and name like draft || '/%';
  r := r || E'\n 8 admin sees the draft / the draft''s file: ' || n || ' / ' || n2;
  select count(*) into n from public.news_articles;
  reset role;
  select count(*) into n2 from public.news_articles;
  r := r || E'\n11 admin reads every article (matches the owner''s count): ' || (n = n2);

  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  set local role anon;
  begin
    select count(*) into n from storage.objects where bucket_id = 'news-media';
    r := r || E'\n 9 anon sees news-media files: ' || n;
  exception when others then r := r || E'\n 9 anon sees news-media files: DENIED ' || sqlstate;
  end;
  select count(*) into n from public.counties;
  r := r || E'\n13 counties still readable signed out: ' || (n > 0);
  reset role;

  select p.oid into importer from pg_proc p
  where p.proname = 'import_news_draft' and p.pronamespace = 'public'::regnamespace;
  r := r || E'\n12 import_news_draft: service_role yes, anon no, signed-in no: '
    || has_function_privilege('service_role', importer, 'execute')
    || ' / ' || has_function_privilege('anon', importer, 'execute')
    || ' / ' || has_function_privilege('authenticated', importer, 'execute');

  select string_agg(format(E'\n     %s.%s %s', tablename, policyname, roles::text), '' order by tablename)
  into t
  from pg_policies
  where schemaname = 'public'
    and tablename in ('news_articles', 'news_media', 'news_article_price_products', 'news_categories', 'news_sources')
    and policyname like 'Signed-in users can view%';
  r := r || E'\n14 reader policies now for signed-in users only:' || coalesce(t, ' none');

  raise exception 'VERIFY_RESULTS (rolled back):%', r;
end $$;
