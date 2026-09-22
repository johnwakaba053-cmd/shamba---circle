-- Education 2.0 foundation: crop/livestock topics + learning categories.
--
-- education_topics is deliberately keyed off the existing canonical
-- crop_types/livestock_types tables (never communities -- their ids
-- don't consistently align, per the Education audit), so this doesn't
-- create a second, competing crop/livestock taxonomy. A topic_type
-- check plus a matching check constraint on the two nullable FK columns
-- enforces "exactly one of crop_type_id/livestock_type_id, matching
-- topic_type" at the database level, not just in application code.
create table public.education_topics (
  id text primary key,
  name text not null,
  topic_type text not null check (topic_type in ('crop', 'livestock')),
  crop_type_id text references public.crop_types (id),
  livestock_type_id text references public.livestock_types (id),
  description text,
  emoji text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint education_topics_type_matches_fk check (
    (topic_type = 'crop' and crop_type_id is not null and livestock_type_id is null)
    or
    (topic_type = 'livestock' and livestock_type_id is not null and crop_type_id is null)
  )
);

create index education_topics_crop_type_id_idx on public.education_topics (crop_type_id);
create index education_topics_livestock_type_id_idx on public.education_topics (livestock_type_id);

alter table public.education_topics enable row level security;

create policy "Authenticated users can view education topics"
on public.education_topics
for select
to authenticated
using (true);

-- education_resources: two additive, nullable columns. Both stay NULL by
-- default so all 21 existing resources remain valid with no backfill
-- required -- learning_category's allowed values are enforced by a check
-- constraint so the app never needs to defensively re-validate them.
alter table public.education_resources
  add column topic_id text references public.education_topics (id),
  add column learning_category text check (
    learning_category in (
      'getting_started',
      'crop_management',
      'pests_diseases',
      'harvest_post_harvest',
      'marketing',
      'general'
    )
  );

create index education_resources_topic_id_idx on public.education_resources (topic_id);

-- Seed topics 1:1 from the existing canonical crop_types/livestock_types
-- rows -- same ids, same names, nothing invented. Using the crop/
-- livestock type's own id as the topic id keeps /education?topic=avocado
-- style URLs readable and keeps the FK relationship trivially traceable.
-- Emoji is purely decorative, mirroring the pattern already used on
-- public.communities (group_name + emoji).
insert into public.education_topics (id, name, topic_type, crop_type_id, emoji, sort_order) values
  ('maize', 'Maize', 'crop', 'maize', '🌽', 1),
  ('beans', 'Beans', 'crop', 'beans', '🫘', 2),
  ('irish-potatoes', 'Irish Potatoes', 'crop', 'irish-potatoes', '🥔', 3),
  ('sweet-potatoes', 'Sweet Potatoes', 'crop', 'sweet-potatoes', '🍠', 4),
  ('tomatoes', 'Tomatoes', 'crop', 'tomatoes', '🍅', 5),
  ('kale', 'Kale (Sukuma Wiki)', 'crop', 'kale', '🥬', 6),
  ('cabbage', 'Cabbage', 'crop', 'cabbage', '🥬', 7),
  ('onions', 'Onions', 'crop', 'onions', '🧅', 8),
  ('coffee', 'Coffee', 'crop', 'coffee', '☕', 9),
  ('tea', 'Tea', 'crop', 'tea', '🍃', 10),
  ('sugarcane', 'Sugarcane', 'crop', 'sugarcane', '🎋', 11),
  ('bananas', 'Bananas', 'crop', 'bananas', '🍌', 12),
  ('cassava', 'Cassava', 'crop', 'cassava', '🌰', 13),
  ('avocado', 'Avocado', 'crop', 'avocado', '🥑', 14),
  ('mango', 'Mango', 'crop', 'mango', '🥭', 15),
  ('groundnuts', 'Groundnuts', 'crop', 'groundnuts', '🥜', 16);

insert into public.education_topics (id, name, topic_type, livestock_type_id, emoji, sort_order) values
  ('dairy-cattle', 'Dairy Cattle', 'livestock', 'dairy-cattle', '🐄', 1),
  ('beef-cattle', 'Beef Cattle', 'livestock', 'beef-cattle', '🐂', 2),
  ('goats', 'Goats', 'livestock', 'goats', '🐐', 3),
  ('sheep', 'Sheep', 'livestock', 'sheep', '🐑', 4),
  ('pigs', 'Pigs', 'livestock', 'pigs', '🐖', 5),
  ('poultry', 'Poultry', 'livestock', 'poultry', '🐓', 6),
  ('rabbits', 'Rabbits', 'livestock', 'rabbits', '🐇', 7),
  ('bees', 'Bees', 'livestock', 'bees', '🐝', 8);

-- Backfill topic_id / learning_category on the existing 21 resources
-- only where the resource's own title/content unambiguously names a
-- single seeded topic, or its existing category IS the same concept as
-- a learning category under a new name -- never a guess. Every other
-- existing resource is left untouched (both columns stay NULL, exactly
-- as valid as before this migration).
update public.education_resources set topic_id = 'maize' where id = 'maize-production-basics';
update public.education_resources set topic_id = 'dairy-cattle' where id = 'basic-dairy-feeding-principles';
update public.education_resources set topic_id = 'poultry' where id in ('poultry-farming-basics', 'backyard-chicken-health-essentials');

update public.education_resources set learning_category = 'pests_diseases' where id in ('integrated-pest-management-basics', 'early-disease-identification');
update public.education_resources set learning_category = 'harvest_post_harvest' where id in ('reducing-post-harvest-losses', 'safe-grain-storage-fundamentals');
