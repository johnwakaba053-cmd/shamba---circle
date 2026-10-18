-- News: Agriculture Today is for signed-in members only.
--
-- The /news pages already send signed-out visitors to sign-in, but N1/N4
-- made published stories readable by the anon role too (they were meant
-- to be public then), so the public Supabase API still served them to
-- anyone with the project's anon key. This closes that:
--
--  * news_articles, news_media and news_article_price_products: readable
--    by signed-in users only. The reader rules are unchanged (live
--    published stories; media and price links of stories you can see),
--    only the anon role is gone from the policies and loses its grants.
--  * news_categories and news_sources: the News-only reference tables
--    go the same way -- nothing outside News reads them.
--  * The 'news-media' bucket becomes PRIVATE: no public file URLs. A
--    signed-in user can read a file only when its story (the folder,
--    '<article uuid>/<file>') is one they can see; the app serves files
--    through short-lived signed URLs. Admins keep their own policy.
--
-- Unchanged: admin access (is_admin() policies and the SECURITY DEFINER
-- admin functions), the importer (service role), public.counties.

-- Tables: anon loses every grant (REVOKE on a table also removes its
-- column-level grants).
revoke all on public.news_articles from anon;
revoke all on public.news_media from anon;
revoke all on public.news_article_price_products from anon;
revoke all on public.news_categories from anon;
revoke all on public.news_sources from anon;

-- Policies: the same rules, for signed-in users only.
alter policy "Anyone can view published news articles" on public.news_articles to authenticated;
alter policy "Anyone can view published news articles" on public.news_articles
  rename to "Signed-in users can view published news articles";

alter policy "Anyone can view media of articles they can see" on public.news_media to authenticated;
alter policy "Anyone can view media of articles they can see" on public.news_media
  rename to "Signed-in users can view media of articles they can see";

alter policy "Anyone can view price links of articles they can see" on public.news_article_price_products
  to authenticated;
alter policy "Anyone can view price links of articles they can see" on public.news_article_price_products
  rename to "Signed-in users can view price links of articles they can see";

alter policy "Anyone can view news categories" on public.news_categories to authenticated;
alter policy "Anyone can view news categories" on public.news_categories
  rename to "Signed-in users can view news categories";

alter policy "Anyone can view news sources" on public.news_sources to authenticated;
alter policy "Anyone can view news sources" on public.news_sources
  rename to "Signed-in users can view news sources";

-- Storage: private bucket, files readable through the story they
-- belong to. The subquery runs with the reader's own news_articles RLS,
-- so a reader gets files of live stories only (an admin already reads
-- every file through "Admins can view news media objects").
update storage.buckets set public = false where id = 'news-media';

create policy "Signed-in users can view media of visible news articles"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'news-media'
  and exists (
    select 1
    from public.news_articles a
    where a.id::text = (storage.foldername(name))[1]
  )
);
