-- Stage 7C market catalogue expansion. Discovery method identical to
-- Stage 6B/7B: the official KAMIS export mechanism, scoped to this
-- batch's 21 commodity ids over the 30 days ending 2026-09-21. 2,399
-- raw rows resolved to 49 distinct, valid (market, county) pairs after
-- normalization -- 0 rejected (no blanks, no unknown counties, no
-- test/junk values).
--
-- 44 of those 49 pairs already exist in agricultural_markets from the
-- Stage 6B/7B maize and beans discovery and are reused as-is. Only the
-- 5 genuinely new markets below are inserted -- all coastal markets
-- (Kwale, Taita-Taveta) that neither maize nor beans reported in.
insert into public.agricultural_markets (name, county_id) values
  ('Diani Market', 'kwale'),
  ('Kinango', 'kwale'),
  ('Lungalunga', 'kwale'),
  ('Voi Wholesale', 'taita-taveta'),
  ('Wundanyi', 'taita-taveta');
