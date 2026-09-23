-- Shamba Space Profile, Phase 2A: avatar + bio data/privacy foundation.
--
-- Scope, deliberately narrow: two new nullable profiles columns, a new
-- private avatar storage bucket, and extending the two existing public-
-- identity functions (get_public_profile/search_public_profiles) to carry
-- the two new fields under the exact visibility rule they already enforce
-- for display_name/roles. No UI, no three-dot menu, no post grid, no
-- profile viewer -- those are separate, later work.
--
-- Explicitly NOT touched by this migration (per the approved scope):
--   - can_view_profile_posts(), get_profile_posts(), follower_count(),
--     following_count() -- the Phase 1 post-privacy functions are left
--     completely unmodified and are not called anywhere in this file.
--     Avatar/bio visibility deliberately follows a DIFFERENT, narrower
--     rule than posts (public OR owner, with no follower branch) -- see
--     the new can_view_profile_identity() helper below for why a
--     separate, posts-unaware function was required.
--   - farmer_preferences, farmer_crop_preferences,
--     farmer_livestock_preferences, alert_notification_preferences -- no
--     column added, no row touched, no privacy change. County/location is
--     deliberately NOT added to profiles here; it stays inside
--     farmer_preferences, which stays private.
--   - Global posts RLS, stories, post_comments, post_likes,
--     comment_reactions -- unrelated to this batch.

-- === profiles: avatar_path + bio ===========================================

alter table public.profiles
  add column avatar_path text,
  add column bio text;

-- 280 characters -- enough for a short farmer profile blurb, short enough
-- to stay scannable in a profile header; matches the well-established
-- "short bio" convention used elsewhere on the web rather than an
-- arbitrarily-chosen number. NULL bio (never written yet) is explicitly
-- allowed by the "bio is null or ..." form.
alter table public.profiles
  add constraint profiles_bio_length_check check (
    bio is null or char_length(bio) <= 280
  );

-- avatar_path deliberately has no format/length CHECK: it stores a Storage
-- object path (e.g. "{profile_id}/{filename}"), never a public URL --
-- validated implicitly by the storage RLS below (only a path the owner
-- was actually allowed to upload to can ever exist), the same convention
-- already used for post_media.storage_path/stories.media_path (neither of
-- which has its own CHECK constraint either).

-- === avatars storage bucket =================================================
--
-- A new, dedicated private bucket -- not reused from post-media/story-
-- media/listing-media, since none of those buckets' existing SELECT
-- policies encode profile_visibility at all, and avatars specifically
-- must. Path shape "{profile_id}/{filename}", identical convention to
-- listing-media/story-media: ownership for INSERT/UPDATE is authorized
-- directly from the path's own first segment against auth.uid(), never
-- from a client-supplied profile_id anywhere in the request body.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  false,
  5242880, -- 5MB -- a profile photo is much smaller than a listing/post photo
  array['image/jpeg', 'image/png', 'image/webp']
);

-- A caller cannot upload into another profile's folder no matter what
-- profile_id they claim elsewhere, because this check never reads one --
-- identical mechanism to listing-media's own upload policy.
create policy "Owners can upload their own avatar"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(objects.name))[1] = (select auth.uid())::text
);

-- In-place replacement at the same path (e.g. always upserting
-- "{profile_id}/avatar.jpg") so changing a photo doesn't require a
-- separate delete-then-reupload step -- same ownership check as the
-- INSERT policy, required on both USING (which row you may touch) and
-- WITH CHECK (what the row may look like afterwards).
create policy "Owners can update their own avatar"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(objects.name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(objects.name))[1] = (select auth.uid())::text
);

-- Storage automatically records the uploader as `owner` on insert --
-- identical direct-ownership DELETE pattern already used by post-media/
-- story-media/listing-media's own delete policies.
create policy "Owners can delete their own avatar"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and owner = (select auth.uid())
);

