-- Farm Records R2: crop seasons and livestock groups.
--
-- What a farmer grows and keeps on a farm. A crop season is one crop
-- grown over a period (optionally on one plot, otherwise the whole farm);
-- a livestock group is a herd or flock of one kind of animal. Both reuse
-- the existing crop_types / livestock_types reference tables -- no new
-- taxonomy. No activities, inputs, harvests, sales, expenses, photos or
-- reports here -- those are later slices.
--
-- Same model as R1 (20261001090000): private, owner-only, archived not
-- deleted, server-set timestamps.
--
-- Structural safety, all enforced by foreign keys (which ignore RLS):
--  * (farm_id, profile_id) -> farms (id, profile_id): a record can only
--    belong to one of its owner's own farms.
--  * (plot_id, farm_id, profile_id) -> farm_plots (id, farm_id,
--    profile_id): a chosen plot must be on the same farm and have the same
--    owner. plot_id is optional; with it null (a whole-farm record) the
--    key is not checked (MATCH SIMPLE).
-- Combined with the RLS check that profile_id is the caller, a forged
-- request can't attach a record to someone else's farm or plot, or to a
-- plot of a different farm.
--
-- Archived parents: a record can't be added to, moved onto, or restored
-- under an archived farm or plot (check_farm_record_parents_active
-- below). Records that already exist when their farm or plot is archived
-- are left exactly as they are and can still be edited, ended or
-- archived.
--
-- Nothing existing changes: farms, farm_plots, crop_types,
-- livestock_types and every existing policy are untouched.

-- === crop_seasons ============================================================

create table public.crop_seasons (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  farm_id uuid not null,
  plot_id uuid,
  crop_type_id text not null references public.crop_types (id),
  label text check (label is null or char_length(btrim(label)) between 1 and 80),
  started_on date not null,
  ended_on date,
  area_acres numeric(10, 2) check (area_acres is null or (area_acres > 0 and area_acres <= 100000)),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Targets for later slices' composite foreign keys (activities,
  -- harvests, expenses, sales), exactly as farm_plots was prepared in R1:
  -- a child row can then only name a season with the same owner (and,
  -- through the second key, on the same farm).
  constraint crop_seasons_id_profile_id_key unique (id, profile_id),
  constraint crop_seasons_id_farm_id_profile_id_key unique (id, farm_id, profile_id),
  -- Catches typing slips like year 20026 or 0026; not a business rule.
  -- 1900 leaves room for inherited perennials (tea, coffee) planted
  -- generations ago.
  constraint crop_seasons_started_on_range check (started_on between date '1900-01-01' and date '2100-12-31'),
  constraint crop_seasons_ended_on_range check (ended_on is null or ended_on between date '1900-01-01' and date '2100-12-31'),
  constraint crop_seasons_ended_after_started check (ended_on is null or ended_on >= started_on),
  constraint crop_seasons_farm_owner_fkey foreign key (farm_id, profile_id)
    references public.farms (id, profile_id) on delete cascade,
  constraint crop_seasons_plot_farm_owner_fkey foreign key (plot_id, farm_id, profile_id)
    references public.farm_plots (id, farm_id, profile_id) on delete cascade
);

create index crop_seasons_farm_id_idx on public.crop_seasons (farm_id, started_on);
create index crop_seasons_profile_id_idx on public.crop_seasons (profile_id);
create index crop_seasons_plot_idx on public.crop_seasons (plot_id, farm_id, profile_id) where plot_id is not null;
create index crop_seasons_crop_type_id_idx on public.crop_seasons (crop_type_id);

-- === livestock_groups ========================================================

create table public.livestock_groups (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  farm_id uuid not null,
  plot_id uuid,
  livestock_type_id text not null references public.livestock_types (id),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  head_count integer check (head_count is null or (head_count >= 0 and head_count <= 1000000)),
  started_on date,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Same later-slice targets as on crop_seasons.
  constraint livestock_groups_id_profile_id_key unique (id, profile_id),
  constraint livestock_groups_id_farm_id_profile_id_key unique (id, farm_id, profile_id),
  constraint livestock_groups_started_on_range check (started_on is null or started_on between date '1900-01-01' and date '2100-12-31'),
  constraint livestock_groups_farm_owner_fkey foreign key (farm_id, profile_id)
    references public.farms (id, profile_id) on delete cascade,
  constraint livestock_groups_plot_farm_owner_fkey foreign key (plot_id, farm_id, profile_id)
    references public.farm_plots (id, farm_id, profile_id) on delete cascade
);

