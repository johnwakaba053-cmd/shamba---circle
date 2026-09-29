-- Feed posts: the caption is optional when a photo/video is attached.
--
-- posts.body was CHECK (char_length(body) between 1 and 2000), so a
-- photo-only or video-only Feed post could not exist. The Feed composer
-- now allows posting with media and no caption (it still requires a
-- caption OR at least one photo/video), so an empty caption must be
-- storable.
--
-- Only this one CHECK changes: the 2000-character limit stays, and body
-- stays NOT NULL (an absent caption is stored as '', so every reader can
-- keep treating body as a string). No RLS policy, other constraint,
-- trigger, table or function is touched; community posts are unaffected
-- (their composer still requires text).
alter table public.posts drop constraint posts_body_check;

alter table public.posts add constraint posts_body_check
  check (char_length(body) <= 2000);
