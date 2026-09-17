-- Farming Story deletion. stories already has an own-row DELETE RLS
-- policy ("Creators can delete their own stories"), which is already a
-- sufficient security boundary on its own -- exactly the same shape as
-- posts' own delete policy, which ReelDeleteControl.tsx/
-- PostDeleteControl.tsx call directly with no RPC involved. This
-- function exists anyway, alongside that policy, for two reasons
-- specific to Stories: it gives the frontend an unambiguous true/false
-- "did this actually delete a row" signal (a plain
-- .delete().eq(...).eq(...) call returns no rows by default unless
-- .select() is added), and it matches record_story_view's established
-- RPC style for this feature. It is not a *replacement* security
-- boundary -- the existing RLS policy is untouched and still applies to
-- any direct .from("stories").delete() call too.
--
-- Deliberately has no knowledge of storage at all: database functions
-- shouldn't be handed storage privileges just to make deletion
-- convenient (per the Step 73 brief), so story-media cleanup happens in
-- the authenticated application layer instead, using the existing
-- "Owners can delete their own story media objects" storage policy --
-- see StoryViewer.tsx.
create function public.delete_my_story(p_story_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_id uuid := auth.uid();
  v_deleted_id uuid;
begin
  if v_caller_id is null then
    raise exception 'authentication required';
  end if;

  -- The profile_id = v_caller_id condition is the entire ownership
  -- check: a non-owner's call matches zero rows and simply returns
  -- false, the same outcome as calling this on a story_id that doesn't
  -- exist at all. Cascades to story_hashtags/story_mentions/story_views
  -- automatically via their existing "on delete cascade" foreign keys --
  -- no explicit cleanup of those tables is needed here.
  delete from public.stories
  where id = p_story_id
    and profile_id = v_caller_id
  returning id into v_deleted_id;

  return v_deleted_id is not null;
end;
$$;

revoke execute on function public.delete_my_story(uuid) from public;
revoke execute on function public.delete_my_story(uuid) from anon;
grant execute on function public.delete_my_story(uuid) to authenticated;
