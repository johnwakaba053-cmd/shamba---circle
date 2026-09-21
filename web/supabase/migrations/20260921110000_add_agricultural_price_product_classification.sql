-- Agricultural price product model refinement (Stage 6A). Fixes the
-- gap the real KAMIS test exposed: KAMIS's "Dry Maize" commodity
-- actually reports three distinct classifications (White Maize,
-- Yellow Maize, Mixed-Traditional) priced per kg, while the only
-- existing maize product (maize-dry) is a single, unclassified
-- "90kg bag" product -- forcing KAMIS's per-kg, classification-specific
-- prices into that row would misrepresent both the unit (roughly a
-- 90x error) and the classification (three genuinely different market
-- prices collapsed into one). No agricultural_prices rows exist yet
-- (verified live immediately before writing this migration: 0 rows),
-- so there is nothing to migrate or risk corrupting -- this is a pure
-- schema/catalog change.
--
-- Farmer preferences (farmer_crop_preferences/farmer_livestock_preferences)
-- are untouched and unaffected: they reference crop_types/livestock_types
-- directly and have never had any foreign key relationship to
-- agricultural_price_products at all (verified live) -- broad farmer
-- preferences ("Maize") and specific price-product granularity
-- ("Dry Maize / White Maize / kg") were already architecturally
-- separate concepts before this migration; this migration doesn't
-- create that separation, it just gives price products room to be as
-- granular as a real source needs without ever touching preferences.

-- === classification column ==================================================
--
-- A plain nullable-in-spirit text attribute on the product itself
-- (option B from the Stage 6A comparison), not a separate normalized
-- table: classification values (e.g. "White Maize") have no
-- independent identity or reuse value outside the specific commodity
-- they describe -- unlike counties or crop_types, nothing else in this
-- schema would ever reference "White Maize" as a standalone concept.
-- A join table would add a table, FKs, and RLS for no real benefit.
--
-- NOT NULL with a default of '' (empty string), not a nullable column
-- -- the same convention already used for
-- agricultural_price_source_product_map.source_classification (Stage
-- 4), and for the identical reason: SQL treats NULL as distinct from
-- NULL for uniqueness purposes, which would silently defeat the
-- dedup constraint below for every classification-less product (e.g.
-- milk-cow) if this were nullable instead.
alter table public.agricultural_price_products
  add column classification text not null default '';

alter table public.agricultural_price_products
  add constraint agricultural_price_products_classification_check
  check (char_length(classification) <= 100);

-- === duplicate prevention ====================================================
--
-- (name, classification, unit) is the natural key: two rows only
-- collide if they claim to be the exact same commodity, at the exact
-- same classification, priced on the exact same basis -- "Maize (dry)"
-- at "White Maize" classification priced per kg is a different row
-- from the same commodity/classification priced per 90kg bag, which is
-- deliberate (Part 9: the model must stay usable for a future source
-- that reports the same commodity on a different pricing basis, not
-- just KAMIS's own per-kg convention). category is deliberately NOT
-- part of this key -- a product's name already implies its category in
-- practice, and there is no realistic scenario in this schema where
-- the same (name, classification, unit) triple should be allowed to
-- exist twice under two different categories.
alter table public.agricultural_price_products
  add constraint agricultural_price_products_identity_key
  unique (name, classification, unit);

-- === new KAMIS-shaped maize products =========================================
--
-- The existing maize-dry row (name='Maize (dry)', classification=''
-- after the default above, unit='90kg bag') is deliberately left
-- completely unchanged -- it remains a legitimate, distinct product
-- (unclassified, bag-priced maize), simply one that KAMIS's per-kg,
-- classified data does not correspond to. It is not modified,
-- deprecated, or renamed: retained as-is for any future source that
-- prices maize the same way it does (this pricing convention is, if
-- anything, more common in everyday Kenyan market usage than per-kg
-- for grain).
--
-- These three new rows are the minimum needed to represent what the
-- real KAMIS test actually observed. They are catalog entries only --
-- no agricultural_price_source_product_map row is created here (that
-- mapping decision is explicitly deferred to a later stage), and no
-- agricultural_prices row is created here either.
insert into public.agricultural_price_products (id, name, category, unit, classification, crop_type_id) values
  ('maize-dry-white', 'Maize (dry)', 'crop', 'kg', 'White Maize', 'maize'),
  ('maize-dry-yellow', 'Maize (dry)', 'crop', 'kg', 'Yellow Maize', 'maize'),
  ('maize-dry-mixed', 'Maize (dry)', 'crop', 'kg', 'Mixed-Traditional', 'maize');
