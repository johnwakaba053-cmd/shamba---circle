-- Alert System — database foundation only.
--
-- Scope, deliberately: the alert content model, its scope tables, and a
-- single security-definer read path (get_my_alerts). No delivery, no
-- read/unread tracking, no ingestion, no UI. Those are later stages —
-- see the architecture discussion this migration follows.

-- public.alert_subtypes: mirrors crop_types/livestock_types -- a small,
-- rarely-changing lookup table so a new subtype ("other future weather
-- events") is a plain insert, never a schema migration. alert_type is
-- carried here (not just a free-standing id) specifically so it can back
-- a composite foreign key from alerts, guaranteeing a subtype can never
-- be attached to the wrong alert family (e.g. 'rain' on a market_price
-- alert).
create table public.alert_subtypes (
  id text primary key,
  alert_type text not null check (alert_type in ('weather', 'pest_disease', 'market_price')),
  name text not null,
  created_at timestamptz not null default now(),
  constraint alert_subtypes_alert_type_id_key unique (alert_type, id)
);

alter table public.alert_subtypes enable row level security;

create policy "Authenticated users can view alert subtypes"
on public.alert_subtypes
for select
to authenticated
using (true);

-- public.alerts: the canonical platform-generated alert record.
--
-- alert_type must stay in sync with alert_notification_preferences'
-- own check constraint -- it is the join key between alert content and
-- a farmer's opt-in preference.
--
-- "Active" is deliberately never a stored column: it's derived from
-- is_published + starts_at + expires_at at read time (inside
-- get_my_alerts below), so there's nothing to keep in sync via a
-- background job.
--
-- dispatched_at is reserved, unused space for a future delivery stage
-- (batch-level "has this gone out for notification processing", not a
-- per-farmer read/delivery state -- that is a separate future table).
--
-- No RLS policy is granted to `authenticated` on this table at all (see
-- below): get_my_alerts() is the only intended read path for normal
-- users, so the raw table is fully locked to that role rather than
-- openly SELECT-able like education_resources.
create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  alert_type text not null check (alert_type in ('weather', 'pest_disease', 'market_price')),
  subtype_id text not null,
  title text not null check (char_length(title) between 1 and 200),
  message text not null check (char_length(message) >= 1),
  severity text not null check (severity in ('info', 'advisory', 'warning', 'severe')),
  source_name text,
  source_url text,
  external_ref text,
  metadata jsonb,
  is_published boolean not null default false,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  dispatched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint alerts_alert_type_subtype_id_fkey
    foreign key (alert_type, subtype_id) references public.alert_subtypes (alert_type, id)
);

