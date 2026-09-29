-- Alerts: make external_ref dedup work for ingestion upserts.
--
-- 20260916150000_create_alerts_foundation.sql made external_ref unique
-- with a PARTIAL index (where external_ref is not null). Postgres only
-- infers a partial index as an ON CONFLICT target when the statement
-- repeats its predicate, and PostgREST's on_conflict (used by
-- src/lib/weather/ingest.ts via supabase-js .upsert) can't send one, so
-- every weather-alert upsert failed with 42P10 ("there is no unique or
-- exclusion constraint matching the ON CONFLICT specification").
--
-- A plain UNIQUE constraint gives the same guarantee: Postgres treats
-- NULLs as distinct by default, so manually curated alerts with no
-- provider ref can still coexist. Any existing rows already satisfy it
-- (non-null refs were already unique), so this can't fail on data.
-- Same name, so nothing referring to it by name changes. Nothing else
-- changes: no policy, function, trigger or column change.
drop index public.alerts_external_ref_key;

alter table public.alerts
  add constraint alerts_external_ref_key unique (external_ref);
