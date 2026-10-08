-- Verification script for 20261009120000_add_news_auto_publish.sql
--
-- Run in the Supabase SQL editor (or via the Supabase MCP execute_sql).
-- It is NOT a migration and changes nothing: it imports test drafts the
-- way the importer does (import_news_draft as the service role), publishes
-- them with auto_publish_news_draft, checks every refusal, then ALWAYS
-- ends with RAISE EXCEPTION, which rolls every change back. To test the
-- migration before it is applied, send `begin; <migration> <this script>`
-- in one call.
--
-- Expected output:
--    1 anon / signed-in can execute auto_publish_news_draft: false / false
--    2 service role can execute it: true
--    3 auto-publish an imported text draft: published, at the source time: published / true
--    4 audit: published, automatic, no actor: published / true / true
--    5 source, link, excerpt and external_ref unchanged: true
--    6 auto-publish it again: 22023 news_article_not_draft
--    7 auto-publish a draft whose summary copies the excerpt: 22023 news_summary_needs_rewrite (still draft)
--    8 auto-publish an admin-written (not imported) draft: 22023 news_article_not_imported
--    9 auto-publish an imported video draft (its YouTube embed is attached): published
--   10 a future source time is capped at now: true
--   11 unknown article: P0002 news_article_not_found
--   12 seed articles unchanged (published / featured): 5 / 2
do $$
declare
  a uuid := gen_random_uuid();
  t1 uuid; t2 uuid; v1 uuid; v2 uuid; own uuid;
  src timestamptz := now() - interval '3 hours';
  n int; n2 int;
  t text;
  b boolean;
  b2 boolean;
  r text := '';
begin
  insert into auth.users (id, aud, role, phone, created_at, updated_at)
  values (a, 'authenticated', 'authenticated', '19990000993', now(), now());
  insert into public.staff_roles (profile_id, role) values (a, 'admin');

  r := r || E'\n 1 anon / signed-in can execute auto_publish_news_draft: '
    || has_function_privilege('anon', 'public.auto_publish_news_draft(uuid)', 'execute') || ' / '
    || has_function_privilege('authenticated', 'public.auto_publish_news_draft(uuid)', 'execute');
  r := r || E'\n 2 service role can execute it: '
    || has_function_privilege('service_role', 'public.auto_publish_news_draft(uuid)', 'execute');

  -- Imported exactly as the importer does it.
  set local role service_role;
  t1 := public.import_news_draft(
    'kilimo-news', 'url:verify-auto-1', 'verify-auto-maize-1', 'Maize farmers expect a good harvest',
    'A Kenyan farming story from Kilimo News on maize and harvest. Read the full report on Kilimo News.',
    'Farmers in the Rift Valley say rains have improved maize yields this season.',
    'https://example.com/verify-auto-1', 'kenya', 'agriculture', 'article', src, 3, array['maize', 'harvest']
  );
  t2 := public.import_news_draft(
    'kilimo-news', 'url:verify-auto-2', 'verify-auto-copy-2', 'Tea prices rise',
    'Tea prices rose at the Mombasa auction this week as demand from buyers grew.',
    'Tea prices rose at the Mombasa auction this week as demand from buyers grew.',
    'https://example.com/verify-auto-2', 'kenya', 'agriculture', 'article', src, 2, array['tea']
  );
  v1 := public.import_news_draft(
    'kalro-youtube', 'youtube:VerifyAuto01', 'verify-auto-video-1', 'Dairy feeding for smallholders',
    'A Kenyan farming video from KALRO on dairy. Watch it here through YouTube''s player.',
    'How to feed dairy cows.', 'https://www.youtube.com/watch?v=VerifyAuto01', 'kenya', 'agriculture', 'video',
    src, 2, array['dairy'], 'VerifyAuto01'
  );
  v2 := public.import_news_draft(
    'kilimo-news', 'url:verify-auto-3', 'verify-auto-future-3', 'Wheat farmers plan early planting',
    'A Kenyan farming story from Kilimo News on wheat. Read the full report on Kilimo News.',
    'Wheat farmers plan to plant early.', 'https://example.com/verify-auto-3', 'kenya', 'agriculture', 'article',
    now() + interval '2 hours', 2, array['wheat']
  );

  perform public.auto_publish_news_draft(t1);
  select status, published_at = src into t, b from public.news_articles where id = t1;
  r := r || E'\n 3 auto-publish an imported text draft: published, at the source time: ' || t || ' / ' || b;

  select action, (details ->> 'automatic')::boolean, actor_profile_id is null into t, b, b2
  from public.news_audit_events where article_id = t1 and action = 'published';
  r := r || E'\n 4 audit: published, automatic, no actor: ' || t || ' / ' || b || ' / ' || b2;

  select source_id is not null and external_url = 'https://example.com/verify-auto-1'
         and source_excerpt like 'Farmers in the Rift Valley%' and external_ref = 'url:verify-auto-1'
         and source_published_at = src
  into b from public.news_articles where id = t1;
  r := r || E'\n 5 source, link, excerpt and external_ref unchanged: ' || b;

  begin
    perform public.auto_publish_news_draft(t1);
    r := r || E'\n 6 auto-publish it again: ALLOWED';
  exception when others then r := r || E'\n 6 auto-publish it again: ' || sqlstate || ' ' || sqlerrm;
  end;

  begin
    perform public.auto_publish_news_draft(t2);
    r := r || E'\n 7 auto-publish a draft whose summary copies the excerpt: ALLOWED';
  exception when others then
    select status into t from public.news_articles where id = t2;
    r := r || E'\n 7 auto-publish a draft whose summary copies the excerpt: ' || sqlstate || ' ' || sqlerrm
      || ' (still ' || t || ')';
  end;
  reset role;

  -- An admin-written draft, not from a feed.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  own := public.admin_save_news_article(
    null, 'verify-auto-own', 'agriculture', 'kenya', 'Our own story', 'Written by Shamba Space.',
    'shamba_original', 'Body text.', 'shamba-space', null, null, null, null, null, 'article', null
  );
  reset role;

  set local role service_role;
  begin
    perform public.auto_publish_news_draft(own);
    r := r || E'\n 8 auto-publish an admin-written (not imported) draft: ALLOWED';
  exception when others then
    r := r || E'\n 8 auto-publish an admin-written (not imported) draft: ' || sqlstate || ' ' || sqlerrm;
  end;

  perform public.auto_publish_news_draft(v1);
  select status into t from public.news_articles where id = v1;
  r := r || E'\n 9 auto-publish an imported video draft (its YouTube embed is attached): ' || t;

  perform public.auto_publish_news_draft(v2);
  select published_at <= now() into b from public.news_articles where id = v2;
  r := r || E'\n10 a future source time is capped at now: ' || b;

  begin
    perform public.auto_publish_news_draft(gen_random_uuid());
    r := r || E'\n11 unknown article: ALLOWED';
  exception when others then r := r || E'\n11 unknown article: ' || sqlstate || ' ' || sqlerrm;
  end;
  reset role;

  select count(*) filter (where status = 'published'), count(*) filter (where is_featured)
  into n, n2
  from public.news_articles
  where slug in ('welcome-to-agriculture-today', 'how-to-read-market-prices', 'understanding-agriculture-stocks',
                 'farm-technology-for-smallholders', 'ai-in-farming-what-to-expect');
  r := r || E'\n12 seed articles unchanged (published / featured): ' || n || ' / ' || n2;

  raise exception 'VERIFY_RESULTS (rolled back):%', r;
end $$;
