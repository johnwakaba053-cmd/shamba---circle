-- Private Farmer-to-Farmer Messaging, Phase 1 — database foundation only.
--
-- Scope, deliberately, per the approved audit: public.conversations +
-- public.messages, their RLS, their indexes, and a last_message_at
-- maintenance trigger. No conversation-creation RPC, no read/unread RPC,
-- no notification integration, no UI. Those are separate, later,
-- separately-reviewed migrations/phases.
--
-- Strictly 1-to-1 in V1 (no group conversations), no message editing, no
-- "delete conversation" feature, no attachments/reactions/replies/
-- forwarding, and no blocking/reporting yet -- this migration does not
-- foreclose blocking later (a future blocks table + a check inside a
-- future get_or_create_conversation() RPC composes cleanly on top of
-- this shape without altering it).
--
-- Completely independent of every existing content system: does not
-- reuse posts/post_comments, is not visible in Communities or Feed, and
-- is not reachable through any existing table's RLS. A private message
-- is only ever a row in the two tables created here.

-- === public.conversations ====================================================
--
-- One row per unique unordered pair of farmers -- two participant
-- columns directly on the table (not a separate junction table), so
-- "exactly one conversation per pair" is a single UNIQUE index rather
-- than something application code has to check-then-insert (which two
-- simultaneous requests could both pass). participant_one_id <
-- participant_two_id is what makes the pair's ordering canonical: (A, B)
-- and (B, A) always normalize to the same stored row.
--
-- Both the "not equal" and "ordered" constraints are declared explicitly
-- even though the second implies the first -- belt and suspenders,
-- matching this schema's own existing style (see follows_no_self_follow
-- plus its INSERT policy's own duplicated self-follow check).
--
-- participant_one_last_read_at/participant_two_last_read_at hold each
-- participant's own read-state directly on the shared row (no separate
-- per-participant table) since this is exactly two parties, always --
-- read/write access to these two columns is deliberately not opened to
-- authenticated clients in this migration (see the RLS section below);
-- a future SECURITY DEFINER RPC is the only sanctioned way to advance
-- either one.
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  participant_one_id uuid not null references public.profiles (id) on delete cascade,
  participant_two_id uuid not null references public.profiles (id) on delete cascade,
  participant_one_last_read_at timestamptz,
  participant_two_last_read_at timestamptz,
  created_at timestamptz not null default now(),
  last_message_at timestamptz,
  constraint conversations_distinct_participants check (participant_one_id <> participant_two_id),
  constraint conversations_ordered_participants check (participant_one_id < participant_two_id)
);

-- The structural guarantee itself: two farmers can never end up with
-- more than one conversation row between them, under any concurrent
-- insert pattern, because this is a single index the database itself
-- enforces -- never something relying on application code noticing a
-- duplicate after the fact.
create unique index conversations_participant_pair_key
  on public.conversations (participant_one_id, participant_two_id);

-- Inbox lookup: "my conversations, newest activity first" -- two
-- indexes, one per column a caller's own id might appear in, since a
-- participant can be stored in either position.
create index conversations_participant_one_last_message_at_idx
  on public.conversations (participant_one_id, last_message_at desc);

create index conversations_participant_two_last_message_at_idx
  on public.conversations (participant_two_id, last_message_at desc);

alter table public.conversations enable row level security;

-- Own-conversation read only. This is the entire IDOR/unauthorized-read
-- boundary for conversations: guessing another conversation's id reveals
-- nothing, because no policy ever matches a non-participant.
create policy "Participants can view their own conversations"
on public.conversations
for select
to authenticated
using (
  (select auth.uid()) = participant_one_id
  or (select auth.uid()) = participant_two_id
);

