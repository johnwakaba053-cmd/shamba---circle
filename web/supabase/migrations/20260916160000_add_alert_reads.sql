-- Alert read/unread state — Stage 3.
--
-- Adds a private per-farmer "have I opened this alert" record, and
-- extends get_my_alerts() to report it. Alert eligibility itself
-- (Stage 1's matching logic, unchanged below) stays completely separate
-- from read state: reading an alert never removes it from a farmer's
-- personalized feed.

-- public.alert_reads: one row per (farmer, alert) they have opened.
-- Same shape as the Stage 1 selection-set tables (farmer_crop_preferences
-- etc.) -- composite primary key, no UPDATE policy, since read_at is set
-- once on first read and never changes after (mark_alert_as_read below
-- is idempotent via ON CONFLICT DO NOTHING, not by updating an existing
-- row) -- so there is nothing an UPDATE policy would ever be used for.
-- No DELETE policy either: there is no "mark unread" feature in this
-- stage.
create table public.alert_reads (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  alert_id uuid not null references public.alerts (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (profile_id, alert_id)
);

alter table public.alert_reads enable row level security;

create policy "Users can view their own alert reads"
on public.alert_reads
for select
to authenticated
using (profile_id = (select auth.uid()));

create policy "Users can add their own alert reads"
on public.alert_reads
for insert
to authenticated
with check (profile_id = (select auth.uid()));

-- get_my_alerts() must be dropped and recreated (not CREATE OR REPLACE):
-- its RETURNS TABLE shape is changing, and Postgres does not allow
-- changing a function's output columns in place.
drop function if exists public.get_my_alerts();

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
  updated_at timestamptz,
  is_read boolean,
  read_at timestamptz
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
    a.updated_at,
    -- The join condition itself is scoped to the caller's own id (not a
    -- later filter on the result), so no other farmer's alert_reads row
    -- can ever be the one that lands in this projection.
    (ar.profile_id is not null) as is_read,
    ar.read_at
  from public.alerts a
  left join public.alert_reads ar
    on ar.alert_id = a.id
   and ar.profile_id = (select auth.uid())
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
-- earlier security-definer function in this project. Dropping and
-- recreating the function also drops its prior grants, so these must be
-- reissued here.
revoke execute on function public.get_my_alerts() from public;
revoke execute on function public.get_my_alerts() from anon;
grant execute on function public.get_my_alerts() to authenticated;

-- mark_alert_as_read(): the write-side counterpart to get_my_alerts().
-- Re-uses get_my_alerts() itself as the eligibility check, rather than
-- duplicating its matching WHERE clause a second time, so the two can
-- never drift out of sync -- an alert is markable-as-read if and only if
-- it would actually appear in the caller's own personalized feed.
-- plpgsql (not sql) because rejecting an ineligible alert needs a
-- conditional/exception, not just a query. Idempotent via
-- ON CONFLICT DO NOTHING: calling it again on an already-read alert
-- succeeds without creating a duplicate row or changing read_at.
create function public.mark_alert_as_read(p_alert_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.get_my_alerts() ga where ga.id = p_alert_id
  ) then
    raise exception 'Alert not found or not available to this farmer';
  end if;

  insert into public.alert_reads (profile_id, alert_id)
  values ((select auth.uid()), p_alert_id)
  on conflict (profile_id, alert_id) do nothing;
end;
$$;

revoke execute on function public.mark_alert_as_read(uuid) from public;
revoke execute on function public.mark_alert_as_read(uuid) from anon;
grant execute on function public.mark_alert_as_read(uuid) to authenticated;
