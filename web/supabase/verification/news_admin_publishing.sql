-- Verification script for 20261008140000_add_news_admin_publishing.sql
--
-- Run in the Supabase SQL editor (or via the Supabase MCP execute_sql).
-- It is NOT a migration and changes nothing: it creates a farmer F and an
-- admin A, calls every news admin function as anon, F and A, checks the
-- results as anon and in the audit log, then ALWAYS ends with RAISE
-- EXCEPTION, which rolls every change back. The results are in the error
-- message ("VERIFY_RESULTS ..."). To test the migration before it is
-- applied, send `begin; <migration> <this script>` in one call.
--
-- Expected output:
--    1 anon save / publish / unpublish / archive / feature: 42501 x5
--    2 anon reads audit log: DENIED 42501
--    3 farmer save / publish / unpublish / archive / feature: 42501 x5
--    4 farmer reads audit log: rows = 0
--    5 farmer writes audit log directly: DENIED 42501
--    6 admin creates draft: status draft, created_by/updated_by = admin: true
--    7 anon sees the new draft: rows = 0
--    8 admin edits the draft (title trimmed, blank credit -> null): true
--    9 admin edits a missing article: P0002 news_article_not_found
--   10 admin saves a duplicate slug: 23505
--   11 admin saves external_linked with a body: 23514
--   12 admin saves an unknown category: 23503
--   13 admin features a draft: P0001 news_article_not_published
--   14 admin publishes now: status published, anon rows = 1
--   15 admin features it at rank 3: anon featured rank = 3
--   16 admin features with rank 0: 23514
--   17 admin unfeatures: is_featured false, rank null: true
--   18 admin schedules for tomorrow: status published, anon rows = 0
--   19 admin re-publishes now and features, then unpublishes:
--      status draft, published_at null, featured cleared, anon rows = 0
--   20 admin archives: status archived, anon rows = 0
--   21 admin publishes a missing article: P0002 news_article_not_found
--   22 admin writes audit log directly: DENIED 42501
--   23 admin reads audit log for the article:
--      created,updated,published,featured,unfeatured,scheduled,published,featured,unpublished,archived
--   24 every audit row's actor is the admin: true
--   25 scheduled row records published_at: true
--   26 anon can execute any admin function: false
--   27 seed articles untouched (published / featured): 5 / 2
--
-- Uses phone numbers 19990000951-952, which must not belong to real
-- accounts.
do $$
declare
  f uuid := gen_random_uuid();
  a uuid := gen_random_uuid();
  art uuid;
  n int;
  t text;
  b boolean;
  r text := '';
  v_status text;
  v_feat boolean;
  v_rank smallint;
  v_pub timestamptz;
