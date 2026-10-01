-- Farm Records R3a: reference data.
--
-- The product taxonomy and controlled vocabularies Farm Records R3 builds
-- on: crop and livestock categories, measurement units, input categories
-- and farm record kinds. Read-only lookup tables only -- no farm_records
-- table yet (R3b).
--
-- Existing crop_types / livestock_types rows (16 + 8) keep their id, name
-- and created_at exactly; they only gain a category_id. Nothing is
-- deleted, renamed or replaced. Every table that references those types
-- (farmer preferences, alert types, education topics, price products,
-- crop seasons, livestock groups) only uses the ids, so adding rows is
-- safe for them.
--
-- Categories are the initial product taxonomy (not just UI labels), kept
-- in their own tables so later categories are added as rows.
--
-- No quantity conversion here: measurement_units carries no conversion
-- factors. Conversion is designed later with Reports/Money (some units,
-- like the debe, are approximate).

-- === categories ==============================================================

create table public.crop_categories (
  id text primary key check (id ~ '^[a-z][a-z0-9_]*$'),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  sort_order integer not null,
  created_at timestamptz not null default now()
);

create table public.livestock_categories (
  id text primary key check (id ~ '^[a-z][a-z0-9_]*$'),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  sort_order integer not null,
  created_at timestamptz not null default now()
);

insert into public.crop_categories (id, name, sort_order) values
  ('cereals', 'Cereals', 10),
  ('legumes', 'Legumes & pulses', 20),
  ('roots_tubers', 'Roots & tubers', 30),
  ('vegetables', 'Vegetables', 40),
  ('fruits_nuts', 'Fruits & nuts', 50),
  ('cash_crops', 'Cash crops', 60),
  ('fodder', 'Fodder', 70);

insert into public.livestock_categories (id, name, sort_order) values
  ('cattle', 'Cattle', 10),
  ('small_stock', 'Goats & sheep', 20),
  ('poultry', 'Poultry', 30),
  ('pigs', 'Pigs', 40),
  ('camels_donkeys', 'Camels & donkeys', 50),
  ('rabbits', 'Rabbits', 60),
  ('bees', 'Bees', 70),
  ('fish', 'Fish', 80);

-- === crop_types: categorise the existing 16, add 22 ==========================

alter table public.crop_types add column category_id text references public.crop_categories (id);

update public.crop_types set category_id = 'cereals'      where id = 'maize';
update public.crop_types set category_id = 'legumes'      where id in ('beans', 'groundnuts');
update public.crop_types set category_id = 'roots_tubers' where id in ('cassava', 'irish-potatoes', 'sweet-potatoes');
update public.crop_types set category_id = 'vegetables'   where id in ('cabbage', 'kale', 'onions', 'tomatoes');
update public.crop_types set category_id = 'fruits_nuts'  where id in ('avocado', 'bananas', 'mango');
update public.crop_types set category_id = 'cash_crops'   where id in ('coffee', 'sugarcane', 'tea');

insert into public.crop_types (id, name, category_id) values
  ('sorghum', 'Sorghum', 'cereals'),
  ('finger-millet', 'Finger Millet (Wimbi)', 'cereals'),
  ('wheat', 'Wheat', 'cereals'),
  ('rice', 'Rice', 'cereals'),
  ('green-grams', 'Green Grams (Ndengu)', 'legumes'),
  ('cowpeas', 'Cowpeas (Kunde)', 'legumes'),
  ('pigeon-peas', 'Pigeon Peas (Mbaazi)', 'legumes'),
  ('french-beans', 'French Beans', 'legumes'),
  ('spinach', 'Spinach', 'vegetables'),
  ('carrots', 'Carrots', 'vegetables'),
  ('capsicum', 'Capsicum (Pilipili Hoho)', 'vegetables'),
  ('watermelon', 'Watermelon', 'fruits_nuts'),
  ('passion-fruit', 'Passion Fruit', 'fruits_nuts'),
  ('macadamia', 'Macadamia', 'fruits_nuts'),
  ('pawpaw', 'Pawpaw', 'fruits_nuts'),
  ('pineapple', 'Pineapple', 'fruits_nuts'),
  ('oranges', 'Oranges', 'fruits_nuts'),
  ('pyrethrum', 'Pyrethrum', 'cash_crops'),
  ('cotton', 'Cotton', 'cash_crops'),
  ('sunflower', 'Sunflower', 'cash_crops'),
  ('miraa', 'Miraa (Khat)', 'cash_crops'),
  ('napier-grass', 'Napier Grass', 'fodder');

