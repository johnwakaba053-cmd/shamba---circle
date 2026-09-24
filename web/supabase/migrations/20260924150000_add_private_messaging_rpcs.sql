-- Private Farmer-to-Farmer Messaging, Phase 2 — secure conversation RPCs.
--
-- Scope, deliberately: three SECURITY DEFINER functions that give
-- controlled write/read access to the conversations/messages foundation
-- from Phase 1, without ever adding a client-facing INSERT/UPDATE policy
-- to public.conversations (Phase 1 deliberately left it with none at
-- all). No notification integration, no UI, no schema change to
-- conversations/messages themselves -- those are separate, later,
-- separately-reviewed phases.
--
-- All three follow this project's mandatory pattern for every
-- SECURITY DEFINER function: `set search_path = ''` plus fully
-- schema-qualified references (public.conversations, public.messages,
-- public.profiles), and the explicit
-- `revoke all from public; revoke execute from anon; grant execute to
-- authenticated;` sequence -- `revoke ... from public` alone does not
-- remove Supabase's default direct grant to `anon` on a brand-new
-- function, a gotcha this project's own history has hit and fixed
-- (see 20260915123143_revoke_community_member_count_anon.sql) and that
-- every function created since has carried forward.

-- === RPC 1: get_or_create_conversation ======================================
--
-- The sole, controlled path to creating a conversation row -- Phase 1's
-- migration deliberately left `conversations` with no INSERT policy for
-- `authenticated` at all, specifically reserving conversation creation
-- for this function. The caller is exclusively auth.uid(); the only
-- argument is the OTHER party's id, so a farmer can never name two
-- arbitrary participants and can never create a conversation on behalf
-- of someone else. Concurrency safety comes entirely from Phase 1's own
-- `conversations_participant_pair_key` unique index, used here via a
-- single atomic `INSERT ... ON CONFLICT ... DO UPDATE ... RETURNING`
-- statement (the DO UPDATE is a harmless no-op -- it sets
-- participant_one_id to the value it already has -- included only so
-- RETURNING always yields a row, whether this call just inserted the
-- conversation or another concurrent call already had): two farmers
-- clicking "Message" on each other at the same instant can never end up
-- with two rows, and neither caller has to run a separate
-- check-then-insert that the other could race.
--
-- Per the approved V1 decision, this function does not consult
-- profile_visibility at all -- any authenticated farmer may start a
-- conversation with any other. It does, however, reject a
-- non-existent p_other_profile_id (never silently creating a
-- conversation with a profile that isn't real), a null argument, an
-- unauthenticated caller, and a self-conversation attempt.
create function public.get_or_create_conversation(p_other_profile_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
  v_one uuid;
  v_two uuid;
  v_conversation_id uuid;
begin
  if v_caller is null then
    raise exception 'You must be signed in to start a conversation.';
  end if;

  if p_other_profile_id is null then
    raise exception 'A farmer to message must be specified.';
  end if;

  if p_other_profile_id = v_caller then
    raise exception 'You cannot start a conversation with yourself.';
  end if;

  if not exists (select 1 from public.profiles where id = p_other_profile_id) then
    raise exception 'That farmer could not be found.';
  end if;

  v_one := least(v_caller, p_other_profile_id);
  v_two := greatest(v_caller, p_other_profile_id);

  insert into public.conversations (participant_one_id, participant_two_id)
  values (v_one, v_two)
  on conflict (participant_one_id, participant_two_id)
  do update set participant_one_id = excluded.participant_one_id
  returning id into v_conversation_id;

  return v_conversation_id;
end;
$$;

revoke all on function public.get_or_create_conversation(uuid) from public;
revoke execute on function public.get_or_create_conversation(uuid) from anon;
grant execute on function public.get_or_create_conversation(uuid) to authenticated;

-- === RPC 2: mark_conversation_as_read =======================================
--
-- The sole, controlled path to advancing a participant's own read
-- state -- Phase 1 deliberately left `conversations` with no UPDATE
-- policy for `authenticated` at all, specifically because RLS has no
-- column-level granularity: a broad "any participant may update" policy
-- would let either party silently rewrite the OTHER party's read
-- timestamp too. This function only ever writes ONE of the two
-- last_read_at columns, chosen by which participant column actually
-- equals the caller -- never both, and never based on a value the
-- caller supplies. Both UPDATE statements' WHERE clauses require BOTH
-- `id = p_conversation_id` AND the specific participant column matching
-- the caller, so a caller who is not actually a participant of that
-- conversation id updates zero rows in either branch and the function
-- returns false -- it never touches last_message_at, messages, or
-- notifications.
create function public.mark_conversation_as_read(p_conversation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
  v_updated boolean := false;
begin
  if v_caller is null then
    raise exception 'You must be signed in to do that.';
  end if;

  update public.conversations
  set participant_one_last_read_at = now()
  where id = p_conversation_id
    and participant_one_id = v_caller;

  if found then
    v_updated := true;
  else
    update public.conversations
    set participant_two_last_read_at = now()
    where id = p_conversation_id
      and participant_two_id = v_caller;

    if found then
      v_updated := true;
    end if;
  end if;

  return v_updated;
end;
$$;

revoke all on function public.mark_conversation_as_read(uuid) from public;
revoke execute on function public.mark_conversation_as_read(uuid) from anon;
grant execute on function public.mark_conversation_as_read(uuid) to authenticated;

-- === RPC 3: get_my_conversations =============================================
--
-- The future inbox's only data source. Every row is filtered by
-- `auth.uid()` participation in the CTE below BEFORE anything about the
-- other participant's profile or message-derived unread count is ever
-- computed -- there is no path through this function that can surface a
-- conversation the caller is not part of.
--
-- other_profile_id/other_display_name/other_avatar_path deliberately
-- bypass can_view_profile_identity()/profile_visibility: the caller is
-- already an established participant in a real conversation with this
-- exact profile (verified by the same WHERE clause that scopes the CTE
-- to the caller's own conversations), which is a materially different
-- situation from browsing an arbitrary profile -- "they are already
-- messaging you directly" is the boundary here, matching the approved
-- decision that messaging (and, by extension, seeing who you are
-- messaging) does not depend on the recipient's profile visibility.
-- Only display_name/avatar_path are selected -- never phone, bio,
-- profile_visibility, or any farmer_preferences/farmer_crop_preferences/
-- farmer_livestock_preferences/alert_notification_preferences row, none
-- of which this function references at all.
--
-- unread_count only ever counts messages sent by the OTHER participant
-- (m.sender_profile_id = mc.other_profile_id) with created_at after the
-- caller's own last_read_at (or all of them, if the caller has never
-- read this conversation) -- a message the caller sent themselves can
-- never be counted, structurally, regardless of read state.
create function public.get_my_conversations(p_limit integer default 50)
returns table (
  conversation_id uuid,
  other_profile_id uuid,
  other_display_name text,
  other_avatar_path text,
  last_message_at timestamptz,
  my_last_read_at timestamptz,
  unread_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with my_conversations as (
    select
      c.id as conversation_id,
      c.created_at,
      c.last_message_at,
      case
        when c.participant_one_id = (select auth.uid()) then c.participant_two_id
        else c.participant_one_id
      end as other_profile_id,
      case
        when c.participant_one_id = (select auth.uid()) then c.participant_one_last_read_at
        else c.participant_two_last_read_at
      end as my_last_read_at
    from public.conversations c
    where c.participant_one_id = (select auth.uid())
       or c.participant_two_id = (select auth.uid())
  )
  select
    mc.conversation_id,
    mc.other_profile_id,
    p.display_name as other_display_name,
    p.avatar_path as other_avatar_path,
    mc.last_message_at,
    mc.my_last_read_at,
    (
      select count(*)
      from public.messages m
      where m.conversation_id = mc.conversation_id
        and m.sender_profile_id = mc.other_profile_id
        and (mc.my_last_read_at is null or m.created_at > mc.my_last_read_at)
    ) as unread_count
  from my_conversations mc
  join public.profiles p on p.id = mc.other_profile_id
  order by mc.last_message_at desc nulls last, mc.created_at desc
  limit least(greatest(p_limit, 1), 100);
$$;

revoke all on function public.get_my_conversations(integer) from public;
revoke execute on function public.get_my_conversations(integer) from anon;
grant execute on function public.get_my_conversations(integer) to authenticated;
