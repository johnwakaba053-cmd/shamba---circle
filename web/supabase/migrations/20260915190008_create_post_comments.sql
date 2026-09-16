-- Post comments: same shape and author-attribution pattern as posts
-- itself (denormalized, trigger-derived author_display_name, since
-- profiles RLS only lets a user read their own row — there is still no
-- other way to resolve profile_id -> display_name for another author).
create table public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  author_display_name text not null,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Primary read path is "comments for this post, newest first".
create index post_comments_post_id_created_at_idx
  on public.post_comments (post_id, created_at desc);

-- Same trigger pattern as posts.set_post_author_display_name: derives the
-- name server-side from auth.uid() directly, ignoring whatever the client
-- sent, so a forged author_display_name is always overwritten. Not
-- security definer, so it stays subject to profiles' own "view own
-- profile" RLS — it can only ever read the caller's own display_name.
create function public.set_post_comment_author_display_name()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select display_name into new.author_display_name
  from public.profiles
  where id = auth.uid();

  return new;
end;
$$;

create trigger set_post_comment_author_display_name
  before insert on public.post_comments
  for each row
  execute function public.set_post_comment_author_display_name();

alter table public.post_comments enable row level security;

-- Open read, matching posts itself (browsing a post's comments doesn't
-- require membership, same as browsing the post or the community).
create policy "Authenticated users can view comments"
on public.post_comments
for select
to authenticated
using (true);

-- A user may only comment as themselves, and only on a post in a
-- community they currently belong to. Direct EXISTS check through posts,
-- not a security definer function — mirrors the posts and post_likes
-- INSERT policies exactly: the caller's own community_memberships row is
-- already readable to them, and posts are openly readable, so no RLS
-- bypass is needed to evaluate this.
create policy "Members can comment on posts in their communities"
on public.post_comments
for insert
to authenticated
with check (
  profile_id = (select auth.uid())
  and exists (
    select 1
    from public.posts p
    join public.community_memberships m on m.community_id = p.community_id
    where p.id = post_comments.post_id
      and m.profile_id = (select auth.uid())
  )
);

-- Ownership of your own comment persists independently of current
-- membership, matching how post authorship (update/delete) already
-- works.
create policy "Authors can update their own comments"
on public.post_comments
for update
to authenticated
using (profile_id = (select auth.uid()))
with check (profile_id = (select auth.uid()));

create policy "Authors can delete their own comments"
on public.post_comments
for delete
to authenticated
using (profile_id = (select auth.uid()));
