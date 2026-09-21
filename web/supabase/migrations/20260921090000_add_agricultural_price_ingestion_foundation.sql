-- Market Price Ingestion -- database foundation only (Stage 4 of the
-- Kenyan Agricultural Market Prices feature). No importer, no cron job,
-- no KAMIS download, and no price rows are inserted by this migration
-- -- see the accompanying Stage 3 architecture report for what these
-- four tables exist to support. This migration touches nothing outside
-- the agricultural_* feature: Feed, Marketplace, and Alerts are
-- untouched.
--
-- These four tables are all *ingestion-control* tables, not public
-- content -- unlike agricultural_price_products/markets/sources/prices
-- (open SELECT to authenticated, per the Stage 1 migration), none of
-- the three run/quarantine/conflict tables grant `authenticated` any
-- policy at all. RLS enabled with no matching policy denies every
-- command for that role, exactly like public.alerts' own lockdown --
-- there is no explicit reason yet to expose raw ingestion internals to
-- ordinary app users, so none is granted. The mapping table is the one
-- exception: it's reference/vocabulary data in the same spirit as
-- agricultural_price_products itself, so it follows that table's own
-- open-read model.

-- === agricultural_price_source_product_map ==================================
--
-- Human-curated only. Deliberately NOT populated by this migration --
-- a mapping row here is an explicit, reviewed claim that "this
-- specific KAMIS (commodity, classification) pair really is this
-- specific agricultural_price_products row," which nobody has made yet
-- for any real KAMIS commodity. An unmapped (source, commodity,
-- classification) combination is exactly what should route to
-- quarantine during ingestion, per the Stage 3 design -- this table
-- must start empty for that to mean anything.
create table public.agricultural_price_source_product_map (
  id uuid primary key default gen_random_uuid(),
  source_id text not null references public.agricultural_price_sources (id),
  source_commodity_id text not null check (char_length(source_commodity_id) > 0),
  source_commodity_name text not null check (char_length(source_commodity_name) > 0),
  -- Defaults to '' (not null) rather than being nullable: a source
  -- with no classification concept for a given commodity still needs a
  -- stable, unique key value to map against, and NULL can't serve that
  -- role in a unique constraint the way empty string can.
  source_classification text not null default '',
  product_id text not null references public.agricultural_price_products (id),
  note text,
  created_at timestamptz not null default now(),
  constraint agricultural_price_source_product_map_key
    unique (source_id, source_commodity_id, source_classification)
);

create index agricultural_price_source_product_map_product_id_idx
  on public.agricultural_price_source_product_map (product_id);

alter table public.agricultural_price_source_product_map enable row level security;

-- Read access follows the existing price-data model (open to any
-- authenticated user, same as agricultural_price_products itself) --
-- this is vocabulary/reference data, not sensitive. No INSERT/UPDATE/
-- DELETE policy for `authenticated`: mappings are curated exclusively
-- via migration or a future trusted internal tool, never by ordinary
-- app users.
create policy "Authenticated users can view price source mappings"
on public.agricultural_price_source_product_map
for select
to authenticated
using (true);

-- === agricultural_price_ingestion_runs =======================================
--
-- One row per ingestion execution -- the accountability record the
-- Stage 3 design assumes exists. Never written to by ordinary app
-- users; a future ingestion job writes here using the service-role key
-- (or a security-definer function, if that's how that stage is
-- eventually built) -- neither exists yet, deliberately, since no
-- importer is being built in this stage.
create table public.agricultural_price_ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  source_id text not null references public.agricultural_price_sources (id),
  started_at timestamptz not null,
  completed_at timestamptz,
  status text not null check (status in ('running', 'completed', 'failed', 'partial')),
  endpoint text,
  query_params jsonb,
  rows_downloaded integer not null default 0 check (rows_downloaded >= 0),
  rows_accepted integer not null default 0 check (rows_accepted >= 0),
  rows_duplicate_skipped integer not null default 0 check (rows_duplicate_skipped >= 0),
  rows_conflicted integer not null default 0 check (rows_conflicted >= 0),
  rows_rejected integer not null default 0 check (rows_rejected >= 0),
  rejection_reasons jsonb,
  error_message text,
  file_reference text,
  created_at timestamptz not null default now()
);

