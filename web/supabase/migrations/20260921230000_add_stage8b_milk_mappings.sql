-- Curated KAMIS -> agricultural_price_products mappings for Stage 8B's
-- two milk commodities, using the Stage 8A four-part mapping key
-- (source_commodity_id, source_classification, source_grade,
-- source_sex). Milk populates none of KAMIS's Classification/Grade/Sex
-- columns, so all three dimensions are stored as '-' -- matching
-- exactly what KAMIS's own export renders, same convention already
-- used for every classification-less commodity onboarded so far.
insert into public.agricultural_price_source_product_map
  (source_id, source_commodity_id, source_commodity_name, source_classification, source_grade, source_sex, product_id) values
  ('kamis', '133', 'Cow Milk(At collection point)', '-', '-', '-', 'cow-milk-collection-point'),
  ('kamis', '153', 'Cow Milk(Processd)', '-', '-', '-', 'cow-milk-processed');
