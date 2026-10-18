-- ROLLBACK SCRIPT -- NOT A MIGRATION. Do not move this file into
-- supabase/migrations/: anything there can be applied during a release
-- and would silently undo the News security change.
--
-- Reverses: web/supabase/migrations/20261009110000_require_sign_in_for_news.sql
--
-- Effect: makes Agriculture Today readable signed out again, exactly as
-- before that migration --
--   * drops the storage policy "Signed-in users can view media of
--     visible news articles" and makes the 'news-media' bucket public;
--   * returns the five reader policies to their original names and to
--     roles anon + authenticated (as created in 20261008130000 and
--     20261008160000);
--   * restores anon's original grants: SELECT on 24 news_articles
--     columns (20261008130000, 20261008160000, 20261009100000) and on
--     news_media, news_article_price_products, news_categories and
--     news_sources.
-- Nothing else changes: authenticated and admin access, the importer,
-- functions, other tables, buckets and policies are untouched.
--
-- Use ONLY for an intentional production rollback, after reviewing the
-- live application and database state. This RE-OPENS public read access
-- to News. Apply it together with rolling the app back to a deployment
-- that expects public News (the new code signs URLs and requires
-- sign-in); a public database under the new code just re-opens the gap.
-- Apply it as its own recorded migration (e.g. through the Supabase
-- connector's apply_migration), so the migration history stays accurate.
-- No IF EXISTS on purpose: if the forward migration isn't in place, a
-- statement fails and, applied as one migration, nothing changes.
--
-- Tested 2026-10-18 on production inside a transaction that always
-- rolled back: forward migration then this script restored all 178
-- snapshot rows (grants for every role, RLS flags, policies on the news
-- tables and storage, every bucket, migration history) with 0 missing
-- and 0 extra, and signed-out reads worked again. Statements below are
-- the tested section D, unchanged.

drop policy "Signed-in users can view media of visible news articles" on storage.objects;
update storage.buckets set public = true where id = 'news-media';

alter policy "Signed-in users can view published news articles" on public.news_articles
  to anon, authenticated;
alter policy "Signed-in users can view published news articles" on public.news_articles
  rename to "Anyone can view published news articles";

alter policy "Signed-in users can view media of articles they can see" on public.news_media
  to anon, authenticated;
alter policy "Signed-in users can view media of articles they can see" on public.news_media
  rename to "Anyone can view media of articles they can see";

alter policy "Signed-in users can view price links of articles they can see" on public.news_article_price_products
  to anon, authenticated;
alter policy "Signed-in users can view price links of articles they can see" on public.news_article_price_products
  rename to "Anyone can view price links of articles they can see";

alter policy "Signed-in users can view news categories" on public.news_categories
  to anon, authenticated;
alter policy "Signed-in users can view news categories" on public.news_categories
  rename to "Anyone can view news categories";

alter policy "Signed-in users can view news sources" on public.news_sources
  to anon, authenticated;
alter policy "Signed-in users can view news sources" on public.news_sources
  rename to "Anyone can view news sources";

grant select (
  id, slug, category_id, region, county_id, title, summary, body, origin,
  source_id, external_url, cover_image_path, cover_image_alt,
  cover_image_credit, status, is_featured, featured_rank, published_at,
  expires_at, created_at, updated_at,
  format, byline,
  source_published_at
) on public.news_articles to anon;
grant select on public.news_media to anon;
grant select on public.news_article_price_products to anon;
grant select on public.news_categories to anon;
grant select on public.news_sources to anon;
