-- Verification script for 20260929150000_add_content_reports.sql
--
-- Run in the Supabase SQL editor (or via the Supabase MCP execute_sql).
-- It is NOT a migration and changes nothing: it creates throwaway users
-- (reporter A, content owner B, outsider C, moderator M) and content,
-- exercises report_content() / resolve_report() / the reports policies
-- as each of them and as anon, then ALWAYS ends with RAISE EXCEPTION,
-- which rolls every change back. The results are in the error message
-- ("VERIFY_RESULTS ...").
--
-- Expected output:
--    1 anon files a report: DENIED 42501
--    2 A reports B's post: OK (owner = B, body + media path copied, no phone)
--    3 A reports the same post again: REJECTED 23505
--    4 A reports B's comment: OK
--    5 A reports B's listing: OK (title copied)
--    6 A reports B's active story: OK
--    7 A reports B's expired story: REJECTED P0002
--    8 A reports B's message in their conversation: OK (only that message)
--    9 A reports a message in B and C's conversation: REJECTED P0002
--   10 A reports B's profile: OK (display name copied, no phone)
--   11 A reports own profile: REJECTED 22023
--   12 A reports a non-existent post: REJECTED P0002
--   13 invalid reason / invalid type: REJECTED 23514 / 22023
--   14 A reads reports / inserts / updates directly: rows = 0 / DENIED 42501 / DENIED 42501
--   15 reported user B / outsider C read reports: rows = 0 / 0
--   16 A calls resolve_report(): DENIED 42501
--   17 anon reads reports: DENIED 42501
--   18 moderator M reads reports: rows = 6
--   19 moderator M reads private messages: rows = 0
--   20 rate limit: 14 more accepted, next REJECTED P0001
--   21 B deletes the reported post: rows = 1; report survives with its body
--   22 B's account deleted: reports kept = 20, owner set to NULL
--   23 M resolves the post report: actioned by M, reviewed_at set
--   24 M sets an invalid status: REJECTED 22023
--
-- Uses phone numbers 19990000921-924, which must not belong to real
-- accounts.
do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  c uuid := gen_random_uuid();
  m uuid := gen_random_uuid();
  post_id uuid; comment_id uuid; listing_id uuid; story_id uuid; old_story_id uuid;
  conv_ab uuid; conv_bc uuid; msg_ab uuid; msg_bc uuid;
  rid uuid; post_report uuid;
  snap jsonb; owner uuid;
  extra uuid[] := '{}';
  n int; accepted int := 0;
  r text := '';
  s text;
