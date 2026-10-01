-- Farm Records R1: farms and plots -- database foundation.
--
-- A farmer can own any number of farms, and a farm can have zero, one or
-- many plots. Plots are optional: nothing later in Farm Records may
-- require one. No crop seasons, livestock groups, records, photos,
-- reports, GPS, boundaries or documents here -- those are later slices.
--
-- Farm data is private. Every row carries profile_id and every policy is
-- the plain owner check profile_id = auth.uid(), the same shape as
-- farmer_preferences. Nobody else can read it: not other farmers, not
-- anon, and not staff (there is deliberately no can_moderate() policy --
-- farm data is never visible to anyone else, so there is nothing to
-- moderate).
--
-- Structural safety: farms has UNIQUE (id, profile_id), and farm_plots
-- references farms through the composite (farm_id, profile_id). Combined
-- with the RLS check that a plot's profile_id is the caller, a plot can
-- only ever point at one of the caller's own farms, even with a forged
-- request that names someone else's farm id.
--
-- No DELETE: farms and plots are archived (archived_at), never deleted
-- through the API. DELETE is not granted and has no policy. Rows only go
-- away when the owning account is deleted (ON DELETE CASCADE from
-- profiles), matching every other farmer-owned table.
--
-- Nothing existing changes: profiles, farmer_preferences, counties and
-- every existing policy are untouched. county_id reuses the existing
-- public.counties table.

-- === farms ==================================================================

create table public.farms (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  county_id text not null references public.counties (id),
  location_text text check (location_text is null or char_length(location_text) <= 200),
  size_acres numeric(10, 2) check (size_acres is null or (size_acres > 0 and size_acres <= 100000)),
  tenure text check (tenure is null or tenure in ('owned', 'leased', 'family', 'communal', 'other')),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Target of the composite foreign key below (and of later Farm Records
  -- tables), so a child row's owner must match its farm's owner.
  constraint farms_id_profile_id_key unique (id, profile_id)
);

create index farms_profile_id_idx on public.farms (profile_id, created_at);

-- === farm_plots =============================================================

create table public.farm_plots (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  size_acres numeric(10, 2) check (size_acres is null or (size_acres > 0 and size_acres <= 100000)),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Same reason as on farms: lets later slices (crop seasons) reference a
  -- plot by (plot_id, profile_id).
  constraint farm_plots_id_profile_id_key unique (id, profile_id),
  constraint farm_plots_farm_owner_fkey foreign key (farm_id, profile_id)
    references public.farms (id, profile_id) on delete cascade
);

create index farm_plots_farm_id_idx on public.farm_plots (farm_id, created_at);
create index farm_plots_profile_id_idx on public.farm_plots (profile_id);

-- === timestamps =============================================================

-- created_at and updated_at are set by the server, never trusted from the
-- client: insert stamps both with now(); update keeps the original
-- created_at and stamps updated_at. Later slices rely on these being
-- honest ("entered at" vs "event date").
create function public.set_farm_records_timestamps()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
  else
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.set_farm_records_timestamps() from public;
revoke execute on function public.set_farm_records_timestamps() from anon;
revoke execute on function public.set_farm_records_timestamps() from authenticated;

create trigger set_farms_timestamps
  before insert or update on public.farms
  for each row
  execute function public.set_farm_records_timestamps();

create trigger set_farm_plots_timestamps
  before insert or update on public.farm_plots
  for each row
  execute function public.set_farm_records_timestamps();

-- === privileges =============================================================

-- Same reset as staff_roles/reports: Supabase's default privileges grant
-- anon and authenticated everything on a new table. anon gets nothing;
-- authenticated gets select/insert/update only (still filtered by the
-- policies below) and never delete.
revoke all on public.farms from anon;
revoke all on public.farms from authenticated;
grant select, insert, update on public.farms to authenticated;

revoke all on public.farm_plots from anon;
revoke all on public.farm_plots from authenticated;
grant select, insert, update on public.farm_plots to authenticated;

-- === RLS ====================================================================

alter table public.farms enable row level security;
alter table public.farm_plots enable row level security;

create policy "Farmers can view their own farms"
on public.farms
for select
to authenticated
using (profile_id = (select auth.uid()));

create policy "Farmers can create their own farms"
on public.farms
for insert
to authenticated
with check (profile_id = (select auth.uid()));

-- WITH CHECK also stops a farmer handing a farm to someone else by
-- changing profile_id.
create policy "Farmers can update their own farms"
on public.farms
for update
to authenticated
using (profile_id = (select auth.uid()))
with check (profile_id = (select auth.uid()));

create policy "Farmers can view their own plots"
on public.farm_plots
for select
to authenticated
using (profile_id = (select auth.uid()));

-- The composite foreign key does the rest: (farm_id, caller) must exist
-- in farms, i.e. the farm must be the caller's own.
create policy "Farmers can create plots on their own farms"
on public.farm_plots
for insert
to authenticated
with check (profile_id = (select auth.uid()));

create policy "Farmers can update their own plots"
on public.farm_plots
for update
to authenticated
using (profile_id = (select auth.uid()))
with check (profile_id = (select auth.uid()));
