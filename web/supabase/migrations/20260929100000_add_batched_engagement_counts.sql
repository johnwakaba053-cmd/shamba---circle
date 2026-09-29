-- Farming Reels performance -- batched engagement counts.
--
-- Loading one Feed page (or a single Reel) called post_like_count() once
-- per Reel and comment_reaction_counts() once per comment -- N + C round
-- trips. These two functions return the same totals for many ids in one
-- call each.
--
-- They are deliberately exact batched equivalents of the existing
-- single-id functions (20260915184144_create_post_likes.sql and
-- 20260915195237_create_comment_reactions.sql):
--   - SECURITY DEFINER for the same reason: post_likes / comment_reactions
--     SELECT policies only expose the caller's OWN rows, so totals across
--     all farmers can't be counted under the caller's privileges;
--   - they return aggregate counts only -- never profile_id, created_at or
--     any other row data;
--   - they count for exactly the ids they're given, like the single-id
--     versions (which any signed-in farmer can already call for any id),
--     so no count becomes visible that wasn't already.
-- Ids with no likes / reactions simply produce no row (callers treat a
-- missing row as 0, exactly like count(*) = 0 before).
--
-- Nothing else changes: post_like_count() and comment_reaction_counts()
-- stay as they are (Communities and the profile grid still use them), and
-- no table, policy, trigger or notification behavior is touched.

create function public.post_like_counts(p_post_ids uuid[])
returns table (post_id uuid, like_count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select l.post_id, count(*)
  from public.post_likes l
  where l.post_id = any (p_post_ids)
  group by l.post_id;
$$;

-- Same explicit revoke/grant sequence as every function in this project:
-- `revoke ... from public` alone doesn't remove Supabase's default direct
-- grant to anon on a new function.
revoke all on function public.post_like_counts(uuid[]) from public;
revoke execute on function public.post_like_counts(uuid[]) from anon;
grant execute on function public.post_like_counts(uuid[]) to authenticated;

create function public.comment_reaction_counts_for_comments(p_comment_ids uuid[])
returns table (comment_id uuid, reaction_type text, reaction_count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select r.comment_id, r.reaction_type, count(*)
  from public.comment_reactions r
  where r.comment_id = any (p_comment_ids)
  group by r.comment_id, r.reaction_type;
$$;

revoke all on function public.comment_reaction_counts_for_comments(uuid[]) from public;
revoke execute on function public.comment_reaction_counts_for_comments(uuid[]) from anon;
grant execute on function public.comment_reaction_counts_for_comments(uuid[]) to authenticated;
