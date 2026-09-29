-- Verification script for 20260929090000_allow_feed_level_comment_reactions.sql
--
-- Run in the Supabase SQL editor (or via the Supabase MCP execute_sql).
-- It is NOT a migration and changes nothing: it creates two throwaway
-- users and some posts/comments/reactions, exercises the comment_reactions
-- RLS policies as those users (and as anon), then ALWAYS ends with
-- RAISE EXCEPTION, which rolls every change back. The results are in the
-- error message ("VERIFY_RESULTS ...").
--
-- Expected output:
--   1 react to another user's feed-level Reel comment: ALLOWED
--   2 non-member reacts to community comment: DENIED 42501
--   3 another user deletes Y's reaction: rows = 0
--   4 another user updates Y's reaction: rows = 0
--   5 react as someone else: DENIED 42501
--   6 unauthenticated reacts: DENIED 42501
--   7 Y removes own reaction: rows = 1
--
-- Uses the 'agribusiness' community and phone numbers 19990000901/902,
-- which must not belong to real accounts.
do $$
declare
  x uuid := gen_random_uuid();
  y uuid := gen_random_uuid();
  comm text := 'agribusiness';
  feed_post uuid; comm_post uuid; feed_comment uuid; comm_comment uuid;
  n int;
  r text := '';
begin
  insert into auth.users (id, aud, role, phone, created_at, updated_at) values
    (x, 'authenticated', 'authenticated', '19990000901', now(), now()),
    (y, 'authenticated', 'authenticated', '19990000902', now(), now());
  update public.profiles set display_name = 'DryRun X' where id = x;
  update public.profiles set display_name = 'DryRun Y' where id = y;

  -- Setup as X, through the real RLS path.
  perform set_config('request.jwt.claims', json_build_object('sub', x, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.posts (profile_id, community_id, body) values (x, null, 'dry run feed reel') returning id into feed_post;
  insert into public.post_comments (post_id, profile_id, body) values (feed_post, x, 'dry run comment 1') returning id into feed_comment;
  insert into public.community_memberships (community_id, profile_id) values (comm, x);
  insert into public.posts (profile_id, community_id, body) values (x, comm, 'dry run community post') returning id into comm_post;
  insert into public.post_comments (post_id, profile_id, body) values (comm_post, x, 'dry run comment 2') returning id into comm_comment;
  reset role;

  -- 1: user can react to another user's comment on a Feed-level Reel.
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', y, 'role', 'authenticated')::text, true);
    set local role authenticated;
    insert into public.comment_reactions (comment_id, profile_id, reaction_type) values (feed_comment, y, 'love');
    r := r || E'\n1 react to another user''s feed-level Reel comment: ALLOWED';
  exception when others then r := r || E'\n1 react to another user''s feed-level Reel comment: DENIED ' || sqlstate;
  end;
  reset role;

  -- 2: community membership is still required for community posts.
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', y, 'role', 'authenticated')::text, true);
    set local role authenticated;
    insert into public.comment_reactions (comment_id, profile_id, reaction_type) values (comm_comment, y, 'love');
    r := r || E'\n2 non-member reacts to community comment: ALLOWED';
  exception when others then r := r || E'\n2 non-member reacts to community comment: DENIED ' || sqlstate;
  end;
  reset role;

  -- 3 + 4: user cannot modify another user's reaction.
  perform set_config('request.jwt.claims', json_build_object('sub', x, 'role', 'authenticated')::text, true);
  set local role authenticated;
  delete from public.comment_reactions where profile_id = y;
  get diagnostics n = row_count;
  r := r || E'\n3 another user deletes Y''s reaction: rows = ' || n;
  update public.comment_reactions set reaction_type = 'funny' where profile_id = y;
  get diagnostics n = row_count;
  r := r || E'\n4 another user updates Y''s reaction: rows = ' || n;
  reset role;

  -- 5: user cannot react on someone else's behalf.
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', x, 'role', 'authenticated')::text, true);
    set local role authenticated;
    insert into public.comment_reactions (comment_id, profile_id, reaction_type) values (feed_comment, y, 'thanks');
    r := r || E'\n5 react as someone else: ALLOWED';
  exception when others then r := r || E'\n5 react as someone else: DENIED ' || sqlstate;
  end;
  reset role;

  -- 6: unauthenticated user cannot react.
  begin
    perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
    set local role anon;
    insert into public.comment_reactions (comment_id, profile_id, reaction_type) values (feed_comment, y, 'thanks');
    r := r || E'\n6 unauthenticated reacts: ALLOWED';
  exception when others then r := r || E'\n6 unauthenticated reacts: DENIED ' || sqlstate;
  end;
  reset role;

  -- 7: user can remove their own reaction.
  perform set_config('request.jwt.claims', json_build_object('sub', y, 'role', 'authenticated')::text, true);
  set local role authenticated;
  delete from public.comment_reactions where comment_id = feed_comment and profile_id = y and reaction_type = 'love';
  get diagnostics n = row_count;
  r := r || E'\n7 Y removes own reaction: rows = ' || n;
  reset role;

  raise exception 'VERIFY_RESULTS (rolled back):%', r;
end $$;
