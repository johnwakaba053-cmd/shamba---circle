-- Verification script for 20261009100000_add_news_draft_import.sql
--
-- Run in the Supabase SQL editor (or via the Supabase MCP execute_sql).
-- It is NOT a migration and changes nothing: it creates a farmer F and an
-- admin A, imports test drafts as the service role, checks who can see
-- and call what, the copyright rule on summaries and the constraints,
-- then ALWAYS ends with RAISE EXCEPTION, which rolls every change back.
-- To test the migration before it is applied, send
-- `begin; <migration> <this script>` in one call.
--
-- Expected output:
--    1 anon / farmer call import_news_draft: DENIED 42501 / DENIED 42501
--    2 admin calls import_news_draft: DENIED 42501
--    3 service role imports an article draft: draft, external_linked, no body, feed + source set
--    4 service role imports a video draft: format video, 1 youtube embed
--    5 importing the same story again: null (skipped), rows still 1
--    6 anon sees the drafts: 0
--    7 admin sees the drafts: 2
--    8 anon reads source_published_at / source_excerpt / import_feed_id: ok / DENIED 42501 / DENIED 42501
--    9 audit rows for the imports (actor null): 2 / true
--   10 publish article draft whose summary is the excerpt: 22023 news_summary_needs_rewrite
--   11 publish with a summary that is a long piece of the excerpt: 22023 news_summary_needs_rewrite
--   12 publish article draft with an original summary: published
--   13 publish video draft (original summary, 1 embed): published
--   14 video import from a text feed: 22023 video_needs_youtube_feed
--   15 video import with a bad video id: 22023 invalid_video_id
--   16 import from an unknown feed: P0002
--   17 import with a bad slug / http link: 23514 / 23514
--   18 imported row without external_ref (direct insert): 23514
--   19 seed articles unchanged (published / featured / imported): 5 / 2 / 0
--
-- Uses phone numbers 19990001001-1002, which must not belong to real
-- accounts.
do $$
declare
  f uuid := gen_random_uuid();
  a uuid := gen_random_uuid();
  art uuid;
  vid uuid;
  again uuid;
  n int; n2 int;
  t text;
  b boolean;
  r text := '';
  ex text := 'Coffee farmers in Nyeri saw higher auction prices this week as buyers competed for top grades, according to the exchange.';
