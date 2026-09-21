-- Adds the real KAMIS source row, separate from and alongside the
-- Stage 1 'manual' placeholder -- that row is not renamed, repurposed,
-- or touched in any way. 'kamis' identifies the actual Ministry of
-- Agriculture market price system investigated in Stage 2A/2B, so it
-- gets its own row with an accurate source_type ('government', not
-- 'manual') and a real website_url, matching the source_type
-- vocabulary already established in the Stage 1 migration.
insert into public.agricultural_price_sources (id, name, source_type, website_url, active)
values (
  'kamis',
  'Kenya Agricultural Market Information System (KAMIS)',
  'government',
  'https://kamis.kilimo.go.ke/',
  true
);
