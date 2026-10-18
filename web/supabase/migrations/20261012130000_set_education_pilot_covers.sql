-- Education: set the cover photos of the five pilot guides (Stage 2, step 3
-- -- data only).
--
-- 20261012120000_add_education_cover_images.sql added the cover columns
-- and the private 'education-media' bucket. The ten cover files are now in
-- that bucket, uploaded to '<guide id>/cover-1280.webp' and
-- '<guide id>/cover-640.webp' and verified byte-for-byte (size and SHA-1)
-- against education-cover-review/prepared/prepared.json. This migration
-- links them to their guides, with the values recorded in
-- education-cover-review/prepared/ATTRIBUTION.md: path, card-size path,
-- alt text, credit (creator), licence and source page. Each source page
-- and licence was re-checked on Wikimedia Commons on 2026-10-12, just
-- before upload.
--
-- Touches only the six cover_* columns of exactly five rows. Guide
-- content, titles, publication status, dates, RLS, storage and policies
-- are not changed. updated_at is deliberately left alone: a cover is
-- presentation, not a change to the guide's text, and leaving it keeps a
-- rerun a true no-op.
--
-- One DO block, so it is a single statement and all-or-nothing on its own.
-- It stops with an error, changing nothing, unless:
--
--  * all five guides exist, are published Shamba Space Original articles,
--    and still have the expected category and topic;
--  * all ten files exist in 'education-media' as image/webp with the
--    verified byte size;
--  * each guide's cover columns are either all empty or already exactly
--    these values (an existing, different cover is never overwritten).
--
-- Safe to rerun: guides already holding these values are not updated
-- again, and the final check passes either way.
--
-- The table's own CHECK constraints (path format, own folder,
-- all-or-nothing, licence allow-list, https source) also apply to the
-- update.

do $mig$
declare
  targets constant jsonb := $targets$[
    {
      "id": "shamba-space-indigenous-chicken-guide",
      "category_id": "poultry",
      "topic_id": "poultry",
      "image_path": "shamba-space-indigenous-chicken-guide/cover-1280.webp",
      "image_bytes": 283644,
      "thumb_path": "shamba-space-indigenous-chicken-guide/cover-640.webp",
      "thumb_bytes": 109060,
      "alt": "Red-brown hens foraging on grass beside a young maize field, with tall trees behind, in Kuria East, Kenya",
      "credit": "Elite Jac / Wikimedia Commons (cropped, resized)",
      "licence": "cc-by-sa-4.0",
      "source_url": "https://commons.wikimedia.org/wiki/File:Chickens_feeding_on_grass_in_a_breathtaking_cool_environment_in_rural_Kenya_(Kuria_East).jpg"
    },
    {
      "id": "shamba-space-rabbits-guide",
      "category_id": "livestock",
      "topic_id": "rabbits",
      "image_path": "shamba-space-rabbits-guide/cover-1280.webp",
      "image_bytes": 107816,
      "thumb_path": "shamba-space-rabbits-guide/cover-640.webp",
      "thumb_bytes": 40594,
      "alt": "White and fawn rabbits, with young rabbits behind them, in a wire-mesh hutch with fresh fodder, at a farm in Uganda",
      "credit": "Zahara5555 / Wikimedia Commons (cropped, resized)",
      "licence": "cc-by-sa-4.0",
      "source_url": "https://commons.wikimedia.org/wiki/File:A_colony_of_rabbits_in_their_hutch_at_Mlinza_Farm_01.jpg"
    },
    {
      "id": "shamba-space-beekeeping-guide",
      "category_id": "livestock",
      "topic_id": "bees",
      "image_path": "shamba-space-beekeeping-guide/cover-1280.webp",
      "image_bytes": 208604,
      "thumb_path": "shamba-space-beekeeping-guide/cover-640.webp",
      "thumb_bytes": 65510,
      "alt": "Rows of green and yellow top-bar beehives hanging from a wooden pole frame in a grassy apiary in Gatundu, Kenya",
      "credit": "treesftf / Wikimedia Commons (cropped, resized)",
      "licence": "cc-by-2.0",
      "source_url": "https://commons.wikimedia.org/wiki/File:Beehives_in_Kenya.jpg"
    },
    {
      "id": "shamba-space-avocado-guide",
      "category_id": "crop-farming",
      "topic_id": "avocado",
      "image_path": "shamba-space-avocado-guide/cover-1280.webp",
      "image_bytes": 246188,
      "thumb_path": "shamba-space-avocado-guide/cover-640.webp",
      "thumb_bytes": 76588,
      "alt": "Newly grafted avocado seedlings in black nursery bags, each graft wrapped in clear plastic film, at a nursery in Ceará, Brazil",
      "credit": "Porto Neto / Wikimedia Commons (cropped, resized)",
      "licence": "cc-by-sa-4.0",
      "source_url": "https://commons.wikimedia.org/wiki/File:Avocado_newly_grafted_seedlings.jpg"
    },
    {
      "id": "shamba-space-maize-guide",
      "category_id": "crop-farming",
      "topic_id": "maize",
      "image_path": "shamba-space-maize-guide/cover-1280.webp",
      "image_bytes": 86060,
      "thumb_path": "shamba-space-maize-guide/cover-640.webp",
      "thumb_bytes": 34160,
      "alt": "Close-up of a flowering maize tassel above green leaves, with a farmhouse blurred in the background, in the Mount Kenya region",
      "credit": "CIAT / Wikimedia Commons (cropped, resized)",
      "licence": "cc-by-sa-2.0",
      "source_url": "https://commons.wikimedia.org/wiki/File:Maize_on_a_Mount_Kenya_farm.jpg"
    }
  ]$targets$::jsonb;
  problem text;
  updated integer;
  matching integer;
