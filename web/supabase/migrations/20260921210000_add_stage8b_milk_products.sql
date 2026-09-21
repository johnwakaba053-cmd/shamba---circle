-- Stage 8B: Milk. KAMIS reports "Cow milk (at collection point)" (id
-- 133) and "Cow milk (processed)" (id 153) as two separate commodity
-- IDs, each with no real KAMIS classification value ("-" throughout) --
-- structurally identical to how Dry Beans varieties are separate
-- commodity IDs, not a classification split within one ID. These two
-- products must never be merged: collection-point and processed milk
-- are different market stages with independently observed prices.
--
-- The pre-existing 'milk-cow' product (Stage 1 seed: 'Milk (cow)',
-- livestock_product, litre, livestock_type_id='dairy-cattle',
-- classification='') is NOT touched by this migration in any way -- it
-- keeps serving farmer-preference matching independently of KAMIS
-- pricing, exactly as 'maize-dry'/'beans-dry' do for their commodities.
--
-- livestock_type_id='dairy-cattle' is set because it's the exact same
-- clear match the pre-existing milk-cow placeholder already uses --
-- not invented for this migration. No crop_type_id applies.
insert into public.agricultural_price_products (id, name, category, unit, livestock_type_id, classification) values
  ('cow-milk-collection-point', 'Cow milk', 'livestock_product', 'litre', 'dairy-cattle', 'At collection point'),
  ('cow-milk-processed', 'Cow milk', 'livestock_product', 'litre', 'dairy-cattle', 'Processed');
