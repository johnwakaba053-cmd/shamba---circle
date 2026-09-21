-- Curated KAMIS -> agricultural_price_products mappings (Stage 6C).
-- Exactly the three classifications the real KAMIS test (Stage 5) and
-- market discovery (Stage 6B) have actually observed for commodity id
-- 1 (Dry Maize) -- no other commodity or classification is mapped,
-- since none has been verified. agricultural_price_source_product_map
-- was confirmed empty immediately before this migration.
--
-- source_commodity_id/source_classification are stored exactly as
-- KAMIS renders them ("1", "White Maize", "Yellow Maize",
-- "Mixed-Traditional"), not pre-normalized -- the importer
-- (web/src/lib/kamis/ingest.ts) applies normalizeForMatching() to
-- source_classification at lookup time, on both the stored mapping row
-- and the freshly-parsed KAMIS row, so storing the raw source
-- vocabulary here is both correct and exactly what was asked: the
-- mapping table records what KAMIS actually said, not a normalized
-- proxy for it.
--
-- No other classification (e.g. any KAMIS value not yet seen in a real
-- export) is mapped -- an unmapped classification continues to
-- quarantine via the existing unmapped_product path, exactly as
-- designed.
insert into public.agricultural_price_source_product_map
  (source_id, source_commodity_id, source_commodity_name, source_classification, product_id) values
  ('kamis', '1', 'Dry Maize', 'White Maize', 'maize-dry-white'),
  ('kamis', '1', 'Dry Maize', 'Yellow Maize', 'maize-dry-yellow'),
  ('kamis', '1', 'Dry Maize', 'Mixed-Traditional', 'maize-dry-mixed');
