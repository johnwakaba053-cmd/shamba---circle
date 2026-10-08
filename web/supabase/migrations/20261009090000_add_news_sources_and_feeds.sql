-- News N6a: live agriculture news sources, feeds and ingestion-run
-- tracking (database only).
--
-- Agriculture Today becomes a current agriculture news feed. This step
-- only records WHERE stories may come from and HOW each source's media
-- may be shown; nothing here fetches, imports or publishes anything. A
-- later importer (service role) reads news_feeds, writes drafts and logs
-- each run in news_ingestion_runs; admins review and publish as before.
--
-- Sources and feeds are the ones marked APPROVED in the source research
-- of 2026-10-08 (feeds fetched live, terms read where published):
--   text (RSS)   headline, date, link and our own summary only -- no
--                source images (no publisher granted image reuse)
--   video        official YouTube channels, shown only through YouTube's
--                embedded player (each channel's embedding was on);
--                YouTube's thumbnail only as that video's play image
--
-- Media rules live on the source:
--   image_policy  'none' (default) | 'link' -- no source is 'link' yet
--   video_policy  'none' (default) | 'youtube_embed'
-- A YouTube feed can only belong to a source whose video_policy is
-- 'youtube_embed' (trigger below).
--
-- Access: news_sources stays publicly readable (its new columns describe
-- attribution and media rules, nothing private). news_feeds and
-- news_ingestion_runs are admin-read-only; nobody writes them through
-- the API -- the importer will use the service role.
--
-- Nothing else changes: no news_articles columns, no admin functions,
-- the 5 published articles and the shamba-space source stay as they are.

-- === sources: website, terms and media rules ================================

alter table public.news_sources
  add column website_url text check (website_url is null or website_url ~ '^https://[^\s]+$'),
  add column terms_url text check (terms_url is null or terms_url ~ '^https://[^\s]+$'),
  -- What was checked and what it allows, in plain words.
  add column terms_note text check (terms_note is null or char_length(btrim(terms_note)) between 1 and 1000),
  add column terms_checked_on date,
  add column image_policy text not null default 'none' check (image_policy in ('none', 'link')),
  add column video_policy text not null default 'none' check (video_policy in ('none', 'youtube_embed'));

-- === feeds ==================================================================

create table public.news_feeds (
  id text primary key check (id ~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*$'),
  source_id text not null references public.news_sources (id),
  -- rss: an RSS/Atom feed of text stories.
  -- youtube_channel: an official channel's public video feed.
  kind text not null check (kind in ('rss', 'youtube_channel')),
  feed_url text not null unique check (char_length(feed_url) <= 500 and feed_url ~ '^https://[^\s]+$'),
  youtube_channel_id text check (youtube_channel_id is null or youtube_channel_id ~ '^UC[A-Za-z0-9_-]{22}$'),
  region text not null check (region in ('kenya', 'africa', 'global')),
  default_category_id text not null references public.news_categories (id),
  -- agri_feed: the feed is agriculture-only. keyword_filter: a wider
  -- feed whose items must match the agriculture keyword list.
  relevance_mode text not null default 'agri_feed' check (relevance_mode in ('agri_feed', 'keyword_filter')),
  is_active boolean not null default true,
  notes text check (notes is null or char_length(btrim(notes)) between 1 and 500),

  -- Fetch state, written by the importer (service role) only.
  etag text check (etag is null or char_length(etag) <= 500),
  last_modified text check (last_modified is null or char_length(last_modified) <= 200),
  last_fetched_at timestamptz,
  last_success_at timestamptz,
  last_status text check (last_status in ('ok', 'not_modified', 'error')),
  last_error text check (last_error is null or char_length(last_error) <= 500),
  last_item_count integer check (last_item_count is null or last_item_count >= 0),
  consecutive_failures integer not null default 0 check (consecutive_failures >= 0),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- A YouTube feed is exactly that channel's public feed; an RSS feed has
  -- no channel.
  constraint news_feeds_youtube_shape check (
    (kind = 'youtube_channel'
      and youtube_channel_id is not null
      and feed_url = 'https://www.youtube.com/feeds/videos.xml?channel_id=' || youtube_channel_id)
    or (kind = 'rss' and youtube_channel_id is null)
  )
);

create index news_feeds_source_idx on public.news_feeds (source_id);
create index news_feeds_category_idx on public.news_feeds (default_category_id);
create index news_feeds_active_idx on public.news_feeds (is_active, region);
create unique index news_feeds_youtube_channel_key
  on public.news_feeds (youtube_channel_id) where youtube_channel_id is not null;

create function public.set_news_feeds_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.set_news_feeds_updated_at() from public;
revoke execute on function public.set_news_feeds_updated_at() from anon;
revoke execute on function public.set_news_feeds_updated_at() from authenticated;

create trigger news_feeds_set_updated_at
before update on public.news_feeds
for each row execute function public.set_news_feeds_updated_at();

-- A YouTube feed needs a source whose video_policy allows embedding.
-- Fixed message: 'news_feed_video_not_permitted' (23514).
create function public.check_news_feed_media_policy()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.kind = 'youtube_channel' and not exists (
    select 1 from public.news_sources s
    where s.id = new.source_id and s.video_policy = 'youtube_embed'
  ) then
    raise exception 'news_feed_video_not_permitted' using errcode = '23514', detail = new.source_id;
  end if;
  return new;
end;
$$;

revoke all on function public.check_news_feed_media_policy() from public;
revoke execute on function public.check_news_feed_media_policy() from anon;
revoke execute on function public.check_news_feed_media_policy() from authenticated;

create trigger news_feeds_check_media_policy
before insert or update of kind, source_id on public.news_feeds
for each row execute function public.check_news_feed_media_policy();

-- And a source can't drop video permission while it still has YouTube
-- feeds.
create function public.check_news_source_video_policy()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.video_policy <> 'youtube_embed' and exists (
    select 1 from public.news_feeds f
    where f.source_id = new.id and f.kind = 'youtube_channel'
  ) then
    raise exception 'news_feed_video_not_permitted' using errcode = '23514', detail = new.id;
  end if;
  return new;
end;
$$;

revoke all on function public.check_news_source_video_policy() from public;
revoke execute on function public.check_news_source_video_policy() from anon;
revoke execute on function public.check_news_source_video_policy() from authenticated;

create trigger news_sources_check_video_policy
before update of video_policy on public.news_sources
for each row execute function public.check_news_source_video_policy();

-- === ingestion runs =========================================================

-- One row per feed per run; rows from the same run share run_id.
create table public.news_ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  feed_id text references public.news_feeds (id) on delete set null,
  triggered_by text not null check (triggered_by in ('cron', 'manual')),
  dry_run boolean not null default false,
  status text not null check (status in ('running', 'completed', 'not_modified', 'failed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  http_status smallint check (http_status is null or http_status between 100 and 599),
  items_seen integer not null default 0 check (items_seen >= 0),
  items_new integer not null default 0 check (items_new >= 0),
  items_duplicate integer not null default 0 check (items_duplicate >= 0),
  items_irrelevant integer not null default 0 check (items_irrelevant >= 0),
  items_too_old integer not null default 0 check (items_too_old >= 0),
  items_invalid integer not null default 0 check (items_invalid >= 0),
  error_message text check (error_message is null or char_length(error_message) <= 1000),
  -- Small diagnostics, e.g. rejected items' reasons in a dry run.
  details jsonb,
  constraint news_ingestion_runs_completed_after_start
    check (completed_at is null or completed_at >= started_at)
);

create index news_ingestion_runs_run_idx on public.news_ingestion_runs (run_id);
create index news_ingestion_runs_feed_idx on public.news_ingestion_runs (feed_id, started_at desc);
create index news_ingestion_runs_started_idx on public.news_ingestion_runs (started_at desc);

-- === access =================================================================

alter table public.news_feeds enable row level security;
alter table public.news_ingestion_runs enable row level security;

revoke all on public.news_feeds from anon, authenticated;
revoke all on public.news_ingestion_runs from anon, authenticated;
grant select on public.news_feeds to authenticated;
grant select on public.news_ingestion_runs to authenticated;

create policy "Admins can view news feeds"
on public.news_feeds
for select
to authenticated
using ((select public.is_admin()));

create policy "Admins can view news ingestion runs"
on public.news_ingestion_runs
for select
to authenticated
using ((select public.is_admin()));

-- === approved sources =======================================================

insert into public.news_sources
  (id, name, url, website_url, terms_url, terms_note, terms_checked_on, image_policy, video_policy)
values
-- Kenya
('kilimo-news', 'Kilimo News', 'https://www.kilimonews.co.ke', 'https://www.kilimonews.co.ke', null,
 'No terms or licence page found. Headline, date, link and our own summary only; images need written permission.',
 '2026-10-08', 'none', 'none'),
('kenya-news-agency', 'Kenya News Agency', 'https://www.kenyanews.go.ke', 'https://www.kenyanews.go.ke',
 'https://www.kenyanews.go.ke/disclaimer/',
 'Government news agency; disclaimer has no reuse clause. Headline, date, link and our own summary only.',
 '2026-10-08', 'none', 'none'),
('kalro', 'KALRO', 'https://www.kalro.org', 'https://www.kalro.org', null,
 'Official YouTube channel with embedding on. Videos only through YouTube''s embedded player; no download or re-hosting.',
 '2026-10-08', 'none', 'youtube_embed'),
('kenya-moald', 'Ministry of Agriculture and Livestock Development', 'https://kilimo.go.ke', 'https://kilimo.go.ke', null,
 'Official YouTube channel with embedding on. Videos only through YouTube''s embedded player; no download or re-hosting.',
 '2026-10-08', 'none', 'youtube_embed'),
('ktn-farmers-tv', 'KTN Farmers TV (Farm Kenya)', 'https://www.standardmedia.co.ke', 'https://www.standardmedia.co.ke',
 'https://www.standardmedia.co.ke/terms-and-conditions',
 'Standard Group''s official Farm Kenya YouTube channel, embedding on. YouTube player only; The Standard''s website text and photos are not licensed for reuse.',
 '2026-10-08', 'none', 'youtube_embed'),
-- Africa
('farmers-review-africa', 'Farmers Review Africa', 'https://farmersreviewafrica.com', 'https://farmersreviewafrica.com', null,
 'No terms page found. Headline, date, link and our own summary only; images need written permission.',
 '2026-10-08', 'none', 'none'),
('allafrica', 'AllAfrica', 'https://allafrica.com', 'https://allafrica.com',
 'https://allafrica.com/misc/info/copyright.html',
 'Content may not be copied without written permission; the agriculture headline feed is AllAfrica''s own linking tool. Headline, date, link and our own summary only.',
 '2026-10-08', 'none', 'none'),
('ilri', 'International Livestock Research Institute (ILRI)', 'https://www.ilri.org', 'https://www.ilri.org', null,
 'Official YouTube channel with embedding on. Videos only through YouTube''s embedded player; no download or re-hosting.',
 '2026-10-08', 'none', 'youtube_embed'),
('cimmyt', 'CIMMYT', 'https://www.cimmyt.org', 'https://www.cimmyt.org', null,
 'Official YouTube channel with embedding on. Videos only through YouTube''s embedded player; no download or re-hosting.',
 '2026-10-08', 'none', 'youtube_embed'),
-- Global
('fao', 'Food and Agriculture Organization of the United Nations (FAO)', 'https://www.fao.org', 'https://www.fao.org',
 'https://www.fao.org/contact-us/terms/en/',
 'Newsroom: headline, date, link and our own summary; FAO photos need permission (CC BY 4.0 covers FAO datasets only). Official YouTube channel with embedding on: YouTube player only.',
 '2026-10-08', 'none', 'youtube_embed'),
('agfunder', 'AgFunderNews', 'https://agfundernews.com', 'https://agfundernews.com',
 'https://agfundernews.com/terms-of-use',
 'Site terms give no image licence: headline, date, link and our own summary only. Official AgFunder YouTube channel with embedding on: YouTube player only.',
 '2026-10-08', 'none', 'youtube_embed'),
('ifpri', 'International Food Policy Research Institute (IFPRI)', 'https://www.ifpri.org', 'https://www.ifpri.org', null,
 'Official YouTube channel with embedding on. Videos only through YouTube''s embedded player; no download or re-hosting.',
 '2026-10-08', 'none', 'youtube_embed'),
('unep', 'UN Environment Programme (UNEP)', 'https://www.unep.org', 'https://www.unep.org', null,
 'Official YouTube channel with embedding on. YouTube player only; environment-wide, so agriculture-relevant videos only.',
 '2026-10-08', 'none', 'youtube_embed');

-- === approved feeds =========================================================

insert into public.news_feeds
  (id, source_id, kind, feed_url, youtube_channel_id, region, default_category_id, relevance_mode, notes)
values
-- Kenya
('kilimo-news', 'kilimo-news', 'rss', 'https://www.kilimonews.co.ke/feed/', null,
 'kenya', 'agriculture', 'agri_feed', null),
('kna-agriculture', 'kenya-news-agency', 'rss', 'https://www.kenyanews.go.ke/category/agriculture/feed/', null,
 'kenya', 'agriculture', 'agri_feed', 'Low volume (about 4 stories in 14 days when checked).'),
('kalro-youtube', 'kalro', 'youtube_channel',
 'https://www.youtube.com/feeds/videos.xml?channel_id=UCCiK13RnXgpJzI8gCnkHHTg', 'UCCiK13RnXgpJzI8gCnkHHTg',
 'kenya', 'agriculture', 'agri_feed', null),
('kenya-moald-youtube', 'kenya-moald', 'youtube_channel',
 'https://www.youtube.com/feeds/videos.xml?channel_id=UClzp7-BsvmEjqGj6hjJu-sA', 'UClzp7-BsvmEjqGj6hjJu-sA',
 'kenya', 'agriculture', 'agri_feed', null),
('ktn-farmers-tv-youtube', 'ktn-farmers-tv', 'youtube_channel',
 'https://www.youtube.com/feeds/videos.xml?channel_id=UCZfzFgmReSD09S2L-cvg8uA', 'UCZfzFgmReSD09S2L-cvg8uA',
 'kenya', 'agriculture', 'agri_feed', null),
-- Africa
('farmers-review-africa', 'farmers-review-africa', 'rss', 'https://farmersreviewafrica.com/feed/', null,
 'africa', 'agriculture', 'agri_feed', null),
('allafrica-agriculture', 'allafrica', 'rss', 'https://allafrica.com/tools/headlines/rdf/agriculture/headlines.rdf', null,
 'africa', 'agriculture', 'agri_feed', 'Headlines are prefixed with the country (e.g. "Kenya: ...").'),
('ilri-youtube', 'ilri', 'youtube_channel',
 'https://www.youtube.com/feeds/videos.xml?channel_id=UC_3Lza_tjzG7gWz5_xCMYCw', 'UC_3Lza_tjzG7gWz5_xCMYCw',
 'africa', 'agriculture', 'agri_feed', null),
('cimmyt-youtube', 'cimmyt', 'youtube_channel',
 'https://www.youtube.com/feeds/videos.xml?channel_id=UCc_U8b1lLAaujXzx1kH2FCw', 'UCc_U8b1lLAaujXzx1kH2FCw',
 'africa', 'agriculture', 'agri_feed', null),
-- Global
('fao-newsroom', 'fao', 'rss', 'https://www.fao.org/feeds/fao-newsroom-rss', null,
 'global', 'agriculture', 'agri_feed', 'Item descriptions are thin; summaries will mostly be written from the headline and story.'),
('fao-youtube', 'fao', 'youtube_channel',
 'https://www.youtube.com/feeds/videos.xml?channel_id=UCtu8MkufmVgxS8_Ocl7mMig', 'UCtu8MkufmVgxS8_Ocl7mMig',
 'global', 'agriculture', 'agri_feed', null),
('agfunder-news', 'agfunder', 'rss', 'https://agfundernews.com/feed', null,
 'global', 'farm-tech', 'agri_feed', null),
('agfunder-youtube', 'agfunder', 'youtube_channel',
 'https://www.youtube.com/feeds/videos.xml?channel_id=UCw5Krey0jFXjh6mgL-AxfJQ', 'UCw5Krey0jFXjh6mgL-AxfJQ',
 'global', 'farm-tech', 'agri_feed', null),
('ifpri-youtube', 'ifpri', 'youtube_channel',
 'https://www.youtube.com/feeds/videos.xml?channel_id=UC28QAYHj0clfOvMMmR6kYGA', 'UC28QAYHj0clfOvMMmR6kYGA',
 'global', 'agriculture', 'agri_feed', null),
('unep-youtube', 'unep', 'youtube_channel',
 'https://www.youtube.com/feeds/videos.xml?channel_id=UC9V3x9HelwEk3Z6EknB_1Cg', 'UC9V3x9HelwEk3Z6EknB_1Cg',
 'global', 'agriculture', 'keyword_filter', 'Environment-wide channel: only videos that match the agriculture keywords.');
