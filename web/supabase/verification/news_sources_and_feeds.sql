-- Verification script for 20261009090000_add_news_sources_and_feeds.sql
--
-- Run in the Supabase SQL editor (or via the Supabase MCP execute_sql).
-- It is NOT a migration and changes nothing: it creates a farmer F and an
-- admin A, checks the seeded sources/feeds, what anon / F / A / the
-- service role can read and write, and every constraint and trigger,
-- then ALWAYS ends with RAISE EXCEPTION, which rolls every change back.
-- To test the migration before it is applied, send
-- `begin; <migration> <this script>` in one call.
--
-- Expected output:
--    1 sources total / new approved: 14 / 13
--    2 feeds total / rss / youtube: 15 / 6 / 9
--    3 feeds by region kenya / africa / global: 5 / 4 / 6
--    4 any source with image_policy link: 0
--    5 youtube sources without youtube_embed: 0
--    6 youtube feed URLs match their channel id: 9 / 9
--    7 all feeds active, never fetched: 15 / 15
--    8 shamba-space source unchanged (policies none, no website): true
--    9 anon reads sources with media columns: 14
--   10 anon reads feeds / runs: DENIED 42501 / DENIED 42501
--   11 farmer reads feeds / runs: 0 / 0
--   12 farmer inserts feed / run, updates source: DENIED 42501 / DENIED 42501 / DENIED 42501
--   13 admin reads feeds: 15
--   14 admin inserts feed / updates feed / inserts run: DENIED 42501 x3
--   15 service role records a run and feed fetch state: ok
--   16 admin reads that run: 1
--   17 http feed URL: REJECTED 23514
--   18 youtube feed with a non-matching URL: REJECTED 23514
--   19 rss feed with a channel id: REJECTED 23514
--   20 unknown region / unknown category: REJECTED 23514 / REJECTED 23503
--   21 duplicate feed URL / duplicate channel: REJECTED 23505 / REJECTED 23505
--   22 youtube feed for a source without video permission: REJECTED 23514 news_feed_video_not_permitted
--   23 removing video permission from a source with youtube feeds: REJECTED 23514
--   24 source image_policy 'download': REJECTED 23514
--   25 run with negative count / unknown status: REJECTED 23514 / REJECTED 23514
--   26 feed update moves updated_at forward: true
--   27 anon/authenticated can execute the trigger functions: false
--   28 news articles unchanged (5 published, 2 featured, none imported): 5 / 2 / 0
--
-- Uses phone numbers 19990000991-992, which must not belong to real
-- accounts.
do $$
declare
  f uuid := gen_random_uuid();
  a uuid := gen_random_uuid();
  run uuid := gen_random_uuid();
  n int; n2 int; n3 int;
  t text;
  b boolean;
  ts timestamptz;
  r text := '';
