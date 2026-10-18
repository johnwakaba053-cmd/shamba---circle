-- Read-only verification for 20261012130000_set_education_pilot_covers.sql
--
-- One SELECT statement: reads catalog tables, five guides and ten storage
-- rows, and changes nothing. Run it in the Supabase SQL editor:
--
--   Run A, BEFORE the migration: rows 2-6 read CHECK ("not set") and
--     row 7 reads CHECK (0); every other PASS/CHECK row reads PASS.
--     Copy the INFO rows (14-19).
--   Run B: apply the migration.
--   Run C, AFTER the migration: every PASS/CHECK row must read PASS, and
--     the INFO rows 15-19 must be identical to Run A -- proof that the
--     guides' text, publication status and dates did not change.
--
-- Expected values are copied from
-- education-cover-review/prepared/ATTRIBUTION.md and prepared.json.
--
-- Expected output after the migration:
--    1 pilot guides found / published / Shamba Space Original / article   5 / 5 / 5 / 5
--  2-6 cover fields match ATTRIBUTION.md: <guide id>                      match
--    7 cover paths valid and in the guide's own folder                    5
--    8 cover files in bucket (exact path, size, image/webp)              10
--    9 other guides with a cover set                                      0
--   10 cover constraints present / validated                              2 / 2
--   11 education_resources: RLS on / write policies                       true / 0
--   12 education-media: public / size limit / types                       false / 307200 / image/jpeg,image/webp
--   13 education-media storage policies                                   1 SELECT
--   14 migration 20261012130000 recorded as applied                       INFO only
-- 15-19 text fingerprint: <guide id>                                      INFO only
with expected(id, image_path, image_bytes, thumb_path, thumb_bytes, alt, credit, licence, source_url) as (
  values
    ('shamba-space-indigenous-chicken-guide',
     'shamba-space-indigenous-chicken-guide/cover-1280.webp', 283644,
     'shamba-space-indigenous-chicken-guide/cover-640.webp', 109060,
     'Red-brown hens foraging on grass beside a young maize field, with tall trees behind, in Kuria East, Kenya',
     'Elite Jac / Wikimedia Commons (cropped, resized)',
     'cc-by-sa-4.0',
     'https://commons.wikimedia.org/wiki/File:Chickens_feeding_on_grass_in_a_breathtaking_cool_environment_in_rural_Kenya_(Kuria_East).jpg'),
    ('shamba-space-rabbits-guide',
     'shamba-space-rabbits-guide/cover-1280.webp', 107816,
     'shamba-space-rabbits-guide/cover-640.webp', 40594,
     'White and fawn rabbits, with young rabbits behind them, in a wire-mesh hutch with fresh fodder, at a farm in Uganda',
     'Zahara5555 / Wikimedia Commons (cropped, resized)',
     'cc-by-sa-4.0',
     'https://commons.wikimedia.org/wiki/File:A_colony_of_rabbits_in_their_hutch_at_Mlinza_Farm_01.jpg'),
    ('shamba-space-beekeeping-guide',
     'shamba-space-beekeeping-guide/cover-1280.webp', 208604,
     'shamba-space-beekeeping-guide/cover-640.webp', 65510,
     'Rows of green and yellow top-bar beehives hanging from a wooden pole frame in a grassy apiary in Gatundu, Kenya',
     'treesftf / Wikimedia Commons (cropped, resized)',
     'cc-by-2.0',
     'https://commons.wikimedia.org/wiki/File:Beehives_in_Kenya.jpg'),
    ('shamba-space-avocado-guide',
     'shamba-space-avocado-guide/cover-1280.webp', 246188,
     'shamba-space-avocado-guide/cover-640.webp', 76588,
     'Newly grafted avocado seedlings in black nursery bags, each graft wrapped in clear plastic film, at a nursery in Ceará, Brazil',
     'Porto Neto / Wikimedia Commons (cropped, resized)',
     'cc-by-sa-4.0',
     'https://commons.wikimedia.org/wiki/File:Avocado_newly_grafted_seedlings.jpg'),
    ('shamba-space-maize-guide',
     'shamba-space-maize-guide/cover-1280.webp', 86060,
     'shamba-space-maize-guide/cover-640.webp', 34160,
     'Close-up of a flowering maize tassel above green leaves, with a farmhouse blurred in the background, in the Mount Kenya region',
     'CIAT / Wikimedia Commons (cropped, resized)',
     'cc-by-sa-2.0',
     'https://commons.wikimedia.org/wiki/File:Maize_on_a_Mount_Kenya_farm.jpg')
),
guide as (
  select e.id as expected_id, e.*, r.id as found_id,
         r.is_published, r.origin, r.resource_type, r.title, r.summary, r.content,
         r.published_at, r.updated_at,
         r.cover_image_path, r.cover_thumb_path, r.cover_image_alt,
         r.cover_image_credit, r.cover_image_licence, r.cover_image_source_url
  from expected e
  left join public.education_resources r on r.id = e.id
),
files(path, bytes) as (
  select image_path, image_bytes from expected
  union all
  select thumb_path, thumb_bytes from expected
),
path_re(re) as (
  values ('^[a-z0-9]+(-[a-z0-9]+)*/[a-z0-9]+(-[a-z0-9]+)*\.(webp|jpg|jpeg)$')
),
checks(n, check_name, expected, actual) as (
  select 1, 'pilot guides found / published / Shamba Space Original / article', '5 / 5 / 5 / 5',
    (select count(found_id) || ' / ' || count(*) filter (where is_published)
            || ' / ' || count(*) filter (where origin = 'shamba_original')
            || ' / ' || count(*) filter (where resource_type = 'article')
     from guide)
  union all
  select 1 + row_number() over (order by g.expected_id)::int,
    'cover fields match ATTRIBUTION.md: ' || g.expected_id, 'match',
    case
      when g.found_id is null then 'guide missing'
      when num_nonnulls(g.cover_image_path, g.cover_thumb_path, g.cover_image_alt, g.cover_image_credit,
                        g.cover_image_licence, g.cover_image_source_url) = 0 then 'not set'
      else coalesce(nullif(concat_ws(', ',
        case when g.cover_image_path is distinct from g.image_path then 'path differs' end,
        case when g.cover_thumb_path is distinct from g.thumb_path then 'thumb path differs' end,
        case when g.cover_image_alt is distinct from g.alt then 'alt differs' end,
        case when g.cover_image_credit is distinct from g.credit then 'credit differs' end,
        case when g.cover_image_licence is distinct from g.licence then 'licence differs' end,
        case when g.cover_image_source_url is distinct from g.source_url then 'source url differs' end
      ), ''), 'match')
    end
  from guide g
  union all
  select 7, 'cover paths valid and in the guide''s own folder', '5',
    (select count(*)::text from guide g, path_re p
     where g.cover_image_path ~ p.re and g.cover_thumb_path ~ p.re
       and g.cover_image_path !~ '\.\.' and g.cover_thumb_path !~ '\.\.'
       and split_part(g.cover_image_path, '/', 1) = g.found_id
       and split_part(g.cover_thumb_path, '/', 1) = g.found_id
       and g.cover_image_path like '%/cover-1280.webp'
       and g.cover_thumb_path like '%/cover-640.webp')
  union all
  select 8, 'cover files in bucket (exact path, size, image/webp)', '10',
    (select count(*)::text from files f
     join storage.objects o on o.bucket_id = 'education-media' and o.name = f.path
     where o.metadata->>'size' = f.bytes::text
       and o.metadata->>'mimetype' = 'image/webp')
  union all
  select 9, 'other guides with a cover set', '0',
    (select count(*)::text from public.education_resources r
     where r.id not in (select id from expected)
       and num_nonnulls(r.cover_image_path, r.cover_thumb_path, r.cover_image_alt, r.cover_image_credit,
                        r.cover_image_licence, r.cover_image_source_url) > 0)
  union all
  select 10, 'cover constraints present / validated', '2 / 2',
    (select count(*) || ' / ' || count(*) filter (where convalidated)
     from pg_constraint
     where conrelid = 'public.education_resources'::regclass
       and conname in ('education_resources_cover_complete', 'education_resources_cover_in_own_folder'))
  union all
  select 11, 'education_resources: RLS on / write policies', 'true / 0',
    (select c.relrowsecurity::text || ' / '
            || (select count(*) from pg_policies
                where schemaname = 'public' and tablename = 'education_resources'
                  and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL'))
     from pg_class c where c.oid = 'public.education_resources'::regclass)
  union all
  select 12, 'education-media: public / size limit / types', 'false / 307200 / image/jpeg,image/webp',
    coalesce((select b.public::text || ' / ' || b.file_size_limit || ' / '
                     || array_to_string(array(select unnest(b.allowed_mime_types) order by 1), ',')
              from storage.buckets b where b.id = 'education-media'),
             '(no bucket)')
  union all
  select 13, 'education-media storage policies', '1 SELECT',
    (select count(*) || coalesce(' ' || string_agg(distinct cmd, ','), '')
     from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and (coalesce(qual, '') like '%education-media%'
            or coalesce(with_check, '') like '%education-media%'))
  union all
  select 14, 'migration 20261012130000 recorded as applied', 'INFO',
    -- The history table exists only if the CLI / MCP has applied migrations;
    -- read it only when it is there.
    case when to_regclass('supabase_migrations.schema_migrations') is null then 'no history table'
         else (xpath('/row/n/text()',
                 query_to_xml('select count(*) as n from supabase_migrations.schema_migrations '
                              || 'where version = ''20261012130000''', false, true, '')))[1]::text
    end
  union all
  select 14 + row_number() over (order by g.expected_id)::int,
    'text fingerprint: ' || g.expected_id, 'INFO',
    coalesce(left(md5(g.title || E'\n' || g.summary || E'\n' || g.content), 12)
             || ' / published ' || g.is_published
             || ' / ' || to_char(g.published_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS')
             || ' / updated ' || to_char(g.updated_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS'),
             'guide missing')
  from guide g
)
select n as "#", check_name, expected, actual,
       case when expected = 'INFO' then 'INFO'
            when actual = expected then 'PASS'
            else 'CHECK' end as result
from checks
order by n;
