-- Stage 7C: high-coverage Kg-priced crop/vegetable/fruit/pulse batch,
-- selected from the read-only KAMIS catalogue audit (146-of-190
-- commodities surveyed, 30 days ending 2026-09-21). All 21 commodities
-- here already report in Kg with both wholesale and retail present, so
-- this batch needs no ingestion-code or schema change -- same
-- architecture as Dry Maize/Dry Beans, just more products.
--
-- 18 of these 21 KAMIS commodities carry no real classification
-- ("-") and get exactly one product row each, classification=''.
-- The other 3 (Avocado, Green Grams, Ground Nuts) DO report real
-- KAMIS classifications and are split the same way Dry Maize/Dry Beans
-- were -- one product per (commodity, classification) pair, never
-- merged into a single generic row. crop_type_id is set only where an
-- existing crop_types row clearly matches (Tomatoes, Onions, Cabbage,
-- Kale, Irish Potatoes, Sweet Potatoes, Bananas, Avocado, Groundnuts);
-- left null everywhere else rather than inventing a new crop type.
insert into public.agricultural_price_products (id, name, category, unit, crop_type_id, classification) values
  -- Cereals/grains -- no crop_types match exists for any of these
  ('sorghum-red', 'Sorghum (red)', 'crop', 'kg', null, ''),
  ('millet-finger', 'Millet (finger)', 'crop', 'kg', null, ''),
  ('millet-pearl-rush', 'Millet (pearl rush)', 'crop', 'kg', null, ''),

  -- Vegetables/tubers
  ('tomato', 'Tomatoes', 'crop', 'kg', 'tomatoes', ''),
  ('onion-dry', 'Onions (dry)', 'crop', 'kg', 'onions', ''),
  ('cabbage', 'Cabbage', 'crop', 'kg', 'cabbage', ''),
  ('kale-sukuma-wiki', 'Kales (Sukuma Wiki)', 'crop', 'kg', 'kale', ''),
  ('potato-irish-white', 'Irish Potatoes (white)', 'crop', 'kg', 'irish-potatoes', ''),
  ('carrot', 'Carrots', 'crop', 'kg', null, ''),
  ('potato-sweet', 'Sweet Potatoes', 'crop', 'kg', 'sweet-potatoes', ''),
  ('capsicum', 'Capsicums', 'crop', 'kg', null, ''),
  ('nightshade-black', 'Black Nightshade (Managu/Osuga)', 'crop', 'kg', null, ''),
  ('spinach', 'Spinach', 'crop', 'kg', null, ''),
  ('arrow-root', 'Arrow Root', 'crop', 'kg', null, ''),

  -- Fruits
  ('orange', 'Oranges', 'crop', 'kg', null, ''),
  ('watermelon', 'Water Melon', 'crop', 'kg', null, ''),
  ('banana-cooking', 'Banana (cooking)', 'crop', 'kg', 'bananas', ''),

  -- Pulses (in addition to the existing Dry Maize/Dry Beans varieties)
  ('cowpea', 'Cowpeas', 'crop', 'kg', null, ''),

  -- Avocado -- real KAMIS classifications: Local, Fuerte, Hass
  ('avocado-local', 'Avocado', 'crop', 'kg', 'avocado', 'Local'),
  ('avocado-fuerte', 'Avocado', 'crop', 'kg', 'avocado', 'Fuerte'),
  ('avocado-hass', 'Avocado', 'crop', 'kg', 'avocado', 'Hass'),

  -- Green Grams -- real KAMIS classifications: Local-Special, Makueni, Hybrid/ polished
  ('green-gram-local-special', 'Green Grams', 'crop', 'kg', null, 'Local-Special'),
  ('green-gram-makueni', 'Green Grams', 'crop', 'kg', null, 'Makueni'),
  ('green-gram-hybrid-polished', 'Green Grams', 'crop', 'kg', null, 'Hybrid/ polished'),

  -- Ground Nuts -- real KAMIS classifications: Small Red, Large Brown
  ('groundnut-small-red', 'Groundnuts', 'crop', 'kg', 'groundnuts', 'Small Red'),
  ('groundnut-large-brown', 'Groundnuts', 'crop', 'kg', 'groundnuts', 'Large Brown');
