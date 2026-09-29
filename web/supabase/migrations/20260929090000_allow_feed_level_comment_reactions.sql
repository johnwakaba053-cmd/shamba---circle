-- Feed architecture follow-up -- comment reactions on Feed-level posts.
--
-- 20260916200000_add_feed_level_engagement_and_media.sql opened likes,
-- comments and media to Feed-level posts (posts.community_id IS NULL) but
-- missed public.comment_reactions. Its INSERT policy still joined
-- post_comments -> posts -> community_memberships ON
-- m.community_id = p.community_id, which can never match a NULL
-- community_id -- so nobody (not even the Reel's own author) could react
-- to a comment on a Feed-level Reel.
--
-- This replaces ONLY that INSERT policy, with the exact shape
-- post_likes/post_comments already use:
--   - profile_id = auth.uid(): a farmer can only ever react as themselves;
--   - community_id IS NULL (Feed-level post): no membership to check;
--   - otherwise the existing community-membership check, unchanged, so
--     every Community behavior stays exactly as it is today.
--
-- Untouched: the SELECT and DELETE policies (own rows only), the absence
-- of any UPDATE policy (nobody can edit a reaction), the `to
-- authenticated` scoping (anon still has no policy and is denied), the
-- reaction_type CHECK, comment_reaction_counts(), and the
-- notify_comment_reaction trigger.

drop policy "Members can react to comments in their communities" on public.comment_reactions;

create policy "Authenticated users can react to comments"
on public.comment_reactions
for insert
to authenticated
with check (
  profile_id = (select auth.uid())
  and exists (
    select 1
    from public.post_comments c
    join public.posts p on p.id = c.post_id
    where c.id = comment_reactions.comment_id
      and (
        p.community_id is null
        or exists (
          select 1
          from public.community_memberships m
          where m.community_id = p.community_id
            and m.profile_id = (select auth.uid())
        )
      )
  )
);
