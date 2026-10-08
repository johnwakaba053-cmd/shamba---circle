-- News: automatic publishing of clear-cut imported stories.
--
-- The importer (src/lib/newsIngest, mode "auto") decides which new drafts
-- are clear-cut -- relevance, duplicate, age and safety checks -- and
-- calls this for each one. Anything questionable is never passed here and
-- stays a draft for an admin.
--
-- auto_publish_news_draft only ever publishes an IMPORTED DRAFT (one that
-- came from a feed, with its source time, link and external_ref), and it
-- runs the same readiness check as an admin's publish
-- (assert_news_article_ready: a video needs its video, the summary must
-- not copy the publisher's text). Source, original link and media rules
-- are untouched: the story is published exactly as imported.
--
-- published_at is the publisher's own time (never later than now), so the
-- feed's order and "2 hours ago" reflect when the story actually broke.
-- The audit log records it as an automatic publish (no actor).
--
-- Service role only: the importer runs server-side with the service-role
-- key; no reader or admin session can call it.

create function public.auto_publish_news_draft(p_article_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_imported boolean;
  v_source_at timestamptz;
  v_at timestamptz;
begin
  select status,
         import_feed_id is not null and external_ref is not null and source_published_at is not null,
         source_published_at
  into v_status, v_imported, v_source_at
  from public.news_articles
  where id = p_article_id
  for update;

  if not found then
    raise exception 'news_article_not_found' using errcode = 'P0002';
  end if;
  if not v_imported then
    raise exception 'news_article_not_imported' using errcode = '22023';
  end if;
  if v_status <> 'draft' then
    raise exception 'news_article_not_draft' using errcode = '22023';
  end if;

  perform public.assert_news_article_ready(p_article_id);

  v_at := least(v_source_at, now());

  update public.news_articles
  set status = 'published',
      published_at = v_at,
      updated_by = null
  where id = p_article_id;

  insert into public.news_audit_events (article_id, action, actor_profile_id, details)
  values (p_article_id, 'published', null, jsonb_build_object('published_at', v_at, 'automatic', true));
end;
$$;

revoke all on function public.auto_publish_news_draft(uuid) from public;
revoke execute on function public.auto_publish_news_draft(uuid) from anon;
revoke execute on function public.auto_publish_news_draft(uuid) from authenticated;
grant execute on function public.auto_publish_news_draft(uuid) to service_role;
