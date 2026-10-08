-- Verification script for 20261008160000_add_news_formats_and_media.sql
--
-- Run in the Supabase SQL editor (or via the Supabase MCP execute_sql).
-- It is NOT a migration and changes nothing: it creates a farmer F and an
-- admin A, builds a photo story, a video story, an external_linked video
-- and a market update through the admin functions, checks what anon and
-- F can see and do, then ALWAYS ends with RAISE EXCEPTION, which rolls
-- every change back. Storage files are simulated by inserting
-- storage.objects rows, which runs the same policies the Storage API
-- does. To test the migration before it is applied, send
-- `begin; <migration> <this script>` in one call.
--
-- Expected output:
--    1 seeds: 5 articles, all format article, no byline: 5 / 5 / 0
--    2 anon reads format + byline columns: rows = 5
--    3 cover without credit: REJECTED 23514
--    4 old 14-argument save function gone: true
--    5 anon calls save / add / update / remove / reorder / prices: 42501 x6
--    6 farmer calls save / add / update / remove / reorder / prices: 42501 x6
--    7 anon / farmer write news_media directly: DENIED 42501 / DENIED 42501
--    8 admin writes news_media directly: DENIED 42501
--    9 admin creates photo story draft with byline: photo_story / Jane W.
--   10 add image whose file isn't uploaded: P0002 news_media_file_missing
--   11 add image without a credit: 23514
--   12 add image from another article's folder: 23514
--   13 add 2 credited images: ok, sort 0,1
--   14 add YouTube embed to a photo story: P0001 video_embed_needs_video_format
--   15 publish photo story: published; anon sees its media: 2
--   16 remove an image from the published photo story: 22023 photo_story_needs_2_images (still 2)
--   17 reorder with a wrong list: 22023
--   18 reorder reversed: first is now the second image: true
--   19 edit caption: true
--   20 farmer sees media of published photo story / draft linked video: 2 / 0
--   21 video story: bad id 23514, valid id ok, second embed P0001 video_already_set
--   22 publish video story without its embed: 22023 video_needs_1_video
--   23 publish video story with embed: published
--   24 change video story to article format: P0001 video_embed_needs_video_format
--   25 external_linked video: YouTube embed ok, image P0001 external_linked_cannot_host_images
--   26 change photo story to external_linked: P0001 external_linked_cannot_host_images
--   27 market update: publish w/o prices 22023, unknown product 23503, duplicates 22023
--   28 market update: 2 products linked, published; anon sees links: 2
--   29 clear prices on published market update: 22023 market_update_needs_prices
--   30 remove image from a draft returns its storage path: true
--   31 photo story audit trail:
--      created,media_added,media_added,published,media_reordered,media_updated
--   32 anon can execute any N4 admin function: false
--   33 signed-in users can execute assert_news_article_ready: false
--   34 seed articles unchanged (published / featured / format article): 5 / 2 / 5
--
-- Uses phone numbers 19990000981-982, which must not belong to real
-- accounts.
do $$
declare
  f uuid := gen_random_uuid();
  a uuid := gen_random_uuid();
  photo uuid;
  vid uuid;
  vid2 uuid;
  linked uuid;
  market uuid;
  other uuid := gen_random_uuid();
  m1 uuid; m2 uuid; m3 uuid;
  p1 text; p2 text;
  n int; n2 int; m int;
  t text;
  b boolean;
  r text := '';
