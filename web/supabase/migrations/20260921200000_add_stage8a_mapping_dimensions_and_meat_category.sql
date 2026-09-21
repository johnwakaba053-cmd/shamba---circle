-- Stage 8A: architecture-only plumbing for future non-crop KAMIS
-- commodities (livestock, milk, eggs, meat). No new products, mappings,
-- markets, whitelist entries, or prices are added by this migration --
-- see the Stage 8 design report for the full rationale.
--
-- KAMIS reports multiple breed/grade/sex combinations for the same
-- commodity, market, and date for Cattle/Goat/Sheep/Chicken. The
-- existing 3-part mapping key (source_id, source_commodity_id,
-- source_classification) can't express that, but agricultural_prices
-- itself doesn't need to change: once each real (classification, grade,
-- sex) combination gets its own product_id -- the same mechanism
-- already proven for maize/beans/avocado -- agricultural_prices' own
-- unique constraint (product_id, market_id, source_id, price_type,
-- recorded_at) already fully disambiguates everything, by construction.
-- This migration only widens the MAPPING table to be able to route to
-- that per-combination product_id.
--
-- source_grade/source_sex default to '-', which is not a filler value
-- -- it's the literal, correct historical value for every existing
-- maize/beans/crop mapping row, since none of those commodities ever
-- populate KAMIS's Grade/Sex columns. Adding columns to an existing
-- unique constraint only ever widens it (a set of rows already unique
-- on 3 columns stays unique on 5), so this cannot introduce a
-- collision among the 37 existing mapping rows.
alter table public.agricultural_price_source_product_map
  add column source_grade text not null default '-',
  add column source_sex text not null default '-';

alter table public.agricultural_price_source_product_map
  drop constraint agricultural_price_source_product_map_key,
  add constraint agricultural_price_source_product_map_key
    unique (source_id, source_commodity_id, source_classification, source_grade, source_sex);

-- Meat (Meat Beef, Pork, Meat Chevon, Meat Mutton, Meat Indigenous
-- Chicken, ...) is a distinct value-chain stage from both the live
-- animal ('livestock') and ongoing-production livestock_product
-- (milk/eggs) -- it doesn't fit either existing value. Widening only
-- adds an allowed value; both currently-used categories ('crop',
-- 'livestock_product') remain valid, so no existing row is affected.
-- 'fish' is deliberately NOT added yet, per the Stage 8 design report's
-- recommendation to keep fish scoped to its own future decision.
alter table public.agricultural_price_products
  drop constraint agricultural_price_products_category_check,
  add constraint agricultural_price_products_category_check
    check (category in ('crop', 'livestock', 'livestock_product', 'meat'));
