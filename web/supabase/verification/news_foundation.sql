-- Verification script for 20261008130000_add_news_foundation.sql
--
-- Run in the Supabase SQL editor (or via the Supabase MCP execute_sql).
-- It is NOT a migration and changes nothing: it creates a farmer F and an
-- admin A, adds draft / scheduled / expired / archived articles as the
-- project owner, exercises news_* tables and the news-media bucket as
-- anon, F and A, then ALWAYS ends with RAISE EXCEPTION, which rolls every
-- change back. The results are in the error message ("VERIFY_RESULTS
-- ..."). To test the migration before it is applied, send
-- `begin; <migration> <this script>` in one call.
--
-- Expected output:
--    1 seeds categories / sources / published / featured: 5 / 1 / 5 / 2
--    2 bucket public / size / types: true / 5242880 / {image/jpeg,image/png,image/webp}
--    3 anon reads categories / sources / articles: 5 / 1 / 5
--    4 anon featured in rank order: welcome-to-agriculture-today,how-to-read-market-prices
--    5 anon select *: DENIED 42501
--    6 anon reads created_by: DENIED 42501
--    7 anon reads external_ref: DENIED 42501
--    8 anon inserts an article: DENIED 42501
--    9 anon updates an article: DENIED 42501
--   10 anon deletes an article: DENIED 42501
--   11 anon inserts a category: DENIED 42501
--   12 anon lists news-media objects: rows = 0
--   13 anon uploads to news-media: DENIED 42501
--   14 farmer reads articles (5 seeded + 4 hidden): 5
--   15 farmer reads a draft by slug: rows = 0
--   16 farmer inserts an article: DENIED 42501
--   17 farmer updates an article: DENIED 42501
--   18 farmer deletes an article: DENIED 42501
--   19 farmer uploads to news-media: DENIED 42501
--   20 farmer lists news-media objects: rows = 0
--   21 admin reads articles: 9
--   22 admin inserts an article directly: DENIED 42501
--   23 admin updates an article directly: DENIED 42501
--   24 admin uploads cover into <uuid>/ folder: ALLOWED
--   25 admin uploads outside a <uuid>/ folder: DENIED 42501
--   26 admin lists news-media objects: rows = 1
--   27 admin deletes the cover: DENIED 42501 Direct deletion from storage
--      tables is not allowed. Use the Storage API instead.
--      (Supabase blocks SQL deletes on storage.objects for everyone; the
--      delete policy is exercised through the Storage API instead.)
--   28 external_linked with a body: REJECTED 23514
--   29 external_linked without a link: REJECTED 23514
--   30 hosted article without a body: REJECTED 23514
--   31 published without published_at: REJECTED 23514
--   32 county on a non-Kenya story: REJECTED 23514
--   33 featured_rank without is_featured: REJECTED 23514
--   34 http:// external_url: REJECTED 23514
--   35 bad cover path: REJECTED 23514
--   36 bad slug: REJECTED 23514
--   37 unknown region: REJECTED 23514
--   38 duplicate external_ref: REJECTED 23505
--   39 expires before publish: REJECTED 23514
--   40 valid external_linked summary: ALLOWED
--   41 update moves updated_at forward: true
--   42 anon can execute trigger function: false
--
-- Uses phone numbers 19990000941-942, which must not belong to real
-- accounts.
do $$
declare
  f uuid := gen_random_uuid();
  a uuid := gen_random_uuid();
  art uuid := gen_random_uuid();
  draft_id uuid;
  n int; n2 int; n3 int; n4 int;
  t text;
  b boolean;
  ts timestamptz;
  r text := '';
begin
  insert into auth.users (id, aud, role, phone, created_at, updated_at) values
    (f, 'authenticated', 'authenticated', '19990000941', now(), now()),
    (a, 'authenticated', 'authenticated', '19990000942', now(), now());
  insert into public.staff_roles (profile_id, role) values (a, 'admin');

  -- Seeds and bucket, as the owner.
  select count(*) into n from public.news_categories;
  select count(*) into n2 from public.news_sources;
  select count(*) into n3 from public.news_articles where status = 'published';
  select count(*) into n4 from public.news_articles where status = 'published' and is_featured;
  r := r || E'\n 1 seeds categories / sources / published / featured: ' || n || ' / ' || n2 || ' / ' || n3 || ' / ' || n4;
  select public::text || ' / ' || file_size_limit || ' / ' || allowed_mime_types::text into t
  from storage.buckets where id = 'news-media';
  r := r || E'\n 2 bucket public / size / types: ' || t;

  -- Hidden articles, as the owner: draft, scheduled, expired, archived.
  insert into public.news_articles (slug, category_id, region, title, summary, body, origin, status, updated_at)
  values ('verify-draft', 'agriculture', 'kenya', 'Draft', 'Draft', 'Draft', 'shamba_original', 'draft', now() - interval '1 day')
  returning id into draft_id;
  insert into public.news_articles (slug, category_id, region, title, summary, body, origin, status, published_at)
  values ('verify-scheduled', 'agriculture', 'kenya', 'Later', 'Later', 'Later', 'shamba_original', 'published', now() + interval '1 day');
  insert into public.news_articles (slug, category_id, region, title, summary, body, origin, status, published_at, expires_at)
  values ('verify-expired', 'agriculture', 'kenya', 'Old', 'Old', 'Old', 'shamba_original', 'published', now() - interval '2 days', now() - interval '1 day');
  insert into public.news_articles (slug, category_id, region, title, summary, body, origin, status, published_at)
  values ('verify-archived', 'agriculture', 'kenya', 'Gone', 'Gone', 'Gone', 'shamba_original', 'archived', now() - interval '1 day');

  -- Anonymous.
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  set local role anon;
  select count(*) into n from public.news_categories;
  select count(*) into n2 from public.news_sources;
  select count(id) into n3 from public.news_articles;
  r := r || E'\n 3 anon reads categories / sources / articles: ' || n || ' / ' || n2 || ' / ' || n3;
  select string_agg(slug, ',' order by featured_rank) into t from public.news_articles where is_featured;
  r := r || E'\n 4 anon featured in rank order: ' || coalesce(t, '(none)');
  begin
    execute 'select count(*) from (select * from public.news_articles) s' into n;
    r := r || E'\n 5 anon select *: ALLOWED';
  exception when others then r := r || E'\n 5 anon select *: DENIED ' || sqlstate;
  end;
  begin
    execute 'select count(created_by) from public.news_articles' into n;
    r := r || E'\n 6 anon reads created_by: ALLOWED';
  exception when others then r := r || E'\n 6 anon reads created_by: DENIED ' || sqlstate;
  end;
  begin
    execute 'select count(external_ref) from public.news_articles' into n;
    r := r || E'\n 7 anon reads external_ref: ALLOWED';
  exception when others then r := r || E'\n 7 anon reads external_ref: DENIED ' || sqlstate;
  end;
  begin
    insert into public.news_articles (slug, category_id, region, title, summary, body, origin, status, published_at)
    values ('anon-x', 'agriculture', 'kenya', 'x', 'x', 'x', 'shamba_original', 'published', now());
    r := r || E'\n 8 anon inserts an article: ALLOWED';
  exception when others then r := r || E'\n 8 anon inserts an article: DENIED ' || sqlstate;
  end;
  begin
    update public.news_articles set title = 'hacked' where slug = 'welcome-to-agriculture-today';
    get diagnostics n = row_count;
    r := r || E'\n 9 anon updates an article: rows = ' || n;
  exception when others then r := r || E'\n 9 anon updates an article: DENIED ' || sqlstate;
  end;
  begin
    delete from public.news_articles where slug = 'welcome-to-agriculture-today';
    get diagnostics n = row_count;
    r := r || E'\n10 anon deletes an article: rows = ' || n;
  exception when others then r := r || E'\n10 anon deletes an article: DENIED ' || sqlstate;
  end;
  begin
    insert into public.news_categories (id, name, sort_order) values ('x', 'x', 1);
    r := r || E'\n11 anon inserts a category: ALLOWED';
  exception when others then r := r || E'\n11 anon inserts a category: DENIED ' || sqlstate;
  end;
  begin
    select count(*) into n from storage.objects where bucket_id = 'news-media';
    r := r || E'\n12 anon lists news-media objects: rows = ' || n;
  exception when others then r := r || E'\n12 anon lists news-media objects: DENIED ' || sqlstate;
  end;
  begin
    insert into storage.objects (bucket_id, name, metadata)
    values ('news-media', art || '/anon.webp', '{"mimetype":"image/webp","size":1000}');
    r := r || E'\n13 anon uploads to news-media: ALLOWED';
  exception when others then r := r || E'\n13 anon uploads to news-media: DENIED ' || sqlstate;
  end;
  reset role;

  -- Farmer F.
  perform set_config('request.jwt.claims', json_build_object('sub', f, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(id) into n from public.news_articles;
  r := r || E'\n14 farmer reads articles (5 seeded + 4 hidden): ' || n;
  select count(id) into n from public.news_articles where slug = 'verify-draft';
  r := r || E'\n15 farmer reads a draft by slug: rows = ' || n;
  begin
    insert into public.news_articles (slug, category_id, region, title, summary, body, origin, status, published_at)
    values ('farmer-x', 'agriculture', 'kenya', 'x', 'x', 'x', 'shamba_original', 'published', now());
    r := r || E'\n16 farmer inserts an article: ALLOWED';
  exception when others then r := r || E'\n16 farmer inserts an article: DENIED ' || sqlstate;
  end;
  begin
    update public.news_articles set title = 'hacked' where slug = 'welcome-to-agriculture-today';
    get diagnostics n = row_count;
    r := r || E'\n17 farmer updates an article: rows = ' || n;
  exception when others then r := r || E'\n17 farmer updates an article: DENIED ' || sqlstate;
  end;
  begin
    delete from public.news_articles where slug = 'welcome-to-agriculture-today';
    get diagnostics n = row_count;
    r := r || E'\n18 farmer deletes an article: rows = ' || n;
  exception when others then r := r || E'\n18 farmer deletes an article: DENIED ' || sqlstate;
  end;
  begin
    insert into storage.objects (bucket_id, name, owner, owner_id, metadata)
    values ('news-media', art || '/farmer.webp', f, f::text, '{"mimetype":"image/webp","size":1000}');
    r := r || E'\n19 farmer uploads to news-media: ALLOWED';
  exception when others then r := r || E'\n19 farmer uploads to news-media: DENIED ' || sqlstate;
  end;
  select count(*) into n from storage.objects where bucket_id = 'news-media';
  r := r || E'\n20 farmer lists news-media objects: rows = ' || n;
  reset role;

  -- Admin A.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(id) into n from public.news_articles;
  r := r || E'\n21 admin reads articles: ' || n;
  begin
    insert into public.news_articles (slug, category_id, region, title, summary, body, origin)
    values ('admin-x', 'agriculture', 'kenya', 'x', 'x', 'x', 'shamba_original');
    r := r || E'\n22 admin inserts an article directly: ALLOWED';
  exception when others then r := r || E'\n22 admin inserts an article directly: DENIED ' || sqlstate;
  end;
  begin
    update public.news_articles set title = 'x' where id = draft_id;
    get diagnostics n = row_count;
    r := r || E'\n23 admin updates an article directly: rows = ' || n;
  exception when others then r := r || E'\n23 admin updates an article directly: DENIED ' || sqlstate;
  end;
  begin
    insert into storage.objects (bucket_id, name, owner, owner_id, metadata)
    values ('news-media', art || '/cover.webp', a, a::text, '{"mimetype":"image/webp","size":1000}');
    r := r || E'\n24 admin uploads cover into <uuid>/ folder: ALLOWED';
  exception when others then r := r || E'\n24 admin uploads cover into <uuid>/ folder: DENIED ' || sqlstate || ' ' || sqlerrm;
  end;
  begin
    insert into storage.objects (bucket_id, name, owner, owner_id, metadata)
    values ('news-media', 'loose/cover.webp', a, a::text, '{"mimetype":"image/webp","size":1000}');
    r := r || E'\n25 admin uploads outside a <uuid>/ folder: ALLOWED';
  exception when others then r := r || E'\n25 admin uploads outside a <uuid>/ folder: DENIED ' || sqlstate;
  end;
  select count(*) into n from storage.objects where bucket_id = 'news-media';
  r := r || E'\n26 admin lists news-media objects: rows = ' || n;
  begin
    delete from storage.objects where bucket_id = 'news-media' and name = art || '/cover.webp';
    get diagnostics n = row_count;
    r := r || E'\n27 admin deletes the cover: rows = ' || n;
  exception when others then r := r || E'\n27 admin deletes the cover: DENIED ' || sqlstate || ' ' || sqlerrm;
  end;
  reset role;

  -- Constraints, as the owner.
  begin
    insert into public.news_articles (slug, category_id, region, title, summary, body, origin, external_url)
    values ('c28', 'agriculture', 'global', 'x', 'x', 'copied text', 'external_linked', 'https://example.org/a');
    r := r || E'\n28 external_linked with a body: ALLOWED';
  exception when others then r := r || E'\n28 external_linked with a body: REJECTED ' || sqlstate;
  end;
  begin
    insert into public.news_articles (slug, category_id, region, title, summary, origin)
    values ('c29', 'agriculture', 'global', 'x', 'x', 'external_linked');
    r := r || E'\n29 external_linked without a link: ALLOWED';
  exception when others then r := r || E'\n29 external_linked without a link: REJECTED ' || sqlstate;
  end;
  begin
    insert into public.news_articles (slug, category_id, region, title, summary, origin)
    values ('c30', 'agriculture', 'global', 'x', 'x', 'shamba_original');
    r := r || E'\n30 hosted article without a body: ALLOWED';
  exception when others then r := r || E'\n30 hosted article without a body: REJECTED ' || sqlstate;
  end;
  begin
    insert into public.news_articles (slug, category_id, region, title, summary, body, origin, status)
    values ('c31', 'agriculture', 'global', 'x', 'x', 'x', 'shamba_original', 'published');
    r := r || E'\n31 published without published_at: ALLOWED';
  exception when others then r := r || E'\n31 published without published_at: REJECTED ' || sqlstate;
  end;
  begin
    insert into public.news_articles (slug, category_id, region, county_id, title, summary, body, origin)
    select 'c32', 'agriculture', 'africa', id, 'x', 'x', 'x', 'shamba_original' from public.counties limit 1;
    r := r || E'\n32 county on a non-Kenya story: ALLOWED';
  exception when others then r := r || E'\n32 county on a non-Kenya story: REJECTED ' || sqlstate;
  end;
  begin
    insert into public.news_articles (slug, category_id, region, title, summary, body, origin, featured_rank)
    values ('c33', 'agriculture', 'global', 'x', 'x', 'x', 'shamba_original', 1);
    r := r || E'\n33 featured_rank without is_featured: ALLOWED';
  exception when others then r := r || E'\n33 featured_rank without is_featured: REJECTED ' || sqlstate;
  end;
  begin
    insert into public.news_articles (slug, category_id, region, title, summary, origin, external_url)
    values ('c34', 'agriculture', 'global', 'x', 'x', 'external_linked', 'http://example.org/a');
    r := r || E'\n34 http:// external_url: ALLOWED';
  exception when others then r := r || E'\n34 http:// external_url: REJECTED ' || sqlstate;
  end;
  begin
    insert into public.news_articles (slug, category_id, region, title, summary, body, origin, cover_image_path)
    values ('c35', 'agriculture', 'global', 'x', 'x', 'x', 'shamba_original', '../avatars/x.png');
    r := r || E'\n35 bad cover path: ALLOWED';
  exception when others then r := r || E'\n35 bad cover path: REJECTED ' || sqlstate;
  end;
  begin
    insert into public.news_articles (slug, category_id, region, title, summary, body, origin)
    values ('Bad Slug!', 'agriculture', 'global', 'x', 'x', 'x', 'shamba_original');
    r := r || E'\n36 bad slug: ALLOWED';
  exception when others then r := r || E'\n36 bad slug: REJECTED ' || sqlstate;
  end;
  begin
    insert into public.news_articles (slug, category_id, region, title, summary, body, origin)
    values ('c37', 'agriculture', 'europe', 'x', 'x', 'x', 'shamba_original');
    r := r || E'\n37 unknown region: ALLOWED';
  exception when others then r := r || E'\n37 unknown region: REJECTED ' || sqlstate;
  end;
  begin
    insert into public.news_articles (slug, category_id, region, title, summary, body, origin, external_ref) values
      ('c38a', 'agriculture', 'global', 'x', 'x', 'x', 'shamba_original', 'feed:1'),
      ('c38b', 'agriculture', 'global', 'x', 'x', 'x', 'shamba_original', 'feed:1');
    r := r || E'\n38 duplicate external_ref: ALLOWED';
  exception when others then r := r || E'\n38 duplicate external_ref: REJECTED ' || sqlstate;
  end;
  begin
    insert into public.news_articles (slug, category_id, region, title, summary, body, origin, status, published_at, expires_at)
    values ('c39', 'agriculture', 'global', 'x', 'x', 'x', 'shamba_original', 'published', now(), now() - interval '1 hour');
    r := r || E'\n39 expires before publish: ALLOWED';
  exception when others then r := r || E'\n39 expires before publish: REJECTED ' || sqlstate;
  end;
  begin
    insert into public.news_articles (slug, category_id, region, title, summary, origin, external_url, cover_image_path)
    values ('c40', 'markets-prices', 'africa', 'x', 'x', 'external_linked', 'https://example.org/a', art || '/cover.webp');
    r := r || E'\n40 valid external_linked summary: ALLOWED';
  exception when others then r := r || E'\n40 valid external_linked summary: REJECTED ' || sqlstate || ' ' || sqlerrm;
  end;

  -- updated_at trigger.
  select updated_at into ts from public.news_articles where id = draft_id;
  update public.news_articles set title = 'Draft 2' where id = draft_id;
  select updated_at > ts into b from public.news_articles where id = draft_id;
  r := r || E'\n41 update moves updated_at forward: ' || b;

  r := r || E'\n42 anon can execute trigger function: '
    || has_function_privilege('anon', 'public.set_news_articles_updated_at()', 'execute');

  raise exception 'VERIFY_RESULTS (rolled back):%', r;
end $$;
