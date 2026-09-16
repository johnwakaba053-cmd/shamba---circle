-- The author_display_name trigger only ran BEFORE INSERT, so nothing
-- stopped an UPDATE payload from also carrying a forged
-- author_display_name (the UPDATE policy only checks profile_id =
-- auth.uid(), not which columns change). Blast radius was always limited
-- to a user's own comment row, never another user's, but this closes the
-- gap the same way INSERT is already protected: derive the name from
-- auth.uid() on every write, ignoring whatever the client sent.
drop trigger set_post_comment_author_display_name on public.post_comments;

create trigger set_post_comment_author_display_name
  before insert or update on public.post_comments
  for each row
  execute function public.set_post_comment_author_display_name();
