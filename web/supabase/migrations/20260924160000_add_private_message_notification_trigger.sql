-- Private Farmer-to-Farmer Messaging, Phase 3 (Migration C) — private-
-- message notifications.
--
-- Scope, deliberately: widen notifications' two CHECK constraints to
-- accept 'private_message'/'conversation', then add exactly one new
-- AFTER INSERT trigger on public.messages that creates one generic
-- notification for the OTHER conversation participant. No other object
-- is touched: notifications' RLS, its four RPCs, conversations/messages'
-- own RLS, and every existing social-activity notification trigger
-- (notify_new_follower, notify_post_comment, notify_post_like,
-- notify_comment_reaction, notify_post_mention) are all left completely
-- unmodified. No UI file is touched here -- the small getNotificationHref()/
-- NotificationCard.tsx additions are a separate, later, separately-
-- reviewed step.

-- === 1. Extend notifications_type_check =====================================
--
-- In-place CHECK replacement, not a DROP+CREATE of the table or any
-- function -- unlike get_public_profile()'s own RETURNS TABLE shape
-- change earlier in this project, a CHECK constraint has no output shape
-- to preserve, so a plain drop+add is sufficient and safe. Every existing
-- row's type value is already a member of the widened set, so this
-- cannot reject any existing data (moot today regardless: notifications
-- currently has zero rows in production).
alter table public.notifications drop constraint notifications_type_check;

alter table public.notifications add constraint notifications_type_check
  check (
    type = any (
      array[
        'alert',
        'new_follower',
        'post_comment',
        'post_reaction',
        'mention',
        'marketplace',
        'education',
        'private_message'
      ]
    )
  );

-- === 2. Extend notifications_entity_type_check ==============================
alter table public.notifications drop constraint notifications_entity_type_check;

alter table public.notifications add constraint notifications_entity_type_check
  check (
    entity_type = any (
      array[
        'alert',
        'profile',
        'post',
        'post_comment',
        'listing',
        'education_resource',
        'conversation'
      ]
    )
  );

-- === 3. notify_private_message() ============================================
--
-- Same shape and security rationale as the five existing social-activity
-- notification triggers (see 20260924130000_add_social_activity_notification_triggers.sql):
-- SECURITY DEFINER is required only to cross notifications' own
-- intentional "no INSERT policy for authenticated" boundary -- never to
-- bypass any profile-privacy rule. The sender's display_name lookup
-- reads only NEW.sender_profile_id's own row, and that row's identity is
-- always the caller's own (messages' INSERT policy already requires
-- sender_profile_id = auth.uid()), so this never reads or exposes
-- another user's private data.
--
-- Recipient is derived exclusively from the conversation row itself --
-- never a client-supplied field (messages has no recipient column to
-- begin with). If the conversation cannot be found, or the sender
-- somehow matches neither stored participant, this returns NEW without
-- inserting anything: a notification-creation failure must never fail
-- the underlying message insert, but it must equally never guess at an
-- incorrect recipient.
create function public.notify_private_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_participant_one uuid;
  v_participant_two uuid;
  v_recipient uuid;
  v_sender_name text;
begin
  select participant_one_id, participant_two_id
  into v_participant_one, v_participant_two
  from public.conversations
  where id = new.conversation_id;

  if v_participant_one is null or v_participant_two is null then
    return new;
  end if;

  if new.sender_profile_id = v_participant_one then
    v_recipient := v_participant_two;
  elsif new.sender_profile_id = v_participant_two then
    v_recipient := v_participant_one;
  else
    -- Sender matches neither stored participant -- should be
    -- structurally impossible given messages' own INSERT RLS, but
    -- handled explicitly rather than assumed: no notification is
    -- created for data this trigger cannot safely interpret.
    return new;
  end if;

  -- Only display_name is ever selected -- never bio, avatar_path,
  -- phone, profile_visibility, or any farmer_preferences/farmer_crop_
  -- preferences/farmer_livestock_preferences/alert_notification_
  -- preferences row, none of which this function references at all.
  select display_name into v_sender_name
  from public.profiles
  where id = new.sender_profile_id;

  -- title contains only the sender's display name and a fixed suffix --
  -- never NEW.body, never a message preview, never any other farmer
  -- data. body/payload carry no message content whatsoever.
  insert into public.notifications (
    recipient_profile_id, actor_profile_id, type, entity_type, entity_id, title, body, payload
  ) values (
    v_recipient,
    new.sender_profile_id,
    'private_message',
    'conversation',
    new.conversation_id,
    coalesce(v_sender_name, 'Another farmer') || ' sent you a message',
    null,
    '{}'::jsonb
  );

  return new;
end;
$$;

-- Never granted to authenticated/anon -- only ever invoked by the
-- trigger mechanism, never callable directly as an RPC. Supabase's
-- default-privilege auto-grant to anon applies to every new function
-- regardless of intended use, so it is revoked explicitly here too, the
-- same gotcha already hit and fixed for every earlier function in this
-- project. This is also, deliberately, the only sanctioned way a
-- notification row can ever be created for a private message: the
-- client still has no INSERT policy on notifications, and none is added
-- here.
revoke all on function public.notify_private_message() from public;
revoke all on function public.notify_private_message() from anon;
revoke all on function public.notify_private_message() from authenticated;

-- AFTER INSERT only -- no DELETE trigger (deleting a message must never
-- notify anyone) and no UPDATE trigger (messages supports no editing).
-- This coexists with update_conversation_last_message_at (also AFTER
-- INSERT on this same table, untouched by this migration): each trigger
-- performs its own independent task, and Postgres fires both, once
-- each, per inserted row -- never a source of duplicate notifications,
-- since each trigger's own body only ever inserts into the one table it
-- owns.
create trigger notify_private_message_after_insert
  after insert on public.messages
  for each row
  execute function public.notify_private_message();