begin
  insert into auth.users (id, aud, role, phone, created_at, updated_at) values
    (f, 'authenticated', 'authenticated', '19990000951', now(), now()),
    (a, 'authenticated', 'authenticated', '19990000952', now(), now());
  insert into public.staff_roles (profile_id, role) values (a, 'admin');

  -- Anonymous: every write function.
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  set local role anon;
  t := '';
  begin perform public.admin_save_news_article(null, 'x', 'agriculture', 'kenya', 'x', 'x', 'shamba_original', 'x');
    t := t || 'ALLOWED '; exception when others then t := t || sqlstate || ' '; end;
  begin perform public.admin_publish_news_article(gen_random_uuid());
    t := t || 'ALLOWED '; exception when others then t := t || sqlstate || ' '; end;
  begin perform public.admin_unpublish_news_article(gen_random_uuid());
    t := t || 'ALLOWED '; exception when others then t := t || sqlstate || ' '; end;
  begin perform public.admin_archive_news_article(gen_random_uuid());
    t := t || 'ALLOWED '; exception when others then t := t || sqlstate || ' '; end;
  begin perform public.admin_set_news_featured(gen_random_uuid(), true, 1::smallint);
    t := t || 'ALLOWED '; exception when others then t := t || sqlstate || ' '; end;
  r := r || E'\n 1 anon save / publish / unpublish / archive / feature: ' || t;
  begin
    select count(*) into n from public.news_audit_events;
    r := r || E'\n 2 anon reads audit log: rows = ' || n;
  exception when others then r := r || E'\n 2 anon reads audit log: DENIED ' || sqlstate;
  end;
  reset role;

  -- Farmer F: every write function.
  perform set_config('request.jwt.claims', json_build_object('sub', f, 'role', 'authenticated')::text, true);
  set local role authenticated;
  t := '';
  begin perform public.admin_save_news_article(null, 'x', 'agriculture', 'kenya', 'x', 'x', 'shamba_original', 'x');
    t := t || 'ALLOWED '; exception when others then t := t || sqlstate || ' '; end;
  begin perform public.admin_publish_news_article((select id from public.news_articles where slug = 'welcome-to-agriculture-today'));
    t := t || 'ALLOWED '; exception when others then t := t || sqlstate || ' '; end;
  begin perform public.admin_unpublish_news_article((select id from public.news_articles where slug = 'welcome-to-agriculture-today'));
    t := t || 'ALLOWED '; exception when others then t := t || sqlstate || ' '; end;
  begin perform public.admin_archive_news_article((select id from public.news_articles where slug = 'welcome-to-agriculture-today'));
    t := t || 'ALLOWED '; exception when others then t := t || sqlstate || ' '; end;
  begin perform public.admin_set_news_featured((select id from public.news_articles where slug = 'welcome-to-agriculture-today'), false);
    t := t || 'ALLOWED '; exception when others then t := t || sqlstate || ' '; end;
  r := r || E'\n 3 farmer save / publish / unpublish / archive / feature: ' || t;
  select count(*) into n from public.news_audit_events;
  r := r || E'\n 4 farmer reads audit log: rows = ' || n;
  begin
    insert into public.news_audit_events (article_id, action, actor_profile_id)
    select id, 'published', f from public.news_articles limit 1;
    r := r || E'\n 5 farmer writes audit log directly: ALLOWED';
  exception when others then r := r || E'\n 5 farmer writes audit log directly: DENIED ' || sqlstate;
  end;
  reset role;

  -- Admin A.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  art := public.admin_save_news_article(
    null, ' Verify-Admin-Story ', 'farm-tech', 'kenya', 'Draft title', 'Draft summary',
    'shamba_original', 'Draft body', 'shamba-space'
  );
  reset role;
  select status = 'draft' and created_by = a and updated_by = a and slug = 'verify-admin-story' into b
  from public.news_articles where id = art;
  r := r || E'\n 6 admin creates draft: status draft, created_by/updated_by = admin: ' || coalesce(b::text, 'null');

  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  set local role anon;
  select count(id) into n from public.news_articles where id = art;
  r := r || E'\n 7 anon sees the new draft: rows = ' || n;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.admin_save_news_article(
    art, 'verify-admin-story', 'farm-tech', 'kenya', '  Edited title  ', 'Edited summary',
    'shamba_original', 'Edited body', 'shamba-space', null, null, null, null, '   '
  );
  select title = 'Edited title' and cover_image_credit is null into b from public.news_articles where id = art;
  r := r || E'\n 8 admin edits the draft (title trimmed, blank credit -> null): ' || coalesce(b::text, 'null');
  begin
    perform public.admin_save_news_article(gen_random_uuid(), 'nope', 'farm-tech', 'kenya', 'x', 'x', 'shamba_original', 'x');
    r := r || E'\n 9 admin edits a missing article: ALLOWED';
  exception when others then r := r || E'\n 9 admin edits a missing article: ' || sqlstate || ' ' || sqlerrm;
  end;
  begin
    perform public.admin_save_news_article(null, 'welcome-to-agriculture-today', 'farm-tech', 'kenya', 'x', 'x', 'shamba_original', 'x');
    r := r || E'\n10 admin saves a duplicate slug: ALLOWED';
  exception when others then r := r || E'\n10 admin saves a duplicate slug: ' || sqlstate;
  end;
  begin
    perform public.admin_save_news_article(null, 'linked-x', 'farm-tech', 'global', 'x', 'x', 'external_linked', 'copied', null, 'https://example.org/a');
    r := r || E'\n11 admin saves external_linked with a body: ALLOWED';
  exception when others then r := r || E'\n11 admin saves external_linked with a body: ' || sqlstate;
  end;
  begin
    perform public.admin_save_news_article(null, 'cat-x', 'no-such-category', 'global', 'x', 'x', 'shamba_original', 'x');
    r := r || E'\n12 admin saves an unknown category: ALLOWED';
  exception when others then r := r || E'\n12 admin saves an unknown category: ' || sqlstate;
  end;
  begin
    perform public.admin_set_news_featured(art, true, 1::smallint);
    r := r || E'\n13 admin features a draft: ALLOWED';
  exception when others then r := r || E'\n13 admin features a draft: ' || sqlstate || ' ' || sqlerrm;
  end;

  perform public.admin_publish_news_article(art);
  reset role;
  select status into v_status from public.news_articles where id = art;
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  set local role anon;
  select count(id) into n from public.news_articles where id = art;
  r := r || E'\n14 admin publishes now: status ' || v_status || ', anon rows = ' || n;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.admin_set_news_featured(art, true, 3::smallint);
  reset role;
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  set local role anon;
  select featured_rank into v_rank from public.news_articles where id = art and is_featured;
  r := r || E'\n15 admin features it at rank 3: anon featured rank = ' || coalesce(v_rank::text, 'null');
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.admin_set_news_featured(art, true, 0::smallint);
    r := r || E'\n16 admin features with rank 0: ALLOWED';
  exception when others then r := r || E'\n16 admin features with rank 0: ' || sqlstate;
  end;
  perform public.admin_set_news_featured(art, false, 5::smallint);
  select not is_featured and featured_rank is null into b from public.news_articles where id = art;
  r := r || E'\n17 admin unfeatures: is_featured false, rank null: ' || coalesce(b::text, 'null');

  perform public.admin_publish_news_article(art, now() + interval '1 day');
  reset role;
  select status into v_status from public.news_articles where id = art;
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  set local role anon;
  select count(id) into n from public.news_articles where id = art;
  r := r || E'\n18 admin schedules for tomorrow: status ' || v_status || ', anon rows = ' || n;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.admin_publish_news_article(art);
  perform public.admin_set_news_featured(art, true, 2::smallint);
  perform public.admin_unpublish_news_article(art);
  reset role;
  select status, published_at, is_featured, featured_rank into v_status, v_pub, v_feat, v_rank
  from public.news_articles where id = art;
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  set local role anon;
  select count(id) into n from public.news_articles where id = art;
  r := r || E'\n19 admin re-publishes now and features, then unpublishes: status ' || v_status
    || ', published_at ' || coalesce(v_pub::text, 'null')
    || ', featured cleared ' || (not v_feat and v_rank is null) || ', anon rows = ' || n;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.admin_archive_news_article(art);
  reset role;
  select status into v_status from public.news_articles where id = art;
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  set local role anon;
  select count(id) into n from public.news_articles where id = art;
  r := r || E'\n20 admin archives: status ' || v_status || ', anon rows = ' || n;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.admin_publish_news_article(gen_random_uuid());
    r := r || E'\n21 admin publishes a missing article: ALLOWED';
  exception when others then r := r || E'\n21 admin publishes a missing article: ' || sqlstate || ' ' || sqlerrm;
  end;
  begin
    insert into public.news_audit_events (article_id, action, actor_profile_id) values (art, 'published', a);
    r := r || E'\n22 admin writes audit log directly: ALLOWED';
  exception when others then r := r || E'\n22 admin writes audit log directly: DENIED ' || sqlstate;
  end;
  select string_agg(action, ',' order by created_at, ctid) into t from public.news_audit_events where article_id = art;
  r := r || E'\n23 admin reads audit log for the article: ' || coalesce(t, '(none)');
  select bool_and(actor_profile_id = a) into b from public.news_audit_events where article_id = art;
  r := r || E'\n24 every audit row''s actor is the admin: ' || coalesce(b::text, 'null');
  select (details ? 'published_at') into b from public.news_audit_events where article_id = art and action = 'scheduled';
  r := r || E'\n25 scheduled row records published_at: ' || coalesce(b::text, 'null');
  reset role;

  r := r || E'\n26 anon can execute any admin function: ' || (
    has_function_privilege('anon', 'public.admin_save_news_article(uuid, text, text, text, text, text, text, text, text, text, text, text, text, text)', 'execute')
    or has_function_privilege('anon', 'public.admin_publish_news_article(uuid, timestamptz)', 'execute')
    or has_function_privilege('anon', 'public.admin_unpublish_news_article(uuid)', 'execute')
    or has_function_privilege('anon', 'public.admin_archive_news_article(uuid)', 'execute')
    or has_function_privilege('anon', 'public.admin_set_news_featured(uuid, boolean, smallint)', 'execute')
  );

  select count(*) filter (where status = 'published'), count(*) filter (where status = 'published' and is_featured)
  into n, v_rank
  from public.news_articles where id <> art;
  r := r || E'\n27 seed articles untouched (published / featured): ' || n || ' / ' || v_rank;

  raise exception 'VERIFY_RESULTS (rolled back):%', r;
end $$;