-- Every crop type now has a category; future types must declare one.
alter table public.crop_types alter column category_id set not null;
create index crop_types_category_id_idx on public.crop_types (category_id);

-- === livestock_types: categorise the existing 8, add 5 =======================

alter table public.livestock_types add column category_id text references public.livestock_categories (id);

update public.livestock_types set category_id = 'cattle'      where id in ('beef-cattle', 'dairy-cattle');
update public.livestock_types set category_id = 'small_stock' where id in ('goats', 'sheep');
update public.livestock_types set category_id = 'poultry'     where id = 'poultry';
update public.livestock_types set category_id = 'pigs'        where id = 'pigs';
update public.livestock_types set category_id = 'rabbits'     where id = 'rabbits';
update public.livestock_types set category_id = 'bees'        where id = 'bees';

insert into public.livestock_types (id, name, category_id) values
  ('camels', 'Camels', 'camels_donkeys'),
  ('donkeys', 'Donkeys', 'camels_donkeys'),
  ('ducks', 'Ducks', 'poultry'),
  ('turkeys', 'Turkeys', 'poultry'),
  ('fish', 'Fish (Tilapia, Catfish)', 'fish');

alter table public.livestock_types alter column category_id set not null;
create index livestock_types_category_id_idx on public.livestock_types (category_id);

-- === measurement_units =======================================================