begin
  insert into auth.users (id, aud, role, phone, created_at, updated_at) values
    (f, 'authenticated', 'authenticated', '19990001001', now(), now()),
    (a, 'authenticated', 'authenticated', '19990001002', now(), now());
  insert into public.staff_roles (profile_id, role) values (a, 'admin');

  -- Who may call the import function.
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  set local role anon;
  r := r || E'\n 1 anon / farmer call import_news_draft: ';
  begin
    perform public.import_news_draft('kilimo-news', 'url:x', 'x', 'x', 'x', 'x', 'https://example.org/x', 'kenya', 'agriculture', 'article', now(), 1, '{}');
    r := r || 'ALLOWED';
  exception when others then r := r || 'DENIED ' || sqlstate; end;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', f, 'role', 'authenticated')::text, true);
  set local role authenticated;
  r := r || ' / ';
  begin
    perform public.import_news_draft('kilimo-news', 'url:x', 'x', 'x', 'x', 'x', 'https://example.org/x', 'kenya', 'agriculture', 'article', now(), 1, '{}');
    r := r || 'ALLOWED';
  exception when others then r := r || 'DENIED ' || sqlstate; end;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.import_news_draft('kilimo-news', 'url:x', 'x', 'x', 'x', 'x', 'https://example.org/x', 'kenya', 'agriculture', 'article', now(), 1, '{}');
    r := r || E'\n 2 admin calls import_news_draft: ALLOWED';
  exception when others then r := r || E'\n 2 admin calls import_news_draft: DENIED ' || sqlstate; end;
  reset role;

  -- The importer.
  set local role service_role;
  art := public.import_news_draft(
    'kilimo-news', 'url:verify-article', 'verify-coffee-auction-a1b2c3', 'Coffee auction prices rise',
    ex, ex, 'https://www.kilimonews.co.ke/verify-story/', 'kenya', 'agriculture', 'article',
    now() - interval '5 hours', 3, array['coffee', 'farmers']
  );
  vid := public.import_news_draft(
    'kalro-youtube', 'youtube:dQw4w9WgXcQ', 'verify-kalro-video-d4e5f6', 'KALRO field day',
    'A KALRO video about soil health for smallholder farmers.', 'Field day highlights.',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'kenya', 'agriculture', 'video',
    now() - interval '1 day', 2, array['soil', 'smallholder'], 'dQw4w9WgXcQ'
  );
  again := public.import_news_draft(
    'kilimo-news', 'url:verify-article', 'verify-coffee-auction-other', 'Coffee auction prices rise',
    ex, ex, 'https://www.kilimonews.co.ke/verify-story/', 'kenya', 'agriculture', 'article',
    now() - interval '5 hours', 3, array['coffee']
  );
  reset role;

  select status = 'draft' and origin = 'external_linked' and body is null and import_feed_id = 'kilimo-news'
         and source_id = 'kilimo-news' and imported_at is not null and source_published_at is not null
         and published_at is null and source_excerpt = ex
  into b from public.news_articles where id = art;
  r := r || E'\n 3 service role imports an article draft: ' || coalesce(b::text, 'null');
  select a2.format || ', ' || (select count(*) from public.news_media m where m.article_id = vid and m.kind = 'video_embed' and m.embed_id = 'dQw4w9WgXcQ') || ' youtube embed'
  into t from public.news_articles a2 where a2.id = vid;
  r := r || E'\n 4 service role imports a video draft: format ' || coalesce(t, 'null');
  select count(*) into n from public.news_articles where external_ref = 'url:verify-article';
  r := r || E'\n 5 importing the same story again: ' || coalesce(again::text, 'null') || ', rows still ' || n;

  -- Visibility.
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  set local role anon;
  select count(id) into n from public.news_articles where id in (art, vid);
  r := r || E'\n 6 anon sees the drafts: ' || n;
  r := r || E'\n 8 anon reads source_published_at / source_excerpt / import_feed_id: ';
  begin execute 'select count(source_published_at) from public.news_articles' into n; r := r || 'ok';
  exception when others then r := r || 'DENIED ' || sqlstate; end;
  r := r || ' / ';
  begin execute 'select count(source_excerpt) from public.news_articles' into n; r := r || 'ok';
  exception when others then r := r || 'DENIED ' || sqlstate; end;
  r := r || ' / ';
  begin execute 'select count(import_feed_id) from public.news_articles' into n; r := r || 'ok';
  exception when others then r := r || 'DENIED ' || sqlstate; end;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(id) into n from public.news_articles where id in (art, vid);
  r := r || E'\n 7 admin sees the drafts: ' || n;
  reset role;

  select count(*), bool_and(actor_profile_id is null) into n, b
  from public.news_audit_events where article_id in (art, vid) and action = 'created';
  r := r || E'\n 9 audit rows for the imports (actor null): ' || n || ' / ' || b;

  -- Copyright rule at publish time (as the admin).
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.admin_publish_news_article(art);
    r := r || E'\n10 publish article draft whose summary is the excerpt: ALLOWED';
  exception when others then
    get stacked diagnostics t = message_text;
    r := r || E'\n10 publish article draft whose summary is the excerpt: ' || sqlstate || ' ' || t;
  end;
  begin
    perform public.admin_save_news_article(
      art, 'verify-coffee-auction-a1b2c3', 'agriculture', 'kenya', 'Coffee auction prices rise',
      'Buyers competed for top grades, according to the exchange.', 'external_linked', null, 'kilimo-news',
      'https://www.kilimonews.co.ke/verify-story/'
    );
    perform public.admin_publish_news_article(art);
    r := r || E'\n11 publish with a summary that is a long piece of the excerpt: ALLOWED';
  exception when others then
    get stacked diagnostics t = message_text;
    r := r || E'\n11 publish with a summary that is a long piece of the excerpt: ' || sqlstate || ' ' || t;
  end;
  perform public.admin_save_news_article(
    art, 'verify-coffee-auction-a1b2c3', 'agriculture', 'kenya', 'Coffee auction prices rise',
    'A Kenya coffee market report from Kilimo News. Read the full story on Kilimo News.',
    'external_linked', null, 'kilimo-news', 'https://www.kilimonews.co.ke/verify-story/'
  );
  perform public.admin_publish_news_article(art);
  select status into t from public.news_articles where id = art;
  r := r || E'\n12 publish article draft with an original summary: ' || t;
  perform public.admin_publish_news_article(vid);
  select status into t from public.news_articles where id = vid;
  r := r || E'\n13 publish video draft (original summary, 1 embed): ' || t;
  reset role;

  -- Import validation (as the service role).
  set local role service_role;
  begin
    perform public.import_news_draft('kilimo-news', 'youtube:abcdefghijk', 'verify-v2', 'x', 'x', 'x',
      'https://www.youtube.com/watch?v=abcdefghijk', 'kenya', 'agriculture', 'video', now(), 1, '{}', 'abcdefghijk');
    r := r || E'\n14 video import from a text feed: ALLOWED';
  exception when others then
    get stacked diagnostics t = pg_exception_detail;
    r := r || E'\n14 video import from a text feed: ' || sqlstate || ' ' || t;
  end;
  begin
    perform public.import_news_draft('kalro-youtube', 'youtube:bad', 'verify-v3', 'x', 'x', 'x',
      'https://www.youtube.com/watch?v=bad', 'kenya', 'agriculture', 'video', now(), 1, '{}', 'bad id!');
    r := r || E'\n15 video import with a bad video id: ALLOWED';
  exception when others then
    get stacked diagnostics t = pg_exception_detail;
    r := r || E'\n15 video import with a bad video id: ' || sqlstate || ' ' || t;
  end;
  begin
    perform public.import_news_draft('no-such-feed', 'url:y', 'verify-y', 'x', 'x', 'x',
      'https://example.org/y', 'kenya', 'agriculture', 'article', now(), 1, '{}');
    r := r || E'\n16 import from an unknown feed: ALLOWED';
  exception when others then r := r || E'\n16 import from an unknown feed: ' || sqlstate; end;
  r := r || E'\n17 import with a bad slug / http link: ';
  begin
    perform public.import_news_draft('kilimo-news', 'url:z1', 'Bad Slug!', 'x', 'x', 'x',
      'https://example.org/z1', 'kenya', 'agriculture', 'article', now(), 1, '{}');
    r := r || 'ALLOWED';
  exception when others then r := r || sqlstate; end;
  r := r || ' / ';
  begin
    perform public.import_news_draft('kilimo-news', 'url:z2', 'verify-z2', 'x', 'x', 'x',
      'http://example.org/z2', 'kenya', 'agriculture', 'article', now(), 1, '{}');
    r := r || 'ALLOWED';
  exception when others then r := r || sqlstate; end;
  reset role;

  begin
    insert into public.news_articles (slug, category_id, region, title, summary, origin, external_url, import_feed_id, imported_at, source_published_at)
    values ('verify-noref', 'agriculture', 'kenya', 'x', 'x', 'external_linked', 'https://example.org/n', 'kilimo-news', now(), now());
    r := r || E'\n18 imported row without external_ref (direct insert): ALLOWED';
  exception when others then r := r || E'\n18 imported row without external_ref (direct insert): ' || sqlstate; end;

  select count(*) filter (where status = 'published'), count(*) filter (where is_featured),
         (count(*) filter (where import_feed_id is not null))::text
  into n, n2, t
  from public.news_articles
  where slug in ('welcome-to-agriculture-today', 'how-to-read-market-prices', 'understanding-agriculture-stocks',
                 'farm-technology-for-smallholders', 'ai-in-farming-what-to-expect');
  r := r || E'\n19 seed articles unchanged (published / featured / imported): ' || n || ' / ' || n2 || ' / ' || t;

  raise exception 'VERIFY_RESULTS (rolled back):%', r;
end $$;