begin
  if jsonb_array_length(targets) <> 5 then
    raise exception 'education pilot covers: expected 5 targets, found %', jsonb_array_length(targets);
  end if;

  -- Lock the five rows so nothing changes them between check and update.
  perform 1
  from public.education_resources r
  where r.id in (select t.id from jsonb_to_recordset(targets) as t(id text))
  for update;

  -- 1. Every guide exists and is what we expect.
  select string_agg(t.id || case
           when r.id is null then ' (missing)'
           else ' (' || concat_ws(', ',
             case when not r.is_published then 'not published' end,
             case when r.origin is distinct from 'shamba_original' then 'origin ' || coalesce(r.origin, 'null') end,
             case when r.resource_type is distinct from 'article' then 'type ' || r.resource_type end,
             case when r.category_id is distinct from t.category_id then 'category ' || r.category_id end,
             case when r.topic_id is distinct from t.topic_id then 'topic ' || coalesce(r.topic_id, 'null') end
           ) || ')'
         end, '; ' order by t.id)
  into problem
  from jsonb_to_recordset(targets) as t(id text, category_id text, topic_id text)
  left join public.education_resources r on r.id = t.id
  where r.id is null
     or not r.is_published
     or r.origin is distinct from 'shamba_original'
     or r.resource_type is distinct from 'article'
     or r.category_id is distinct from t.category_id
     or r.topic_id is distinct from t.topic_id;
  if problem is not null then
    raise exception 'education pilot covers: guide missing or not as expected: %', problem;
  end if;

  -- 2. All ten files are in the bucket, as uploaded and verified.
  select string_agg(f.path || coalesce(
           ' (' || case when o.id is null then 'missing'
                        else 'size ' || coalesce(o.metadata->>'size', 'null')
                             || ', type ' || coalesce(o.metadata->>'mimetype', 'null') end || ')', ''),
           '; ' order by f.path)
  into problem
  from (
    select t.image_path as path, t.image_bytes as bytes
    from jsonb_to_recordset(targets) as t(image_path text, image_bytes bigint)
    union all
    select t.thumb_path, t.thumb_bytes
    from jsonb_to_recordset(targets) as t(thumb_path text, thumb_bytes bigint)
  ) f
  left join storage.objects o
    on o.bucket_id = 'education-media' and o.name = f.path
  where o.id is null
     or o.metadata->>'size' is distinct from f.bytes::text
     or o.metadata->>'mimetype' is distinct from 'image/webp';
  if problem is not null then
    raise exception 'education pilot covers: cover file missing or not as uploaded: %', problem;
  end if;

  -- 3. Never replace a different cover: each guide is empty or already set
  --    to exactly these values.
  select string_agg(r.id, ', ' order by r.id)
  into problem
  from public.education_resources r
  join jsonb_to_recordset(targets) as t(id text, image_path text, thumb_path text,
                                        alt text, credit text, licence text, source_url text)
    on t.id = r.id
  where num_nonnulls(r.cover_image_path, r.cover_thumb_path, r.cover_image_alt,
                     r.cover_image_credit, r.cover_image_licence, r.cover_image_source_url) > 0
    and (r.cover_image_path, r.cover_thumb_path, r.cover_image_alt,
         r.cover_image_credit, r.cover_image_licence, r.cover_image_source_url)
        is distinct from
        (t.image_path, t.thumb_path, t.alt, t.credit, t.licence, t.source_url);
  if problem is not null then
    raise exception 'education pilot covers: guide already has a different cover: %', problem;
  end if;

  -- 4. Set the six cover columns, only where not already set.
  update public.education_resources r
  set cover_image_path = t.image_path,
      cover_thumb_path = t.thumb_path,
      cover_image_alt = t.alt,
      cover_image_credit = t.credit,
      cover_image_licence = t.licence,
      cover_image_source_url = t.source_url
  from jsonb_to_recordset(targets) as t(id text, image_path text, thumb_path text,
                                        alt text, credit text, licence text, source_url text)
  where r.id = t.id
    and (r.cover_image_path, r.cover_thumb_path, r.cover_image_alt,
         r.cover_image_credit, r.cover_image_licence, r.cover_image_source_url)
        is distinct from
        (t.image_path, t.thumb_path, t.alt, t.credit, t.licence, t.source_url);
  get diagnostics updated = row_count;

  -- 5. All five now hold exactly these values.
  select count(*)
  into matching
  from public.education_resources r
  join jsonb_to_recordset(targets) as t(id text, image_path text, thumb_path text,
                                        alt text, credit text, licence text, source_url text)
    on t.id = r.id
  where (r.cover_image_path, r.cover_thumb_path, r.cover_image_alt,
         r.cover_image_credit, r.cover_image_licence, r.cover_image_source_url)
        is not distinct from
        (t.image_path, t.thumb_path, t.alt, t.credit, t.licence, t.source_url);
  if matching <> 5 then
    raise exception 'education pilot covers: expected 5 guides with their cover set, found %', matching;
  end if;

  raise notice 'education pilot covers: % guide(s) updated, % already set', updated, 5 - updated;
end
$mig$;