-- external_ref is how a future ingestion job dedupes against a
-- provider's own event id -- unique only when present, since manually
-- curated alerts (like this migration's seed data) have no provider ref
-- at all.
create unique index alerts_external_ref_key on public.alerts (external_ref) where external_ref is not null;

create index alerts_is_published_idx on public.alerts (is_published);
create index alerts_starts_at_idx on public.alerts (starts_at);

alter table public.alerts enable row level security;
-- Intentionally no policies for `authenticated` here: RLS enabled with
-- no matching policy denies every row for that role, for every command.
-- Reads happen exclusively through get_my_alerts() (security definer,
-- runs as the function owner and so is not subject to this table's
-- RLS); writes happen exclusively through migrations or a future
-- trusted backend job using a service-role key.

-- public.alert_counties / alert_crop_types / alert_livestock_types:
-- optional many-to-many scope for an alert, same shape as
-- farmer_crop_preferences / farmer_livestock_preferences. An alert with
-- zero rows in a given scope table is unrestricted on that dimension
-- (a weather alert with no crop/livestock rows applies regardless of
-- what a farmer grows or keeps; an alert with no county rows is
-- globally relevant) -- get_my_alerts() implements this wildcard
-- reading below. Same access model as alerts itself: RLS enabled, no
-- policy for `authenticated`, readable only from inside the security
-- definer function.
create table public.alert_counties (
  alert_id uuid not null references public.alerts (id) on delete cascade,
  county_id text not null references public.counties (id),
  primary key (alert_id, county_id)
);

alter table public.alert_counties enable row level security;

create table public.alert_crop_types (
  alert_id uuid not null references public.alerts (id) on delete cascade,
  crop_type_id text not null references public.crop_types (id),
  primary key (alert_id, crop_type_id)
);

alter table public.alert_crop_types enable row level security;

create table public.alert_livestock_types (
  alert_id uuid not null references public.alerts (id) on delete cascade,
  livestock_type_id text not null references public.livestock_types (id),
  primary key (alert_id, livestock_type_id)
);

alter table public.alert_livestock_types enable row level security;

-- get_my_alerts(): the security boundary for a farmer's personalized
-- alert feed. Identifies the caller via auth.uid() (no parameter, so
-- there is no way to pass another user's id), matches against that
-- farmer's own farmer_preferences / farmer_crop_preferences /
-- farmer_livestock_preferences / alert_notification_preferences rows,
-- and returns a fixed, explicit projection of alerts -- never farmer
-- preference rows, and never a bare `select *`.
--
-- Wildcard scope: an EXISTS check against the relevant alert_* scope
-- table, OR-ed with NOT EXISTS any scope row at all for that alert --
-- "no rows = applies to everyone" on that dimension, matching how the
-- scope tables are documented above.
--
-- security definer so it can read alerts/alert_counties/etc. despite
-- those tables having no authenticated policy, and so it can read the
-- caller's own preference tables even though this function's queries
-- run as the function owner rather than the caller.
create function public.get_my_alerts()
returns table (
  id uuid,
  alert_type text,
  subtype_id text,
  title text,
  message text,
  severity text,
  source_name text,
  source_url text,
  metadata jsonb,
  starts_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    a.id,
    a.alert_type,
    a.subtype_id,
    a.title,
    a.message,
    a.severity,
    a.source_name,
    a.source_url,
    a.metadata,
    a.starts_at,
    a.expires_at,
    a.created_at,
    a.updated_at
  from public.alerts a
  where a.is_published = true
    and now() >= a.starts_at
    and (a.expires_at is null or now() < a.expires_at)
    -- Opted in to this alert type. No preference row for a type means
    -- "off", matching the convention the app's AlertPreferencesControl
    -- already relies on.
    and exists (
      select 1
      from public.alert_notification_preferences anp
      where anp.profile_id = (select auth.uid())
        and anp.alert_type = a.alert_type
        and anp.enabled = true
    )
    -- County: unrestricted if the alert has no county scope at all,
    -- otherwise the farmer's own county (from farmer_preferences) must
    -- appear in it.
    and (
      not exists (
        select 1 from public.alert_counties ac where ac.alert_id = a.id
      )
      or exists (
        select 1
        from public.alert_counties ac
        join public.farmer_preferences fp on fp.county_id = ac.county_id
        where ac.alert_id = a.id
          and fp.profile_id = (select auth.uid())
      )
    )
    -- Crop: unrestricted if the alert has no crop scope at all,
    -- otherwise at least one of the farmer's crop preferences must
    -- appear in it.
    and (
      not exists (
        select 1 from public.alert_crop_types act where act.alert_id = a.id
      )
      or exists (
        select 1
        from public.alert_crop_types act
        join public.farmer_crop_preferences fcp on fcp.crop_type_id = act.crop_type_id
        where act.alert_id = a.id
          and fcp.profile_id = (select auth.uid())
      )
    )
    -- Livestock: same wildcard logic as crop, against livestock scope.
    and (
      not exists (
        select 1 from public.alert_livestock_types alt where alt.alert_id = a.id
      )
      or exists (
        select 1
        from public.alert_livestock_types alt
        join public.farmer_livestock_preferences flp on flp.livestock_type_id = alt.livestock_type_id
        where alt.alert_id = a.id
          and flp.profile_id = (select auth.uid())
      )
    );
$$;

-- Supabase grants anon a direct EXECUTE on new public functions by
-- default, independent of the PUBLIC pseudo-role revoke, so it must be
-- revoked explicitly -- the same gotcha already hit and fixed for every
-- earlier security-definer function in this project.
revoke execute on function public.get_my_alerts() from public;
revoke execute on function public.get_my_alerts() from anon;
grant execute on function public.get_my_alerts() to authenticated;

-- Seed data: alert_subtypes, matching the alert_type vocabulary already
-- live on alert_notification_preferences.
insert into public.alert_subtypes (id, alert_type, name) values
  ('rain', 'weather', 'Rain'),
  ('heavy_rain', 'weather', 'Heavy Rain'),
  ('dry_spell', 'weather', 'Dry Spell'),
  ('extreme_weather', 'weather', 'Extreme Weather'),
  ('crop_disease', 'pest_disease', 'Crop Disease'),
  ('crop_pest', 'pest_disease', 'Crop Pest'),
  ('livestock_disease', 'pest_disease', 'Livestock Disease'),
  ('livestock_pest', 'pest_disease', 'Livestock Pest/Health'),
  ('market_price_change', 'market_price', 'Market Price Change');

-- Seed data: five clearly-artificial test alerts, one per matching case
-- this stage needs to validate. Ids are deliberately obvious
-- placeholders, titles are prefixed [TEST], and every message says
-- outright that it is seed data -- none of this is meant to be mistaken
-- for a real alert. Source is left null (no real provider); metadata is
-- populated only on the market-price example, to prove the jsonb column
-- round-trips real structured data.
insert into public.alerts
  (id, alert_type, subtype_id, title, message, severity, source_name, is_published, starts_at, expires_at, metadata)
values
(
  '00000000-0000-0000-0000-000000000001',
  'weather',
  'rain',
  '[TEST] General Weather Advisory',
  'This is test seed data for validating alert matching logic. Not a real alert. Demonstrates a globally-relevant alert with no county, crop, or livestock scope at all.',
  'info',
  'Shamba Circle Engineering (test data)',
  true,
  now(),
  null,
  null
),
(
  '00000000-0000-0000-0000-000000000002',
  'weather',
  'heavy_rain',
  '[TEST] Heavy Rain Warning — Nakuru',
  'This is test seed data for validating alert matching logic. Not a real alert. Demonstrates a county-scoped weather alert (Nakuru only, no crop/livestock scope).',
  'warning',
  'Shamba Circle Engineering (test data)',
  true,
  now(),
  now() + interval '90 days',
  null
),
(
  '00000000-0000-0000-0000-000000000003',
  'pest_disease',
  'crop_pest',
  '[TEST] Fall Armyworm Risk — Maize',
  'This is test seed data for validating alert matching logic. Not a real alert. Demonstrates a crop-scoped pest alert (maize only, no county restriction).',
  'advisory',
  'Shamba Circle Engineering (test data)',
  true,
  now(),
  now() + interval '90 days',
  null
),
(
  '00000000-0000-0000-0000-000000000004',
  'pest_disease',
  'livestock_disease',
  '[TEST] Newcastle Disease Notice — Poultry',
  'This is test seed data for validating alert matching logic. Not a real alert. Demonstrates a livestock-scoped alert (poultry only, no county restriction).',
  'severe',
  'Shamba Circle Engineering (test data)',
  true,
  now(),
  now() + interval '90 days',
  null
),
(
  '00000000-0000-0000-0000-000000000005',
  'market_price',
  'market_price_change',
  '[TEST] Maize Price Increase — Nakuru Market',
  'This is test seed data for validating alert matching logic. Not a real alert. Demonstrates a combined county + crop scoped market-price alert.',
  'info',
  'Shamba Circle Engineering (test data)',
  true,
  now(),
  now() + interval '90 days',
  '{"crop": "maize", "price": 45, "unit": "KES/kg", "change_percent": 12}'
);

-- Seed data: scope rows. Alert 1 has none (global, on purpose). Alert 5
-- carries both a county and a crop row, to test the AND-across-
-- dimensions case (must match both, not either).
insert into public.alert_counties (alert_id, county_id) values
  ('00000000-0000-0000-0000-000000000002', 'nakuru'),
  ('00000000-0000-0000-0000-000000000005', 'nakuru');

insert into public.alert_crop_types (alert_id, crop_type_id) values
  ('00000000-0000-0000-0000-000000000003', 'maize'),
  ('00000000-0000-0000-0000-000000000005', 'maize');

insert into public.alert_livestock_types (alert_id, livestock_type_id) values
  ('00000000-0000-0000-0000-000000000004', 'poultry');
