-- Run A: read-only precheck for 20261012120000_add_education_cover_images.sql
--
-- Run in the Supabase SQL editor BEFORE the migration and before the
-- rolled-back verification (Run B). It is one SELECT statement: it reads
-- catalog tables and a few rows and changes nothing -- no inserts, updates,
-- DDL, or functions with side effects. Run it again after Run B (that is
-- Run C): every row must still read PASS, proving Run B left nothing behind.
--
-- Each row shows what the migration and Run B assume, the live value, and
-- PASS / CHECK. Any CHECK: stop and send the output before going further.
--
-- Expected output (all PASS):
--    1 pilot guides found / published / Shamba Space Original   5 / 5 / 5
--    2 pilot guide topics                                        avocado / bees / maize / poultry / rabbits
--    3 cover columns on education_resources                      0
--    4 cover check constraints on education_resources            0
--    5 education-media bucket                                    0
--    6 education-media storage policy                            0
--    7 test phone 19990000998 in auth.users                      0
--    8 Run B's throwaway guide id                                0
--    9 migration 20261012120000 recorded as applied              0
--   10 education_resources: RLS on / write policies              true / 0
--   11 storage.foldername(text) exists                           true
--   12 storage.objects policies without a bucket_id filter       0
with pilot(id) as (
  values
    ('shamba-space-indigenous-chicken-guide'),
    ('shamba-space-rabbits-guide'),
    ('shamba-space-beekeeping-guide'),
    ('shamba-space-avocado-guide'),
    ('shamba-space-maize-guide')
),
checks(n, check_name, expected, actual) as (
  select 1, 'pilot guides found / published / Shamba Space Original', '5 / 5 / 5',
    (select count(*) || ' / ' || count(*) filter (where r.is_published)
            || ' / ' || count(*) filter (where r.origin = 'shamba_original')
     from public.education_resources r join pilot p on p.id = r.id)
  union all
  select 2, 'pilot guide topics', 'avocado / bees / maize / poultry / rabbits',
    (select coalesce(string_agg(r.topic_id, ' / ' order by r.topic_id), '(none)')
     from public.education_resources r join pilot p on p.id = r.id)
  union all
  select 3, 'cover columns on education_resources', '0',
    (select count(*)::text from information_schema.columns
     where table_schema = 'public' and table_name = 'education_resources'
       and column_name in ('cover_image_path', 'cover_thumb_path', 'cover_image_alt',
                           'cover_image_credit', 'cover_image_licence', 'cover_image_source_url'))
  union all
  select 4, 'cover check constraints on education_resources', '0',
    (select count(*)::text from pg_constraint
     where conrelid = 'public.education_resources'::regclass
       and conname in ('education_resources_cover_complete', 'education_resources_cover_in_own_folder'))
  union all
  select 5, 'education-media bucket', '0',
    (select count(*)::text from storage.buckets where id = 'education-media')
  union all
  select 6, 'education-media storage policy', '0',
    (select count(*)::text from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and (policyname = 'Signed-in users can view media of published education resources'
            or coalesce(qual, '') like '%education-media%'
            or coalesce(with_check, '') like '%education-media%'))
  union all
  select 7, 'test phone 19990000998 in auth.users', '0',
    (select count(*)::text from auth.users where phone = '19990000998')
  union all
  select 8, 'Run B''s throwaway guide id', '0',
    (select count(*)::text from public.education_resources where id = 'verify-cover-unpublished-guide')
  union all
  select 9, 'migration 20261012120000 recorded as applied', '0',
    -- The history table exists only if the CLI / MCP has applied migrations;
    -- read it only when it is there.
    case when to_regclass('supabase_migrations.schema_migrations') is null then '0'
         else (xpath('/row/n/text()',
                 query_to_xml('select count(*) as n from supabase_migrations.schema_migrations '
                              || 'where version = ''20261012120000''', false, true, '')))[1]::text
    end
  union all
  select 10, 'education_resources: RLS on / write policies', 'true / 0',
    (select c.relrowsecurity::text || ' / '
            || (select count(*) from pg_policies
                where schemaname = 'public' and tablename = 'education_resources'
                  and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL'))
     from pg_class c where c.oid = 'public.education_resources'::regclass)
  union all
  select 11, 'storage.foldername(text) exists', 'true',
    (to_regprocedure('storage.foldername(text)') is not null)::text
  union all
  select 12, 'storage.objects policies without a bucket_id filter', '0',
    (select count(*)::text from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and coalesce(qual, '') not like '%bucket_id%'
       and coalesce(with_check, '') not like '%bucket_id%')
)
select n as "#", check_name, expected, actual,
       case when actual = expected then 'PASS' else 'CHECK' end as result
from checks
order by n;
