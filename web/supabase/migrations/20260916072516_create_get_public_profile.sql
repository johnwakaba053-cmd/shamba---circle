-- Public profiles foundation: a narrowly-scoped, minimal-field lookup for
-- viewing ANOTHER user's profile, following the exact pattern already
-- proven three times in this schema (community_member_count,
-- post_like_count, comment_reaction_counts) — a SECURITY DEFINER function
-- returning only approved fields, never the underlying table.
--
-- Unlike those three, this function must distinguish "profile does not
-- exist" from "profile exists but is private" (the UI needs both states),
-- so it always returns a row for a real profile id, with display_name and
-- roles nulled out when the caller isn't allowed to see them — it is
-- never a plain "select ... where profile_visibility = 'public'" filter,
-- since phone/email/other columns must never be reachable through this
-- path regardless of visibility (they are simply never selected at all).
--
-- profiles' own RLS (owner-only SELECT/UPDATE) is untouched by this
-- migration.
create function public.get_public_profile(p_profile_id uuid)
returns table (
  profile_id uuid,
  display_name text,
  is_public boolean,
  roles text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id as profile_id,
    case
      when p.profile_visibility = 'public' or p.id = auth.uid() then p.display_name
      else null
    end as display_name,
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
$$;

-- Supabase grants anon a direct EXECUTE on new public functions by
-- default, independent of the PUBLIC pseudo-role revoke, so it must be
-- revoked explicitly (the same gotcha already hit and fixed once in this
-- project, and correctly avoided from the start in every function since).
revoke execute on function public.get_public_profile(uuid) from public;
revoke execute on function public.get_public_profile(uuid) from anon;
grant execute on function public.get_public_profile(uuid) to authenticated;
