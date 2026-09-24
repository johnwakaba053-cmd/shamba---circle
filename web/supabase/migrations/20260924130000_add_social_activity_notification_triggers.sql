-- Notifications, Phase 2B — real social activity events.
--
-- Scope, deliberately: five AFTER INSERT triggers that populate the
-- existing public.notifications table for events that already have a
-- fully-supported type/entity_type combination (new_follower,
-- post_comment, post_reaction x2, mention) -- no schema change to
-- notifications itself, no new RPC, no UI change. Private messaging does
-- not exist anywhere in this codebase (confirmed by the accompanying
-- read-only audit) and is explicitly not touched or invented here.
--
-- Why triggers, not application code or a new RPC: every write this
-- migration reacts to (follows, post_comments, post_likes,
-- comment_reactions, post_mentions) is already a plain client-side
-- `supabase.from(...).insert(...)` call, with no server action or RPC
-- layer in front of any of them (FeedComposer.tsx, PostCommentComposer.tsx,
-- ReelLikeControl.tsx, ReelFollowControl.tsx all insert directly). A
-- trigger is the only mechanism that fires regardless of which UI
-- component performed the insert, without having to update every current
-- and future composer individually.
--
-- Why SECURITY DEFINER is required here, and what it is NOT used for:
-- public.notifications intentionally grants `authenticated` no INSERT
-- policy at all (see the Phase 1 migration) -- a plain trigger function
-- would run as the inserting farmer and be blocked by that same RLS,
-- exactly like a direct client insert already is. SECURITY DEFINER here
-- exists solely to cross THAT boundary (the one this project's own
-- Phase 1 migration explicitly reserved for "a future trusted
-- SECURITY DEFINER function"), never to cross a profile-privacy
-- boundary: every profiles.display_name lookup below reads only the
-- CURRENT ACTOR's own row, because in every one of these five cases the
-- row being inserted was itself only insertable because
-- `profile_id = auth.uid()` (or, for mentions, because the post's own
-- author is the only one allowed to attach a mention) -- so the lookup
-- would already have succeeded under the acting farmer's own normal
-- privileges even without SECURITY DEFINER. Nothing here reads or
-- exposes a RECIPIENT's private data, and nothing here bypasses
-- can_view_profile_posts()/can_view_profile_identity()/profile_visibility
-- -- the recipient of every one of these five notifications is always
-- the owner of the relationship or content the event happened on, so no
-- third-party profile-privacy boundary is crossed by their existence.
--
-- No exception handling is added around the notification INSERT: a
-- genuine failure here should surface immediately (rolling back the
-- triggering follow/comment/like/reaction/mention along with it) rather
-- than being silently swallowed, consistent with how this schema's other
-- insert paths already fail loudly (e.g. FeedComposer.tsx's own
-- compensating post DELETE when a post_mentions insert fails).

-- === A. New follower ========================================================
--
-- No self-guard needed: follows_no_self_follow already makes a
-- self-follow row impossible to insert in the first place.
create function public.notify_new_follower()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_name text;
begin
  select display_name into v_actor_name
  from public.profiles
  where id = new.follower_profile_id;

  insert into public.notifications (
    recipient_profile_id, actor_profile_id, type, entity_type, entity_id, title
  ) values (
    new.followed_profile_id,
    new.follower_profile_id,
    'new_follower',
    'profile',
    new.follower_profile_id,
    coalesce(v_actor_name, 'Another farmer') || ' started following you'
  );

  return new;
end;
$$;

-- Never granted to authenticated/anon -- this is only ever invoked by
-- the trigger mechanism, never called directly as an RPC. Supabase's
-- default-privilege auto-grant to anon applies to every new function
-- regardless of intended use, so it is revoked explicitly here too, the
-- same gotcha already hit and fixed for every earlier function in this
-- project.
revoke all on function public.notify_new_follower() from public;
revoke execute on function public.notify_new_follower() from anon;
revoke execute on function public.notify_new_follower() from authenticated;

create trigger notify_new_follower
  after insert on public.follows
  for each row
  execute function public.notify_new_follower();

-- === B. Post comment ========================================================
--
-- Skips notifying when the post's own author is the one commenting.
-- No profile-visibility check: the recipient here is always the post's
-- own owner, being told about activity on their own content -- a
-- different question entirely from what a third party may see.
-- NEW.author_display_name is already populated by the existing
-- set_post_comment_author_display_name BEFORE INSERT trigger by the
-- time this AFTER INSERT trigger runs, so no additional profile lookup
-- is needed for the actor's name here.
create function public.notify_post_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_post_owner uuid;
begin
  select profile_id into v_post_owner
  from public.posts
  where id = new.post_id;

  if v_post_owner is null or v_post_owner = new.profile_id then
    return new;
  end if;

  insert into public.notifications (
    recipient_profile_id, actor_profile_id, type, entity_type, entity_id, title
  ) values (
    v_post_owner,
    new.profile_id,
    'post_comment',
    'post_comment',
    new.id,
    coalesce(new.author_display_name, 'Another farmer') || ' commented on your post'
  );

  return new;
end;
$$;

revoke all on function public.notify_post_comment() from public;
revoke execute on function public.notify_post_comment() from anon;
revoke execute on function public.notify_post_comment() from authenticated;

create trigger notify_post_comment
  after insert on public.post_comments
  for each row
  execute function public.notify_post_comment();

-- === C. Post like ============================================================
--
-- post_likes has no denormalized actor name (unlike posts/post_comments),
-- so the actor's display_name is looked up directly -- safe because
-- post_likes' own INSERT policy already requires profile_id = auth.uid(),
-- so this is always the acting farmer's own row. Insert-only: no trigger
-- exists on DELETE, so unliking never generates or removes a
-- notification.
create function public.notify_post_like()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_post_owner uuid;
  v_actor_name text;
begin
  select profile_id into v_post_owner
  from public.posts
  where id = new.post_id;

  if v_post_owner is null or v_post_owner = new.profile_id then
    return new;
  end if;

  select display_name into v_actor_name
  from public.profiles
  where id = new.profile_id;

  insert into public.notifications (
    recipient_profile_id, actor_profile_id, type, entity_type, entity_id, title
  ) values (
    v_post_owner,
    new.profile_id,
    'post_reaction',
    'post',
    new.post_id,
    coalesce(v_actor_name, 'Another farmer') || ' reacted to your post'
  );

  return new;
end;
$$;

revoke all on function public.notify_post_like() from public;
revoke execute on function public.notify_post_like() from anon;
revoke execute on function public.notify_post_like() from authenticated;

create trigger notify_post_like
  after insert on public.post_likes
  for each row
  execute function public.notify_post_like();

-- === D. Comment reaction =====================================================
--
-- Deliberately a separate event from a post like -- comment_reactions is
-- a different table with a different owner (the comment's author, not
-- the post's author). entity_type = 'post_comment' (not 'post') is what
-- distinguishes this from notify_post_like() above at read time, since
-- both share the same notification `type` ('post_reaction').
create function public.notify_comment_reaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_comment_owner uuid;
  v_actor_name text;
begin
  select profile_id into v_comment_owner
  from public.post_comments
  where id = new.comment_id;

  if v_comment_owner is null or v_comment_owner = new.profile_id then
    return new;
  end if;

  select display_name into v_actor_name
  from public.profiles
  where id = new.profile_id;

  insert into public.notifications (
    recipient_profile_id, actor_profile_id, type, entity_type, entity_id, title
  ) values (
    v_comment_owner,
    new.profile_id,
    'post_reaction',
    'post_comment',
    new.comment_id,
    coalesce(v_actor_name, 'Another farmer') || ' reacted to your comment'
  );

  return new;
end;
$$;

revoke all on function public.notify_comment_reaction() from public;
revoke execute on function public.notify_comment_reaction() from anon;
revoke execute on function public.notify_comment_reaction() from authenticated;

create trigger notify_comment_reaction
  after insert on public.comment_reactions
  for each row
  execute function public.notify_comment_reaction();

-- === E. Post mention =========================================================
--
-- post_mentions has no surrogate id (composite PK: post_id,
-- mentioned_profile_id), so entity_id is the post id, matching the
-- read-only audit's own conclusion. The actor is the post's own author
-- (post_mentions' INSERT policy only allows a post's author to attach a
-- mention to it), so v_post_owner is always auth.uid() at insert time --
-- the profiles lookup below is, again, always the acting farmer's own
-- row. Only post mentions are handled here -- comment mentions do not
-- exist in this schema, and story_mentions is a separate, untouched
-- feature not in scope for this phase.
create function public.notify_post_mention()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_post_owner uuid;
  v_actor_name text;
begin
  select profile_id into v_post_owner
  from public.posts
  where id = new.post_id;

  if v_post_owner is null or v_post_owner = new.mentioned_profile_id then
    return new;
  end if;

  select display_name into v_actor_name
  from public.profiles
  where id = v_post_owner;

  insert into public.notifications (
    recipient_profile_id, actor_profile_id, type, entity_type, entity_id, title
  ) values (
    new.mentioned_profile_id,
    v_post_owner,
    'mention',
    'post',
    new.post_id,
    coalesce(v_actor_name, 'Another farmer') || ' mentioned you in a post'
  );

  return new;
end;
$$;

revoke all on function public.notify_post_mention() from public;
revoke execute on function public.notify_post_mention() from anon;
revoke execute on function public.notify_post_mention() from authenticated;

create trigger notify_post_mention
  after insert on public.post_mentions
  for each row
  execute function public.notify_post_mention();