create index livestock_groups_farm_id_idx on public.livestock_groups (farm_id, created_at);
create index livestock_groups_profile_id_idx on public.livestock_groups (profile_id);
create index livestock_groups_plot_idx on public.livestock_groups (plot_id, farm_id, profile_id) where plot_id is not null;
create index livestock_groups_livestock_type_id_idx on public.livestock_groups (livestock_type_id);

-- === timestamps ==============================================================

-- Reuses R1's trigger function: created_at and updated_at are always set
-- by the server, never trusted from the client.
create trigger set_crop_seasons_timestamps
  before insert or update on public.crop_seasons
  for each row
  execute function public.set_farm_records_timestamps();

create trigger set_livestock_groups_timestamps
  before insert or update on public.livestock_groups
  for each row
  execute function public.set_farm_records_timestamps();

-- === archived parents ========================================================

-- Refuses to put a record under an archived farm or plot: on insert, when
-- farm_id/plot_id change, and when an archived record is restored. Other
-- updates (rename, end a season, archive) pass, so records that already
-- sat on a farm or plot before it was archived stay usable.
--
-- Runs as the caller (security invoker), so the lookups go through RLS:
-- someone else's farm or plot is simply invisible here and the request
-- falls through to the foreign keys, which reject it (23503) without
-- revealing whether that farm exists or is archived.
--
-- Raised with SQLSTATE P0001 and a fixed message the app maps to a
-- friendly sentence: 'farm_archived' or 'plot_archived'.
create function public.check_farm_record_parents_active()
returns trigger
language plpgsql
set search_path = ''
as $fn$
begin
  if tg_op = 'UPDATE'
     and new.farm_id is not distinct from old.farm_id
     and new.plot_id is not distinct from old.plot_id
     and not (old.archived_at is not null and new.archived_at is null) then
    return new;
  end if;

  if exists (
    select 1 from public.farms f
    where f.id = new.farm_id and f.archived_at is not null
  ) then
    raise exception 'farm_archived' using errcode = 'P0001';
  end if;

  if new.plot_id is not null and exists (
    select 1 from public.farm_plots p
    where p.id = new.plot_id and p.archived_at is not null
  ) then
    raise exception 'plot_archived' using errcode = 'P0001';
  end if;

  return new;
end;
$fn$;

revoke all on function public.check_farm_record_parents_active() from public;
revoke execute on function public.check_farm_record_parents_active() from anon;
revoke execute on function public.check_farm_record_parents_active() from authenticated;

create trigger check_crop_seasons_parents_active
  before insert or update on public.crop_seasons
  for each row
  execute function public.check_farm_record_parents_active();

create trigger check_livestock_groups_parents_active
  before insert or update on public.livestock_groups
  for each row
  execute function public.check_farm_record_parents_active();

-- === privileges ==============================================================

-- Same reset as R1: anon gets nothing; authenticated gets
-- select/insert/update only (still filtered by the policies below) and
-- never delete.
revoke all on public.crop_seasons from anon;
revoke all on public.crop_seasons from authenticated;
grant select, insert, update on public.crop_seasons to authenticated;

revoke all on public.livestock_groups from anon;
revoke all on public.livestock_groups from authenticated;
grant select, insert, update on public.livestock_groups to authenticated;

-- === RLS =====================================================================

alter table public.crop_seasons enable row level security;
alter table public.livestock_groups enable row level security;

create policy "Farmers can view their own crop seasons"
on public.crop_seasons
for select
to authenticated
using (profile_id = (select auth.uid()));

-- The composite foreign keys do the rest: the farm (and plot, if any)
-- must be the caller's own.
create policy "Farmers can create crop seasons on their own farms"
on public.crop_seasons
for insert
to authenticated
with check (profile_id = (select auth.uid()));

-- WITH CHECK also stops a farmer handing a record to someone else by
-- changing profile_id.
create policy "Farmers can update their own crop seasons"
on public.crop_seasons
for update
to authenticated
using (profile_id = (select auth.uid()))
with check (profile_id = (select auth.uid()));

create policy "Farmers can view their own livestock groups"
on public.livestock_groups
for select
to authenticated
using (profile_id = (select auth.uid()));

create policy "Farmers can create livestock groups on their own farms"
on public.livestock_groups
for insert
to authenticated
with check (profile_id = (select auth.uid()));

create policy "Farmers can update their own livestock groups"
on public.livestock_groups
for update
to authenticated
using (profile_id = (select auth.uid()))
with check (profile_id = (select auth.uid()));