-- Read access must follow the *identity* visibility rule (public OR
-- owner) -- the exact same rule get_public_profile() already uses for
-- avatar_path/bio -- deliberately NOT the posts rule (public OR owner OR
-- approved follower). These are two intentionally different privacy
-- rules in this product: a private account's posts are shared with
-- followers, but its avatar/bio are not. Reusing can_view_profile_posts()
-- here would silently grant followers a private avatar even though
-- get_public_profile() would never hand them the avatar_path to look up
-- in the first place -- two different gates for the same photo. This
-- narrow helper exists so that never happens: it has no reference to
-- public.follows at all, by construction.
--
-- A plain inline `exists (select 1 from public.profiles ...)` cannot do
-- this job directly inside the storage policy: profiles' own RLS
-- (`id = auth.uid()`) would block reading any OTHER user's row entirely
-- before this policy's own condition is even reached, making "any
-- authenticated user may see a public profile's avatar" impossible to
-- express that way. A SECURITY DEFINER function is the smallest way to
-- cross that boundary safely, exactly like get_public_profile() itself
-- already does for the identical reason.
create function public.can_view_profile_identity(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select
    p_profile_id = auth.uid()
    or exists (
      select 1
      from public.profiles p
      where p.id = p_profile_id
        and p.profile_visibility = 'public'
    );
$function$;

revoke all on function public.can_view_profile_identity(uuid) from public;
revoke execute on function public.can_view_profile_identity(uuid) from anon;
grant execute on function public.can_view_profile_identity(uuid) to authenticated;

create policy "Profile visibility governs avatar reads"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'avatars'
  and public.can_view_profile_identity(((storage.foldername(objects.name))[1])::uuid)
);

-- === get_public_profile(): extend with avatar_path + bio ===================
--
-- Postgres cannot change a function's output-column list via CREATE OR
-- REPLACE (only same-shape replacement is allowed) -- adding avatar_path/
-- bio requires DROP + CREATE. This resets the function's ACL to this
-- project's default privileges (which, as the Phase 1 migration's audit
-- trail documented, grant anon EXECUTE automatically on any brand-new-to-
-- Postgres function object) -- so the same explicit
-- revoke-from-public/revoke-from-anon/grant-to-authenticated sequence is
-- required again below, exactly as for a genuinely new function. This is
-- not weakening or replacing the function's behavior: every existing
-- column, every existing condition for display_name/roles, and the
-- existing (profile_visibility = 'public') is_public flag are preserved
-- byte-for-byte; only two columns are added, gated by the exact same
-- "public OR owner" condition already used for display_name.
drop function if exists public.get_public_profile(uuid);

create function public.get_public_profile(p_profile_id uuid)
returns table (
  profile_id uuid,
  display_name text,
  avatar_path text,
  bio text,
  is_public boolean,
  roles text[]
)
language sql
stable
security definer
set search_path to ''
as $function$
  select
    p.id as profile_id,
    case
      when p.profile_visibility = 'public' or p.id = auth.uid() then p.display_name
      else null
    end as display_name,
    case
      when p.profile_visibility = 'public' or p.id = auth.uid() then p.avatar_path
      else null
    end as avatar_path,
    case
      when p.profile_visibility = 'public' or p.id = auth.uid() then p.bio
      else null
    end as bio,
    (p.profile_visibility = 'public') as is_public,
    case
      when p.profile_visibility = 'public' or p.id = auth.uid()
        then (
          select array_agg(r.role order by r.role)
          from public.user_roles r
          where r.profile_id = p.id
        )
      else null
    end as roles
  from public.profiles p
  where p.id = p_profile_id;
$function$;

revoke all on function public.get_public_profile(uuid) from public;
revoke execute on function public.get_public_profile(uuid) from anon;
grant execute on function public.get_public_profile(uuid) to authenticated;

-- === search_public_profiles(): extend with avatar_path + bio ===============
--
-- Unlike get_public_profile (which always returns a row and nulls out
-- fields for an unauthorized viewer), this function's WHERE clause already
-- excludes every non-public, non-own profile from the result set entirely
-- -- so every row it can possibly return is already authorized, and
-- avatar_path/bio can be added to the SELECT list directly with no new
-- per-column CASE needed. Same DROP + CREATE + explicit ACL requirement
-- as above, for the same reason (output-column list is changing).
drop function if exists public.search_public_profiles(text, integer);

create function public.search_public_profiles(p_query text, p_limit integer default 10)
returns table (
  profile_id uuid,
  display_name text,
  avatar_path text,
  bio text,
  is_public boolean,
  roles text[]
)
language sql
stable
security definer
set search_path to ''
as $function$
  select
    p.id as profile_id,
    p.display_name,
    p.avatar_path,
    p.bio,
    (p.profile_visibility = 'public') as is_public,
    (
      select array_agg(r.role order by r.role)
      from public.user_roles r
      where r.profile_id = p.id
    ) as roles
  from public.profiles p
  where p.display_name is not null
    and (
      p.profile_visibility = 'public'
      or p.id = (select auth.uid())
    )
    and lower(p.display_name) like lower(
      replace(replace(replace(p_query, '\', '\\'), '%', '\%'), '_', '\_')
    ) || '%' escape '\'
  order by p.display_name
  limit least(greatest(p_limit, 1), 10);
$function$;

revoke all on function public.search_public_profiles(text, integer) from public;
revoke execute on function public.search_public_profiles(text, integer) from anon;
grant execute on function public.search_public_profiles(text, integer) to authenticated;
