-- Kenyan Agricultural Market Prices -- database foundation only (Stage
-- 1). No UI, no external provider integration, no ingestion job, and
-- deliberately no price rows at all -- see the accompanying design
-- report for what's out of scope here. This migration adds nothing
-- that touches Marketplace listings, Feed, Communities, Stories,
-- Education, or the existing alert system.
--
-- Naming: the shared `agricultural_` prefix keeps this feature's four
-- tables grouped together and unambiguous against Marketplace's
-- `listings`/`listing_media` -- "market" here means a physical
-- agricultural trading market (e.g. a produce market in a given
-- county), never Shamba Circle's own Marketplace feature.
--
-- Core data principle enforced throughout: a price is never presented
-- as "current" without a recorded date/time and a source. There is no
-- "is_current" flag anywhere in this schema -- freshness is always
-- derived from recorded_at at read time, and every price row requires
-- both recorded_at and source_id.

-- === agricultural_price_products ============================================
--
-- id is a text slug, matching the existing crop_types/livestock_types
-- convention. crop_type_id/livestock_type_id are optional forward
-- links back into the *existing* preference-matching tables -- not
-- required for this stage, but present so a future price-alert stage
-- can reuse farmer_crop_preferences/farmer_livestock_preferences
-- instead of inventing a second, parallel taxonomy. A price product can
-- be more granular than the broad crop_types/livestock_types lists
-- (e.g. a specific grade or variety), which is exactly why this is a
-- separate catalog rather than reusing those tables directly.
create table public.agricultural_price_products (
  id text primary key,
  name text not null check (char_length(name) between 1 and 200),
  category text not null check (category in ('crop', 'livestock', 'livestock_product')),
  -- Free text, not an enum: Kenyan market pricing units genuinely vary
  -- (90kg bags, crates, per litre, per head, per kg) and a fixed
  -- vocabulary would be more restrictive than useful here.
  unit text not null check (char_length(unit) between 1 and 50),
  crop_type_id text references public.crop_types (id),
  livestock_type_id text references public.livestock_types (id),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.agricultural_price_products enable row level security;

create policy "Authenticated users can view price products"
on public.agricultural_price_products
for select
to authenticated
using (true);

-- === agricultural_markets ====================================================
--
-- Unlike the small, hand-curated lookup tables above, a market catalog
-- could grow large and eventually be provider-fed -- a generated uuid
-- fits better here than a hand-picked slug, which is why this table
-- (alone among the four) doesn't follow the text-slug convention.
create table public.agricultural_markets (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  county_id text not null references public.counties (id),
  -- Free-text sub-location/town detail -- not full geocoding, which
  -- isn't needed for this stage.
  location_details text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint agricultural_markets_name_county_key unique (name, county_id)
);

create index agricultural_markets_county_id_idx on public.agricultural_markets (county_id);

alter table public.agricultural_markets enable row level security;

create policy "Authenticated users can view markets"
on public.agricultural_markets
for select
to authenticated
using (true);

-- === agricultural_price_sources ==============================================
--
-- A small, curated lookup table, same shape as alert_subtypes -- who or
-- what a price record is attributed to. Required (not optional) on
-- every agricultural_prices row: see the data principle above.
create table public.agricultural_price_sources (
  id text primary key,
  name text not null check (char_length(name) between 1 and 200),
  source_type text not null check (
    source_type in ('government', 'market_survey', 'cooperative', 'private_provider', 'manual', 'other')
  ),
  website_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.agricultural_price_sources enable row level security;

create policy "Authenticated users can view price sources"
on public.agricultural_price_sources
for select
to authenticated
using (true);

-- === agricultural_prices =====================================================
--
-- The fact table. recorded_at has NO default value -- this is
-- deliberate, not an oversight: a default of now() would silently
-- record "when this row was inserted" rather than "when the price was
-- actually observed," which is exactly wrong for backfilled/historical
-- ingestion. Every insert must state explicitly when the price was
-- real. Combined with source_id being NOT NULL, this is the concrete
-- enforcement of "never presented as current without a recorded
-- date/time and source."
--
-- No on-delete cascade from product/market/source -- deleting a
-- reference row must never silently wipe price history (matching how
-- alerts_alert_type_subtype_id_fkey doesn't cascade either).
create table public.agricultural_prices (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.agricultural_price_products (id),
  market_id uuid not null references public.agricultural_markets (id),
  source_id text not null references public.agricultural_price_sources (id),
  price numeric not null check (price >= 0),
  min_price numeric check (min_price >= 0),
  max_price numeric check (max_price >= 0),
  -- Nullable and undefaulted -- the wholesale/retail distinction itself
  -- is optional, not just its value. Caveat (documented, not solved
  -- here): SQL treats NULL as distinct from NULL for uniqueness
  -- purposes, so two untyped price rows for the same
  -- product/market/source/instant would not be caught as duplicates by
  -- the constraint below. Accepted as a minor limitation rather than
  -- adding a sentinel value to work around it.
  price_type text check (price_type in ('wholesale', 'retail')),
  recorded_at timestamptz not null,
  created_at timestamptz not null default now(),
  metadata jsonb,
  constraint agricultural_prices_min_max_check check (
    min_price is null or max_price is null or min_price <= max_price
  ),
  -- Dedup rule: the same source can't report two conflicting prices for
  -- the same product/market/price-type at the same recorded instant --
  -- but the same source CAN add a new row at a later recorded_at (this
  -- is how price history accumulates), and different sources each get
  -- their own independent rows for the same product/market/time.
  constraint agricultural_prices_dedup_key
    unique (product_id, market_id, source_id, price_type, recorded_at)
);

-- The core "latest price for product X at market Y" access pattern --
-- covers a plain product_id-only query too, as its leading column.
create index agricultural_prices_product_market_recorded_idx
  on public.agricultural_prices (product_id, market_id, recorded_at desc);
create index agricultural_prices_market_id_idx on public.agricultural_prices (market_id);
create index agricultural_prices_recorded_at_idx on public.agricultural_prices (recorded_at);

alter table public.agricultural_prices enable row level security;

create policy "Authenticated users can view prices"
on public.agricultural_prices
for select
to authenticated
using (true);

-- No INSERT/UPDATE/DELETE policy for `authenticated` on any of the four
-- tables above -- RLS enabled with no matching policy denies those
-- commands entirely for that role, for every row. Writes only ever
-- happen via a migration or a future trusted backend ingestion job
-- using the service-role key, exactly matching public.alerts' own
-- write-lockdown convention. Ordinary users can read; nobody but a
-- migration or a future trusted job can write.

-- === Seed data ===============================================================
--
-- Reference-only, deliberately minimal. A handful of real (not
-- invented) common Kenyan commodity names with no price attached to
-- any of them, plus one explicitly-labeled placeholder source so the
-- foreign key can be exercised. No agricultural_markets rows are
-- seeded at all -- specific market names/locations are exactly the
-- kind of provider-verified data that belongs to the future ingestion
-- stage, not fabricated here. Zero rows are inserted into
-- agricultural_prices: no price, current or otherwise, is invented by
-- this migration.
insert into public.agricultural_price_products (id, name, category, unit, crop_type_id) values
  ('maize-dry', 'Maize (dry)', 'crop', '90kg bag', 'maize'),
  ('beans-dry', 'Beans (dry)', 'crop', '90kg bag', 'beans');

insert into public.agricultural_price_products (id, name, category, unit, livestock_type_id) values
  ('milk-cow', 'Milk (cow)', 'livestock_product', 'litre', 'dairy-cattle');

insert into public.agricultural_price_sources (id, name, source_type, website_url) values
  ('manual', 'Manual Entry (placeholder)', 'manual', null);
