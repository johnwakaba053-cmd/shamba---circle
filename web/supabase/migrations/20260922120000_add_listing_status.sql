-- Marketplace 2.0 Batch M3.1: listing status (available/sold).
-- Completely independent of listing_type (for_sale/wanted, unchanged)
-- and of category_details (Batch M3, unchanged) -- a listing's category
-- fields and its availability are orthogonal concerns.
--
-- Added with a default so every existing row (including the one real
-- production listing) becomes 'available' automatically; the explicit
-- UPDATE below is a harmless no-op safety net over that default, kept
-- to match the approved step-by-step migration plan exactly. No index:
-- nothing filters or sorts by status in this batch (sold listings stay
-- fully visible in Marketplace, unfiltered), so nothing needs one yet.
--
-- No RLS change: the existing "Users can update their own listings"
-- policy (profile_id = auth.uid()) is row-scoped, not column-scoped,
-- and already permits an owner to update this new column exactly as it
-- already permits category_details -- confirmed by audit before this
-- migration was written.
alter table public.listings
  add column status text default 'available';

update public.listings set status = 'available' where status is null;

alter table public.listings
  alter column status set not null;

alter table public.listings
  add constraint listings_status_check check (status in ('available', 'sold'));
