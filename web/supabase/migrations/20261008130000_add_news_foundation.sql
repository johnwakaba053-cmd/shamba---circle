-- News N1: Agriculture Today foundation (database only).
--
-- Platform-curated farming news, shaped after education_resources but
-- with three differences:
--  * Published news is PUBLIC: anon can read it as well as signed-in
--    users, so stories can be shared and read before sign-in. Every
--    other table in this project is signed-in only; nothing else changes
--    here.
--  * Region (kenya / africa / global) is its own column, separate from
--    the topic category, so a story can be both "Kenya" and "Farm Tech".
--  * Cover images live in a PUBLIC 'news-media' bucket, so share previews
--    (WhatsApp, Facebook) and caching work without expiring signed URLs.
--    It is the project's only public bucket; all user uploads stay in
--    private buckets.
--
-- Publishing is derived at read time, like alerts' "active": an article
-- is visible when status = 'published', published_at has passed and
-- expires_at (if any) hasn't. "Scheduled" is just a published article
-- with a future published_at -- there is no job to flip it.
--
-- Writes: nobody writes these tables directly from the API -- no
-- INSERT/UPDATE/DELETE grant or policy for anon or authenticated. Admin
-- create/edit/publish comes in a later step through is_admin()-checked
-- functions; until then content is added by migration, as here.
--
-- Hidden from the API: created_by, updated_by and external_ref (column
-- grants below), so who wrote an article and any import ids never leave
-- the database.
--
-- "Trending" for the top of /news is editorial for now: is_featured +
-- featured_rank. There is no view counting.

-- === reference data ==========================================================