create table public.measurement_units (
  id text primary key check (id ~ '^[a-z][a-z0-9_]*$'),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  dimension text not null check (dimension in ('mass', 'volume', 'count', 'area')),
  sort_order integer not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.measurement_units (id, name, dimension, sort_order) values
  ('g', 'Grams', 'mass', 10),
  ('kg', 'Kilograms', 'mass', 20),
  ('bag_50kg', '50 kg bag', 'mass', 30),
  ('bag_70kg', '70 kg bag', 'mass', 40),
  ('bag_90kg', '90 kg bag', 'mass', 50),
  ('ml', 'Millilitres', 'volume', 60),
  ('l', 'Litres', 'volume', 70),
  ('knapsack_20l', '20 L knapsack', 'volume', 80),
  ('debe', 'Debe (about 20 L)', 'volume', 90),
  ('crate', 'Crates', 'count', 100),
  ('tray', 'Trays', 'count', 110),
  ('bale', 'Bales', 'count', 120),
  ('sachet', 'Sachets', 'count', 130),
  ('dose', 'Doses', 'count', 140),
  ('head', 'Head (animals)', 'count', 150),
  ('bird', 'Birds', 'count', 160),
  ('hive', 'Hives', 'count', 170),
  ('acre', 'Acres', 'area', 180);

-- === input_categories ========================================================

create table public.input_categories (
  id text primary key check (id ~ '^[a-z][a-z0-9_]*$'),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  sort_order integer not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.input_categories (id, name, sort_order) values
  ('seed', 'Seed or seedlings', 10),
  ('fertilizer', 'Fertilizer', 20),
  ('manure_compost', 'Manure or compost', 30),
  ('pesticide', 'Pesticide', 40),
  ('herbicide', 'Herbicide (weed killer)', 50),
  ('fungicide', 'Fungicide', 60),
  ('vaccine', 'Vaccine', 70),
  ('vet_medicine', 'Animal medicine', 80),
  ('dewormer', 'Dewormer', 90),
  ('feed', 'Feed', 100),
  ('supplement', 'Supplement or mineral', 110),
  ('other', 'Other', 120);

-- === farm_record_kinds =======================================================

-- subject_mode: what a farm record of this kind must be about --
--   crop          a crop season (required)
--   livestock     a livestock group (required)
--   farm          the farm, optionally one plot (no crop season / group)
--   farm_or_crop  either a crop season, or the farm / a plot
--   any           a crop season, a livestock group, or the farm / a plot
-- input_mode: none | optional | expected (expected = prompted, never forced)
-- Inactive kinds are reserved for later slices; R3b refuses new records
-- of an inactive kind.
create table public.farm_record_kinds (
  id text primary key check (id ~ '^[a-z][a-z0-9_]*$'),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  group_id text not null check (group_id in ('crops', 'livestock', 'farm', 'money')),
  subject_mode text not null check (subject_mode in ('crop', 'livestock', 'farm', 'farm_or_crop', 'any')),
  input_mode text not null check (input_mode in ('none', 'optional', 'expected')),
  sort_order integer not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.farm_record_kinds (id, name, group_id, subject_mode, input_mode, sort_order, is_active) values
  ('land_preparation',       'Prepared land',       'crops',     'farm_or_crop', 'optional', 10,  true),
  ('planting',               'Planted',             'crops',     'crop',         'optional', 20,  true),
  ('weeding',                'Weeded',              'crops',     'crop',         'optional', 30,  true),
  ('fertilizer_application', 'Applied fertilizer',  'crops',     'crop',         'expected', 40,  true),
  ('crop_protection',        'Sprayed crops',       'crops',     'crop',         'expected', 50,  true),
  ('irrigation',             'Watered / irrigated', 'crops',     'crop',         'none',     60,  true),
  ('crop_observation',       'Crop check',          'crops',     'crop',         'none',     70,  true),
  ('animal_treatment',       'Treated animals',     'livestock', 'livestock',    'expected', 110, true),
  ('feeding',                'Fed animals',         'livestock', 'livestock',    'optional', 120, true),
  ('animal_observation',     'Animal check',        'livestock', 'livestock',    'none',     130, true),
  ('farm_work',              'Farm work',           'farm',      'farm',         'optional', 210, true),
  ('note',                   'Note',                'farm',      'any',          'none',     220, true),
  -- Reserved: Money (R4).
  ('harvest',  'Harvested', 'crops', 'crop', 'none', 80,  false),
  ('sale',     'Sold',      'money', 'any',  'none', 310, false),
  ('purchase', 'Bought',    'money', 'any',  'none', 320, false),
  ('expense',  'Expense',   'money', 'any',  'none', 330, false),
  ('income',   'Income',    'money', 'any',  'none', 340, false),
  -- Reserved: livestock changes.
  ('animal_birth',  'Animals born',   'livestock', 'livestock', 'none', 140, false),
  ('animal_death',  'Animals died',   'livestock', 'livestock', 'none', 150, false),
  ('animal_bought', 'Animals bought', 'livestock', 'livestock', 'none', 160, false),
  ('animal_sold',   'Animals sold',   'livestock', 'livestock', 'none', 170, false),
  ('animal_moved',  'Animals moved',  'livestock', 'livestock', 'none', 180, false);

-- === privileges + RLS ========================================================

-- Read-only lookup tables: anon gets nothing, signed-in users can read,
-- and only migrations change them. crop_types / livestock_types keep their
-- existing grants and policies.
revoke all on public.crop_categories from anon, authenticated;
revoke all on public.livestock_categories from anon, authenticated;
revoke all on public.measurement_units from anon, authenticated;
revoke all on public.input_categories from anon, authenticated;
revoke all on public.farm_record_kinds from anon, authenticated;

grant select on public.crop_categories to authenticated;
grant select on public.livestock_categories to authenticated;
grant select on public.measurement_units to authenticated;
grant select on public.input_categories to authenticated;
grant select on public.farm_record_kinds to authenticated;

alter table public.crop_categories enable row level security;
alter table public.livestock_categories enable row level security;
alter table public.measurement_units enable row level security;
alter table public.input_categories enable row level security;
alter table public.farm_record_kinds enable row level security;

create policy "Authenticated users can view crop categories"
on public.crop_categories for select to authenticated using (true);

create policy "Authenticated users can view livestock categories"
on public.livestock_categories for select to authenticated using (true);

create policy "Authenticated users can view measurement units"
on public.measurement_units for select to authenticated using (true);

create policy "Authenticated users can view input categories"
on public.input_categories for select to authenticated using (true);

create policy "Authenticated users can view farm record kinds"
on public.farm_record_kinds for select to authenticated using (true);
