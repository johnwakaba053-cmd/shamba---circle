-- Farmer Preferences foundation.
--
-- Scope, deliberately: reference data (counties, crop types, livestock
-- types) plus the preference tables a farmer's own choices live in. No
-- alert engine, no external weather/market-price integration, no
-- notification delivery -- this stage only gives future alert work
-- something real to target.

-- public.counties / public.crop_types / public.livestock_types mirror
-- education_categories: small, rarely-changing text-slug lookup tables,
-- read-only from the app. Seeded here, not writable by any app role.
create table public.counties (
  id text primary key,
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.counties enable row level security;

create policy "Authenticated users can view counties"
on public.counties
for select
to authenticated
using (true);

create table public.crop_types (
  id text primary key,
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.crop_types enable row level security;

create policy "Authenticated users can view crop types"
on public.crop_types
for select
to authenticated
using (true);

create table public.livestock_types (
  id text primary key,
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.livestock_types enable row level security;

create policy "Authenticated users can view livestock types"
on public.livestock_types
for select
to authenticated
using (true);

-- public.farmer_preferences: one row per farmer holding their location.
-- A dedicated table (not more columns on profiles) so this stage's
-- farmer-specific data stays grouped together and out of the core
-- identity table, matching how roles already live outside profiles.
-- profile_id is the primary key (not a surrogate id) since this is
-- always exactly one row per farmer -- the same 1:1 shape profiles
-- itself uses against auth.users.
create table public.farmer_preferences (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  county_id text references public.counties (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.farmer_preferences enable row level security;

create policy "Users can view their own farmer preferences"
on public.farmer_preferences
for select
to authenticated
using (profile_id = (select auth.uid()));

create policy "Users can insert their own farmer preferences"
on public.farmer_preferences
for insert
to authenticated
with check (profile_id = (select auth.uid()));

create policy "Users can update their own farmer preferences"
on public.farmer_preferences
for update
to authenticated
using (profile_id = (select auth.uid()))
with check (profile_id = (select auth.uid()));

-- public.farmer_crop_preferences / public.farmer_livestock_preferences:
-- one row per (profile, crop/livestock type), same shape as user_roles --
-- a set of selections rather than boolean columns, so adding a new crop
-- or livestock type never requires a schema change. No UPDATE policy for
-- the same reason as user_roles: both columns are the primary key, so
-- "changing" a selection is a delete + insert (toggle membership).
create table public.farmer_crop_preferences (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  crop_type_id text not null references public.crop_types (id),
  created_at timestamptz not null default now(),
  primary key (profile_id, crop_type_id)
);

alter table public.farmer_crop_preferences enable row level security;

create policy "Users can view their own crop preferences"
on public.farmer_crop_preferences
for select
to authenticated
using (profile_id = (select auth.uid()));

create policy "Users can add their own crop preferences"
on public.farmer_crop_preferences
for insert
to authenticated
with check (profile_id = (select auth.uid()));

create policy "Users can remove their own crop preferences"
on public.farmer_crop_preferences
for delete
to authenticated
using (profile_id = (select auth.uid()));

create table public.farmer_livestock_preferences (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  livestock_type_id text not null references public.livestock_types (id),
  created_at timestamptz not null default now(),
  primary key (profile_id, livestock_type_id)
);

alter table public.farmer_livestock_preferences enable row level security;

create policy "Users can view their own livestock preferences"
on public.farmer_livestock_preferences
for select
to authenticated
using (profile_id = (select auth.uid()));

create policy "Users can add their own livestock preferences"
on public.farmer_livestock_preferences
for insert
to authenticated
with check (profile_id = (select auth.uid()));

create policy "Users can remove their own livestock preferences"
on public.farmer_livestock_preferences
for delete
to authenticated
using (profile_id = (select auth.uid()));

-- public.alert_notification_preferences: one row per (profile, alert
-- type) holding an explicit on/off flag. Unlike the selection tables
-- above, a row's value (enabled) can flip in place without changing
-- identity, so this one does carry an UPDATE policy -- the app upserts
-- a row per alert type rather than inserting/deleting to toggle it.
-- A farmer with no rows here has simply never set a preference; the
-- app treats that as "off" rather than requiring a row to exist.
create table public.alert_notification_preferences (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  alert_type text not null check (alert_type in ('weather', 'pest_disease', 'market_price')),
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (profile_id, alert_type)
);

alter table public.alert_notification_preferences enable row level security;

create policy "Users can view their own alert preferences"
on public.alert_notification_preferences
for select
to authenticated
using (profile_id = (select auth.uid()));

create policy "Users can add their own alert preferences"
on public.alert_notification_preferences
for insert
to authenticated
with check (profile_id = (select auth.uid()));

create policy "Users can update their own alert preferences"
on public.alert_notification_preferences
for update
to authenticated
using (profile_id = (select auth.uid()))
with check (profile_id = (select auth.uid()));

-- Seed data: all 47 Kenyan counties (Shamba Circle is currently
-- Kenya-focused). Ids are simple slugs, matching the existing
-- education_categories / communities convention.
insert into public.counties (id, name) values
  ('mombasa', 'Mombasa'),
  ('kwale', 'Kwale'),
  ('kilifi', 'Kilifi'),
  ('tana-river', 'Tana River'),
  ('lamu', 'Lamu'),
  ('taita-taveta', 'Taita-Taveta'),
  ('garissa', 'Garissa'),
  ('wajir', 'Wajir'),
  ('mandera', 'Mandera'),
  ('marsabit', 'Marsabit'),
  ('isiolo', 'Isiolo'),
  ('meru', 'Meru'),
  ('tharaka-nithi', 'Tharaka-Nithi'),
  ('embu', 'Embu'),
  ('kitui', 'Kitui'),
  ('machakos', 'Machakos'),
  ('makueni', 'Makueni'),
  ('nyandarua', 'Nyandarua'),
  ('nyeri', 'Nyeri'),
  ('kirinyaga', 'Kirinyaga'),
  ('muranga', 'Murang''a'),
  ('kiambu', 'Kiambu'),
  ('turkana', 'Turkana'),
  ('west-pokot', 'West Pokot'),
  ('samburu', 'Samburu'),
  ('trans-nzoia', 'Trans Nzoia'),
  ('uasin-gishu', 'Uasin Gishu'),
  ('elgeyo-marakwet', 'Elgeyo-Marakwet'),
  ('nandi', 'Nandi'),
  ('baringo', 'Baringo'),
  ('laikipia', 'Laikipia'),
  ('nakuru', 'Nakuru'),
  ('narok', 'Narok'),
  ('kajiado', 'Kajiado'),
  ('kericho', 'Kericho'),
  ('bomet', 'Bomet'),
  ('kakamega', 'Kakamega'),
  ('vihiga', 'Vihiga'),
  ('bungoma', 'Bungoma'),
  ('busia', 'Busia'),
  ('siaya', 'Siaya'),
  ('kisumu', 'Kisumu'),
  ('homa-bay', 'Homa Bay'),
  ('migori', 'Migori'),
  ('kisii', 'Kisii'),
  ('nyamira', 'Nyamira'),
  ('nairobi', 'Nairobi');

-- Seed data: a manageable initial set of common Kenyan crops, not an
-- exhaustive catalogue -- more can be added later without a schema
-- change.
insert into public.crop_types (id, name) values
  ('maize', 'Maize'),
  ('beans', 'Beans'),
  ('irish-potatoes', 'Irish Potatoes'),
  ('sweet-potatoes', 'Sweet Potatoes'),
  ('tomatoes', 'Tomatoes'),
  ('kale', 'Kale (Sukuma Wiki)'),
  ('cabbage', 'Cabbage'),
  ('onions', 'Onions'),
  ('coffee', 'Coffee'),
  ('tea', 'Tea'),
  ('sugarcane', 'Sugarcane'),
  ('bananas', 'Bananas'),
  ('cassava', 'Cassava'),
  ('avocado', 'Avocado'),
  ('mango', 'Mango'),
  ('groundnuts', 'Groundnuts');

-- Seed data: a manageable initial set of common Kenyan livestock
-- categories, not an exhaustive catalogue.
insert into public.livestock_types (id, name) values
  ('dairy-cattle', 'Dairy Cattle'),
  ('beef-cattle', 'Beef Cattle'),
  ('goats', 'Goats'),
  ('sheep', 'Sheep'),
  ('pigs', 'Pigs'),
  ('poultry', 'Poultry'),
  ('rabbits', 'Rabbits'),
  ('bees', 'Bees');
