-- News N6c: importing live feed items as DRAFT articles (database only).
--
-- The importer (service role) turns each verified N6b candidate into a
-- draft news_articles row through import_news_draft(): origin
-- external_linked (no body; the original link is required), status
-- draft, never published here. A YouTube candidate becomes a format
-- 'video' draft with its official embed in news_media (N4), so it can
-- only ever be shown through YouTube's player.
--
-- New on news_articles:
--   source_published_at  when the publisher released it -- shown to
--                        readers later, so public like other card columns
--   imported_at,         when and from which feed it was imported
--   import_feed_id
--   source_excerpt       the feed's own description: the publisher's
--                        words, kept for admin review only (hidden from
--                        the API by column grants, like created_by)
--   relevance_score,     why the importer judged it about farming
--   relevance_terms
--
-- Copyright rule, enforced when anything is published (and kept while
-- published): an imported story's summary must not be the source excerpt
-- or a long piece of it ('news_summary_needs_rewrite'). The importer
-- writes a short original summary; admins can rewrite it before
-- publishing.
--
-- Nothing is published, scheduled or archived by this migration, and the
-- 5 existing articles are unchanged.

-- === articles: import columns ===============================================

alter table public.news_articles
  add column source_published_at timestamptz,
  add column imported_at timestamptz,
  add column import_feed_id text references public.news_feeds (id) on delete set null,
  add column source_excerpt text check (source_excerpt is null or char_length(source_excerpt) <= 2000),
  add column relevance_score smallint check (relevance_score is null or relevance_score between 0 and 100),
  add column relevance_terms text[] check (relevance_terms is null or cardinality(relevance_terms) <= 20),
  -- An imported story is always a linked one, with its identity, import
  -- time and publisher time recorded.
  add constraint news_articles_import_shape check (
    import_feed_id is null
    or (origin = 'external_linked' and external_ref is not null
        and imported_at is not null and source_published_at is not null)
  );

create index news_articles_import_feed_idx on public.news_articles (import_feed_id);
create index news_articles_imported_drafts_idx
  on public.news_articles (imported_at desc) where status = 'draft' and imported_at is not null;

-- Readers will see when the publisher released a story; everything else
-- about the import stays internal.
grant select (source_published_at) on public.news_articles to anon, authenticated;

-- === readiness: imported summaries must be our own ==========================

-- N4's readiness check plus one rule: an imported story's summary may not
-- be its source excerpt, or a 40+ character piece of it (compared
-- ignoring case, spacing and punctuation).
-- New fixed message: 'news_summary_needs_rewrite' (22023).
create or replace function public.assert_news_article_ready(p_article_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_format text;
  v_summary text;
  v_excerpt text;
  v_images int;
  v_videos int;
  v_prices int;
begin
  select format,
         btrim(regexp_replace(lower(summary), '[^[:alnum:]]+', ' ', 'g')),
         btrim(regexp_replace(lower(coalesce(source_excerpt, '')), '[^[:alnum:]]+', ' ', 'g'))
  into v_format, v_summary, v_excerpt
  from public.news_articles where id = p_article_id;

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

  if v_excerpt <> '' and (
    v_summary = v_excerpt
    or (char_length(v_summary) >= 40 and position(v_summary in v_excerpt) > 0)
  ) then
    raise exception 'news_summary_needs_rewrite' using errcode = '22023';
  end if;
end;
$$;

-- === draft import (service role only) =======================================

-- Creates one imported draft, or returns null if that story was already
-- imported (same external_ref). Video drafts get their YouTube embed in
-- the same transaction. Only the importer (service role) can call it.
-- Fixed messages: 'news_feed_not_found' (P0002), 'news_import_invalid'
-- (22023; DETAIL 'video_needs_youtube_feed', 'video_not_permitted',
-- 'invalid_video_id'). Other bad values fail on the table constraints.
create function public.import_news_draft(
  p_feed_id text,
  p_external_ref text,
  p_slug text,
  p_title text,
  p_summary text,
  p_source_excerpt text,
  p_external_url text,
  p_region text,
  p_category_id text,
  p_format text,
  p_source_published_at timestamptz,
  p_relevance_score integer,
  p_relevance_terms text[],
  p_youtube_video_id text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_feed public.news_feeds%rowtype;
  v_video_policy text;
  v_id uuid;
begin
  select * into v_feed from public.news_feeds where id = p_feed_id and is_active;
  if not found then
    raise exception 'news_feed_not_found' using errcode = 'P0002';
  end if;

  if p_format = 'video' then
    if v_feed.kind <> 'youtube_channel' then
      raise exception 'news_import_invalid' using errcode = '22023', detail = 'video_needs_youtube_feed';
    end if;
    select video_policy into v_video_policy from public.news_sources where id = v_feed.source_id;
    if v_video_policy <> 'youtube_embed' then
      raise exception 'news_import_invalid' using errcode = '22023', detail = 'video_not_permitted';
    end if;
    if p_youtube_video_id is null or p_youtube_video_id !~ '^[A-Za-z0-9_-]{6,20}$' then
      raise exception 'news_import_invalid' using errcode = '22023', detail = 'invalid_video_id';
    end if;
  end if;

  insert into public.news_articles (
    slug, category_id, region, title, summary, body, origin, source_id, external_url,
    format, status, external_ref, source_published_at, imported_at, import_feed_id,
    source_excerpt, relevance_score, relevance_terms
  )
  values (
    p_slug, p_category_id, p_region, btrim(p_title), btrim(p_summary), null, 'external_linked',
    v_feed.source_id, p_external_url, coalesce(p_format, 'article'), 'draft', p_external_ref,
    p_source_published_at, now(), v_feed.id, nullif(btrim(p_source_excerpt), ''),
    p_relevance_score, p_relevance_terms
  )
  on conflict (external_ref) where external_ref is not null do nothing
  returning id into v_id;

  if v_id is null then
    return null;
  end if;

  if p_format = 'video' then
    insert into public.news_media (article_id, kind, embed_provider, embed_id, sort_order)
    values (v_id, 'video_embed', 'youtube', p_youtube_video_id, 0);
  end if;

  insert into public.news_audit_events (article_id, action, actor_profile_id, details)
  values (v_id, 'created', null, jsonb_build_object('imported_from_feed', v_feed.id, 'external_ref', p_external_ref));

  return v_id;
end;
$$;

revoke all on function public.import_news_draft(text, text, text, text, text, text, text, text, text, text, timestamptz, integer, text[], text) from public;
revoke execute on function public.import_news_draft(text, text, text, text, text, text, text, text, text, text, timestamptz, integer, text[], text) from anon;
revoke execute on function public.import_news_draft(text, text, text, text, text, text, text, text, text, text, timestamptz, integer, text[], text) from authenticated;
grant execute on function public.import_news_draft(text, text, text, text, text, text, text, text, text, text, timestamptz, integer, text[], text) to service_role;
