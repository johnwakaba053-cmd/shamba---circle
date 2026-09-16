-- Post likes: toggle pattern, same shape as community_memberships. A row's
-- existence is the like; there is no UPDATE policy, matching how
-- membership itself has none.
create table public.post_likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, profile_id)
);

alter table public.post_likes enable row level security;

-- A user may see only their own like rows (mirrors "Users can view their
-- own memberships" on community_memberships) — this is what lets the
-- client show a filled/unfilled heart for the viewer's own like state
-- without exposing who else liked a post. Aggregate counts are exposed
-- separately below via a security definer function, same split already
-- used for community membership vs. community_member_count.
create policy "Users can view their own likes"
on public.post_likes
for select
to authenticated
using (profile_id = (select auth.uid()));

-- A user may only like as themselves, and only on a post in a community
-- they currently belong to. Direct EXISTS check, not a security definer
-- function, mirroring the posts INSERT policy exactly: the caller's own
-- community_memberships row is already readable to them, and posts are
-- openly readable, so no RLS bypass is needed to evaluate this.
create policy "Members can like posts in their communities"
on public.post_likes
for insert
to authenticated
with check (
  profile_id = (select auth.uid())
  and exists (
    select 1
    from public.posts p
    join public.community_memberships m on m.community_id = p.community_id
    where p.id = post_likes.post_id
      and m.profile_id = (select auth.uid())
  )
);

-- A user may remove only their own like, regardless of current
-- membership status — mirrors "Users can leave a community" and how
-- post authorship (update/delete) is not revoked by leaving.
create policy "Users can remove their own likes"
on public.post_likes
for delete
to authenticated
using (profile_id = (select auth.uid()));

-- Duplicate likes are prevented structurally by the (post_id, profile_id)
-- primary key, exactly like community_memberships prevents duplicate
-- joins — no additional constraint needed.

-- Secure aggregate count, same pattern as community_member_count:
-- security definer so it can count every like on a post regardless of
-- who is asking, but returns only a scalar count, never row data.
create function public.post_like_count(p_post_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)
  from public.post_likes
  where post_id = p_post_id;
$$;

-- Supabase grants anon a direct EXECUTE on new public functions by
-- default, independent of the PUBLIC pseudo-role revoke, so it must be
-- revoked explicitly (the same gotcha hit and fixed for
-- community_member_count previously).
revoke execute on function public.post_like_count(uuid) from public;
revoke execute on function public.post_like_count(uuid) from anon;
grant execute on function public.post_like_count(uuid) to authenticated;
