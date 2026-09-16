-- SMS Alert Delivery — Stage 6 database foundation only.
--
-- Records that a specific alert was (attempted to be) delivered to a
-- specific farmer over a specific channel. This stage adds the table
-- and its RLS only -- no provider credentials, no sending code, no
-- "who should receive this alert" matching logic. That logic is a
-- separate, later stage; this table is simply where its results will
-- be recorded once it exists.

-- public.alert_deliveries: one row per (farmer, alert, channel)
-- delivery attempt. Composite primary key (not a surrogate id), for
-- the same reason as every other selection-set table in this schema
-- (user_roles, farmer_crop_preferences, alert_reads, alert_counties):
-- the triple itself IS the identity, and its own uniqueness is what
-- structurally prevents sending the same alert to the same farmer
-- twice over the same channel -- a second delivery attempt is a
-- primary-key conflict, to be handled by future sending code via
-- upsert (the same idiom alerts.external_ref dedup already uses), not
-- by an application-level existence check.
--
-- channel is text + check (not an enum), matching every other small
-- fixed vocabulary in this schema (alert_type, severity,
-- reaction_type, ...) -- so adding "push" or "email" later is a
-- one-line constraint change, not a type migration. Only 'sms' is
-- allowed today, since SMS is the only channel this stage designs for.
create table public.alert_deliveries (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  alert_id uuid not null references public.alerts (id) on delete cascade,
  channel text not null check (channel in ('sms')),
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  provider_message_id text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (profile_id, alert_id, channel)
);

-- Lets a future dispatch job efficiently ask "who has/hasn't received
-- this alert yet" (an anti-join keyed on alert_id) without a full-table
-- scan -- the composite primary key alone can't serve that query
-- efficiently since alert_id isn't its leading column.
create index alert_deliveries_alert_id_idx on public.alert_deliveries (alert_id);

alter table public.alert_deliveries enable row level security;

-- Read-only from the authenticated role's perspective, by design: a
-- farmer may see their own delivery history (e.g. a future "delivery
-- status" UI), but every write comes from a trusted server-side job
-- using the service-role client (lib/supabase/admin.ts, Stage 4) --
-- exactly the same split already used for public.alerts itself. No
-- INSERT/UPDATE/DELETE policy exists for `authenticated` at all: RLS
-- enabled with no matching policy denies those operations entirely for
-- that role, rather than needing an explicit deny policy.
create policy "Users can view their own alert deliveries"
on public.alert_deliveries
for select
to authenticated
using (profile_id = (select auth.uid()));
