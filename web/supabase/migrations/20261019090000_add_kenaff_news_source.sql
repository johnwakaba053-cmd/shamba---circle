-- News: add KENAFF (Kenya National Farmers' Federation) as an Agriculture
-- Today source. Vetted 2026-10-19: valid RSS advertised at
-- kenaff.org/wp/, all recent items Kenyan farming, low volume (about 1-2
-- posts a month), no overlap with Kilimo News. No terms or licence page;
-- the footer only states copyright, so headlines, dates, links and our own
-- summaries only -- no images.

insert into public.news_sources
  (id, name, url, website_url, terms_url, terms_note, terms_checked_on, image_policy, video_policy)
values
('kenaff', 'KENAFF (Kenya National Farmers'' Federation)', 'https://kenaff.org/wp/', 'https://kenaff.org/wp/', null,
 'No terms or licence page found; footer states copyright only. Headline, date, link and our own summary only; images need written permission.',
 '2026-10-19', 'none', 'none');

insert into public.news_feeds
  (id, source_id, kind, feed_url, youtube_channel_id, region, default_category_id, relevance_mode, notes)
values
('kenaff-news', 'kenaff', 'rss', 'https://kenaff.org/wp/feed/', null,
 'kenya', 'agriculture', 'keyword_filter', 'Low volume (about 1-2 posts a month when checked 2026-10-19).');