begin
  insert into auth.users (id, aud, role, phone, created_at, updated_at) values
    (a, 'authenticated', 'authenticated', '19990000921', now(), now()),
    (b, 'authenticated', 'authenticated', '19990000922', now(), now()),
    (c, 'authenticated', 'authenticated', '19990000923', now(), now()),
    (m, 'authenticated', 'authenticated', '19990000924', now(), now());
  update public.profiles set display_name = 'DryRun A' where id = a;
  update public.profiles set display_name = 'DryRun B', bio = 'dry run bio' where id = b;
  update public.profiles set display_name = 'DryRun C' where id = c;
  update public.profiles set display_name = 'DryRun M' where id = m;
  insert into public.staff_roles (profile_id, role) values (m, 'moderator');

  -- B's content, created with B's JWT claims so the display-name triggers
  -- (which read auth.uid()) fill in B's name; RLS isn't under test here.
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  insert into public.posts (profile_id, author_display_name, body) values (b, 'DryRun B', 'dry run reported reel') returning id into post_id;
  insert into public.post_media (post_id, profile_id, storage_path, media_type) values (post_id, b, b || '/dry-run.jpg', 'image');
  insert into public.post_comments (post_id, profile_id, author_display_name, body) values (post_id, b, 'DryRun B', 'dry run comment') returning id into comment_id;
  insert into public.listings (profile_id, seller_display_name, title, description, category, category_id, listing_type, price, county_id)
    values (b, 'DryRun B', 'dry run listing', 'dry run description', 'seeds_seedlings', 'seeds_seedlings', 'for_sale', 100, 'mombasa')
    returning id into listing_id;
  insert into public.stories (profile_id, media_type, media_path, created_at, expires_at)
    values (b, 'image', b || '/story.jpg', now(), now() + interval '24 hours') returning id into story_id;
  insert into public.stories (profile_id, media_type, media_path, created_at, expires_at)
    values (b, 'image', b || '/old.jpg', now() - interval '25 hours', now() - interval '1 hour') returning id into old_story_id;
  insert into public.conversations (participant_one_id, participant_two_id) values (least(a, b), greatest(a, b)) returning id into conv_ab;
  insert into public.conversations (participant_one_id, participant_two_id) values (least(b, c), greatest(b, c)) returning id into conv_bc;
  insert into public.messages (conversation_id, sender_profile_id, body) values (conv_ab, b, 'dry run message to A') returning id into msg_ab;
  insert into public.messages (conversation_id, sender_profile_id, body) values (conv_bc, b, 'dry run message to C') returning id into msg_bc;
  for i in 1..15 loop
    insert into public.posts (profile_id, author_display_name, body) values (b, 'DryRun B', 'dry run extra ' || i) returning id into rid;
    extra := extra || rid;
  end loop;

  -- 1: anon.
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  set local role anon;
  begin
    perform public.report_content('post', post_id, 'spam');
    r := r || E'\n 1 anon files a report: ALLOWED';
  exception when others then r := r || E'\n 1 anon files a report: DENIED ' || sqlstate;
  end;
  reset role;

  -- 2-16 as reporter A.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  begin
    post_report := public.report_content('post', post_id, 'spam', '  looks like spam  ');
    reset role;
    select snapshot, target_profile_id into snap, owner from public.reports where id = post_report;
    r := r || E'\n 2 A reports B''s post: OK (owner = ' || case when owner = b then 'B' else coalesce(owner::text, 'NULL') end
             || ', body = "' || (snap->>'body') || '", media = ' || (snap->'media'->0->>'storage_path' is not null)
             || ', phone key = ' || (snap ? 'phone') || ', details = "' || (select details from public.reports where id = post_report) || '")';
    set local role authenticated;
  exception when others then r := r || E'\n 2 A reports B''s post: FAILED ' || sqlstate || ' ' || sqlerrm;
  end;

  begin
    perform public.report_content('post', post_id, 'spam');
    r := r || E'\n 3 A reports the same post again: ALLOWED';
  exception when others then r := r || E'\n 3 A reports the same post again: REJECTED ' || sqlstate || ' ' || sqlerrm;
  end;

  begin
    perform public.report_content('comment', comment_id, 'harassment');
    r := r || E'\n 4 A reports B''s comment: OK';
  exception when others then r := r || E'\n 4 A reports B''s comment: FAILED ' || sqlstate || ' ' || sqlerrm;
  end;

  begin
    rid := public.report_content('listing', listing_id, 'scam_or_fraud');
    reset role;
    select snapshot into snap from public.reports where id = rid;
    r := r || E'\n 5 A reports B''s listing: OK (title = "' || (snap->>'title') || '")';
    set local role authenticated;
  exception when others then r := r || E'\n 5 A reports B''s listing: FAILED ' || sqlstate || ' ' || sqlerrm;
  end;

  begin
    perform public.report_content('story', story_id, 'sexual_content');
    r := r || E'\n 6 A reports B''s active story: OK';
  exception when others then r := r || E'\n 6 A reports B''s active story: FAILED ' || sqlstate || ' ' || sqlerrm;
  end;

  begin
    perform public.report_content('story', old_story_id, 'other');
    r := r || E'\n 7 A reports B''s expired story: ALLOWED';
  exception when others then r := r || E'\n 7 A reports B''s expired story: REJECTED ' || sqlstate || ' ' || sqlerrm;
  end;

  begin
    rid := public.report_content('message', msg_ab, 'harassment');
    reset role;
    select snapshot into snap from public.reports where id = rid;
    r := r || E'\n 8 A reports B''s message in their conversation: OK (body = "' || (snap->>'body')
             || '", keys = ' || (select string_agg(k, ',' order by k) from jsonb_object_keys(snap) k) || ')';
    set local role authenticated;
  exception when others then r := r || E'\n 8 A reports B''s message: FAILED ' || sqlstate || ' ' || sqlerrm;
  end;

  begin
    perform public.report_content('message', msg_bc, 'harassment');
    r := r || E'\n 9 A reports a message in B and C''s conversation: ALLOWED';
  exception when others then r := r || E'\n 9 A reports a message in B and C''s conversation: REJECTED ' || sqlstate || ' ' || sqlerrm;
  end;

  begin
    rid := public.report_content('profile', b, 'scam_or_fraud');
    reset role;
    select snapshot into snap from public.reports where id = rid;
    r := r || E'\n10 A reports B''s profile: OK (display name = "' || (snap->>'display_name') || '", phone key = ' || (snap ? 'phone') || ')';
    set local role authenticated;
  exception when others then r := r || E'\n10 A reports B''s profile: FAILED ' || sqlstate || ' ' || sqlerrm;
  end;

  begin
    perform public.report_content('profile', a, 'other');
    r := r || E'\n11 A reports own profile: ALLOWED';
  exception when others then r := r || E'\n11 A reports own profile: REJECTED ' || sqlstate || ' ' || sqlerrm;
  end;

  begin
    perform public.report_content('post', gen_random_uuid(), 'spam');
    r := r || E'\n12 A reports a non-existent post: ALLOWED';
  exception when others then r := r || E'\n12 A reports a non-existent post: REJECTED ' || sqlstate || ' ' || sqlerrm;
  end;

  begin
    perform public.report_content('comment', comment_id, 'not_a_reason');
    s := 'ALLOWED';
  exception when others then s := 'REJECTED ' || sqlstate;
  end;
  begin
    perform public.report_content('group', comment_id, 'spam');
    s := s || ' / ALLOWED';
  exception when others then s := s || ' / REJECTED ' || sqlstate;
  end;
  r := r || E'\n13 invalid reason / invalid type: ' || s;

  select count(*) into n from public.reports;
  s := 'rows = ' || n;
  begin
    insert into public.reports (reporter_profile_id, target_type, target_id, reason, snapshot)
      values (a, 'post', post_id, 'spam', '{"body":"forged"}');
    s := s || ' / insert ALLOWED';
  exception when others then s := s || ' / insert DENIED ' || sqlstate;
  end;
  begin
    update public.reports set status = 'dismissed';
    get diagnostics n = row_count;
    s := s || ' / update rows = ' || n;
  exception when others then s := s || ' / update DENIED ' || sqlstate;
  end;
  r := r || E'\n14 A reads reports / inserts / updates directly: ' || s;

  begin
    perform public.resolve_report(post_report, 'dismissed');
    r := r || E'\n16 A calls resolve_report(): ALLOWED';
  exception when others then r := r || E'\n16 A calls resolve_report(): DENIED ' || sqlstate;
  end;
  reset role;

  -- 15: the reported user and an outsider.
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.reports;
  s := 'rows = ' || n;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.reports;
  r := r || E'\n15 reported user B / outsider C read reports: ' || s || ' / ' || n;
  reset role;

  -- 17: anon reads.
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  set local role anon;
  begin
    select count(*) into n from public.reports;
    r := r || E'\n17 anon reads reports: rows = ' || n;
  exception when others then r := r || E'\n17 anon reads reports: DENIED ' || sqlstate;
  end;
  reset role;

  -- 18-19: moderator.
  perform set_config('request.jwt.claims', json_build_object('sub', m, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.reports;
  r := r || E'\n18 moderator M reads reports: rows = ' || n;
  select count(*) into n from public.messages;
  r := r || E'\n19 moderator M reads private messages: rows = ' || n;
  reset role;

  -- 20: rate limit. A has 6 reports in the last 24 hours; 14 more reach
  -- the limit of 20, and the next one must be refused.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  s := 'no refusal';
  for i in 1..15 loop
    begin
      perform public.report_content('post', extra[i], 'spam');
      accepted := accepted + 1;
    exception when others then
      s := 'next REJECTED ' || sqlstate || ' ' || sqlerrm;
      exit;
    end;
  end loop;
  r := r || E'\n20 rate limit: ' || accepted || ' more accepted, ' || s;
  reset role;

  -- 21: B deletes the reported post through the normal RLS path.
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  delete from public.posts where id = post_id;
  get diagnostics n = row_count;
  reset role;
  select snapshot into snap from public.reports where id = post_report;
  r := r || E'\n21 B deletes the reported post: rows = ' || n || '; report '
           || case when snap is null then 'GONE' else 'survives with body "' || (snap->>'body') || '"' end;

  -- 22: B's whole account is deleted (cascades to all of B's content).
  delete from auth.users where id = b;
  select count(*), count(*) filter (where target_profile_id is null) into n, accepted
  from public.reports where reporter_profile_id = a;
  r := r || E'\n22 B''s account deleted: reports kept = ' || n || ', owner NULL on ' || accepted;

  -- 23-24: moderator resolves.
  perform set_config('request.jwt.claims', json_build_object('sub', m, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.resolve_report(post_report, 'actioned', 'Removed by author; account closed.');
    select status || ' by ' || case when reviewed_by = m then 'M' else coalesce(reviewed_by::text, 'NULL') end
           || ', reviewed_at set = ' || (reviewed_at is not null)
      into s from public.reports where id = post_report;
    r := r || E'\n23 M resolves the post report: ' || s;
  exception when others then r := r || E'\n23 M resolves the post report: FAILED ' || sqlstate || ' ' || sqlerrm;
  end;
  begin
    perform public.resolve_report(post_report, 'open');
    r := r || E'\n24 M sets an invalid status: ALLOWED';
  exception when others then r := r || E'\n24 M sets an invalid status: REJECTED ' || sqlstate;
  end;
  reset role;

  raise exception 'VERIFY_RESULTS (rolled back):%', r;
end $$;