create index agricultural_price_ingestion_runs_source_id_idx
  on public.agricultural_price_ingestion_runs (source_id);
create index agricultural_price_ingestion_runs_started_at_idx
  on public.agricultural_price_ingestion_runs (started_at desc);

alter table public.agricultural_price_ingestion_runs enable row level security;
-- No policy granted to `authenticated` at all -- fully locked for
-- every command, same lockdown shape as public.alerts.

-- === agricultural_price_ingestion_quarantine =================================
--
-- One row per source row that could not safely become an
-- agricultural_prices row (unknown county, unmapped product, malformed
-- price, unknown market under the "known county + unknown market ->
-- quarantine" policy, etc.) -- see the Stage 3 report's data-quality
-- rule table for the full set of reasons this stage anticipates but
-- does not enforce (no importer exists yet to produce any of them).
create table public.agricultural_price_ingestion_quarantine (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.agricultural_price_ingestion_runs (id) on delete cascade,
  reason text not null check (char_length(reason) > 0),
  raw_row jsonb not null,
  conflicting_price_id uuid references public.agricultural_prices (id),
  reviewed boolean not null default false,
  reviewed_at timestamptz,
  -- set null (not cascade/restrict): losing the reviewing profile must
  -- never destroy the quarantine record itself -- the row is the audit
  -- trail, the reviewer identity is a lesser detail.
  reviewed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index agricultural_price_ingestion_quarantine_run_id_idx
  on public.agricultural_price_ingestion_quarantine (run_id);
create index agricultural_price_ingestion_quarantine_reviewed_idx
  on public.agricultural_price_ingestion_quarantine (reviewed);

alter table public.agricultural_price_ingestion_quarantine enable row level security;
-- No policy granted to `authenticated` -- same lockdown as the runs
-- table above.

-- === agricultural_price_ingestion_conflicts ==================================
--
-- One row per incoming source observation whose natural key
-- (product, market, source, price_type, recorded_at) matches an
-- already-ingested agricultural_prices row but disagrees on price.
-- This table exists specifically so a conflict is never resolved by
-- silently overwriting agricultural_prices or silently picking a
-- side -- both values are preserved side by side for human review, per
-- the Stage 3 "no last-one-wins without evidence" decision.
--
-- source_id/product_id/market_id/price_type/recorded_at deliberately
-- mirror agricultural_prices' own natural-key column names (rather
-- than being called "source"/"product"/"market" as free text) so a
-- conflict row can be directly cross-referenced against both the
-- existing price row and any future re-ingestion of the same key.
create table public.agricultural_price_ingestion_conflicts (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.agricultural_price_ingestion_runs (id) on delete cascade,
  existing_price_id uuid not null references public.agricultural_prices (id),
  source_id text not null references public.agricultural_price_sources (id),
  product_id text not null references public.agricultural_price_products (id),
  market_id uuid not null references public.agricultural_markets (id),
  price_type text check (price_type in ('wholesale', 'retail')),
  recorded_at timestamptz not null,
  existing_price numeric not null check (existing_price >= 0),
  incoming_price numeric not null check (incoming_price >= 0),
  raw_row jsonb not null,
  reviewed boolean not null default false,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  -- A "conflict" that doesn't actually disagree on price isn't a
  -- conflict -- enforcing this at the database level, not just trusting
  -- application logic to only insert genuine disagreements.
  constraint agricultural_price_ingestion_conflicts_prices_differ_check
    check (existing_price <> incoming_price)
);

create index agricultural_price_ingestion_conflicts_run_id_idx
  on public.agricultural_price_ingestion_conflicts (run_id);
create index agricultural_price_ingestion_conflicts_existing_price_id_idx
  on public.agricultural_price_ingestion_conflicts (existing_price_id);
create index agricultural_price_ingestion_conflicts_reviewed_idx
  on public.agricultural_price_ingestion_conflicts (reviewed);

alter table public.agricultural_price_ingestion_conflicts enable row level security;
-- No policy granted to `authenticated` -- same lockdown as the runs
-- and quarantine tables above.

-- No seed data in this migration at all: no mappings, no runs, no
-- quarantine rows, no conflicts, and -- unchanged from Stage 1 --
-- still zero rows in agricultural_prices. This migration adds
-- structure only.
