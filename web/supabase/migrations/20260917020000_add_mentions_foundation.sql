-- @Mentions database foundation, part 1: post_mentions + a minimal
-- authenticated profile search RPC for a future composer's
-- autocomplete. No composer, ReelInfo rendering, or notification work
-- is part of this migration.

-- === post_mentions =========================================================
--
-- A structured post -> profile relationship, never free text. Mirrors
-- post_hashtags' shape exactly (composite PK, same cascade behavior),
-- minus the separate "dictionary" table hashtags needed -- a mention's
-- entity is a profiles row that already exists, so no extra table is
-- required here.

create table public.post_mentions (
  post_id uuid not null references public.posts (id) on delete cascade,
  mentioned_profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, mentioned_profile_id)
);

alter table public.post_mentions enable row level security;

-- Same shape as "Authenticated users can view post hashtags" -- a
-- mention is visible only to whoever can already see the underlying
-- post (Feed-level, or a community the viewer belongs to). Exposing a
-- mentioned_profile_id here reveals nothing about that profile on its
-- own -- resolving it to a display name still has to go through
-- get_public_profile(), which independently enforces
-- profile_visibility, unchanged by this migration.
create policy "Authenticated users can view post mentions"
on public.post_mentions
for select
to authenticated
using (
  exists (
    select 1
    from public.posts p
    where p.id = post_mentions.post_id
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

-- Same shape as "Authors can attach hashtags to their own posts" --
-- only the post's own author may attach a mention to it. No UPDATE or
-- DELETE policy exists -- editing/removing a mention is out of scope
-- for this stage, and omitting the policy is a hard "nobody can" by
-- default under RLS (a post's own cascade-delete still cleans up its
-- mentions regardless, since that's enforced by the FK, not RLS).
create policy "Authors can attach mentions to their own posts"
on public.post_mentions
for insert
to authenticated
with check (
  exists (
    select 1
    from public.posts p
    where p.id = post_mentions.post_id
      and p.profile_id = (select auth.uid())
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

-- === profile search (foundation for a future @mention autocomplete) =======
--
-- profiles has no broad SELECT policy (own-row only), and this
-- migration does not add one -- get_public_profile() is and remains
-- the only privacy boundary for reading another user's profile. This
-- function follows the exact same SECURITY DEFINER pattern: it
-- computes what is safe to expose per row; the caller never gets
-- direct table access, and phone is never selected here at all.
--
-- Case-insensitive prefix search needs an index a default (non-"C")
-- collation won't otherwise use for LIKE/ILIKE -- lower(display_name)
-- with text_pattern_ops is the standard fix, matched by querying
-- lower(display_name) LIKE lower(query) || '%' (a prefix match, not a
-- substring ILIKE), so this stays an index range scan rather than a
-- full table scan as the table grows.
create index profiles_display_name_lower_idx
  on public.profiles (lower(display_name) text_pattern_ops);

create function public.search_public_profiles(p_query text, p_limit integer default 10)
returns table(profile_id uuid, display_name text, is_public boolean, roles text[])
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id as profile_id,
    p.display_name,
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
$$;

revoke execute on function public.search_public_profiles(text, integer) from public;
revoke execute on function public.search_public_profiles(text, integer) from anon;
grant execute on function public.search_public_profiles(text, integer) to authenticated;
