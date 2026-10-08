-- News N2: admin publishing functions and audit log (database only).
--
-- Admins write news_articles only through the functions below -- the
-- same model as the Experts review functions: each is SECURITY DEFINER,
-- refuses anyone who isn't is_admin() with 'not_authorized' (42501), and
-- records a news_audit_events row. The tables themselves still grant no
-- INSERT/UPDATE/DELETE to anon or authenticated (N1).
--
--   admin_save_news_article      create a draft (p_article_id null) or
--                                edit an existing article's content
--   admin_publish_news_article   publish now, or schedule with a future
--                                p_published_at
--   admin_unpublish_news_article back to draft (hidden)
--   admin_archive_news_article   archived (hidden, kept for the record)
--   admin_set_news_featured      feature / unfeature, with a rank
--
-- Saving never changes status, so editing a published article updates
-- it in place. Unpublishing and archiving also clear featured, so a
-- hidden story never comes back featured by surprise.
--
-- Fixed error messages: 'not_authorized' (42501),
-- 'news_article_not_found' (P0002), 'news_article_not_published'
-- (P0001). Bad field values fail on N1's check constraints (23514), a
-- duplicate slug on its unique constraint (23505), an unknown category /
-- source / county on its foreign key (23503).
--
-- Nothing in N1 changes.

-- === audit log (admins only) =================================================

create table public.news_audit_events (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.news_articles (id) on delete cascade,
  action text not null check (action in (
    'created', 'updated', 'published', 'scheduled', 'unpublished',
    'archived', 'featured', 'unfeatured'
  )),
  actor_profile_id uuid references public.profiles (id) on delete set null,
  -- Small facts about the change, e.g. published_at or featured_rank.
  details jsonb,
  created_at timestamptz not null default now()
);

create index news_audit_events_article_idx on public.news_audit_events (article_id, created_at);
create index news_audit_events_actor_idx on public.news_audit_events (actor_profile_id);

alter table public.news_audit_events enable row level security;

revoke all on public.news_audit_events from anon, authenticated;
grant select on public.news_audit_events to authenticated;

create policy "Admins can view news audit events"
on public.news_audit_events
for select
to authenticated
using ((select public.is_admin()));

-- === write functions =========================================================

