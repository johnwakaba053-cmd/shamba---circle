-- Marketplace 2.0 Batch M1: category foundation. Marketplace's product
-- taxonomy has, until now, borrowed public.communities.name directly as
-- its category list (see marketplace/new/page.tsx) -- a discussion
-- taxonomy with no relationship to commerce categories, and with no
-- referential integrity: renaming a community's display name (an
-- ordinary, already-approved Communities operation) silently orphans
-- any listing whose category text was set to the old name. This has
-- already happened in production: the "Beef Cattle" community was
-- renamed to "Beef Farming" earlier this session, and the one real
-- listing's category text ("Beef Cattle") no longer matches anything.
--
-- This migration creates a dedicated, independent marketplace_categories
-- table (never touching public.communities), gives listings a proper
-- category_id FK to it, and repairs the orphaned listing -- all
-- additively: listings.category (the free-text column) is left in
-- place and untouched, so nothing that currently reads it breaks during
-- the transition.

-- === marketplace_categories =================================================

create table public.marketplace_categories (
  id text primary key,
  name text not null,
  -- Optional future subcategory support (e.g. "Livestock" -> "Dairy
  -- Cattle" / "Beef Cattle") -- nullable and unused by this batch's
  -- seed data (every seeded category is top-level), so the column
  -- exists for later without adding any actual hierarchy yet.
  parent_id text references public.marketplace_categories (id),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index marketplace_categories_parent_id_idx on public.marketplace_categories (parent_id);

alter table public.marketplace_categories enable row level security;

-- Same open-read/no-write-policy shape as public.communities: reference
-- data any authenticated farmer can browse, writable only via a
-- migration (no INSERT/UPDATE/DELETE policy is granted here, so RLS
-- denies all three by default).
create policy "Authenticated users can view marketplace categories"
on public.marketplace_categories
for select
to authenticated
using (true);

insert into public.marketplace_categories (id, name, sort_order) values
  ('seeds_seedlings', 'Seeds & Seedlings', 1),
  ('fertilizers_farm_inputs', 'Fertilizers & Farm Inputs', 2),
  ('farm_machinery', 'Farm Machinery', 3),
  ('livestock', 'Livestock', 4),
  ('poultry', 'Poultry', 5),
  ('fish_farming', 'Fish Farming', 6),
  ('dairy', 'Dairy', 7),
  ('beekeeping', 'Beekeeping', 8),
  ('farm_produce', 'Farm Produce', 9),
  ('animal_feeds', 'Animal Feeds', 10),
  ('irrigation_water_equipment', 'Irrigation & Water Equipment', 11),
  ('farm_tools_equipment', 'Farm Tools & Equipment', 12),
  ('packaging_storage', 'Packaging & Storage', 13),
  ('farm_structures', 'Farm Structures', 14),
  ('farm_transport_services', 'Farm & Transport Services', 15);

-- === listings.category_id ===================================================

-- Nullable and additive: listings.category (free text) is untouched, so
-- every existing read path (browse, detail, edit) keeps working exactly
-- as it does today without any code change being required by this
-- column's mere existence. category_id is the new, stable-identity
-- relationship going forward; category_id being null simply means "not
-- yet mapped to the new taxonomy," not an error state.
alter table public.listings
  add column category_id text references public.marketplace_categories (id);

create index listings_category_id_idx on public.listings (category_id);

-- Repair the one known orphan: the "Beef Cattle" listing (its category
-- text stopped matching any community name once that community was
-- renamed to "Beef Farming"). Mapped by matching the exact legacy text,
-- not by row id, so this also covers any other row that happens to
-- carry the same now-orphaned string. Beef cattle for sale belongs
-- under the new "Livestock" category.
--
-- set_listing_seller_display_name fires BEFORE UPDATE on every row and
-- unconditionally re-derives seller_display_name from
-- "select ... where id = auth.uid()" -- correct for an authenticated
-- end-user request, but auth.uid() is null in this migration's context,
-- which would null out a NOT NULL column on every row this UPDATE
-- touches. Disabled only for this one administrative statement, then
-- immediately re-enabled -- normal application traffic is unaffected.
alter table public.listings disable trigger set_listing_seller_display_name;

update public.listings
set category_id = 'livestock'
where category = 'Beef Cattle';

alter table public.listings enable trigger set_listing_seller_display_name;