begin
  insert into auth.users (id, aud, role, phone, created_at, updated_at) values
    (f, 'authenticated', 'authenticated', '19990000981', now(), now()),
    (a, 'authenticated', 'authenticated', '19990000982', now(), now());
  insert into public.staff_roles (profile_id, role) values (a, 'admin');
  select id into p1 from public.agricultural_price_products order by id limit 1;
  select id into p2 from public.agricultural_price_products order by id offset 1 limit 1;

  -- Existing data and schema, as the owner.
  select count(*), count(*) filter (where format = 'article'), count(byline) into n, n2, t
  from public.news_articles;
  r := r || E'\n 1 seeds: 5 articles, all format article, no byline: ' || n || ' / ' || n2 || ' / ' || t;
  begin
    insert into public.news_articles (slug, category_id, region, title, summary, body, origin, cover_image_path)
    values ('verify-cover', 'agriculture', 'kenya', 'x', 'x', 'x', 'shamba_original', other || '/c.webp');
    r := r || E'\n 3 cover without credit: ALLOWED';
  exception when others then r := r || E'\n 3 cover without credit: REJECTED ' || sqlstate;
  end;
  r := r || E'\n 4 old 14-argument save function gone: '
    || (to_regprocedure('public.admin_save_news_article(uuid, text, text, text, text, text, text, text, text, text, text, text, text, text)') is null);

  -- Anonymous.
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  set local role anon;
  select count(*) into n from (select format, byline from public.news_articles) s;
  r := r || E'\n 2 anon reads format + byline columns: rows = ' || n;
  t := '';
  begin perform public.admin_save_news_article(null, 'x', 'agriculture', 'kenya', 'x', 'x', 'shamba_original', 'x');
    t := t || 'ALLOWED '; exception when others then t := t || sqlstate || ' '; end;
  begin perform public.admin_add_news_media(gen_random_uuid(), 'video_embed', null, 'dQw4w9WgXcQ');
    t := t || 'ALLOWED '; exception when others then t := t || sqlstate || ' '; end;
  begin perform public.admin_update_news_media(gen_random_uuid(), 'x');
    t := t || 'ALLOWED '; exception when others then t := t || sqlstate || ' '; end;
  begin perform public.admin_remove_news_media(gen_random_uuid());
    t := t || 'ALLOWED '; exception when others then t := t || sqlstate || ' '; end;
  begin perform public.admin_reorder_news_media(gen_random_uuid(), '{}');
    t := t || 'ALLOWED '; exception when others then t := t || sqlstate || ' '; end;
  begin perform public.admin_set_news_price_products(gen_random_uuid(), '{}');
    t := t || 'ALLOWED '; exception when others then t := t || sqlstate || ' '; end;
  r := r || E'\n 5 anon calls save / add / update / remove / reorder / prices: ' || t;
  begin
    insert into public.news_media (article_id, kind, embed_provider, embed_id)
    select id, 'video_embed', 'youtube', 'dQw4w9WgXcQ' from public.news_articles limit 1;
    t := 'ALLOWED';
  exception when others then t := 'DENIED ' || sqlstate;
  end;
  reset role;

  -- Farmer F.
  perform set_config('request.jwt.claims', json_build_object('sub', f, 'role', 'authenticated')::text, true);
  set local role authenticated;
  r := r || E'\n 6 farmer calls save / add / update / remove / reorder / prices: ';
  begin perform public.admin_save_news_article(null, 'x', 'agriculture', 'kenya', 'x', 'x', 'shamba_original', 'x');
    r := r || 'ALLOWED '; exception when others then r := r || sqlstate || ' '; end;
  begin perform public.admin_add_news_media(gen_random_uuid(), 'video_embed', null, 'dQw4w9WgXcQ');
    r := r || 'ALLOWED '; exception when others then r := r || sqlstate || ' '; end;
  begin perform public.admin_update_news_media(gen_random_uuid(), 'x');
    r := r || 'ALLOWED '; exception when others then r := r || sqlstate || ' '; end;
  begin perform public.admin_remove_news_media(gen_random_uuid());
    r := r || 'ALLOWED '; exception when others then r := r || sqlstate || ' '; end;
  begin perform public.admin_reorder_news_media(gen_random_uuid(), '{}');
    r := r || 'ALLOWED '; exception when others then r := r || sqlstate || ' '; end;
  begin perform public.admin_set_news_price_products(gen_random_uuid(), '{}');
    r := r || 'ALLOWED '; exception when others then r := r || sqlstate || ' '; end;
  begin
    insert into public.news_media (article_id, kind, embed_provider, embed_id)
    select id, 'video_embed', 'youtube', 'dQw4w9WgXcQ' from public.news_articles limit 1;
    r := r || E'\n 7 anon / farmer write news_media directly: ' || t || ' / ALLOWED';
  exception when others then r := r || E'\n 7 anon / farmer write news_media directly: ' || t || ' / DENIED ' || sqlstate;
  end;
  reset role;

  -- Admin A: photo story.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    insert into public.news_media (article_id, kind, embed_provider, embed_id)
    select id, 'video_embed', 'youtube', 'dQw4w9WgXcQ' from public.news_articles limit 1;
    r := r || E'\n 8 admin writes news_media directly: ALLOWED';
  exception when others then r := r || E'\n 8 admin writes news_media directly: DENIED ' || sqlstate;
  end;

  photo := public.admin_save_news_article(
    null, 'verify-photo-story', 'agriculture', 'kenya', 'Harvest in pictures', 'A photo story.',
    'shamba_original', 'Intro text.', 'shamba-space', null, null, null, null, null, 'photo_story', ' Jane W. '
  );
  select format || ' / ' || byline into t from public.news_articles where id = photo;
  r := r || E'\n 9 admin creates photo story draft with byline: ' || t;

  begin
    perform public.admin_add_news_media(photo, 'image', photo || '/missing.webp', null, 'alt', null, 'Credit');
    r := r || E'\n10 add image whose file isn''t uploaded: ALLOWED';
  exception when others then r := r || E'\n10 add image whose file isn''t uploaded: ' || sqlstate || ' ' || sqlerrm;
  end;

  -- Upload three files as the admin (storage policies apply).
  insert into storage.objects (bucket_id, name, owner, owner_id, metadata) values
    ('news-media', photo || '/one.webp', a, a::text, '{"mimetype":"image/webp","size":1000}'),
    ('news-media', photo || '/two.webp', a, a::text, '{"mimetype":"image/webp","size":1000}'),
    ('news-media', photo || '/three.webp', a, a::text, '{"mimetype":"image/webp","size":1000}'),
    ('news-media', other || '/elsewhere.webp', a, a::text, '{"mimetype":"image/webp","size":1000}');

  begin
    perform public.admin_add_news_media(photo, 'image', photo || '/one.webp', null, 'Maize field', null, null);
    r := r || E'\n11 add image without a credit: ALLOWED';
  exception when others then r := r || E'\n11 add image without a credit: ' || sqlstate;
  end;
  begin
    perform public.admin_add_news_media(photo, 'image', other || '/elsewhere.webp', null, 'x', null, 'x');
    r := r || E'\n12 add image from another article''s folder: ALLOWED';
  exception when others then r := r || E'\n12 add image from another article''s folder: ' || sqlstate;
  end;
  m1 := public.admin_add_news_media(photo, 'image', photo || '/one.webp', null, 'Maize field', 'Morning harvest', 'Shamba Space');
  m2 := public.admin_add_news_media(photo, 'image', photo || '/two.webp', null, 'Drying cobs', null, 'Shamba Space');
  select string_agg(sort_order::text, ',' order by sort_order) into t from public.news_media where article_id = photo;
  r := r || E'\n13 add 2 credited images: ok, sort ' || t;
  begin
    perform public.admin_add_news_media(photo, 'video_embed', null, 'dQw4w9WgXcQ');
    r := r || E'\n14 add YouTube embed to a photo story: ALLOWED';
  exception when others then
    get stacked diagnostics t = pg_exception_detail;
    r := r || E'\n14 add YouTube embed to a photo story: ' || sqlstate || ' ' || t;
  end;

  perform public.admin_publish_news_article(photo);
  reset role;
  select status into t from public.news_articles where id = photo;
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  set local role anon;
  select count(*) into n from public.news_media where article_id = photo;
  r := r || E'\n15 publish photo story: ' || t || '; anon sees its media: ' || n;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.admin_remove_news_media(m1);
    r := r || E'\n16 remove an image from the published photo story: ALLOWED';
  exception when others then
    get stacked diagnostics t = pg_exception_detail;
    select count(*) into n from public.news_media where article_id = photo;
    r := r || E'\n16 remove an image from the published photo story: ' || sqlstate || ' ' || t || ' (still ' || n || ')';
  end;
  begin
    perform public.admin_reorder_news_media(photo, array[m1]);
    r := r || E'\n17 reorder with a wrong list: ALLOWED';
  exception when others then r := r || E'\n17 reorder with a wrong list: ' || sqlstate;
  end;
  perform public.admin_reorder_news_media(photo, array[m2, m1]);
  select id = m2 into b from public.news_media where article_id = photo order by sort_order limit 1;
  r := r || E'\n18 reorder reversed: first is now the second image: ' || b;
  perform public.admin_update_news_media(m1, 'Maize field', 'Edited caption', 'Shamba Space');
  select caption = 'Edited caption' into b from public.news_media where id = m1;
  r := r || E'\n19 edit caption: ' || b;
  reset role;

  -- Video stories.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  vid := public.admin_save_news_article(
    null, 'verify-video', 'farm-tech', 'africa', 'Drip kit demo', 'A video.',
    'shamba_original', 'About the video.', 'shamba-space', null, null, null, null, null, 'video'
  );
  r := r || E'\n21 video story: bad id ';
  begin perform public.admin_add_news_media(vid, 'video_embed', null, 'bad id!');
    r := r || 'ALLOWED'; exception when others then r := r || sqlstate; end;
  m3 := public.admin_add_news_media(vid, 'video_embed', null, 'dQw4w9WgXcQ', null, null, null, null, null, 212);
  r := r || ', valid id ok, second embed ';
  begin perform public.admin_add_news_media(vid, 'video_embed', null, 'abcdefghijk');
    r := r || 'ALLOWED'; exception when others then
      get stacked diagnostics t = pg_exception_detail;
      r := r || sqlstate || ' ' || t; end;

  vid2 := public.admin_save_news_article(
    null, 'verify-video-empty', 'farm-tech', 'africa', 'No video yet', 'x',
    'shamba_original', 'x', null, null, null, null, null, null, 'video'
  );
  begin
    perform public.admin_publish_news_article(vid2);
    r := r || E'\n22 publish video story without its embed: ALLOWED';
  exception when others then
    get stacked diagnostics t = pg_exception_detail;
    r := r || E'\n22 publish video story without its embed: ' || sqlstate || ' ' || t;
  end;
  perform public.admin_publish_news_article(vid);
  select status into t from public.news_articles where id = vid;
  r := r || E'\n23 publish video story with embed: ' || t;
  begin
    perform public.admin_save_news_article(
      vid, 'verify-video', 'farm-tech', 'africa', 'Drip kit demo', 'A video.',
      'shamba_original', 'About the video.', 'shamba-space', null, null, null, null, null, 'article'
    );
    r := r || E'\n24 change video story to article format: ALLOWED';
  exception when others then
    get stacked diagnostics t = pg_exception_detail;
    r := r || E'\n24 change video story to article format: ' || sqlstate || ' ' || t;
  end;

  -- external_linked: official YouTube embed yes, hosted images no.
  linked := public.admin_save_news_article(
    null, 'verify-linked-video', 'ai-innovation', 'global', 'Partner video', 'Summary only.',
    'external_linked', null, null, 'https://example.org/story', null, null, null, null, 'video'
  );
  perform public.admin_add_news_media(linked, 'video_embed', null, 'dQw4w9WgXcQ');
  insert into storage.objects (bucket_id, name, owner, owner_id, metadata)
  values ('news-media', linked || '/x.webp', a, a::text, '{"mimetype":"image/webp","size":1000}');
  begin
    perform public.admin_add_news_media(linked, 'image', linked || '/x.webp', null, 'x', null, 'x');
    r := r || E'\n25 external_linked video: YouTube embed ok, image ALLOWED';
  exception when others then
    get stacked diagnostics t = pg_exception_detail;
    r := r || E'\n25 external_linked video: YouTube embed ok, image ' || sqlstate || ' ' || t;
  end;
  begin
    perform public.admin_save_news_article(
      photo, 'verify-photo-story', 'agriculture', 'kenya', 'Harvest in pictures', 'A photo story.',
      'external_linked', null, null, 'https://example.org/p', null, null, null, null, 'photo_story'
    );
    r := r || E'\n26 change photo story to external_linked: ALLOWED';
  exception when others then
    get stacked diagnostics t = pg_exception_detail;
    r := r || E'\n26 change photo story to external_linked: ' || sqlstate || ' ' || t;
  end;

  -- Market update.
  market := public.admin_save_news_article(
    null, 'verify-market', 'markets-prices', 'kenya', 'Maize prices this week', 'Prices rose.',
    'shamba_original', 'Details.', 'shamba-space', null, null, null, null, null, 'market_update'
  );
  r := r || E'\n27 market update: publish w/o prices ';
  begin perform public.admin_publish_news_article(market); r := r || 'ALLOWED';
  exception when others then r := r || sqlstate; end;
  r := r || ', unknown product ';
  begin perform public.admin_set_news_price_products(market, array['no-such-product']); r := r || 'ALLOWED';
  exception when others then r := r || sqlstate; end;
  r := r || ', duplicates ';
  begin perform public.admin_set_news_price_products(market, array[p1, p1]); r := r || 'ALLOWED';
  exception when others then r := r || sqlstate; end;
  perform public.admin_set_news_price_products(market, array[p1, p2]);
  perform public.admin_publish_news_article(market);
  begin
    perform public.admin_set_news_price_products(market, '{}');
    r := r || E'\n29 clear prices on published market update: ALLOWED';
  exception when others then
    get stacked diagnostics t = pg_exception_detail;
    r := r || E'\n29 clear prices on published market update: ' || sqlstate || ' ' || t;
  end;

  -- A draft's image: removing it hands back the path for Storage deletion.
  m3 := public.admin_save_news_article(
    null, 'verify-draft-photos', 'agriculture', 'kenya', 'Draft photos', 'x',
    'shamba_original', 'x', null, null, null, null, null, null, 'photo_story'
  );
  insert into storage.objects (bucket_id, name, owner, owner_id, metadata)
  values ('news-media', m3 || '/d.webp', a, a::text, '{"mimetype":"image/webp","size":1000}');
  m2 := public.admin_add_news_media(m3, 'image', m3 || '/d.webp', null, 'x', null, 'x');
  r := r || E'\n30 remove image from a draft returns its storage path: '
    || (public.admin_remove_news_media(m2) = m3 || '/d.webp');

  select string_agg(action, ',' order by created_at, ctid) into t from public.news_audit_events where article_id = photo;
  r := r || E'\n31 photo story audit trail: ' || t;
  reset role;

  -- Readers.
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  set local role anon;
  select count(*) into n from public.news_article_price_products where article_id = market;
  select status into t from public.news_articles where id = market;
  r := r || E'\n28 market update: 2 products linked, ' || coalesce(t, '(hidden)') || '; anon sees links: ' || n;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', f, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.news_media where article_id = photo;
  select count(*) into n2 from public.news_media where article_id = linked;
  r := r || E'\n20 farmer sees media of published photo story / draft linked video: ' || n || ' / ' || n2;
  reset role;

  r := r || E'\n32 anon can execute any N4 admin function: ' || (
    has_function_privilege('anon', 'public.admin_save_news_article(uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text)', 'execute')
    or has_function_privilege('anon', 'public.admin_add_news_media(uuid, text, text, text, text, text, text, integer, integer, integer)', 'execute')
    or has_function_privilege('anon', 'public.admin_update_news_media(uuid, text, text, text)', 'execute')
    or has_function_privilege('anon', 'public.admin_remove_news_media(uuid)', 'execute')
    or has_function_privilege('anon', 'public.admin_reorder_news_media(uuid, uuid[])', 'execute')
    or has_function_privilege('anon', 'public.admin_set_news_price_products(uuid, text[])', 'execute')
    or has_function_privilege('anon', 'public.admin_publish_news_article(uuid, timestamptz)', 'execute')
  );
  r := r || E'\n33 signed-in users can execute assert_news_article_ready: '
    || has_function_privilege('authenticated', 'public.assert_news_article_ready(uuid)', 'execute');

  select count(*) filter (where status = 'published'), count(*) filter (where is_featured),
         count(*) filter (where format = 'article' and byline is null)
  into n, n2, m
  from public.news_articles
  where slug in ('welcome-to-agriculture-today', 'how-to-read-market-prices', 'understanding-agriculture-stocks',
                 'farm-technology-for-smallholders', 'ai-in-farming-what-to-expect');
  r := r || E'\n34 seed articles unchanged (published / featured / format article): ' || n || ' / ' || n2 || ' / ' || m;

  raise exception 'VERIFY_RESULTS (rolled back):%', r;
end $$;