-- Deliberately no INSERT policy for `authenticated`: a direct client
-- insert would let a farmer name an arbitrary second participant with no
-- consent check (impersonation/participant-injection risk) and would
-- have nothing stopping a duplicate-pair race from a naive
-- check-then-insert client. Conversation creation is Phase 2's job, via
-- a SECURITY DEFINER RPC that derives both participants from auth.uid()
-- plus exactly one caller-supplied "other party" argument -- never two
-- client-supplied ids.
--
-- Deliberately no UPDATE policy for `authenticated`: both
-- last_message_at (this migration's own trigger, below) and the two
-- last_read_at columns (a future RPC) must be written by trusted,
-- narrowly-scoped SECURITY DEFINER code -- RLS has no native
-- column-level granularity, so a broad "any participant may update"
-- policy would let either party silently rewrite the OTHER party's
-- own read-state column.
--
-- Deliberately no DELETE policy for `authenticated`: "delete
-- conversation" is explicitly out of scope for V1, per the approved
-- decisions -- RLS enabled with no matching policy denies the operation
-- entirely for that role, the same "no policy = fully locked" idiom
-- already used by public.alerts.

-- === public.messages ==========================================================
--
-- One row per sent message. No edited_at/deleted_at/attachments/
-- reactions/replies -- all explicitly out of scope for V1. body's
-- length constraint mirrors posts.body/post_comments.body exactly
-- (1-2000 characters), the same convention, not an invented new limit.
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_profile_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

-- Primary read path is "messages in this conversation, newest (or
-- oldest, depending on the future UI) first" -- same index shape as
-- post_comments_post_id_created_at_idx.
create index messages_conversation_id_created_at_idx
  on public.messages (conversation_id, created_at desc);

alter table public.messages enable row level security;

-- Read is participant-gated via a direct EXISTS check against
-- conversations, not a security definer function -- the caller's own
-- conversation row is already readable to them under the SELECT policy
-- above, so no RLS bypass is needed to evaluate this, mirroring exactly
-- how post_media/post_likes/post_comments already check membership
-- through their own parent posts row.
create policy "Participants can view messages in their conversations"
on public.messages
for select
to authenticated
using (
  exists (
    select 1
    from public.conversations c
    where c.id = messages.conversation_id
      and (
        (select auth.uid()) = c.participant_one_id
        or (select auth.uid()) = c.participant_two_id
      )
  )
);

-- Insert requires BOTH that the caller is only ever claiming to be
-- themselves (sender_profile_id = auth.uid() -- the client is never
-- trusted to identify the sender) AND that they are actually a
-- participant of the target conversation -- satisfied together, this
-- is what makes impersonation and "posting into a conversation you're
-- not part of" both structurally impossible, not just discouraged by
-- the UI.
create policy "Participants can send messages as themselves"
on public.messages
for insert
to authenticated
with check (
  sender_profile_id = (select auth.uid())
  and exists (
    select 1
    from public.conversations c
    where c.id = messages.conversation_id
      and (
        (select auth.uid()) = c.participant_one_id
        or (select auth.uid()) = c.participant_two_id
      )
  )
);

-- No UPDATE policy: V1 has no message editing at all, per the approved
-- decisions -- RLS enabled with no matching policy denies the operation
-- entirely for `authenticated`.

-- Delete is strictly own-row -- a participant may remove their own sent
-- message, never the other participant's, mirroring the exact
-- "Authors can delete their own posts/comments" ownership pattern
-- already used everywhere else in this schema.
create policy "Senders can delete their own messages"
on public.messages
for delete
to authenticated
using (sender_profile_id = (select auth.uid()));

-- === last_message_at maintenance ============================================
--
-- SECURITY DEFINER is required here for the same reason it was required
-- for the Phase 2B social-activity notification triggers: conversations
-- intentionally grants `authenticated` no UPDATE policy at all (see
-- above), so a plain trigger function running as the inserting farmer
-- would be blocked by that same RLS. This function does exactly one
-- thing -- stamp last_message_at -- and touches no other column, no
-- notifications table, and sends nothing; notification integration is
-- explicitly a separate, later migration.
create function public.update_conversation_last_message_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations
  set last_message_at = new.created_at
  where id = new.conversation_id;

  return new;
end;
$$;

-- Never granted to authenticated/anon -- only ever invoked by the
-- trigger mechanism, never callable directly as an RPC. Supabase's
-- default-privilege auto-grant to anon applies to every new function
-- regardless of intended use, so it is revoked explicitly here too, the
-- same gotcha already hit and fixed for every earlier function in this
-- project.
revoke all on function public.update_conversation_last_message_at() from public;
revoke execute on function public.update_conversation_last_message_at() from anon;
revoke execute on function public.update_conversation_last_message_at() from authenticated;

create trigger update_conversation_last_message_at
  after insert on public.messages
  for each row
  execute function public.update_conversation_last_message_at();
