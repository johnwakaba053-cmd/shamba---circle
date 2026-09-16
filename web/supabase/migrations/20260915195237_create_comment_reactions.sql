-- Comment reactions: toggle-per-type pattern, one level deeper than
-- post_likes (a reaction is scoped to a comment, not directly to a
-- community). A row's existence is the reaction; the composite primary
-- key (comment_id, profile_id, reaction_type) is what allows a user to
-- hold several different reaction types on the same comment while
-- preventing a duplicate of the same type.
create table public.comment_reactions (
  comment_id uuid not null references public.post_comments (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  reaction_type text not null
    check (reaction_type in ('love', 'helpful', 'funny', 'surprised', 'thanks', 'money')),
  created_at timestamptz not null default now(),
  primary key (comment_id, profile_id, reaction_type)
);

alter table public.comment_reactions enable row level security;

-- A user may see only their own reaction rows (mirrors post_likes'
-- "Users can view their own likes") — aggregate counts are exposed
-- separately below via a security definer function.
create policy "Users can view their own comment reactions"
on public.comment_reactions
for select
to authenticated
using (profile_id = (select auth.uid()));

-- A user may only react as themselves, and only on a comment belonging
-- to a post in a community they currently belong to. Direct EXISTS
-- check through post_comments -> posts -> community_memberships, not a
-- security definer function — mirrors the posts/post_likes/post_comments
-- INSERT policies exactly: the caller's own community_memberships row is
-- already readable to them, and comments/posts are openly readable, so
-- no RLS bypass is needed to evaluate this.
create policy "Members can react to comments in their communities"
on public.comment_reactions
for insert
to authenticated
with check (
  profile_id = (select auth.uid())
  and exists (
    select 1
    from public.post_comments c
    join public.posts p on p.id = c.post_id
    join public.community_memberships m on m.community_id = p.community_id
    where c.id = comment_reactions.comment_id
      and m.profile_id = (select auth.uid())
  )
);

-- A user may remove only their own reaction, regardless of current
-- membership status — mirrors how post/comment/like ownership already
-- persists independently of membership. No UPDATE policy: toggle-style,
-- same as post_likes and community_memberships.
create policy "Users can remove their own comment reactions"
on public.comment_reactions
for delete
to authenticated
using (profile_id = (select auth.uid()));

-- Secure aggregate counts, same pattern as post_like_count: security
-- definer so it can count every reaction on a comment regardless of who
-- is asking, but returns only per-type counts, never row data (no
-- profile_id, no created_at).
create function public.comment_reaction_counts(p_comment_id uuid)
returns table (reaction_type text, count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select reaction_type, count(*)
  from public.comment_reactions
  where comment_id = p_comment_id
  group by reaction_type;
$$;

-- Supabase grants anon a direct EXECUTE on new public functions by
-- default, independent of the PUBLIC pseudo-role revoke, so it must be
-- revoked explicitly (the same gotcha hit and fixed for
-- community_member_count and reused correctly for post_like_count).
revoke execute on function public.comment_reaction_counts(uuid) from public;
revoke execute on function public.comment_reaction_counts(uuid) from anon;
grant execute on function public.comment_reaction_counts(uuid) to authenticated;
