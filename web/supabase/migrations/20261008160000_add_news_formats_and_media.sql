-- News N4: story formats, media and market-price links (database only).
--
-- Agriculture Today grows from "one article = cover + text" to four
-- formats, separate from topic (category) and region:
--   article        articles and farming blogs (optional byline)
--   photo_story    an ordered gallery of captioned photos
--   video          one official YouTube embed
--   market_update  an article linked to price products, so the page can
--                  show live Market Prices cards (signed-in only, as now)
-- Innovation stories stay a topic (farm-tech / ai-innovation).
--
-- Media is a new ordered list per article, public.news_media:
--   image        a file in the public 'news-media' bucket under the
--                article's own '<article id>/' folder, with alt text and
--                a credit
--   video_embed  provider 'youtube' + a video ID only -- never a raw URL
--                or embed HTML; the page rebuilds the official
--                youtube-nocookie player from the ID
-- Native video uploads are deliberately not part of this (decided: YouTube
-- embeds only for now).
--
-- Copyright rules, unchanged from N1 and extended to media:
--  * external_linked stories still have no body, and may not host gallery
--    images. They may carry an official YouTube embed (the publisher's
--    own player, not a re-host) -- decided.
--  * Any hosted image needs a credit: every gallery image, and now the
--    cover too (news_articles_cover_needs_credit).
--
-- Format rules are checked when an article is published (and kept true
-- while it stays published):
--   photo_story    at least 2 images
--   video          exactly 1 YouTube embed (and only video stories may
--                  have one)
--   market_update  at least 1 linked price product
--
-- Access follows N1/N2: readers see media and price links only for
-- articles they can see (the policies defer to news_articles' own RLS,
-- so readers get live articles' media and admins get everything);
-- nobody writes directly; admins write through is_admin()-checked
-- functions that log to news_audit_events.
--
-- Existing rows: the 5 published articles become format 'article' with no
-- byline, no media and no price links, and stay exactly as they are.

-- === articles: format, byline, cover credit ==================================

alter table public.news_articles
  add column format text not null default 'article'
    check (format in ('article', 'photo_story', 'video', 'market_update')),
  add column byline text
    check (byline is null or char_length(btrim(byline)) between 1 and 120),
  add constraint news_articles_cover_needs_credit
    check (cover_image_path is null or cover_image_credit is not null);

create index news_articles_format_published_idx
  on public.news_articles (format, published_at desc) where status = 'published';

grant select (format, byline) on public.news_articles to anon, authenticated;

-- === media ===================================================================

create table public.news_media (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.news_articles (id) on delete cascade,
  kind text not null check (kind in ('image', 'video_embed')),
  -- image: '<article id>/<file>' in the public news-media bucket.
  storage_path text check (
    storage_path is null
    or (char_length(storage_path) <= 300
        and storage_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[A-Za-z0-9._-]+$'
        and storage_path !~ '\.\.')
  ),
  -- video_embed: the same ID rule as lib/education.ts YOUTUBE_ID_PATTERN.
  embed_provider text check (embed_provider in ('youtube')),
  embed_id text check (embed_id is null or embed_id ~ '^[A-Za-z0-9_-]{6,20}$'),
  alt text check (alt is null or char_length(btrim(alt)) between 1 and 300),
  caption text check (caption is null or char_length(btrim(caption)) between 1 and 500),
  credit text check (credit is null or char_length(btrim(credit)) between 1 and 200),
  sort_order integer not null default 0 check (sort_order between 0 and 1000),
  width integer check (width is null or width between 1 and 20000),
  height integer check (height is null or height between 1 and 20000),
  duration_seconds integer check (duration_seconds is null or duration_seconds between 1 and 86400),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint news_media_image_shape check (
    kind <> 'image'
    or (storage_path is not null and alt is not null and credit is not null
        and embed_provider is null and embed_id is null and duration_seconds is null)
  ),
  constraint news_media_video_embed_shape check (
    kind <> 'video_embed'
    or (embed_provider is not null and embed_id is not null
        and storage_path is null and width is null and height is null)
  ),
  -- An image can only live in its own article's folder.
  constraint news_media_path_in_article_folder check (
    storage_path is null or split_part(storage_path, '/', 1) = article_id::text
  )
);

create index news_media_article_idx on public.news_media (article_id, sort_order, created_at);

create function public.set_news_media_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.set_news_media_updated_at() from public;
revoke execute on function public.set_news_media_updated_at() from anon;
revoke execute on function public.set_news_media_updated_at() from authenticated;

create trigger news_media_set_updated_at
before update on public.news_media
for each row execute function public.set_news_media_updated_at();

-- === market-price links ======================================================

create table public.news_article_price_products (
  article_id uuid not null references public.news_articles (id) on delete cascade,
  product_id text not null references public.agricultural_price_products (id),
  sort_order integer not null default 0 check (sort_order between 0 and 100),
  created_at timestamptz not null default now(),
  primary key (article_id, product_id)
);

create index news_article_price_products_product_idx on public.news_article_price_products (product_id);

-- === access ==================================================================

alter table public.news_media enable row level security;
alter table public.news_article_price_products enable row level security;

revoke all on public.news_media from anon, authenticated;
revoke all on public.news_article_price_products from anon, authenticated;
grant select on public.news_media to anon, authenticated;
grant select on public.news_article_price_products to anon, authenticated;

-- The subquery runs under news_articles' own RLS for the caller: readers
-- see only live articles there (so only their media), admins see all.
create policy "Anyone can view media of articles they can see"
on public.news_media
for select
to anon, authenticated
using (exists (select 1 from public.news_articles a where a.id = news_media.article_id));

-- Product ids only. Names and prices stay in the signed-in-only Market
-- Prices tables (decided), so signed-out readers get a sign-in prompt.
create policy "Anyone can view price links of articles they can see"
on public.news_article_price_products
for select
to anon, authenticated
using (exists (select 1 from public.news_articles a where a.id = news_article_price_products.article_id));

-- === audit actions ===========================================================

alter table public.news_audit_events drop constraint news_audit_events_action_check;
alter table public.news_audit_events add constraint news_audit_events_action_check
  check (action in (
    'created', 'updated', 'published', 'scheduled', 'unpublished',
    'archived', 'featured', 'unfeatured',
    'media_added', 'media_updated', 'media_removed', 'media_reordered',
    'prices_updated'
  ));

-- === format readiness ========================================================

-- Whether an article meets its format's rules. Internal helper for the
-- admin functions below; not callable from the API.
-- Fixed message: 'news_article_incomplete' (22023), with the reason in
-- DETAIL: 'photo_story_needs_2_images', 'video_needs_1_video',
-- 'market_update_needs_prices'.
create function public.assert_news_article_ready(p_article_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_format text;
  v_images int;
  v_videos int;
  v_prices int;
begin
  select format into v_format from public.news_articles where id = p_article_id;

  select count(*) filter (where kind = 'image'), count(*) filter (where kind = 'video_embed')
  into v_images, v_videos
  from public.news_media where article_id = p_article_id;

  select count(*) into v_prices from public.news_article_price_products where article_id = p_article_id;

  if v_format = 'photo_story' and v_images < 2 then
    raise exception 'news_article_incomplete' using errcode = '22023', detail = 'photo_story_needs_2_images';
  elsif v_format = 'video' and v_videos <> 1 then
    raise exception 'news_article_incomplete' using errcode = '22023', detail = 'video_needs_1_video';
  elsif v_format = 'market_update' and v_prices < 1 then
    raise exception 'news_article_incomplete' using errcode = '22023', detail = 'market_update_needs_prices';
  end if;
end;
$$;

revoke all on function public.assert_news_article_ready(uuid) from public;
revoke execute on function public.assert_news_article_ready(uuid) from anon;
revoke execute on function public.assert_news_article_ready(uuid) from authenticated;

-- === save: now with format and byline ========================================

-- The N2 signature gains p_format and p_byline, so it is replaced (no
-- app code calls it yet). Behaviour is otherwise N2's, plus:
--  * a format or origin change can't leave media that breaks the rules
--    ('news_media_conflict', P0001: a non-video story with a YouTube
--    embed, or an external_linked story with gallery images);
--  * a published article must still meet its format's rules.
drop function public.admin_save_news_article(uuid, text, text, text, text, text, text, text, text, text, text, text, text, text);

create function public.admin_save_news_article(
  p_article_id uuid,
  p_slug text,
  p_category_id text,
  p_region text,
  p_title text,
  p_summary text,
  p_origin text,
  p_body text default null,
  p_source_id text default null,
  p_external_url text default null,
  p_county_id text default null,
  p_cover_image_path text default null,
  p_cover_image_alt text default null,
  p_cover_image_credit text default null,
  p_format text default 'article',
  p_byline text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_status text;
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if p_article_id is null then
    insert into public.news_articles (
      slug, category_id, region, county_id, title, summary, body, origin,
      source_id, external_url, cover_image_path, cover_image_alt,
      cover_image_credit, format, byline, status, created_by, updated_by
    )
    values (
      lower(btrim(p_slug)), p_category_id, p_region, nullif(btrim(p_county_id), ''),
      btrim(p_title), btrim(p_summary), nullif(btrim(p_body), ''), p_origin,
      nullif(btrim(p_source_id), ''), nullif(btrim(p_external_url), ''),
      nullif(btrim(p_cover_image_path), ''), nullif(btrim(p_cover_image_alt), ''),
      nullif(btrim(p_cover_image_credit), ''), coalesce(p_format, 'article'),
      nullif(btrim(p_byline), ''), 'draft', auth.uid(), auth.uid()
    )
    returning id into v_id;

    insert into public.news_audit_events (article_id, action, actor_profile_id)
    values (v_id, 'created', auth.uid());
  else
    update public.news_articles
    set slug = lower(btrim(p_slug)),
        category_id = p_category_id,
        region = p_region,
        county_id = nullif(btrim(p_county_id), ''),
        title = btrim(p_title),
        summary = btrim(p_summary),
        body = nullif(btrim(p_body), ''),
        origin = p_origin,
        source_id = nullif(btrim(p_source_id), ''),
        external_url = nullif(btrim(p_external_url), ''),
        cover_image_path = nullif(btrim(p_cover_image_path), ''),
        cover_image_alt = nullif(btrim(p_cover_image_alt), ''),
        cover_image_credit = nullif(btrim(p_cover_image_credit), ''),
        format = coalesce(p_format, 'article'),
        byline = nullif(btrim(p_byline), ''),
        updated_by = auth.uid()
    where id = p_article_id
    returning id, status into v_id, v_status;

    if v_id is null then
      raise exception 'news_article_not_found' using errcode = 'P0002';
    end if;

    if coalesce(p_format, 'article') <> 'video'
       and exists (select 1 from public.news_media where article_id = v_id and kind = 'video_embed') then
      raise exception 'news_media_conflict' using errcode = 'P0001', detail = 'video_embed_needs_video_format';
    end if;

    if p_origin = 'external_linked'
       and exists (select 1 from public.news_media where article_id = v_id and kind = 'image') then
      raise exception 'news_media_conflict' using errcode = 'P0001', detail = 'external_linked_cannot_host_images';
    end if;

    if v_status = 'published' then
      perform public.assert_news_article_ready(v_id);
    end if;

    insert into public.news_audit_events (article_id, action, actor_profile_id)
    values (v_id, 'updated', auth.uid());
  end if;

  return v_id;
end;
$$;

-- === publish: now checks format readiness ====================================

-- Same signature and behaviour as N2, plus the readiness check.
create or replace function public.admin_publish_news_article(
  p_article_id uuid,
  p_published_at timestamptz default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_at timestamptz := coalesce(p_published_at, now());
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if not exists (select 1 from public.news_articles where id = p_article_id) then
    raise exception 'news_article_not_found' using errcode = 'P0002';
  end if;

  perform public.assert_news_article_ready(p_article_id);

  update public.news_articles
  set status = 'published',
      published_at = v_at,
      updated_by = auth.uid()
  where id = p_article_id;

  insert into public.news_audit_events (article_id, action, actor_profile_id, details)
  values (
    p_article_id,
    case when v_at > now() then 'scheduled' else 'published' end,
    auth.uid(),
    jsonb_build_object('published_at', v_at)
  );
end;
$$;

-- === media functions =========================================================

-- Adds one image or YouTube embed at the end of the article's media.
-- image: the file must already be uploaded to news-media under the
-- article's folder. video_embed: pass the video ID the UI extracted with
-- getYouTubeVideoId (lib/education.ts) -- never a URL.
-- Fixed messages: 'news_article_not_found' (P0002),
-- 'news_media_not_allowed' (P0001; DETAIL 'external_linked_cannot_host_images',
-- 'video_embed_needs_video_format', 'video_already_set', 'too_many_images'),
-- 'news_media_file_missing' (P0002).
create function public.admin_add_news_media(
  p_article_id uuid,
  p_kind text,
  p_storage_path text default null,
  p_embed_id text default null,
  p_alt text default null,
  p_caption text default null,
  p_credit text default null,
  p_width integer default null,
  p_height integer default null,
  p_duration_seconds integer default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_article public.news_articles%rowtype;
  v_id uuid;
  v_path text := nullif(btrim(p_storage_path), '');
  v_next int;
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select * into v_article from public.news_articles where id = p_article_id for update;
  if not found then
    raise exception 'news_article_not_found' using errcode = 'P0002';
  end if;

  if p_kind = 'image' then
    if v_article.origin = 'external_linked' then
      raise exception 'news_media_not_allowed' using errcode = 'P0001', detail = 'external_linked_cannot_host_images';
    end if;
    if (select count(*) from public.news_media where article_id = p_article_id and kind = 'image') >= 30 then
      raise exception 'news_media_not_allowed' using errcode = 'P0001', detail = 'too_many_images';
    end if;
    if v_path is null or not exists (
      select 1 from storage.objects where bucket_id = 'news-media' and name = v_path
    ) then
      raise exception 'news_media_file_missing' using errcode = 'P0002';
    end if;
  elsif p_kind = 'video_embed' then
    if v_article.format <> 'video' then
      raise exception 'news_media_not_allowed' using errcode = 'P0001', detail = 'video_embed_needs_video_format';
    end if;
    if exists (select 1 from public.news_media where article_id = p_article_id and kind = 'video_embed') then
      raise exception 'news_media_not_allowed' using errcode = 'P0001', detail = 'video_already_set';
    end if;
  end if;

  select coalesce(max(sort_order) + 1, 0) into v_next from public.news_media where article_id = p_article_id;

  insert into public.news_media (
    article_id, kind, storage_path, embed_provider, embed_id, alt, caption,
    credit, sort_order, width, height, duration_seconds
  )
  values (
    p_article_id, p_kind,
    case when p_kind = 'image' then v_path end,
    case when p_kind = 'video_embed' then 'youtube' end,
    case when p_kind = 'video_embed' then btrim(p_embed_id) end,
    nullif(btrim(p_alt), ''), nullif(btrim(p_caption), ''), nullif(btrim(p_credit), ''),
    least(v_next, 1000), p_width, p_height, p_duration_seconds
  )
  returning id into v_id;

  update public.news_articles set updated_by = auth.uid() where id = p_article_id;

  insert into public.news_audit_events (article_id, action, actor_profile_id, details)
  values (p_article_id, 'media_added', auth.uid(), jsonb_build_object('media_id', v_id, 'kind', p_kind));

  return v_id;
end;
$$;

-- Edits a media item's words: alt text, caption and credit.
-- Fixed message: 'news_media_not_found' (P0002).
create function public.admin_update_news_media(
  p_media_id uuid,
  p_alt text default null,
  p_caption text default null,
  p_credit text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_article_id uuid;
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  update public.news_media
  set alt = nullif(btrim(p_alt), ''),
      caption = nullif(btrim(p_caption), ''),
      credit = nullif(btrim(p_credit), '')
  where id = p_media_id
  returning article_id into v_article_id;

  if v_article_id is null then
    raise exception 'news_media_not_found' using errcode = 'P0002';
  end if;

  update public.news_articles set updated_by = auth.uid() where id = v_article_id;

  insert into public.news_audit_events (article_id, action, actor_profile_id, details)
  values (v_article_id, 'media_updated', auth.uid(), jsonb_build_object('media_id', p_media_id));
end;
$$;

-- Removes one media item and returns its storage path (null for an
-- embed), so the admin server action can delete the file through the
-- Storage API -- Supabase blocks deleting Storage files with SQL. A
-- published article can't drop below its format's rules.
-- Fixed messages: 'news_media_not_found' (P0002), 'news_article_incomplete'.
create function public.admin_remove_news_media(p_media_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_media public.news_media%rowtype;
  v_status text;
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select * into v_media from public.news_media where id = p_media_id;
  if not found then
    raise exception 'news_media_not_found' using errcode = 'P0002';
  end if;

  select status into v_status from public.news_articles where id = v_media.article_id for update;

  delete from public.news_media where id = p_media_id;

  if v_status = 'published' then
    perform public.assert_news_article_ready(v_media.article_id);
  end if;

  update public.news_articles set updated_by = auth.uid() where id = v_media.article_id;

  insert into public.news_audit_events (article_id, action, actor_profile_id, details)
  values (
    v_media.article_id, 'media_removed', auth.uid(),
    jsonb_build_object('media_id', v_media.id, 'kind', v_media.kind, 'storage_path', v_media.storage_path)
  );

  return v_media.storage_path;
end;
$$;

-- Sets the order of an article's media. p_media_ids must list every
-- media item of the article exactly once.
-- Fixed messages: 'news_article_not_found' (P0002),
-- 'news_media_order_mismatch' (22023).
create function public.admin_reorder_news_media(p_article_id uuid, p_media_ids uuid[])
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  perform 1 from public.news_articles where id = p_article_id for update;
  if not found then
    raise exception 'news_article_not_found' using errcode = 'P0002';
  end if;

  if p_media_ids is null
     or cardinality(p_media_ids) <> (select count(*) from public.news_media where article_id = p_article_id)
     or cardinality(p_media_ids) <> (select count(distinct x) from unnest(p_media_ids) as x)
     or exists (
       select 1 from unnest(p_media_ids) as x
       where not exists (select 1 from public.news_media m where m.id = x and m.article_id = p_article_id)
     ) then
    raise exception 'news_media_order_mismatch' using errcode = '22023';
  end if;

  update public.news_media m
  set sort_order = o.position - 1
  from unnest(p_media_ids) with ordinality as o(media_id, position)
  where m.id = o.media_id;

  update public.news_articles set updated_by = auth.uid() where id = p_article_id;

  insert into public.news_audit_events (article_id, action, actor_profile_id)
  values (p_article_id, 'media_reordered', auth.uid());
end;
$$;

-- Replaces the price products linked to an article, in the given order
-- (at most 12). A published market update keeps at least one.
-- Fixed messages: 'news_article_not_found' (P0002),
-- 'news_price_products_invalid' (22023: duplicates or more than 12);
-- an unknown product id fails on the foreign key (23503).
create function public.admin_set_news_price_products(p_article_id uuid, p_product_ids text[])
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_ids text[] := coalesce(p_product_ids, '{}');
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select status into v_status from public.news_articles where id = p_article_id for update;
  if not found then
    raise exception 'news_article_not_found' using errcode = 'P0002';
  end if;

  if cardinality(v_ids) > 12
     or cardinality(v_ids) <> (select count(distinct x) from unnest(v_ids) as x) then
    raise exception 'news_price_products_invalid' using errcode = '22023';
  end if;

  delete from public.news_article_price_products where article_id = p_article_id;

  insert into public.news_article_price_products (article_id, product_id, sort_order)
  select p_article_id, o.product_id, o.position - 1
  from unnest(v_ids) with ordinality as o(product_id, position);

  if v_status = 'published' then
    perform public.assert_news_article_ready(p_article_id);
  end if;

  update public.news_articles set updated_by = auth.uid() where id = p_article_id;

  insert into public.news_audit_events (article_id, action, actor_profile_id, details)
  values (p_article_id, 'prices_updated', auth.uid(), jsonb_build_object('product_ids', to_jsonb(v_ids)));
end;
$$;

-- Same explicit revoke/grant sequence as every function in this project.
revoke all on function public.admin_save_news_article(uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text) from public;
revoke execute on function public.admin_save_news_article(uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text) from anon;
grant execute on function public.admin_save_news_article(uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text) to authenticated;

revoke all on function public.admin_add_news_media(uuid, text, text, text, text, text, text, integer, integer, integer) from public;
revoke execute on function public.admin_add_news_media(uuid, text, text, text, text, text, text, integer, integer, integer) from anon;
grant execute on function public.admin_add_news_media(uuid, text, text, text, text, text, text, integer, integer, integer) to authenticated;

revoke all on function public.admin_update_news_media(uuid, text, text, text) from public;
revoke execute on function public.admin_update_news_media(uuid, text, text, text) from anon;
grant execute on function public.admin_update_news_media(uuid, text, text, text) to authenticated;

revoke all on function public.admin_remove_news_media(uuid) from public;
revoke execute on function public.admin_remove_news_media(uuid) from anon;
grant execute on function public.admin_remove_news_media(uuid) to authenticated;

revoke all on function public.admin_reorder_news_media(uuid, uuid[]) from public;
revoke execute on function public.admin_reorder_news_media(uuid, uuid[]) from anon;
grant execute on function public.admin_reorder_news_media(uuid, uuid[]) to authenticated;

revoke all on function public.admin_set_news_price_products(uuid, text[]) from public;
revoke execute on function public.admin_set_news_price_products(uuid, text[]) from anon;
grant execute on function public.admin_set_news_price_products(uuid, text[]) to authenticated;
