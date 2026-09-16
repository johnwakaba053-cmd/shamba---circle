-- SMS Dry-Run Matching — Stage 6A.
--
-- Single-sources the alert eligibility predicate (published/active
-- window + alert-type opt-in + county/crop/livestock wildcard scope)
-- into one function, so get_my_alerts() (per-caller) and the new
-- cross-farmer SMS dry-run matching both evaluate literally the same
-- rule instead of maintaining two copies of it. No SMS sending, no
-- provider credentials, no writes to alert_deliveries -- this is
-- read-only matching logic only.

-- public.alert_matches_farmer: the single source of truth for "is this
-- alert relevant to this farmer" -- exactly the predicate
-- get_my_alerts() has used since Stage 1/3, extracted verbatim (same
-- published/active-window check, same alert_notification_preferences
-- opt-in check, same county/crop/livestock wildcard-or-match logic).
--
-- Takes an explicit p_profile_id (unlike get_my_alerts(), which reads
-- auth.uid() internally) because it needs to answer the question for
-- an arbitrary farmer, not just the caller -- that is also exactly why
-- it must never be reachable by `authenticated`/`anon` directly (see
-- revokes below): a direct RPC to this function would let any signed-in
-- farmer probe any other farmer's match status. It is only ever called
-- from inside other SECURITY DEFINER functions (which run as the
-- function owner regardless of who invoked them) or from the
-- service-role connection.
create function public.alert_matches_farmer(p_alert_id uuid, p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.alerts a
    where a.id = p_alert_id
      and a.is_published = true
      and now() >= a.starts_at
      and (a.expires_at is null or now() < a.expires_at)
      and exists (
        select 1
        from public.alert_notification_preferences anp
        where anp.profile_id = p_profile_id
          and anp.alert_type = a.alert_type
          and anp.enabled = true
      )
      and (
        not exists (
          select 1 from public.alert_counties ac where ac.alert_id = a.id
        )
        or exists (
          select 1
          from public.alert_counties ac
          join public.farmer_preferences fp on fp.county_id = ac.county_id
          where ac.alert_id = a.id
            and fp.profile_id = p_profile_id
        )
      )
      and (
        not exists (
          select 1 from public.alert_crop_types act where act.alert_id = a.id
        )
        or exists (
          select 1
          from public.alert_crop_types act
          join public.farmer_crop_preferences fcp on fcp.crop_type_id = act.crop_type_id
          where act.alert_id = a.id
            and fcp.profile_id = p_profile_id
        )
      )
      and (
        not exists (
          select 1 from public.alert_livestock_types alt where alt.alert_id = a.id
        )
        or exists (
          select 1
          from public.alert_livestock_types alt
          join public.farmer_livestock_preferences flp on flp.livestock_type_id = alt.livestock_type_id
          where alt.alert_id = a.id
            and flp.profile_id = p_profile_id
        )
      )
  );
$$;

revoke execute on function public.alert_matches_farmer(uuid, uuid) from public;
revoke execute on function public.alert_matches_farmer(uuid, uuid) from anon;
revoke execute on function public.alert_matches_farmer(uuid, uuid) from authenticated;
-- Deliberately no grant to authenticated either: this is an internal
-- building block, not a farmer-facing capability.

-- get_my_alerts() dropped and recreated to delegate to
-- alert_matches_farmer(a.id, auth.uid()) instead of inlining the same
-- predicate a second time. Signature, return shape, and behavior for
-- an authenticated farmer calling it with no arguments are unchanged --
-- verified by comparing its output against a fixed set of test alerts
-- before and after this migration (see deployment notes). is_read/
-- read_at projection logic (Stage 3) is untouched.
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
    (ar.profile_id is not null) as is_read,
    ar.read_at
  from public.alerts a
  left join public.alert_reads ar
    on ar.alert_id = a.id
   and ar.profile_id = (select auth.uid())
  where public.alert_matches_farmer(a.id, (select auth.uid()));
$$;

revoke execute on function public.get_my_alerts() from public;
revoke execute on function public.get_my_alerts() from anon;
grant execute on function public.get_my_alerts() to authenticated;

-- public.get_eligible_farmers_for_alert: the cross-farmer counterpart --
-- given one alert, which farmers does it match. Reuses
-- alert_matches_farmer() rather than re-deriving the predicate. Returns
-- phone as stored (not normalized/validated) -- normalization and
-- validity checking happen in server-side TypeScript
-- (lib/sms/phone.ts), not here, so this function has exactly one job.
--
-- No grant to authenticated/anon: this enumerates OTHER farmers by
-- alert, which must never be reachable from a normal farmer session --
-- only from the service-role connection (lib/supabase/admin.ts).
create function public.get_eligible_farmers_for_alert(p_alert_id uuid)
returns table (profile_id uuid, phone text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.phone
  from public.profiles p
  where public.alert_matches_farmer(p_alert_id, p.id);
$$;

revoke execute on function public.get_eligible_farmers_for_alert(uuid) from public;
revoke execute on function public.get_eligible_farmers_for_alert(uuid) from anon;
revoke execute on function public.get_eligible_farmers_for_alert(uuid) from authenticated;
