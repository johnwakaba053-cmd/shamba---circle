-- Curated KAMIS -> agricultural_price_products mappings for the 8
-- verified-active dry bean commodities (Stage 7B), mirroring Stage 6C's
-- approach for maize exactly: source_commodity_id/source_commodity_name
-- are stored exactly as KAMIS's own export renders them, never
-- pre-normalized.
--
-- Unlike maize, KAMIS's own "Classification" column is unused ("-") for
-- every bean row -- confirmed directly against the real export -- so
-- source_classification is stored as '-' for all eight rows (matching
-- what KAMIS actually sends), not a synthetic variety label. The real
-- variety distinction lives in source_commodity_id/source_commodity_name
-- instead, which is why each bean commodity id maps 1:1 to its own
-- agricultural_price_products row rather than sharing one id split by
-- classification.
insert into public.agricultural_price_source_product_map
  (source_id, source_commodity_id, source_commodity_name, source_classification, product_id) values
  ('kamis', '29', 'Beans Red Haricot (Wairimu)', '-', 'beans-dry-red-haricot'),
  ('kamis', '30', 'Beans (Yellow-Green)', '-', 'beans-dry-yellow-green'),
  ('kamis', '64', 'Beans Rosecoco', '-', 'beans-dry-rosecoco'),
  ('kamis', '65', 'Beans (Mwitemania)', '-', 'beans-dry-mwitemania'),
  ('kamis', '66', 'Beans (Mwezi Moja)', '-', 'beans-dry-mwezi-moja'),
  ('kamis', '67', 'Beans (Canadian wonder)', '-', 'beans-dry-canadian-wonder'),
  ('kamis', '183', 'Beans Rosecoco (Nyayo)', '-', 'beans-dry-rosecoco-nyayo'),
  ('kamis', '246', 'Mixed Beans', '-', 'beans-dry-mixed');
