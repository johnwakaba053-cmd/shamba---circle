-- Verification script for Feed media posts
-- (20260929110000_allow_media_only_posts.sql + the Feed composer's
-- post -> Storage -> post_media pipeline).
--
-- Run in the Supabase SQL editor (or via the Supabase MCP execute_sql).
-- It is NOT a migration and changes nothing: it creates a throwaway user,
-- exercises posts/post_media under RLS as that user, then ALWAYS ends with
-- RAISE EXCEPTION, which rolls every change back. Results are in the
-- error message ("VERIFY_RESULTS ...").
--
-- Expected output:
--   1 photo-only post (empty caption) + image row: OK (1 row)
--   2 video-only post (empty caption) + video row: OK (1 row)
--   3 photo + caption: OK
--   4 text-only post: OK
--   5 caption over 2000 chars: REJECTED 23514
--   6 null caption: REJECTED 23502
--   7 media row for someone else's post: REJECTED 42501
--
-- The client-side half of the regression guard is the ESLint rule in
-- eslint.config.mjs that forbids crypto.randomUUID() (undefined on
-- plain-HTTP origins such as a phone on the LAN dev server) outside
-- src/lib/randomId.ts.
do $$
declare
  u uuid := gen_random_uuid();
  other uuid := gen_random_uuid();
  pid uuid; other_post uuid; n int;
  r text := '';
begin
  insert into auth.users (id, aud, role, phone, created_at, updated_at) values
    (u, 'authenticated', 'authenticated', '19990000931', now(), now()),
    (other, 'authenticated', 'authenticated', '19990000932', now(), now());
  update public.profiles set display_name = 'Verify Media' where id in (u, other);

  perform set_config('request.jwt.claims', json_build_object('sub', other, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.posts (profile_id, community_id, body) values (other, null, 'someone else') returning id into other_post;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  set local role authenticated;

  insert into public.posts (profile_id, community_id, body) values (u, null, '') returning id into pid;
  insert into public.post_media (post_id, profile_id, storage_path, media_type) values (pid, u, pid || '/a.jpg', 'image');
  select count(*) into n from public.post_media where post_id = pid and media_type = 'image';
  r := r || E'\n1 photo-only post (empty caption) + image row: OK (' || n || ' row)';

  insert into public.posts (profile_id, community_id, body) values (u, null, '') returning id into pid;
  insert into public.post_media (post_id, profile_id, storage_path, media_type) values (pid, u, pid || '/a.mp4', 'video');
  select count(*) into n from public.post_media where post_id = pid and media_type = 'video';
  r := r || E'\n2 video-only post (empty caption) + video row: OK (' || n || ' row)';

  insert into public.posts (profile_id, community_id, body) values (u, null, 'Photo with a caption') returning id into pid;
  insert into public.post_media (post_id, profile_id, storage_path, media_type) values (pid, u, pid || '/b.jpg', 'image');
  r := r || E'\n3 photo + caption: OK';

  insert into public.posts (profile_id, community_id, body) values (u, null, 'Text only') returning id into pid;
  r := r || E'\n4 text-only post: OK';

  begin
    insert into public.posts (profile_id, community_id, body) values (u, null, repeat('x', 2001));
    r := r || E'\n5 caption over 2000 chars: ALLOWED';
  exception when others then r := r || E'\n5 caption over 2000 chars: REJECTED ' || sqlstate;
  end;

  begin
    insert into public.posts (profile_id, community_id, body) values (u, null, null);
    r := r || E'\n6 null caption: ALLOWED';
  exception when others then r := r || E'\n6 null caption: REJECTED ' || sqlstate;
  end;

  begin
    insert into public.post_media (post_id, profile_id, storage_path, media_type)
      values (other_post, u, other_post || '/x.jpg', 'image');
    r := r || E'\n7 media row for someone else''s post: ALLOWED';
  exception when others then r := r || E'\n7 media row for someone else''s post: REJECTED ' || sqlstate;
  end;

  reset role;
  raise exception 'VERIFY_RESULTS (rolled back):%', r;
end $$;
