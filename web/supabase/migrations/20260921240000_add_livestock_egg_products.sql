-- Combined livestock/egg batch (Eggs, Chicken, Goat, Sheep, Cattle),
-- built on the Stage 8A four-part mapping architecture and the Stage 8
-- design report's Option A: one product row per REAL, observed KAMIS
-- (classification, grade, sex) combination -- never a theoretical
-- cross-product. Every row below was recomputed directly from the
-- Stage 7/8 audit's raw KAMIS export data (30 days ending 2026-09-21),
-- not copied from an earlier estimate: 2 Eggs classifications, 10
-- Chicken (classification x sex) combos, 16 Goat (breed x grade x sex),
-- 18 Sheep (breed x grade x sex, including one real ungraded "Red
-- Maasai / Male" row), 43 Cattle (breed x grade x sex) -- 89 total.
--
-- `classification` on each row is a readable compound built only from
-- the real KAMIS values actually present for that combination (joined
-- with " · "), never inventing a value for a dimension KAMIS left
-- blank -- e.g. Chicken's one blank-classification row becomes
-- classification='Female' (sex only), and Sheep's one blank-grade row
-- becomes 'Red Maasai · Male' (no grade segment).
--
-- livestock_type_id is set only where a single existing livestock_types
-- row unambiguously covers the whole KAMIS commodity: 'poultry' for
-- Eggs/Chicken, 'goats' for Goat, 'sheep' for Sheep. Cattle is left
-- NULL: KAMIS's "Cattle" commodity mixes both dairy breeds (Ayrshire,
-- Friesian, Guernsey) and beef/dual-purpose breeds (Boran, Zebu,
-- Sahiwal, plus unspecified Mixed/Other/Exotic) under one commodity, and
-- the livestock_types table splits 'dairy-cattle' from 'beef-cattle' --
-- no single value clearly covers every Cattle row, so none is invented.
--
-- Eggs use category='livestock_product' (matches the existing milk
-- precedent: an ongoing product of a living animal, not the animal
-- itself) and unit='tray of 30' (natural-language display value, per
-- the Stage 8 design report's unit-model recommendation -- KAMIS's own
-- raw "Tray(30)" token is preserved separately in ingested rows'
-- metadata, not stored here). Chicken/Goat/Sheep/Cattle use
-- category='livestock' and unit='head'.
insert into public.agricultural_price_products (id, name, category, unit, livestock_type_id, classification) values
  ('eggs-indigenous-kenyeji', 'Eggs', 'livestock_product', 'tray of 30', 'poultry', 'Indigenous /Kenyeji'),
  ('eggs-exotic-grade', 'Eggs', 'livestock_product', 'tray of 30', 'poultry', 'Exotic/Grade'),
  ('cattle-mixed-grade-2-female', 'Cattle', 'livestock', 'head', null, 'Mixed · Grade 2 · Female'),
  ('cattle-mixed-grade-2-male', 'Cattle', 'livestock', 'head', null, 'Mixed · Grade 2 · Male'),
  ('cattle-mixed-grade-5-male', 'Cattle', 'livestock', 'head', null, 'Mixed · Grade 5 · Male'),
  ('cattle-mixed-grade-4-female', 'Cattle', 'livestock', 'head', null, 'Mixed · Grade 4 · Female'),
  ('cattle-mixed-grade-4-male', 'Cattle', 'livestock', 'head', null, 'Mixed · Grade 4 · Male'),
  ('cattle-mixed-grade-3-female', 'Cattle', 'livestock', 'head', null, 'Mixed · Grade 3 · Female'),
  ('cattle-mixed-grade-3-male', 'Cattle', 'livestock', 'head', null, 'Mixed · Grade 3 · Male'),
  ('cattle-mixed-grade-1-female', 'Cattle', 'livestock', 'head', null, 'Mixed · Grade 1 · Female'),
  ('cattle-mixed-grade-1-male', 'Cattle', 'livestock', 'head', null, 'Mixed · Grade 1 · Male'),
  ('cattle-zebu-grade-5-female', 'Cattle', 'livestock', 'head', null, 'Zebu · Grade 5 · Female'),
  ('cattle-zebu-grade-5-male', 'Cattle', 'livestock', 'head', null, 'Zebu · Grade 5 · Male'),
  ('cattle-zebu-grade-4-female', 'Cattle', 'livestock', 'head', null, 'Zebu · Grade 4 · Female'),
  ('cattle-zebu-grade-4-male', 'Cattle', 'livestock', 'head', null, 'Zebu · Grade 4 · Male'),
  ('cattle-zebu-grade-3-female', 'Cattle', 'livestock', 'head', null, 'Zebu · Grade 3 · Female'),
  ('cattle-zebu-grade-3-male', 'Cattle', 'livestock', 'head', null, 'Zebu · Grade 3 · Male'),
  ('cattle-zebu-grade-2-female', 'Cattle', 'livestock', 'head', null, 'Zebu · Grade 2 · Female'),
  ('cattle-zebu-grade-2-male', 'Cattle', 'livestock', 'head', null, 'Zebu · Grade 2 · Male'),
  ('cattle-zebu-grade-1-female', 'Cattle', 'livestock', 'head', null, 'Zebu · Grade 1 · Female'),
  ('cattle-zebu-grade-1-male', 'Cattle', 'livestock', 'head', null, 'Zebu · Grade 1 · Male'),
  ('cattle-ayrshire-grade-2-male', 'Cattle', 'livestock', 'head', null, 'Ayrshire · Grade 2 · Male'),
  ('cattle-sahiwal-grade-1-male', 'Cattle', 'livestock', 'head', null, 'Sahiwal · Grade 1 · Male'),
  ('cattle-friesian-grade-2-male', 'Cattle', 'livestock', 'head', null, 'Friesian · Grade 2 · Male'),
  ('cattle-ayrshire-grade-3-female', 'Cattle', 'livestock', 'head', null, 'Ayrshire · Grade 3 · Female'),
  ('cattle-ayrshire-grade-3-male', 'Cattle', 'livestock', 'head', null, 'Ayrshire · Grade 3 · Male'),
  ('cattle-friesian-grade-1-female', 'Cattle', 'livestock', 'head', null, 'Friesian · Grade 1 · Female'),
  ('cattle-friesian-grade-1-male', 'Cattle', 'livestock', 'head', null, 'Friesian · Grade 1 · Male'),
  ('cattle-ayrshire-grade-1-female', 'Cattle', 'livestock', 'head', null, 'Ayrshire · Grade 1 · Female'),
  ('cattle-ayrshire-grade-1-male', 'Cattle', 'livestock', 'head', null, 'Ayrshire · Grade 1 · Male'),
  ('cattle-friesian-grade-2-female', 'Cattle', 'livestock', 'head', null, 'Friesian · Grade 2 · Female'),
  ('cattle-boran-grade-2-male', 'Cattle', 'livestock', 'head', null, 'Boran · Grade 2 · Male'),
  ('cattle-boran-grade-2-castrate', 'Cattle', 'livestock', 'head', null, 'Boran · Grade 2 · Castrate'),
  ('cattle-boran-grade-2-female', 'Cattle', 'livestock', 'head', null, 'Boran · Grade 2 · Female'),
  ('cattle-ayrshire-grade-2-female', 'Cattle', 'livestock', 'head', null, 'Ayrshire · Grade 2 · Female'),
  ('cattle-sahiwal-grade-2-female', 'Cattle', 'livestock', 'head', null, 'Sahiwal · Grade 2 · Female'),
  ('cattle-mixed-grade-5-female', 'Cattle', 'livestock', 'head', null, 'Mixed · Grade 5 · Female'),
  ('cattle-other-grade-2-male', 'Cattle', 'livestock', 'head', null, 'Other · Grade 2 · Male'),
  ('cattle-guernsey-grade-2-male', 'Cattle', 'livestock', 'head', null, 'Guernsey · Grade 2 · Male'),
  ('cattle-boran-grade-1-male', 'Cattle', 'livestock', 'head', null, 'Boran · Grade 1 · Male'),
  ('cattle-exotic-grade-2-male', 'Cattle', 'livestock', 'head', null, 'Exotic · Grade 2 · Male'),
  ('cattle-exotic-grade-1-male', 'Cattle', 'livestock', 'head', null, 'Exotic · Grade 1 · Male'),
  ('cattle-friesian-grade-3-male', 'Cattle', 'livestock', 'head', null, 'Friesian · Grade 3 · Male'),
  ('cattle-other-grade-3-male', 'Cattle', 'livestock', 'head', null, 'Other · Grade 3 · Male'),
  ('cattle-sahiwal-grade-2-male', 'Cattle', 'livestock', 'head', null, 'Sahiwal · Grade 2 · Male'),
  ('sheep-dorper-grade-3-male', 'Sheep', 'livestock', 'head', 'sheep', 'Dorper · Grade 3 · Male'),
  ('sheep-red-maasai-grade-2-female', 'Sheep', 'livestock', 'head', 'sheep', 'Red Maasai · Grade 2 · Female'),
  ('sheep-red-maasai-grade-2-male', 'Sheep', 'livestock', 'head', 'sheep', 'Red Maasai · Grade 2 · Male'),
  ('sheep-red-maasai-grade-3-female', 'Sheep', 'livestock', 'head', 'sheep', 'Red Maasai · Grade 3 · Female'),
  ('sheep-red-maasai-grade-3-male', 'Sheep', 'livestock', 'head', 'sheep', 'Red Maasai · Grade 3 · Male'),
  ('sheep-red-maasai-grade-1-female', 'Sheep', 'livestock', 'head', 'sheep', 'Red Maasai · Grade 1 · Female'),
  ('sheep-red-maasai-grade-1-male', 'Sheep', 'livestock', 'head', 'sheep', 'Red Maasai · Grade 1 · Male'),
  ('sheep-dorper-grade-2-male', 'Sheep', 'livestock', 'head', 'sheep', 'Dorper · Grade 2 · Male'),
  ('sheep-blackhead-persian-grade-2-female', 'Sheep', 'livestock', 'head', 'sheep', 'Blackhead Persian · Grade 2 · Female'),
  ('sheep-merino-grade-2-male', 'Sheep', 'livestock', 'head', 'sheep', 'Merino · Grade 2 · Male'),
  ('sheep-blackhead-persian-grade-1-male', 'Sheep', 'livestock', 'head', 'sheep', 'Blackhead Persian · Grade 1 · Male'),
  ('sheep-blackhead-persian-grade-2-male', 'Sheep', 'livestock', 'head', 'sheep', 'Blackhead Persian · Grade 2 · Male'),
  ('sheep-dorper-grade-3-female', 'Sheep', 'livestock', 'head', 'sheep', 'Dorper · Grade 3 · Female'),
  ('sheep-somali-grade-2-male', 'Sheep', 'livestock', 'head', 'sheep', 'Somali · Grade 2 · Male'),
  ('sheep-red-maasai-no-grade-male', 'Sheep', 'livestock', 'head', 'sheep', 'Red Maasai · Male'),
  ('sheep-blackhead-persian-grade-1-female', 'Sheep', 'livestock', 'head', 'sheep', 'Blackhead Persian · Grade 1 · Female'),
  ('sheep-dorper-grade-2-female', 'Sheep', 'livestock', 'head', 'sheep', 'Dorper · Grade 2 · Female'),
  ('sheep-blackhead-persian-grade-3-female', 'Sheep', 'livestock', 'head', 'sheep', 'Blackhead Persian · Grade 3 · Female'),
  ('goat-dairy-goats-grade-3-male', 'Goat', 'livestock', 'head', 'goats', 'Dairy Goats · Grade 3 · Male'),
  ('goat-east-african-goat-grade-2-female', 'Goat', 'livestock', 'head', 'goats', 'East African Goat · Grade 2 · Female'),
  ('goat-east-african-goat-grade-2-male', 'Goat', 'livestock', 'head', 'goats', 'East African Goat · Grade 2 · Male'),
  ('goat-mixed-grade-3-female', 'Goat', 'livestock', 'head', 'goats', 'Mixed · Grade 3 · Female'),
  ('goat-mixed-grade-3-male', 'Goat', 'livestock', 'head', 'goats', 'Mixed · Grade 3 · Male'),
  ('goat-mixed-grade-2-female', 'Goat', 'livestock', 'head', 'goats', 'Mixed · Grade 2 · Female'),
  ('goat-mixed-grade-2-male', 'Goat', 'livestock', 'head', 'goats', 'Mixed · Grade 2 · Male'),
  ('goat-mixed-grade-1-female', 'Goat', 'livestock', 'head', 'goats', 'Mixed · Grade 1 · Female'),
  ('goat-mixed-grade-1-male', 'Goat', 'livestock', 'head', 'goats', 'Mixed · Grade 1 · Male'),
  ('goat-east-african-goat-grade-1-female', 'Goat', 'livestock', 'head', 'goats', 'East African Goat · Grade 1 · Female'),
  ('goat-improved-kienyeji-grade-2-male', 'Goat', 'livestock', 'head', 'goats', 'Improved Kienyeji · Grade 2 · Male'),
  ('goat-east-african-goat-grade-1-male', 'Goat', 'livestock', 'head', 'goats', 'East African Goat · Grade 1 · Male'),
  ('goat-dairy-goats-grade-2-male', 'Goat', 'livestock', 'head', 'goats', 'Dairy Goats · Grade 2 · Male'),
  ('goat-dairy-goats-grade-2-female', 'Goat', 'livestock', 'head', 'goats', 'Dairy Goats · Grade 2 · Female'),
  ('goat-east-african-goat-grade-3-male', 'Goat', 'livestock', 'head', 'goats', 'East African Goat · Grade 3 · Male'),
  ('goat-dairy-goats-grade-3-female', 'Goat', 'livestock', 'head', 'goats', 'Dairy Goats · Grade 3 · Female'),
  ('chicken-indigenous-male', 'Chicken', 'livestock', 'head', 'poultry', 'Indigenous · Male'),
  ('chicken-improved-kienyeji-female', 'Chicken', 'livestock', 'head', 'poultry', 'Improved Kienyeji · Female'),
  ('chicken-improved-kienyeji-male', 'Chicken', 'livestock', 'head', 'poultry', 'Improved Kienyeji · Male'),
  ('chicken-indigenous-female', 'Chicken', 'livestock', 'head', 'poultry', 'Indigenous · Female'),
  ('chicken-broiler-male', 'Chicken', 'livestock', 'head', 'poultry', 'Broiler · Male'),
  ('chicken-layers-female', 'Chicken', 'livestock', 'head', 'poultry', 'Layers · Female'),
  ('chicken-layers-male', 'Chicken', 'livestock', 'head', 'poultry', 'Layers · Male'),
  ('chicken-broiler-female', 'Chicken', 'livestock', 'head', 'poultry', 'Broiler · Female'),
  ('chicken-exotic-male', 'Chicken', 'livestock', 'head', 'poultry', 'Exotic · Male'),
  ('chicken-unspecified-female', 'Chicken', 'livestock', 'head', 'poultry', 'Female');