begin
  insert into auth.users (id, aud, role, phone, created_at, updated_at) values
    (f, 'authenticated', 'authenticated', '19990000991', now(), now()),
    (a, 'authenticated', 'authenticated', '19990000992', now(), now());
  insert into public.staff_roles (profile_id, role) values (a, 'admin');

  -- Seeds, as the owner.
  select count(*), count(*) filter (where terms_checked_on = '2026-10-08') into n, n2 from public.news_sources;
  r := r || E'\n 1 sources total / new approved: ' || n || ' / ' || n2;
  select count(*), count(*) filter (where kind = 'rss'), count(*) filter (where kind = 'youtube_channel')
  into n, n2, n3 from public.news_feeds;
  r := r || E'\n 2 feeds total / rss / youtube: ' || n || ' / ' || n2 || ' / ' || n3;
  select count(*) filter (where region = 'kenya'), count(*) filter (where region = 'africa'), count(*) filter (where region = 'global')
  into n, n2, n3 from public.news_feeds;
  r := r || E'\n 3 feeds by region kenya / africa / global: ' || n || ' / ' || n2 || ' / ' || n3;
  select count(*) into n from public.news_sources where image_policy = 'link';
  r := r || E'\n 4 any source with image_policy link: ' || n;
  select count(distinct s.id) into n from public.news_feeds f join public.news_sources s on s.id = f.source_id
  where f.kind = 'youtube_channel' and s.video_policy <> 'youtube_embed';
  r := r || E'\n 5 youtube sources without youtube_embed: ' || n;
  select count(*) filter (where feed_url = 'https://www.youtube.com/feeds/videos.xml?channel_id=' || youtube_channel_id), count(*)
  into n, n2 from public.news_feeds where kind = 'youtube_channel';
  r := r || E'\n 6 youtube feed URLs match their channel id: ' || n || ' / ' || n2;
  select count(*) filter (where is_active), count(*) filter (where last_fetched_at is null) into n, n2 from public.news_feeds;
  r := r || E'\n 7 all feeds active, never fetched: ' || n || ' / ' || n2;
  select image_policy = 'none' and video_policy = 'none' and website_url is null and name = 'Shamba Space Editorial'
  into b from public.news_sources where id = 'shamba-space';
  r := r || E'\n 8 shamba-space source unchanged (policies none, no website): ' || b;

  -- Anonymous.
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  set local role anon;
  select count(*) into n from (select id, website_url, terms_url, terms_note, image_policy, video_policy from public.news_sources) s;
  r := r || E'\n 9 anon reads sources with media columns: ' || n;
  r := r || E'\n10 anon reads feeds / runs: ';
  begin select count(*) into n from public.news_feeds; r := r || 'rows = ' || n;
  exception when others then r := r || 'DENIED ' || sqlstate; end;
  r := r || ' / ';
  begin select count(*) into n from public.news_ingestion_runs; r := r || 'rows = ' || n;
  exception when others then r := r || 'DENIED ' || sqlstate; end;
  reset role;

  -- Farmer F.
  perform set_config('request.jwt.claims', json_build_object('sub', f, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.news_feeds;
  select count(*) into n2 from public.news_ingestion_runs;
  r := r || E'\n11 farmer reads feeds / runs: ' || n || ' / ' || n2;
  r := r || E'\n12 farmer inserts feed / run, updates source: ';
  begin
    insert into public.news_feeds (id, source_id, kind, feed_url, region, default_category_id)
    values ('x-feed', 'kilimo-news', 'rss', 'https://example.org/feed', 'kenya', 'agriculture');
    r := r || 'ALLOWED';
  exception when others then r := r || 'DENIED ' || sqlstate; end;
  r := r || ' / ';
  begin
    insert into public.news_ingestion_runs (run_id, triggered_by, status) values (run, 'manual', 'running');
    r := r || 'ALLOWED';
  exception when others then r := r || 'DENIED ' || sqlstate; end;
  r := r || ' / ';
  begin
    update public.news_sources set image_policy = 'link' where id = 'kilimo-news';
    get diagnostics n = row_count; r := r || 'rows = ' || n;
  exception when others then r := r || 'DENIED ' || sqlstate; end;
  reset role;

  -- Admin A.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.news_feeds;
  r := r || E'\n13 admin reads feeds: ' || n;
  r := r || E'\n14 admin inserts feed / updates feed / inserts run: ';
  begin
    insert into public.news_feeds (id, source_id, kind, feed_url, region, default_category_id)
    values ('x-feed', 'kilimo-news', 'rss', 'https://example.org/feed', 'kenya', 'agriculture');
    r := r || 'ALLOWED ';
  exception when others then r := r || sqlstate || ' '; end;
  begin
    update public.news_feeds set is_active = false where id = 'kilimo-news';
    get diagnostics n = row_count; r := r || 'rows=' || n || ' ';
  exception when others then r := r || sqlstate || ' '; end;
  begin
    insert into public.news_ingestion_runs (run_id, triggered_by, status) values (run, 'manual', 'running');
    r := r || 'ALLOWED';
  exception when others then r := r || sqlstate; end;
  reset role;

  -- Service role (what the importer will use).
  set local role service_role;
  begin
    insert into public.news_ingestion_runs
      (run_id, feed_id, triggered_by, dry_run, status, completed_at, http_status, items_seen, items_new, items_duplicate, details)
    values (run, 'kilimo-news', 'manual', true, 'completed', now(), 200, 30, 4, 26, '{"note":"verification"}');
    update public.news_feeds
    set last_fetched_at = now(), last_success_at = now(), last_status = 'ok', last_item_count = 30,
        etag = 'W/"abc"', consecutive_failures = 0
    where id = 'kilimo-news';
    r := r || E'\n15 service role records a run and feed fetch state: ok';
  exception when others then r := r || E'\n15 service role records a run and feed fetch state: FAILED ' || sqlstate || ' ' || sqlerrm;
  end;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.news_ingestion_runs where run_id = run;
  r := r || E'\n16 admin reads that run: ' || n;
  reset role;

  -- Constraints and triggers, as the owner.
  begin
    insert into public.news_feeds (id, source_id, kind, feed_url, region, default_category_id)
    values ('c17', 'kilimo-news', 'rss', 'http://example.org/feed', 'kenya', 'agriculture');
    r := r || E'\n17 http feed URL: ALLOWED';
  exception when others then r := r || E'\n17 http feed URL: REJECTED ' || sqlstate; end;
  begin
    insert into public.news_feeds (id, source_id, kind, feed_url, youtube_channel_id, region, default_category_id)
    values ('c18', 'fao', 'youtube_channel', 'https://www.youtube.com/feeds/videos.xml?channel_id=UCaaaaaaaaaaaaaaaaaaaaaa',
            'UCbbbbbbbbbbbbbbbbbbbbbb', 'global', 'agriculture');
    r := r || E'\n18 youtube feed with a non-matching URL: ALLOWED';
  exception when others then r := r || E'\n18 youtube feed with a non-matching URL: REJECTED ' || sqlstate; end;
  begin
    insert into public.news_feeds (id, source_id, kind, feed_url, youtube_channel_id, region, default_category_id)
    values ('c19', 'kilimo-news', 'rss', 'https://example.org/feed2', 'UCaaaaaaaaaaaaaaaaaaaaaa', 'kenya', 'agriculture');
    r := r || E'\n19 rss feed with a channel id: ALLOWED';
  exception when others then r := r || E'\n19 rss feed with a channel id: REJECTED ' || sqlstate; end;
  r := r || E'\n20 unknown region / unknown category: ';
  begin
    insert into public.news_feeds (id, source_id, kind, feed_url, region, default_category_id)
    values ('c20a', 'kilimo-news', 'rss', 'https://example.org/feed3', 'europe', 'agriculture');
    r := r || 'ALLOWED';
  exception when others then r := r || 'REJECTED ' || sqlstate; end;
  r := r || ' / ';
  begin
    insert into public.news_feeds (id, source_id, kind, feed_url, region, default_category_id)
    values ('c20b', 'kilimo-news', 'rss', 'https://example.org/feed4', 'kenya', 'no-such-category');
    r := r || 'ALLOWED';
  exception when others then r := r || 'REJECTED ' || sqlstate; end;
  r := r || E'\n21 duplicate feed URL / duplicate channel: ';
  begin
    insert into public.news_feeds (id, source_id, kind, feed_url, region, default_category_id)
    values ('c21a', 'kilimo-news', 'rss', 'https://www.kilimonews.co.ke/feed/', 'kenya', 'agriculture');
    r := r || 'ALLOWED';
  exception when others then r := r || 'REJECTED ' || sqlstate; end;
  r := r || ' / ';
  begin
    -- Same channel as fao-youtube, different (non-canonical) URL is
    -- impossible by the shape rule, so reuse the canonical URL with a
    -- new id: the unique feed_url and the unique channel both apply.
    insert into public.news_feeds (id, source_id, kind, feed_url, youtube_channel_id, region, default_category_id)
    values ('c21b', 'agfunder', 'youtube_channel', 'https://www.youtube.com/feeds/videos.xml?channel_id=UCtu8MkufmVgxS8_Ocl7mMig',
            'UCtu8MkufmVgxS8_Ocl7mMig', 'global', 'agriculture');
    r := r || 'ALLOWED';
  exception when others then r := r || 'REJECTED ' || sqlstate; end;
  begin
    insert into public.news_feeds (id, source_id, kind, feed_url, youtube_channel_id, region, default_category_id)
    values ('c22', 'kilimo-news', 'youtube_channel', 'https://www.youtube.com/feeds/videos.xml?channel_id=UCcccccccccccccccccccccc',
            'UCcccccccccccccccccccccc', 'kenya', 'agriculture');
    r := r || E'\n22 youtube feed for a source without video permission: ALLOWED';
  exception when others then r := r || E'\n22 youtube feed for a source without video permission: REJECTED ' || sqlstate || ' ' || sqlerrm; end;
  begin
    update public.news_sources set video_policy = 'none' where id = 'kalro';
    r := r || E'\n23 removing video permission from a source with youtube feeds: ALLOWED';
  exception when others then r := r || E'\n23 removing video permission from a source with youtube feeds: REJECTED ' || sqlstate; end;
  begin
    update public.news_sources set image_policy = 'download' where id = 'kilimo-news';
    r := r || E'\n24 source image_policy ''download'': ALLOWED';
  exception when others then r := r || E'\n24 source image_policy ''download'': REJECTED ' || sqlstate; end;
  r := r || E'\n25 run with negative count / unknown status: ';
  begin
    insert into public.news_ingestion_runs (run_id, triggered_by, status, items_new) values (run, 'manual', 'completed', -1);
    r := r || 'ALLOWED';
  exception when others then r := r || 'REJECTED ' || sqlstate; end;
  r := r || ' / ';
  begin
    insert into public.news_ingestion_runs (run_id, triggered_by, status) values (run, 'manual', 'published');
    r := r || 'ALLOWED';
  exception when others then r := r || 'REJECTED ' || sqlstate; end;

  -- now() is fixed inside a transaction, so prove the trigger fires by
  -- writing an old updated_at directly: the trigger must replace it.
  update public.news_feeds set updated_at = '2000-01-01', notes = 'Updated in verification.' where id = 'fao-newsroom';
  select updated_at = now() into b from public.news_feeds where id = 'fao-newsroom';
  r := r || E'\n26 feed update moves updated_at forward: ' || b;

  r := r || E'\n27 anon/authenticated can execute the trigger functions: ' || (
    has_function_privilege('anon', 'public.set_news_feeds_updated_at()', 'execute')
    or has_function_privilege('authenticated', 'public.set_news_feeds_updated_at()', 'execute')
    or has_function_privilege('anon', 'public.check_news_feed_media_policy()', 'execute')
    or has_function_privilege('authenticated', 'public.check_news_feed_media_policy()', 'execute')
    or has_function_privilege('anon', 'public.check_news_source_video_policy()', 'execute')
    or has_function_privilege('authenticated', 'public.check_news_source_video_policy()', 'execute')
  );

  select count(*) filter (where status = 'published'), count(*) filter (where is_featured), count(*) filter (where external_ref is not null)
  into n, n2, n3 from public.news_articles;
  r := r || E'\n28 news articles unchanged (5 published, 2 featured, none imported): ' || n || ' / ' || n2 || ' / ' || n3;

  raise exception 'VERIFY_RESULTS (rolled back):%', r;
end $$;
