-- Marketplace foundation: a listing belongs to its seller. No community
-- scoping — the marketplace is global, unlike posts.
--
-- seller_display_name mirrors posts/post_comments exactly: profiles RLS
-- only lets a user read their own row, so there is still no other way to
-- resolve profile_id -> display_name for anyone but the viewer. Same
-- trigger-derived, tamper-proof pattern, protected on both INSERT and
-- UPDATE from the start (posts/comments needed a follow-up migration to
-- add UPDATE protection; this starts with it).
create table public.listings (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  seller_display_name text not null,
  title text not null check (char_length(title) between 1 and 120),
  description text not null check (char_length(description) between 1 and 2000),
  category text not null,
  listing_type text not null check (listing_type in ('for_sale', 'wanted')),
  price numeric check (price >= 0),
  price_unit text,
  location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Primary browse path is "newest listings first", global (no community
-- dimension to index alongside, unlike posts).
create index listings_created_at_idx on public.listings (created_at desc);

create function public.set_listing_seller_display_name()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select display_name into new.seller_display_name
  from public.profiles
  where id = auth.uid();

  return new;
end;
$$;

create trigger set_listing_seller_display_name
  before insert or update on public.listings
  for each row
  execute function public.set_listing_seller_display_name();

alter table public.listings enable row level security;

-- Open read, matching posts/communities: browsing the marketplace
-- doesn't require any prior relationship, same as browsing communities.
create policy "Authenticated users can view listings"
on public.listings
for select
to authenticated
using (true);

-- A user may only create a listing as themselves — no membership concept
-- applies here, unlike posts.
create policy "Users can create their own listings"
on public.listings
for insert
to authenticated
with check (profile_id = (select auth.uid()));

create policy "Users can update their own listings"
on public.listings
for update
to authenticated
using (profile_id = (select auth.uid()))
with check (profile_id = (select auth.uid()));

create policy "Users can delete their own listings"
on public.listings
for delete
to authenticated
using (profile_id = (select auth.uid()));
