-- Education 2.1: Source & Resource-Type Foundation.
--
-- This batch adds the schema needed to eventually support a Learning
-- Library (PDF documents) and Watch & Learn (videos) without touching
-- any of the 21 existing resources' content, titles, summaries, topic
-- mappings or learning categories, and without building any content,
-- upload, or search functionality yet -- see the accompanying audit for
-- what's deliberately deferred.

-- === education_sources ======================================================
--
-- A small lookup table for recurring source organizations (KALRO, FAO,
-- Shamba Space itself, ...), same shape and same reasoning as
-- education_categories/education_topics: a free-text source_name per
-- resource doesn't scale past a handful of rows and can't be corrected
-- in one place. Existing education_resources.source_name/source_url
-- columns are untouched and remain the legacy path for resources that
-- don't reference a source_id.
create table public.education_sources (
  id text primary key,
  name text not null,
  url text,
  created_at timestamptz not null default now()
);

alter table public.education_sources enable row level security;

create policy "Authenticated users can view education sources"
on public.education_sources
for select
to authenticated
using (true);

-- Seed only the two source organizations already represented by the
-- existing 21 resources' source_name values -- nothing invented.
insert into public.education_sources (id, name, url) values
  ('shamba-circle-editorial-team', 'Shamba Circle Editorial Team', null),
  ('fao', 'Food and Agriculture Organization of the United Nations (FAO)', 'https://www.fao.org');

-- === education_resources: resource type + rights-aware fields ==============
--
-- resource_type defaults to 'article' so all 21 existing resources stay
-- valid with zero backfill -- they are, in fact, all articles today.
--
-- origin is the legally load-bearing field for the future Learning
-- Library: it distinguishes content that must stay linked to its
-- original host (external_linked) from content Shamba Space is
-- permitted to re-host (external_redistributable) and content Shamba
-- Space authored itself (shamba_original). It is deliberately left NULL
-- for every existing resource -- none of their licences were verified,
-- so nothing is asserted about them.
--
-- source_id coexists with the legacy source_name/source_url columns
-- rather than replacing them; external_url/storage_path/is_downloadable
-- are the minimum fields the three origin cases need (see the audit's
-- CASE A/B/C table); youtube_url/thumbnail_url/duration_seconds/
-- video_published_at/language are the minimum future-video fields
-- identified by the audit, added now only as always-NULL columns so a
-- later video batch is a pure UPDATE, not another migration.
alter table public.education_resources
  add column resource_type text not null default 'article' check (
    resource_type in ('article', 'document', 'video')
  ),
  add column origin text check (
    origin in ('external_linked', 'external_redistributable', 'shamba_original')
  ),
  add column source_id text references public.education_sources (id),
  add column external_url text,
  add column storage_path text,
  add column is_downloadable boolean not null default false,
  add column youtube_url text,
  add column thumbnail_url text,
  add column duration_seconds integer,
  add column video_published_at timestamptz,
  add column language text;

create index education_resources_source_id_idx on public.education_resources (source_id);

-- Backfill source_id only where the existing source_name is an exact,
-- unambiguous match to one of the two seeded sources -- no guessing, no
-- change to source_name/source_url themselves.
update public.education_resources
set source_id = 'shamba-circle-editorial-team'
where source_name = 'Shamba Circle Editorial Team';

update public.education_resources
set source_id = 'fao'
where source_name = 'Food and Agriculture Organization of the United Nations (FAO)';

-- === education-documents storage ============================================
--
-- A dedicated, private bucket for curated PDF guides -- never shared
-- with listing-media/post-media/story-media, which are user-upload
-- buckets with per-owner path-based RLS that doesn't apply here: this
-- bucket has no per-user ownership concept at all, only platform-curated
-- content, so its own policy set is deliberately minimal.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'education-documents',
  'education-documents',
  false,
  20971520, -- 20MB: generous for a text/image agricultural PDF guide, well under the 100MB video buckets
  array['application/pdf']
);

-- Mirrors education_resources' own "authenticated users can read" model
-- (no per-user scoping, since nothing here is owned by an individual
-- user). Deliberately no INSERT/UPDATE/DELETE policy -- there is no
-- admin/content-management system yet, so uploads happen only through a
-- migration or the Supabase dashboard, exactly like education_resources
-- rows themselves.
create policy "Authenticated users can read education documents"
on storage.objects
for select
to authenticated
using (bucket_id = 'education-documents');
