-- Notifications, Phase 1 — generic in-app notification foundation only.
--
-- Scope, deliberately: one generic table, its RLS, and a read-side RPC
-- surface (list, mark-read, mark-all-read, unread count). No event
-- generation (no trigger on follows/post_comments/comment_reactions, no
-- market-price change detection, no marketplace/education wiring), no
-- UI, no push/email. Those are separate, later phases -- see the
-- accompanying architecture audit.
--
-- The existing weather/pest_disease/market_price alert system (alerts,
-- alert_subtypes, alert_counties/crop_types/livestock_types, alert_reads,
-- alert_deliveries, get_my_alerts(), mark_alert_as_read(),
-- alert_matches_farmer(), get_eligible_farmers_for_alert()) is completely
-- untouched by this migration -- not one of those objects is dropped,
-- altered, or redefined. It keeps working exactly as it does today. A
-- future phase may choose to have a new `alerts`-sourced notification
-- reference this table's rows (via entity_type = 'alert'), but that is
-- explicitly not done here.

-- public.notifications: one generic row per (recipient, event). A single
-- table for every future notification kind -- weather/pest/market-price,
-- new follower, comment, reaction, mention, marketplace, education --
-- rather than one table per kind, so adding a new kind later never
-- requires a new table or a schema migration to the notification model
-- itself, only a new value in the `type` vocabulary below (or a new
-- entry-point that inserts into this same table).
--
-- entity_type/entity_id are a deliberately polymorphic pair (no foreign
-- key on entity_id): a notification may need to reference an alert, a
-- profile, a post, a post_comment, a listing, or an education_resource,
-- and no single FK column can target six different tables. This is the
-- same tradeoff already accepted elsewhere in this schema for flexible,
-- provider-shaped data (alerts.metadata jsonb, alerts.external_ref) --
-- referential integrity for entity_id is enforced by whatever future
-- code creates a notification (it must only ever write an entity_type/
-- entity_id pair that actually exists), not by the database. Row-level
-- security is unaffected by this: it is enforced entirely on
-- recipient_profile_id, never on entity_id.
--
-- actor_profile_id is nullable and ON DELETE SET NULL (not CASCADE):
-- if the acting profile is later deleted, the notification itself still
-- makes sense to keep ("someone you no longer can identify followed
-- you"), so it is not deleted along with its actor -- only the
-- reference is cleared. recipient_profile_id, by contrast, is ON DELETE
-- CASCADE, matching alert_reads/alert_deliveries: a deleted profile's
-- own notifications have no one left to belong to.
--
-- `type` and `entity_type` are text + check, the exact same small-
-- fixed-vocabulary idiom already used throughout this schema (alerts.
-- alert_type, alert_deliveries.channel, post_media.media_type,
-- user_roles.role, ...) -- extending either later is a one-line
-- constraint change, not a type migration, matching
-- alert_deliveries.channel's own documented rationale for the identical
-- choice. Initial `type` vocabulary covers every case named in the
-- Phase 1 brief; none of these types have any event-generation logic
-- wired up to them yet in this migration.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_profile_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (
    type in (
      'alert',
      'new_follower',
      'post_comment',
      'post_reaction',
      'mention',
      'marketplace',
      'education'
    )
  ),
  entity_type text check (
    entity_type in ('alert', 'profile', 'post', 'post_comment', 'listing', 'education_resource')
  ),
  entity_id uuid,
  actor_profile_id uuid references public.profiles (id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  body text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

-- Full, unread-agnostic feed for one recipient, newest first -- the
-- primary query shape get_my_notifications() below needs.
create index notifications_recipient_created_at_idx
  on public.notifications (recipient_profile_id, created_at desc);

-- Partial index covering BOTH the unread count and an "unread only,
-- newest first" list in one structure, rather than the two separate
-- (recipient_profile_id, read_at) and (recipient_profile_id, read_at,
-- created_at desc) indexes a naive reading might suggest -- those would
-- be redundant with each other once created_at is included, and this
-- index also stays smaller over time as it only ever indexes rows that
-- are still unread (a read row drops out of it, not just gets logically
-- skipped).
create index notifications_recipient_unread_created_at_idx
  on public.notifications (recipient_profile_id, created_at desc)
  where read_at is null;

alter table public.notifications enable row level security;

-- Own-row read only -- identical shape to "Users can view their own
-- alert deliveries" / "Users can view their own alert reads". No
-- INSERT, UPDATE, or DELETE policy for `authenticated` at all: RLS
-- enabled with no matching policy denies those operations entirely for
-- that role, exactly like public.alerts itself grants no policy to
-- `authenticated`. Every notification is created by a future trusted
-- SECURITY DEFINER function or service-role job (none exist yet in this
-- phase); the read-state transition is handled exclusively by
-- mark_notification_as_read()/mark_all_notifications_as_read() below,
-- not by a raw UPDATE policy -- an RPC gives a strictly cleaner security
-- boundary here, since Postgres RLS has no native column-level
-- granularity to restrict a client-issued UPDATE to touching only
-- read_at while blocking every other column.
create policy "Users can view their own notifications"
on public.notifications
for select
to authenticated
using (recipient_profile_id = (select auth.uid()));

-- get_my_notifications(): the sole read path for a farmer's own
-- notification feed, mirroring get_my_alerts()'s own shape. Keyset
-- pagination via p_before (compared against created_at), the same
-- cursor convention feed/page.tsx already uses for Reels, rather than
-- OFFSET/LIMIT -- consistent with how this codebase already paginates
-- reverse-chronological feeds. p_limit is clamped server-side to [1, 50]
-- so a caller can never force an unbounded result set by passing an
-- arbitrary limit.
--
-- Deliberately returns actor_profile_id as a bare uuid, never a resolved
-- display_name/avatar_path/roles -- resolving an actor's identity for
-- display must go through get_public_profile() at the application layer
-- (the same "one get_public_profile() call per distinct id" pattern
-- fetchPostMentionsByPostId already uses), so this function can never
-- become a second, competing path into profile identity data and can
-- never be used to bypass can_view_profile_identity()/profile_visibility.
create function public.get_my_notifications(p_limit integer default 20, p_before timestamptz default null)
returns table (
  id uuid,
  type text,
  entity_type text,
  entity_id uuid,
  actor_profile_id uuid,
  title text,
  body text,
  payload jsonb,
  created_at timestamptz,
  read_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    n.id,
    n.type,
    n.entity_type,
    n.entity_id,
    n.actor_profile_id,
    n.title,
    n.body,
    n.payload,
    n.created_at,
    n.read_at
  from public.notifications n
  where n.recipient_profile_id = (select auth.uid())
    and (p_before is null or n.created_at < p_before)
  order by n.created_at desc
  limit least(greatest(p_limit, 1), 50);
$$;

-- Supabase grants anon a direct EXECUTE on new public functions by
-- default, independent of the PUBLIC pseudo-role revoke -- the same
-- gotcha already hit and fixed for every earlier security-definer
-- function in this project, so it is revoked explicitly here too.
revoke all on function public.get_my_notifications(integer, timestamptz) from public;
revoke execute on function public.get_my_notifications(integer, timestamptz) from anon;
grant execute on function public.get_my_notifications(integer, timestamptz) to authenticated;

-- mark_notification_as_read(): ownership is a direct column equality
-- (recipient_profile_id = auth.uid()) rather than derived matching logic
-- like mark_alert_as_read()'s eligibility re-check, so there is nothing
-- to re-derive here -- the UPDATE's own WHERE clause is the entire
-- authorization boundary. Silently matches zero rows (no exception) for
-- a notification that does not exist, does not belong to the caller, or
-- is already read -- idempotent by construction, and deliberately never
-- reveals via an error whether a given id belongs to someone else,
-- which is strictly safer than mark_alert_as_read()'s "raise exception"
-- behavior would be here (that shape is right for alerts, where
-- eligibility is a rich derived predicate worth surfacing a failure
-- for; here it would only leak existence information about another
-- user's row).
create function public.mark_notification_as_read(p_notification_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.notifications
  set read_at = now()
  where id = p_notification_id
    and recipient_profile_id = (select auth.uid())
    and read_at is null;
end;
$$;

revoke all on function public.mark_notification_as_read(uuid) from public;
revoke execute on function public.mark_notification_as_read(uuid) from anon;
grant execute on function public.mark_notification_as_read(uuid) to authenticated;

-- mark_all_notifications_as_read(): same ownership boundary as above,
-- applied to every currently-unread row for the caller in one
-- statement. Safe to implement because it is scoped to
-- recipient_profile_id = auth.uid() exactly like the single-row version
-- -- there is no cross-farmer fan-out risk here, unlike
-- get_eligible_farmers_for_alert().
create function public.mark_all_notifications_as_read()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.notifications
  set read_at = now()
  where recipient_profile_id = (select auth.uid())
    and read_at is null;
end;
$$;

revoke all on function public.mark_all_notifications_as_read() from public;
revoke execute on function public.mark_all_notifications_as_read() from anon;
grant execute on function public.mark_all_notifications_as_read() to authenticated;

-- get_my_notification_unread_count(): the future bell-badge count.
-- count(*) is bigint; cast to integer per the requested return shape --
-- a per-farmer unread count will never approach int overflow.
create function public.get_my_notification_unread_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.notifications
  where recipient_profile_id = (select auth.uid())
    and read_at is null;
$$;

revoke all on function public.get_my_notification_unread_count() from public;
revoke execute on function public.get_my_notification_unread_count() from anon;
grant execute on function public.get_my_notification_unread_count() to authenticated;

-- No seed/test data is inserted by this migration -- unlike the original
-- alerts foundation migration (which seeded obviously-fake [TEST] rows),
-- this table has no farmer-facing UI yet to validate against, and
-- notifications are recipient-specific in a way that would require a
-- real profile id to seed meaningfully. Verifying RLS/RPC behavior for
-- this migration is done by static review of the policies/functions
-- above; live, authenticated verification happens at the same
-- post-apply verification step every other migration in this project
-- has gone through, once this migration is explicitly approved to be
-- applied to production.
