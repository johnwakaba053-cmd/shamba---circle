-- Shamba Space Profile, Phase 1: privacy foundation for profile posts.
--
-- Product rule being enforced (given, not invented):
--   PUBLIC account  -- any authenticated user may view the owner's profile posts.
--   PRIVATE account -- only the owner, or an approved follower, may view them.
--   Farmer preferences (county/crops/livestock/alerts) are NEVER exposed by
--   anything in this migration -- they stay exactly as private as they are
--   today (profile_id = auth.uid() only), untouched here.
--
-- Follow-relationship interpretation (read-only audit finding, not invented):
--   public.follows(follower_profile_id, followed_profile_id, created_at) has
--   no status/approval column and its own INSERT policy lets a user follow
--   instantly, as themselves, with no request/approval step anywhere in the
--   schema. There is no follow-request system to respect or preserve.
--   Therefore: an existing row in `follows` IS an "approved follower" for
--   the purposes of this rule -- there is no other definition available.
--
-- What this migration deliberately does NOT do:
--   - It does not touch RLS on posts, post_media, post_comments, post_likes,
--     comment_reactions, stories, or any storage policy. Feed and
--     Communities both rely on the existing broad `posts`/`post_comments`
--     SELECT policies plus their own server-side community-membership
--     filtering (see web/src/app/feed/page.tsx and
--     web/src/app/communities/[id]/page.tsx) -- tightening those policies
--     here would risk breaking that already-working, intentional
--     architecture, which is explicitly out of scope for this phase.
--   - It does not change get_public_profile()/search_public_profiles() --
--     their existing "public OR owner" rule for display_name/roles is a
--     separate, pre-existing identity-visibility rule this task was not
--     asked to change. This migration adds a *second*, independent rule
--     (owner OR public OR approved follower) specifically for posts and
--     follower/following counts.
--   - It does not change Stories. See the accompanying audit report for
--     why (Stories currently has its own, different, undecided gap that
--     this task was explicitly told not to silently fix).
--
-- New/changed functions:
--   can_view_profile_posts(uuid)  -- new shared authorization helper.
--   get_profile_posts(uuid)       -- new SECURITY DEFINER post-retrieval path.
--   follower_count(uuid)          -- redefined in place to add the same check.
--   following_count(uuid)         -- redefined in place to add the same check.
--
-- follower_count/following_count today have exactly one caller anywhere in
-- the app (web/src/app/profile/[id]/page.tsx), and only inside its existing
-- `if (isVisible)` branch, where isVisible already means "public profile or
-- the viewer is the owner" (from get_public_profile). Both of those cases
-- still satisfy the new check below, so this redefinition does not change
-- that call site's current behavior at all -- it only closes the gap where
-- calling either RPC directly (bypassing the page's own isVisible gate)
-- could previously return a private profile's counts to anyone.

-- Shared authorization check: may `auth.uid()` see p_profile_id's posts
-- and follow counts? True for the owner, for any public profile, or for
-- anyone who already follows p_profile_id (an existing follows row is
-- this app's only concept of "approved follower" -- see note above).
create or replace function public.can_view_profile_posts(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select
    p_profile_id = (select auth.uid())
    or exists (
      select 1
      from public.profiles p
      where p.id = p_profile_id
        and p.profile_visibility = 'public'
    )
    or exists (
      select 1
      from public.follows f
      where f.follower_profile_id = (select auth.uid())
        and f.followed_profile_id = p_profile_id
    );
$function$;

-- CREATE FUNCTION applies this project's default privileges to a brand-new
-- function automatically, which (confirmed via pg_default_acl) includes
-- EXECUTE for anon/PUBLIC -- unlike follower_count/following_count below,
-- which already exist and keep their current, already-restricted ACL
-- across CREATE OR REPLACE. The explicit revoke here closes that gap for
-- this genuinely new function before the grant narrows it back down.
revoke all on function public.can_view_profile_posts(uuid) from public;
revoke execute on function public.can_view_profile_posts(uuid) from anon;
grant execute on function public.can_view_profile_posts(uuid) to authenticated;

-- The one sanctioned path for fetching another profile's posts. Returns
-- zero rows for an unauthorized viewer (never an error, never a partial
-- row) -- the WHERE clause itself is the authorization boundary, not a
-- check the caller has to remember to apply. Selects only the columns the
-- future profile UI actually needs (matching what Feed/Communities already
-- select from posts); never touches farmer_preferences, farmer_crop_
-- preferences, farmer_livestock_preferences, or alert_notification_
-- preferences, and never reaches into post_media/post_comments/post_likes
-- -- those stay behind their own existing, unchanged RLS.
create or replace function public.get_profile_posts(p_profile_id uuid)
returns table (
  id uuid,
  community_id text,
  profile_id uuid,
  author_display_name text,
  body text,
  topic text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path to ''
as $function$
  select
    po.id,
    po.community_id,
    po.profile_id,
    po.author_display_name,
    po.body,
    po.topic,
    po.created_at
  from public.posts po
  where po.profile_id = p_profile_id
    and public.can_view_profile_posts(p_profile_id)
  order by po.created_at desc;
$function$;

-- Same reasoning as can_view_profile_posts above: this is also a
-- brand-new function, so the default-privilege anon/PUBLIC grant must be
-- explicitly revoked before narrowing access to authenticated.
revoke all on function public.get_profile_posts(uuid) from public;
revoke execute on function public.get_profile_posts(uuid) from anon;
grant execute on function public.get_profile_posts(uuid) to authenticated;

-- Redefined in place (see note above on why this is safe for the one
-- existing caller): same shape and behavior as before for an authorized
-- viewer, but now returns null -- not a real 0, and not the true count --
-- for an unauthorized viewer, so a private profile's follower count can no
-- longer be read by calling this RPC directly for an arbitrary profile id.
create or replace function public.follower_count(p_profile_id uuid)
returns bigint
language sql
stable
security definer
set search_path to ''
as $function$
  select
    case
      when public.can_view_profile_posts(p_profile_id)
        then (select count(*) from public.follows where followed_profile_id = p_profile_id)
      else null
    end;
$function$;

create or replace function public.following_count(p_profile_id uuid)
returns bigint
language sql
stable
security definer
set search_path to ''
as $function$
  select
    case
      when public.can_view_profile_posts(p_profile_id)
        then (select count(*) from public.follows where follower_profile_id = p_profile_id)
      else null
    end;
$function$;

-- follower_count/following_count already had EXECUTE granted to
-- authenticated from their original migration; CREATE OR REPLACE does not
-- revoke existing grants, but these are included anyway so this migration
-- is self-contained and correct even if run against a database where that
-- prior grant is somehow missing.
grant execute on function public.follower_count(uuid) to authenticated;
grant execute on function public.following_count(uuid) to authenticated;
