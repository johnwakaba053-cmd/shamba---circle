-- Marketplace 2.0 Batch M3: category-aware listings. One additive,
-- nullable column -- no default (so every existing row, including the
-- one real production listing, gets NULL automatically with zero
-- backfill), no GIN index (nothing queries into it yet -- deferred
-- until/if category-specific discovery filtering is ever built), no
-- CHECK constraint on its shape (validation lives in application code,
-- see src/lib/marketplaceCategoryFields.ts -- a JSONB shape that varies
-- across 15 categories doesn't fit a single DB-level CHECK without a
-- large per-category CASE that would defeat the point of not needing a
-- migration for every new category).
--
-- Already governed by listings' own existing row-level RLS policies
-- (profile_id = auth.uid() for insert/update/delete, open read) --
-- Postgres RLS is row-scoped, not column-scoped, so no policy change is
-- needed or made here.
alter table public.listings
  add column category_details jsonb;
