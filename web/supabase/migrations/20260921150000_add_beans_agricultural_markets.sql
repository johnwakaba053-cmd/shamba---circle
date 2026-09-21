-- Stage 7B market catalogue expansion. Discovery method identical to
-- Stage 6B: the same official KAMIS export mechanism, scoped to the 8
-- confirmed-active dry bean commodity ids over the most recent 30 days
-- (2026-08-22 to 2026-09-21). 625 raw rows resolved to 40 distinct,
-- valid (market, county) pairs after normalization (trim, casefold,
-- strip apostrophes, treat hyphens as spaces) -- 0 rejected (no blank
-- markets, no unknown counties, no test/junk values found).
--
-- Of those 40 pairs, 38 already exist in agricultural_markets from the
-- Stage 6B maize discovery and are reused as-is, not re-created. Only
-- the 2 genuinely new markets below are inserted here. No fuzzy-merge
-- was applied to any pair -- each is inserted or reused exactly as
-- KAMIS names it.
insert into public.agricultural_markets (name, county_id) values
  ('Gakoromone', 'meru'),
  ('Langas', 'uasin-gishu');
