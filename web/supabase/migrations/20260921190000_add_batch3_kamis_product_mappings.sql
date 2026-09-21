-- Curated KAMIS -> agricultural_price_products mappings for Stage 7C's
-- 21 approved commodities, mirroring Stage 6C/7B exactly:
-- source_commodity_id/source_commodity_name are stored exactly as
-- KAMIS's own export renders them.
--
-- 18 of these commodities report no real classification ("-" in every
-- row observed) -- source_classification is stored as '-' for those,
-- matching what KAMIS actually sends (same convention as the Stage 7B
-- dry bean mappings). The other 3 (Avocado id 142, Green Grams id 10,
-- Ground Nuts id 12) DO report real classifications, so each gets one
-- mapping row per classification value actually observed, exactly
-- preserving KAMIS's own text ("Local-Special", "Hybrid/ polished",
-- etc.) rather than a normalized proxy for it.
insert into public.agricultural_price_source_product_map
  (source_id, source_commodity_id, source_commodity_name, source_classification, product_id) values
  ('kamis', '2', 'Red Sorghum', '-', 'sorghum-red'),
  ('kamis', '54', 'Finger Millet', '-', 'millet-finger'),
  ('kamis', '51', 'Pearl Rush Millet', '-', 'millet-pearl-rush'),
  ('kamis', '61', 'Tomatoes', '-', 'tomato'),
  ('kamis', '158', 'Dry Onions', '-', 'onion-dry'),
  ('kamis', '58', 'Cabbages', '-', 'cabbage'),
  ('kamis', '154', 'Kales/Sukuma Wiki', '-', 'kale-sukuma-wiki'),
  ('kamis', '163', 'White Irish Potatoes', '-', 'potato-irish-white'),
  ('kamis', '60', 'Carrots', '-', 'carrot'),
  ('kamis', '59', 'Sweet potatoes', '-', 'potato-sweet'),
  ('kamis', '172', 'Capsicums', '-', 'capsicum'),
  ('kamis', '121', 'Black nightshade (Managu/ Osuga)', '-', 'nightshade-black'),
  ('kamis', '161', 'Spinach', '-', 'spinach'),
  ('kamis', '143', 'Arrow Root', '-', 'arrow-root'),
  ('kamis', '127', 'Oranges', '-', 'orange'),
  ('kamis', '150', 'Water Melon', '-', 'watermelon'),
  ('kamis', '255', 'Banana (Cooking)', '-', 'banana-cooking'),
  ('kamis', '189', 'Cowpeas', '-', 'cowpea'),
  ('kamis', '142', 'Avocado', 'Local', 'avocado-local'),
  ('kamis', '142', 'Avocado', 'Fuerte', 'avocado-fuerte'),
  ('kamis', '142', 'Avocado', 'Hass', 'avocado-hass'),
  ('kamis', '10', 'Green Grams', 'Local-Special', 'green-gram-local-special'),
  ('kamis', '10', 'Green Grams', 'Makueni', 'green-gram-makueni'),
  ('kamis', '10', 'Green Grams', 'Hybrid/ polished', 'green-gram-hybrid-polished'),
  ('kamis', '12', 'Ground Nuts', 'Small Red', 'groundnut-small-red'),
  ('kamis', '12', 'Ground Nuts', 'Large Brown', 'groundnut-large-brown');