-- Text inputs are trimmed and blank becomes null, so the UI can send
-- form values as they are.
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
  p_cover_image_credit text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if p_article_id is null then
    insert into public.news_articles (
      slug, category_id, region, county_id, title, summary, body, origin,
      source_id, external_url, cover_image_path, cover_image_alt,
      cover_image_credit, status, created_by, updated_by
    )
    values (
      lower(btrim(p_slug)), p_category_id, p_region, nullif(btrim(p_county_id), ''),
      btrim(p_title), btrim(p_summary), nullif(btrim(p_body), ''), p_origin,
      nullif(btrim(p_source_id), ''), nullif(btrim(p_external_url), ''),
      nullif(btrim(p_cover_image_path), ''), nullif(btrim(p_cover_image_alt), ''),
      nullif(btrim(p_cover_image_credit), ''), 'draft', auth.uid(), auth.uid()
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
        updated_by = auth.uid()
    where id = p_article_id
    returning id into v_id;

    if v_id is null then
      raise exception 'news_article_not_found' using errcode = 'P0002';
    end if;

    insert into public.news_audit_events (article_id, action, actor_profile_id)
    values (v_id, 'updated', auth.uid());
  end if;

  return v_id;
end;
$$;

-- Publish now (p_published_at null) or schedule (a future time). Works
-- from any status, so it also re-publishes an unpublished or archived
-- article, or moves a scheduled one.
create function public.admin_publish_news_article(
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

  update public.news_articles
  set status = 'published',
      published_at = v_at,
      updated_by = auth.uid()
  where id = p_article_id;

  if not found then
    raise exception 'news_article_not_found' using errcode = 'P0002';
  end if;

  insert into public.news_audit_events (article_id, action, actor_profile_id, details)
  values (
    p_article_id,
    case when v_at > now() then 'scheduled' else 'published' end,
    auth.uid(),
    jsonb_build_object('published_at', v_at)
  );
end;
$$;

create function public.admin_unpublish_news_article(p_article_id uuid)
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

  update public.news_articles
  set status = 'draft',
      published_at = null,
      is_featured = false,
      featured_rank = null,
      updated_by = auth.uid()
  where id = p_article_id;

  if not found then
    raise exception 'news_article_not_found' using errcode = 'P0002';
  end if;

  insert into public.news_audit_events (article_id, action, actor_profile_id)
  values (p_article_id, 'unpublished', auth.uid());
end;
$$;

-- published_at is kept, as the record of when it ran.
create function public.admin_archive_news_article(p_article_id uuid)
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

  update public.news_articles
  set status = 'archived',
      is_featured = false,
      featured_rank = null,
      updated_by = auth.uid()
  where id = p_article_id;

  if not found then
    raise exception 'news_article_not_found' using errcode = 'P0002';
  end if;

  insert into public.news_audit_events (article_id, action, actor_profile_id)
  values (p_article_id, 'archived', auth.uid());
end;
$$;

-- Only a published (or scheduled) article can be featured. Unfeaturing
-- always clears the rank. A lower rank shows first; several articles
-- may share a rank (published_at breaks the tie).
create function public.admin_set_news_featured(
  p_article_id uuid,
  p_is_featured boolean,
  p_featured_rank smallint default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select status into v_status from public.news_articles where id = p_article_id for update;
  if not found then
    raise exception 'news_article_not_found' using errcode = 'P0002';
  end if;

  if coalesce(p_is_featured, false) and v_status <> 'published' then
    raise exception 'news_article_not_published' using errcode = 'P0001', detail = v_status;
  end if;

  update public.news_articles
  set is_featured = coalesce(p_is_featured, false),
      featured_rank = case when coalesce(p_is_featured, false) then p_featured_rank end,
      updated_by = auth.uid()
  where id = p_article_id;

  insert into public.news_audit_events (article_id, action, actor_profile_id, details)
  values (
    p_article_id,
    case when coalesce(p_is_featured, false) then 'featured' else 'unfeatured' end,
    auth.uid(),
    case when coalesce(p_is_featured, false) then jsonb_build_object('featured_rank', p_featured_rank) end
  );
end;
$$;

-- Same explicit revoke/grant sequence as every function in this project.
revoke all on function public.admin_save_news_article(uuid, text, text, text, text, text, text, text, text, text, text, text, text, text) from public;
revoke execute on function public.admin_save_news_article(uuid, text, text, text, text, text, text, text, text, text, text, text, text, text) from anon;
grant execute on function public.admin_save_news_article(uuid, text, text, text, text, text, text, text, text, text, text, text, text, text) to authenticated;

revoke all on function public.admin_publish_news_article(uuid, timestamptz) from public;
revoke execute on function public.admin_publish_news_article(uuid, timestamptz) from anon;
grant execute on function public.admin_publish_news_article(uuid, timestamptz) to authenticated;

revoke all on function public.admin_unpublish_news_article(uuid) from public;
revoke execute on function public.admin_unpublish_news_article(uuid) from anon;
grant execute on function public.admin_unpublish_news_article(uuid) to authenticated;

revoke all on function public.admin_archive_news_article(uuid) from public;
revoke execute on function public.admin_archive_news_article(uuid) from anon;
grant execute on function public.admin_archive_news_article(uuid) to authenticated;

revoke all on function public.admin_set_news_featured(uuid, boolean, smallint) from public;
revoke execute on function public.admin_set_news_featured(uuid, boolean, smallint) from anon;
grant execute on function public.admin_set_news_featured(uuid, boolean, smallint) to authenticated;