create table public.news_categories (
  id text primary key check (id ~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*$'),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  sort_order integer not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.news_categories (id, name, sort_order) values
  ('agriculture', 'Agriculture', 10),
  ('markets-prices', 'Markets & Prices', 20),
  ('agri-stocks', 'Agri Stocks', 30),
  ('farm-tech', 'Farm Tech', 40),
  ('ai-innovation', 'AI & Innovation', 50);

create table public.news_sources (
  id text primary key check (id ~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*$'),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  url text check (url is null or url ~ '^https://[^\s]+$'),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.news_sources (id, name, url) values
  ('shamba-space', 'Shamba Space Editorial', null);

-- === articles ================================================================

create table public.news_articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    check (char_length(slug) <= 120 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  category_id text not null references public.news_categories (id),
  region text not null check (region in ('kenya', 'africa', 'global')),
  -- Optional, for local Kenyan stories only.
  county_id text references public.counties (id),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  summary text not null check (char_length(btrim(summary)) between 1 and 500),
  -- Plain text; blank lines separate paragraphs and "## " starts a
  -- heading, the same light format education_resources.content uses.
  -- Never rendered as HTML.
  body text check (body is null or char_length(btrim(body)) between 1 and 50000),
  -- Same rights vocabulary as education_resources.origin.
  origin text not null
    check (origin in ('external_linked', 'external_redistributable', 'shamba_original')),
  source_id text references public.news_sources (id),
  external_url text check (external_url is null or external_url ~ '^https://[^\s]+$'),
  -- Object path inside the public 'news-media' bucket, e.g.
  -- '<article uuid>/cover.webp'.
  cover_image_path text check (
    cover_image_path is null
    or (char_length(cover_image_path) <= 300
        and cover_image_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[A-Za-z0-9._-]+$'
        and cover_image_path !~ '\.\.')
  ),
  cover_image_alt text check (cover_image_alt is null or char_length(btrim(cover_image_alt)) between 1 and 300),
  cover_image_credit text check (cover_image_credit is null or char_length(btrim(cover_image_credit)) between 1 and 200),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  is_featured boolean not null default false,
  featured_rank smallint check (featured_rank between 1 and 100),
  published_at timestamptz,
  expires_at timestamptz,
  -- Dedupe key for a future import job; unique only when present.
  external_ref text check (external_ref is null or char_length(external_ref) between 1 and 300),
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Someone else's article is linked to, never copied: no body, and a
  -- link is required.
  constraint news_articles_external_linked_no_body
    check (origin <> 'external_linked' or (body is null and external_url is not null)),
  -- Anything we host in full needs a body.
  constraint news_articles_hosted_needs_body
    check (origin = 'external_linked' or body is not null),
  constraint news_articles_county_only_in_kenya
    check (county_id is null or region = 'kenya'),
  constraint news_articles_rank_only_when_featured
    check (featured_rank is null or is_featured),
  constraint news_articles_published_needs_date
    check (status <> 'published' or published_at is not null),
  constraint news_articles_expires_after_publish
    check (expires_at is null or published_at is null or expires_at > published_at)
);

create unique index news_articles_external_ref_key
  on public.news_articles (external_ref) where external_ref is not null;

create index news_articles_published_idx
  on public.news_articles (published_at desc) where status = 'published';
create index news_articles_category_published_idx
  on public.news_articles (category_id, published_at desc) where status = 'published';
create index news_articles_region_published_idx
  on public.news_articles (region, published_at desc) where status = 'published';
create index news_articles_featured_idx
  on public.news_articles (featured_rank, published_at desc)
  where status = 'published' and is_featured;
create index news_articles_source_id_idx on public.news_articles (source_id);
create index news_articles_county_id_idx on public.news_articles (county_id);
create index news_articles_created_by_idx on public.news_articles (created_by);
create index news_articles_updated_by_idx on public.news_articles (updated_by);

create function public.set_news_articles_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.set_news_articles_updated_at() from public;
revoke execute on function public.set_news_articles_updated_at() from anon;
revoke execute on function public.set_news_articles_updated_at() from authenticated;

create trigger news_articles_set_updated_at
before update on public.news_articles
for each row execute function public.set_news_articles_updated_at();

-- === access ==================================================================

alter table public.news_categories enable row level security;
alter table public.news_sources enable row level security;
alter table public.news_articles enable row level security;

-- Reset Supabase's default grants, then give back read access only.
revoke all on public.news_categories from anon, authenticated;
revoke all on public.news_sources from anon, authenticated;
revoke all on public.news_articles from anon, authenticated;

grant select on public.news_categories to anon, authenticated;
grant select on public.news_sources to anon, authenticated;

-- Column grants: everything a reader or the admin list needs, except
-- created_by, updated_by and external_ref. Queries must name their
-- columns (select=* is refused), which is how this app already queries.
grant select (
  id, slug, category_id, region, county_id, title, summary, body, origin,
  source_id, external_url, cover_image_path, cover_image_alt,
  cover_image_credit, status, is_featured, featured_rank, published_at,
  expires_at, created_at, updated_at
) on public.news_articles to anon, authenticated;

create policy "Anyone can view news categories"
on public.news_categories
for select
to anon, authenticated
using (true);

create policy "Anyone can view news sources"
on public.news_sources
for select
to anon, authenticated
using (true);

create policy "Anyone can view published news articles"
on public.news_articles
for select
to anon, authenticated
using (
  status = 'published'
  and published_at <= now()
  and (expires_at is null or expires_at > now())
);

-- Drafts, scheduled and archived articles: admins only.
create policy "Admins can view all news articles"
on public.news_articles
for select
to authenticated
using ((select public.is_admin()));

-- === cover images ============================================================

-- Public bucket: anyone with an object's URL can fetch it, which is what
-- share previews need. Files sit under a random article id, so a draft's
-- cover can't be found without its URL. No SELECT policy for anon or
-- non-admins, so the bucket can't be listed through the API.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'news-media',
  'news-media',
  true,
  5242880, -- 5MB, same as avatars: a cover photo, not a gallery
  array['image/jpeg', 'image/png', 'image/webp']
);

create policy "Admins can upload news media"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'news-media'
  and (select public.is_admin())
  and (storage.foldername(objects.name))[1]
    ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
);

-- Storage reads the object before replacing or deleting it, so admins
-- need SELECT as well.
create policy "Admins can view news media objects"
on storage.objects
for select
to authenticated
using (bucket_id = 'news-media' and (select public.is_admin()));

create policy "Admins can replace news media"
on storage.objects
for update
to authenticated
using (bucket_id = 'news-media' and (select public.is_admin()))
with check (
  bucket_id = 'news-media'
  and (select public.is_admin())
  and (storage.foldername(objects.name))[1]
    ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
);

create policy "Admins can delete news media"
on storage.objects
for delete
to authenticated
using (bucket_id = 'news-media' and (select public.is_admin()));

-- === seed articles ===========================================================

-- Evergreen Shamba Space explainers -- not dated news events and not
-- attributed to any outside publisher -- so /news has real content to
-- build against. No cover images yet.
insert into public.news_articles
  (slug, category_id, region, title, summary, body, origin, source_id,
   status, is_featured, featured_rank, published_at)
values
(
  'welcome-to-agriculture-today',
  'agriculture',
  'kenya',
  'Welcome to Agriculture Today',
  'Farming news for Kenya, Africa and the world, in one place on Shamba Space.',
  'Agriculture Today is the news section of Shamba Space. It brings together farming stories that matter to growers and livestock keepers, from your county to the wider world.

## What you will find here

Stories are grouped by region -- Kenya, Africa and Global -- and by topic: general agriculture, markets and prices, agriculture stocks, farm technology, and AI and innovation. Featured stories are chosen by the Shamba Space team and appear at the top of the page.

## Where stories come from

Some articles are written by the Shamba Space team. Others are short summaries of reporting by other publishers, with a link to read the full story on their site. Each article shows its source.

## Taking part

Anyone can read Agriculture Today. Sign in to discuss stories with other farmers in Communities, check market prices and get weather alerts for your area.',
  'shamba_original',
  'shamba-space',
  'published',
  true,
  1,
  now()
),
(
  'how-to-read-market-prices',
  'markets-prices',
  'kenya',
  'How to read market prices before you sell',
  'Wholesale and retail prices tell you different things. Here is how to use both when deciding where and when to sell.',
  'Market price reports usually show two numbers for the same product: a wholesale price and a retail price. Knowing the difference helps you judge an offer from a buyer.

## Wholesale and retail

The wholesale price is what traders pay in bulk at a market. The retail price is what a shopper pays for a smaller amount. A farmer selling a full harvest to a trader is usually closer to the wholesale price.

## Compare markets, not just days

Prices for the same crop can differ a lot between markets on the same day, because of transport costs and local supply. Comparing a few nearby markets shows whether a long trip is worth it.

## Look at the trend

A single day''s price can be misleading. A price that has been rising for several weeks tells you more than one high or low reading. Shamba Space Market Prices shows recent history for each product so you can see the direction prices are moving.

Prices are a guide, not a promise. Always confirm with buyers before you transport produce.',
  'shamba_original',
  'shamba-space',
  'published',
  true,
  2,
  now()
),
(
  'understanding-agriculture-stocks',
  'agri-stocks',
  'global',
  'Agriculture stocks explained for farmers',
  'What it means when a farming company is listed on a stock exchange, and why its share price is not a crop price.',
  'Some companies that make seed, fertiliser, machinery or food products sell shares on a stock exchange. Their share price is what investors are willing to pay for a small part of the company.

## Share prices are not crop prices

A rising share price for a fertiliser company does not mean fertiliser is getting cheaper or more expensive in your area. Share prices reflect what investors expect about a company''s future profits, which depend on many things beyond farming.

## Why farmers follow them

Agriculture stocks can hint at wider trends, such as investor confidence in farm inputs or food processing. They are one signal among many, not a forecast for your farm.

This article is general information, not financial advice. Speak to a licensed adviser before buying or selling any investment.',
  'shamba_original',
  'shamba-space',
  'published',
  false,
  null,
  now()
),
(
  'farm-technology-for-smallholders',
  'farm-tech',
  'africa',
  'Farm technology that works for smallholders',
  'Simple tools such as mobile price alerts, drip kits and solar pumps often matter more than expensive machines.',
  'Farm technology is often pictured as large tractors and drones. For most smallholder farms, the most useful technology is smaller and cheaper.

## Information on your phone

Weather alerts, market prices and advice delivered by SMS or app help farmers plan planting, spraying and selling. They need only a basic phone and a network signal.

## Water

Drip irrigation kits and small solar pumps can extend the growing season and use less water than flood irrigation. The right size depends on your water source and plot.

## Start small

Try a new tool on part of the farm first and keep simple records of the results. Your county agricultural extension office can advise on what suits your area.',
  'shamba_original',
  'shamba-space',
  'published',
  false,
  null,
  now()
),
(
  'ai-in-farming-what-to-expect',
  'ai-innovation',
  'global',
  'AI in farming: what to expect',
  'Artificial intelligence is starting to help with pest identification, weather forecasting and advice. Here is what it can and cannot do.',
  'Artificial intelligence (AI) is software that learns patterns from large amounts of data. In farming, it is beginning to appear in tools that farmers can use on a phone.

## Where it helps

AI tools can suggest what pest or disease a leaf photo shows, improve local weather forecasts and answer common farming questions. They work best as a first opinion that you then check.

## Where to be careful

AI can be wrong, especially for crops, pests or conditions it has not seen much data about. Confirm important decisions -- such as which chemical to spray -- with an extension officer, an agro-dealer you trust or a verified expert.

## What comes next

As more farmers share data and results, these tools should become more accurate for local conditions. Agriculture Today will follow new developments as they happen.',
  'shamba_original',
  'shamba-space',
  'published',
  false,
  null,
  now()
);
