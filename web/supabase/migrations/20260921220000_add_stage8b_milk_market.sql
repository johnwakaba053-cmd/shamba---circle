-- Stage 8B market catalogue expansion. Discovery method identical to
-- Stage 6B/7B/7C: the official KAMIS export mechanism, scoped to
-- commodities 133 and 153 over the 30 days ending 2026-09-21. 54 raw
-- rows resolved to 14 distinct, valid (market, county) pairs after
-- normalization -- 0 rejected (no blanks, no unknown counties, no
-- test/junk values).
--
-- 13 of those 14 pairs already exist in agricultural_markets from
-- earlier maize/beans/crop discovery and are reused as-is. Only the one
-- genuinely new market below is inserted.
insert into public.agricultural_markets (name, county_id) values
  ('Ngundune', 'meru');
