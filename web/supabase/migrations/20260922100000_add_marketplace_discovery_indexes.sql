-- Marketplace 2.0 Batch M2: discovery indexes. Purely additive -- no
-- table structure change, no RLS change, no data change. Enables
-- server-side search (title/description) and price-sorted keyset
-- pagination to scale past the current handful of listings without a
-- sequential scan.

-- pg_trgm: trigram similarity, used for scalable partial/substring
-- ILIKE search across title/description. Chosen over Postgres's
-- built-in tsvector full-text search because farmer queries are short,
-- often partial words (e.g. "seed" should match "seedlings" mid-word),
-- and FTS's language-stemming (keyed to 'english') is a poor fit for
-- short agricultural terms that may mix English and Swahili -- trigram
-- matching has no language dependency at all.
create extension if not exists pg_trgm;

create index listings_title_trgm_idx on public.listings using gin (title gin_trgm_ops);
create index listings_description_trgm_idx on public.listings using gin (description gin_trgm_ops);

-- Supports both price range filtering (gte/lte) and price-sorted
-- keyset pagination (price_asc/price_desc). A plain btree handles NULL
-- values correctly (they simply don't participate in equality/range
-- comparisons), no partial index needed.
create index listings_price_idx on public.listings (price);
