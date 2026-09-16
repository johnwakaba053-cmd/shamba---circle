-- Communities foundation, first slice: a read-only directory of
-- agricultural topics, seeded from the original prototype's CHANNELS
-- taxonomy (src/main.js). No membership/posts/comments yet — this table
-- only exists to be listed.
create table public.communities (
  id text primary key,
  name text not null,
  group_name text not null check (
    group_name in ('Crop Farmers', 'Animal Farmers', 'Other')
  ),
  emoji text,
  created_at timestamptz not null default now()
);

alter table public.communities enable row level security;

-- Read-only for signed-in users. No INSERT/UPDATE/DELETE policy —
-- communities aren't created or edited from the app in this slice.
create policy "Authenticated users can view communities"
on public.communities
for select
to authenticated
using (true);

-- Seed: exact 26-entry CHANNELS taxonomy from the prototype, unchanged.
insert into public.communities (id, name, group_name, emoji) values
  ('maize', 'Maize', 'Crop Farmers', '🌽'),
  ('coffee', 'Coffee', 'Crop Farmers', '☕'),
  ('tea', 'Tea', 'Crop Farmers', '🍃'),
  ('rice', 'Rice', 'Crop Farmers', '🌾'),
  ('roots', 'Cassava & Roots', 'Crop Farmers', '🍠'),
  ('beans', 'Beans & Legumes', 'Crop Farmers', '🫘'),
  ('bananas', 'Bananas & Plantain', 'Crop Farmers', '🍌'),
  ('horticulture', 'Vegetables & Fruit', 'Crop Farmers', '🍅'),
  ('sugarcane', 'Sugarcane', 'Crop Farmers', '🎋'),
  ('wheat', 'Wheat', 'Crop Farmers', '🌿'),
  ('sorghum_millet', 'Sorghum & Millet', 'Crop Farmers', '🌾'),
  ('pyrethrum', 'Pyrethrum', 'Crop Farmers', '🌼'),
  ('macadamia', 'Macadamia & Nuts', 'Crop Farmers', '🌰'),
  ('avocado', 'Avocado', 'Crop Farmers', '🥑'),
  ('flowers', 'Flowers (Floriculture)', 'Crop Farmers', '🌷'),
  ('cotton', 'Cotton', 'Crop Farmers', '☁️'),
  ('dairy_cattle', 'Dairy Cattle', 'Animal Farmers', '🐄'),
  ('beef_cattle', 'Beef Cattle', 'Animal Farmers', '🐂'),
  ('goats_sheep', 'Goats & Sheep', 'Animal Farmers', '🐐'),
  ('pigs', 'Pigs', 'Animal Farmers', '🐖'),
  ('chicken', 'Chicken', 'Animal Farmers', '🐓'),
  ('camels', 'Camels', 'Animal Farmers', '🐫'),
  ('rabbits', 'Rabbits', 'Animal Farmers', '🐇'),
  ('beekeeping', 'Beekeeping', 'Animal Farmers', '🐝'),
  ('fish', 'Fish Farming', 'Animal Farmers', '🐟'),
  ('problems', 'General Problems', 'Other', '🆘');
