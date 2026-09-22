-- Marketplace 2.1: structured Kenyan county + For-Hire listings.
-- Purely additive -- no data touched, no defaults, no RLS change.
-- county_id is a NEW, separate dimension from the existing free-text
-- `location` (kept untouched): county_id is for structured
-- filtering/discovery, `location` remains free-text detail ("Karen,
-- near JKIA"). Reuses the existing, already-proven `county_id text
-- references counties(id)` pattern already used by
-- agricultural_markets/alert_counties/farmer_preferences -- no new
-- counties table, no sub-counties/wards invented.
alter table public.listings
  add column county_id text references public.counties (id);

create index listings_county_id_idx on public.listings (county_id);

-- Widen listing_type to add 'for_hire' alongside the existing
-- 'for_sale'/'wanted' -- a pure widening, not a rename/removal, so
-- every existing row's listing_type value (there are currently none,
-- but the principle holds for any future row before this migration)
-- remains valid unchanged.
alter table public.listings
  drop constraint listings_listing_type_check;

alter table public.listings
  add constraint listings_listing_type_check
  check (listing_type = any (array['for_sale', 'wanted', 'for_hire']));

-- Hire-specific terms as two plain nullable columns, not a JSONB blob
-- and not folded into category_details -- category-specific fields
-- and hire-specific fields are deliberately kept as separate concerns
-- (a category's fields don't change based on listing_type, and
-- listing_type's hire fields don't vary by category). price/price_unit
-- are reused as the hire rate itself; these two columns only cover what
-- price/price_unit cannot already express.
alter table public.listings
  add column hire_deposit numeric;

alter table public.listings
  add column hire_minimum_period text;

alter table public.listings
  add constraint listings_hire_deposit_check
  check (hire_deposit is null or hire_deposit >= 0);
