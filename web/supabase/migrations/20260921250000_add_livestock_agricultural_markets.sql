-- Market catalogue expansion for the combined livestock/egg batch.
-- Discovery method identical to every prior batch: the official KAMIS
-- export mechanism, scoped to commodities 72 (Eggs), 227 (Chicken), 168
-- (Goat), 167 (Sheep), 140 (Cattle) over the 30 days ending 2026-09-21.
--
-- Eggs needed zero new markets (all 20 of its market/county pairs
-- already exist). Chicken/Goat/Sheep/Cattle each independently
-- resolved to the exact same 5 new markets -- these are evidently
-- dedicated livestock-trading markets that simply hadn't been touched
-- by any crop/maize/bean/milk discovery so far. 0 rejected across all
-- five commodities (no blanks, unknown counties, or test/junk values).
insert into public.agricultural_markets (name, county_id) values
  ('Chumvini Livestock Market', 'taita-taveta'),
  ('Kababu', 'migori'),
  ('Makunga Market', 'kakamega'),
  ('Malimili Livestock Market', 'kakamega'),
  ('Nambacha Market', 'kakamega');
