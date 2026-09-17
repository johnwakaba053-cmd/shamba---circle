-- Farming Story view tracking -- database foundation only. No "Seen by"
-- list UI, no view count display, no notifications are part of this
-- migration; this is infrastructure a future viewer-list stage can
-- build on top of.

-- === story_views ============================================================

create table public.story_views (
  story_id uuid not null references public.stories (id) on delete cascade,
  viewer_profile_id uuid not null references public.profiles (id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (story_id, viewer_profile_id)
);

-- Supports a future "my view history" / "recently viewed" style query
-- (viewer_profile_id, viewed_at DESC) -- no other index is added since
-- nothing else in this stage queries this table any other way. The
-- composite PK itself already indexes (story_id, viewer_profile_id).
create index story_views_viewer_profile_id_viewed_at_idx
  on public.story_views (viewer_profile_id, viewed_at desc);

alter table public.story_views enable row level security;

-- Read access is deliberately narrow and does not need a broader
-- authenticated policy: a viewer can see their own view rows, and a
-- Story's own author can see who viewed *their* Stories -- exactly the
-- shape a future "Seen by" list needs, with no UI built on top of it
-- yet. A third party (neither the viewer nor that Story's author) sees
-- nothing. This never exposes viewer identity beyond a UUID -- resolving
-- a display name still requires the existing get_public_profile(),
-- unchanged.
create policy "Viewers and Story authors can see relevant story views"
on public.story_views
for select
to authenticated
using (
  viewer_profile_id = (select auth.uid())
  or exists (
    select 1
    from public.stories s
    where s.id = story_views.story_id
      and s.profile_id = (select auth.uid())
  )
);

-- No direct INSERT/UPDATE/DELETE policy exists on this table at all --
-- writes only ever happen through record_story_view() below, which is
-- the entire security boundary for creating a view row. This is
-- narrower and easier to reason about than a table-level WITH CHECK:
-- there is exactly one path that can ever write here, and it cannot be
-- bypassed by calling .from("story_views").insert(...) directly (RLS
-- has no INSERT policy, so that path is a hard "nobody can" for every
-- authenticated user, service role excepted).

-- === record_story_view ======================================================
--
-- Records that the calling user viewed a Story -- viewer_profile_id is
-- never taken from the caller, only from auth.uid(), so it cannot be
-- spoofed. Idempotent (ON CONFLICT DO NOTHING): calling this
-- repeatedly for the same Story is always harmless, which is what lets
-- the Story viewer call it plainly on every "this Story is now being
-- shown" transition without needing to track "have I already recorded
-- this" client-side. Returns false (rather than raising) for a Story
-- that doesn't exist or has expired, so an expired Story can never
-- receive a new view row, and the caller can distinguish "recorded" from
-- "not recorded" without needing to catch an exception for the normal
-- expiry case.
create function public.record_story_view(p_story_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_viewer_id uuid := auth.uid();
begin
  if v_viewer_id is null then
    raise exception 'authentication required';
  end if;

  if not exists (
    select 1
    from public.stories
    where id = p_story_id
      and expires_at > now()
  ) then
    return false;
  end if;

  insert into public.story_views (story_id, viewer_profile_id)
  values (p_story_id, v_viewer_id)
  on conflict (story_id, viewer_profile_id) do nothing;

  return true;
end;
$$;

revoke execute on function public.record_story_view(uuid) from public;
revoke execute on function public.record_story_view(uuid) from anon;
grant execute on function public.record_story_view(uuid) to authenticated;
