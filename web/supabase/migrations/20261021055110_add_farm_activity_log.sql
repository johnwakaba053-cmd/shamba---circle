-- Farm Records FR-1a: farm activity log (database only).
--
-- Migration version matches the version recorded as applied in the test project.
--
-- A farm record is one dated activity -- planting, spraying, treating
-- animals, a note -- about a whole farm (optionally one plot), one crop
-- season or one livestock group. It uses the reference data from R3a:
-- farm_record_kinds (what was done, what it can be about, whether an
-- input is expected), input_categories and measurement_units.
--
-- Records are append-only. Nobody edits or deletes one through the API.
-- A mistake is fixed by voiding the record with a reason
-- (void_farm_record), or by voiding it and adding a linked replacement in
-- one step (correct_farm_record). The voided record stays in the history.
--
-- Same owner-only model as R1/R2: private to the farm's owner, no
-- staff access, no DELETE. profile_id is never sent by the client: a
-- trigger sets it (and created_by) to the signed-in user, and the
-- composite foreign keys only accept the caller's own farm, plot, crop
-- season, livestock group and replacement target.
--
-- Archived parents: no new record or replacement under an archived farm,
-- plot, crop season or livestock group. Voiding a record is still allowed
-- there. The parent rows are locked FOR SHARE (farm, then plot, then crop
-- season or livestock group, then -- for a correction -- the record
-- itself), so an archive and a new record can't pass each other: one
-- waits for the other. Waits give up after 5 seconds (lock_timeout,
-- SQLSTATE 55P03).
--
-- Dates: occurred_on may not be after today in Kenya (Africa/Nairobi).
--
-- FR-1b (crop activities, added to this draft before it was ever
-- applied): a short description; the amount of the work itself
-- (quantity + quantity_unit_id -- bags harvested, litres watered), kept
-- apart from the input used; labour (workers and hours); and what the
-- activity cost, in Kenyan shillings. Two crop kinds change: 'pruning' is
-- added and 'harvest' (reserved since R3a) is switched on. cost_kes is the
-- cost of one activity, not a finance ledger (that is R4).
--
-- Account deletion is unchanged: like every Farm Records table, records
-- are removed with the owner's profile (on delete cascade). created_by and
-- voided_by become null if that person's profile is deleted. How records
-- and these references should be kept or pseudonymised on erasure is the
-- separate M2E design, not this migration.
--
-- Nothing else existing changes: farms, farm_plots, crop_seasons,
-- livestock_groups, the reference tables and their policies, grants and
-- triggers are untouched apart from the two farm_record_kinds rows above. The new foreign keys only add PostgreSQL's
-- internal referential-integrity triggers to the referenced tables.
--
-- Fixed error messages (SQLSTATE):
--   not_signed_in (42501)
--   farm_record_in_future, record_kind_inactive,
--   record_kind_subject_mismatch, record_kind_no_input,
--   input_category_inactive, measurement_unit_inactive,
--   farm_record_invalid_insert, farm_record_supersede_invalid,
--   void_reason_required, void_reason_too_long (22023)
--   farm_archived, plot_archived, crop_season_archived,
--   livestock_group_archived, farm_record_already_voided,
--   farm_record_immutable (P0001)
--   farm_record_not_found (P0002)

-- === crop kinds (FR-1b) ======================================================

insert into public.farm_record_kinds (id, name, group_id, subject_mode, input_mode, sort_order, is_active) values
  ('pruning', 'Pruned', 'crops', 'crop', 'none', 65, true);
update public.farm_record_kinds set is_active = true where id = 'harvest';

-- === table ===================================================================

create table public.farm_records (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  farm_id uuid not null,
  plot_id uuid,
  crop_season_id uuid,
  livestock_group_id uuid,
  kind_id text not null references public.farm_record_kinds (id),
  occurred_on date not null,
  description text,
  input_category_id text references public.input_categories (id),
  input_product_name text,
  input_quantity numeric(12, 3),
  input_unit_id text references public.measurement_units (id),
  -- The work itself (FR-1b), separate from the input used.
  quantity numeric(12, 3),
  quantity_unit_id text references public.measurement_units (id),
  labour_workers integer,
  labour_hours numeric(8, 2),
  cost_kes numeric(12, 2),
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  supersedes_id uuid,
  voided_at timestamptz,
  voided_by uuid references public.profiles (id) on delete set null,
  void_reason text,

  -- The upper limit (today in Kenya) is checked by
  -- check_farm_record_date(): a CHECK can't depend on the current time.
  constraint farm_records_occurred_on_min check (occurred_on >= date '1900-01-01'),
  -- One subject at most besides the farm; a plot only for whole-farm
  -- records (crop season and livestock group records use their own plot).
  constraint farm_records_one_subject check (crop_season_id is null or livestock_group_id is null),
  constraint farm_records_plot_only_farm_level check (
    plot_id is null or (crop_season_id is null and livestock_group_id is null)
  ),
  constraint farm_records_input_product_name_length check (
    input_product_name is null or char_length(btrim(input_product_name)) between 1 and 120
  ),
  constraint farm_records_input_quantity_range check (
    input_quantity is null or (input_quantity > 0 and input_quantity <= 1000000)
  ),
  constraint farm_records_input_quantity_with_unit check ((input_quantity is null) = (input_unit_id is null)),
  constraint farm_records_input_needs_category check (
    input_category_id is not null
    or (input_product_name is null and input_quantity is null and input_unit_id is null)
  ),
  constraint farm_records_description_length check (
    description is null or char_length(btrim(description)) between 1 and 200
  ),
  constraint farm_records_work_quantity_range check (quantity is null or (quantity > 0 and quantity <= 1000000)),
  constraint farm_records_work_quantity_with_unit check ((quantity is null) = (quantity_unit_id is null)),
  constraint farm_records_labour_workers_range check (labour_workers is null or labour_workers between 1 and 10000),
  constraint farm_records_labour_hours_range check (labour_hours is null or (labour_hours > 0 and labour_hours <= 100000)),
  constraint farm_records_cost_range check (cost_kes is null or (cost_kes >= 0 and cost_kes <= 1000000000)),
  constraint farm_records_notes_length check (notes is null or char_length(btrim(notes)) between 1 and 2000),
  constraint farm_records_void_reason_length check (
    void_reason is null or char_length(btrim(void_reason)) between 1 and 300
  ),
  -- Voided means a time and a reason. voided_by is set when a record is
  -- voided (guard_farm_record_update) but may later become null if that
  -- person's profile is deleted; it is never set on a record that isn't
  -- voided.
  constraint farm_records_void_complete check ((voided_at is null) = (void_reason is null)),
  constraint farm_records_voided_by_only_when_voided check (voided_by is null or voided_at is not null),
  constraint farm_records_not_self_superseding check (supersedes_id is null or supersedes_id <> id),

  -- Target for the replacement link below.
  constraint farm_records_id_farm_id_profile_id_key unique (id, farm_id, profile_id),

  -- A record can only point at its owner's own farm, and at a plot, crop
  -- season or livestock group on that same farm with that same owner.
  constraint farm_records_farm_owner_fkey foreign key (farm_id, profile_id)
    references public.farms (id, profile_id) on delete cascade,
  constraint farm_records_plot_farm_owner_fkey foreign key (plot_id, farm_id, profile_id)
    references public.farm_plots (id, farm_id, profile_id) on delete cascade,
  constraint farm_records_crop_season_farm_owner_fkey foreign key (crop_season_id, farm_id, profile_id)
    references public.crop_seasons (id, farm_id, profile_id) on delete cascade,
  constraint farm_records_livestock_group_farm_owner_fkey foreign key (livestock_group_id, farm_id, profile_id)
    references public.livestock_groups (id, farm_id, profile_id) on delete cascade
);

-- A replacement stays on the record's farm and owner. on delete cascade,
-- not set null: set null would rewrite a frozen column (refused by
-- guard_farm_record_update), and anything it reaches is on the same farm
-- and owner, which is being deleted anyway.
alter table public.farm_records
  add constraint farm_records_supersedes_farm_owner_fkey foreign key (supersedes_id, farm_id, profile_id)
    references public.farm_records (id, farm_id, profile_id) on delete cascade;

-- At most one replacement per record, even if the row lock in
-- correct_farm_record were somehow bypassed.
create unique index farm_records_one_replacement_idx
  on public.farm_records (supersedes_id) where supersedes_id is not null;

-- Timelines (newest first; the trailing columns make keyset paging stable).
create index farm_records_farm_timeline_idx
  on public.farm_records (farm_id, occurred_on desc, created_at desc, id);
create index farm_records_farm_current_idx
  on public.farm_records (farm_id, occurred_on desc, created_at desc, id) where voided_at is null;
create index farm_records_crop_season_idx
  on public.farm_records (crop_season_id, occurred_on desc) where crop_season_id is not null;
create index farm_records_livestock_group_idx
  on public.farm_records (livestock_group_id, occurred_on desc) where livestock_group_id is not null;
create index farm_records_plot_idx
  on public.farm_records (plot_id, occurred_on desc) where plot_id is not null;
create index farm_records_profile_idx on public.farm_records (profile_id, occurred_on desc);

-- Foreign-key lookups (reference data, and the set null on profile
-- deletion).
create index farm_records_kind_id_idx on public.farm_records (kind_id);
create index farm_records_input_category_id_idx on public.farm_records (input_category_id) where input_category_id is not null;
create index farm_records_input_unit_id_idx on public.farm_records (input_unit_id) where input_unit_id is not null;
create index farm_records_quantity_unit_id_idx on public.farm_records (quantity_unit_id) where quantity_unit_id is not null;
create index farm_records_created_by_idx on public.farm_records (created_by) where created_by is not null;
create index farm_records_voided_by_idx on public.farm_records (voided_by) where voided_by is not null;

-- === insert triggers (run in name order: 10, 20, 30, 40, 50) ================

-- 10. Who and when come from the server, never the client: the owner and
-- author are the signed-in user, created_at is now. A new record is never
-- already voided. Text is trimmed.
create function public.prepare_farm_record()
returns trigger
language plpgsql
set search_path = ''
as $fn$
begin
  if auth.uid() is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;

  if num_nonnulls(new.voided_at, new.voided_by, new.void_reason) > 0 then
    raise exception 'farm_record_invalid_insert' using errcode = '22023';
  end if;

  new.profile_id := auth.uid();
  new.created_by := auth.uid();
  new.created_at := now();
  new.input_product_name := nullif(btrim(new.input_product_name), '');
  new.description := nullif(btrim(new.description), '');
  new.notes := nullif(btrim(new.notes), '');
  return new;
end;
$fn$;

-- 20. Not after today in Kenya, whatever the session's time zone.
create function public.check_farm_record_date()
returns trigger
language plpgsql
set search_path = ''
as $fn$
begin
  if new.occurred_on > (now() at time zone 'Africa/Nairobi')::date then
    raise exception 'farm_record_in_future' using errcode = '22023';
  end if;
  return new;
end;
$fn$;

-- 30. The record kind must be active and suit the record's subject; a
-- kind that takes no input gets none; a newly used input category or unit
-- must be active. A correction may keep the original's kind, category or
-- unit even if it has since been made inactive.
create function public.check_farm_record_kind()
returns trigger
language plpgsql
set search_path = ''
as $fn$
declare
  v_kind public.farm_record_kinds%rowtype;
  v_original public.farm_records%rowtype;
  v_has_original boolean := false;
  v_active boolean;
begin
  if new.supersedes_id is not null then
    select * into v_original
    from public.farm_records r
    where r.id = new.supersedes_id and r.profile_id = new.profile_id;
    v_has_original := found;
  end if;

  select * into v_kind from public.farm_record_kinds k where k.id = new.kind_id;
  if not found then
    -- Unknown kind: the foreign key rejects it (23503).
    return new;
  end if;

  if not v_kind.is_active and not (v_has_original and v_original.kind_id = new.kind_id) then
    raise exception 'record_kind_inactive' using errcode = '22023';
  end if;

  if (v_kind.subject_mode = 'crop' and new.crop_season_id is null)
     or (v_kind.subject_mode = 'livestock' and new.livestock_group_id is null)
     or (v_kind.subject_mode = 'farm' and (new.crop_season_id is not null or new.livestock_group_id is not null))
     or (v_kind.subject_mode = 'farm_or_crop' and new.livestock_group_id is not null) then
    raise exception 'record_kind_subject_mismatch' using errcode = '22023', detail = v_kind.subject_mode;
  end if;

  if v_kind.input_mode = 'none'
     and num_nonnulls(new.input_category_id, new.input_product_name, new.input_quantity, new.input_unit_id) > 0 then
    raise exception 'record_kind_no_input' using errcode = '22023';
  end if;

  if new.input_category_id is not null then
    select c.is_active into v_active from public.input_categories c where c.id = new.input_category_id;
    if found and not v_active
       and not (v_has_original and v_original.input_category_id = new.input_category_id) then
      raise exception 'input_category_inactive' using errcode = '22023';
    end if;
  end if;

  if new.input_unit_id is not null then
    select u.is_active into v_active from public.measurement_units u where u.id = new.input_unit_id;
    if found and not v_active
       and not (v_has_original and v_original.input_unit_id = new.input_unit_id) then
      raise exception 'measurement_unit_inactive' using errcode = '22023';
    end if;
  end if;

  if new.quantity_unit_id is not null then
    select u.is_active into v_active from public.measurement_units u where u.id = new.quantity_unit_id;
    if found and not v_active
       and not (v_has_original and v_original.quantity_unit_id = new.quantity_unit_id) then
      raise exception 'measurement_unit_inactive' using errcode = '22023';
    end if;
  end if;

  return new;
end;
$fn$;

-- 40. No new record under an archived farm, plot, crop season or
-- livestock group. Each parent is locked FOR SHARE, in the fixed order
-- farm -> plot -> crop season -> livestock group, so an archive of that
-- parent (an UPDATE) waits for this insert to finish, or this insert
-- waits for the archive and then sees it. Lookups are limited to the
-- record's own owner: someone else's farm, plot, season or group is
-- simply not found here and the composite foreign keys reject it
-- (23503), without revealing whether it exists or is archived.
--
-- Runs as the caller (security invoker). FOR SHARE needs UPDATE privilege
-- on the parent tables, which authenticated already has for its own rows.
create function public.check_farm_record_parents()
returns trigger
language plpgsql
set search_path = ''
set lock_timeout = '5s'
as $fn$
declare
  v_archived timestamptz;
begin
  select f.archived_at into v_archived
  from public.farms f
  where f.id = new.farm_id and f.profile_id = new.profile_id
  for share;
  if found and v_archived is not null then
    raise exception 'farm_archived' using errcode = 'P0001';
  end if;

  if new.plot_id is not null then
    select p.archived_at into v_archived
    from public.farm_plots p
    where p.id = new.plot_id and p.farm_id = new.farm_id and p.profile_id = new.profile_id
    for share;
    if found and v_archived is not null then
      raise exception 'plot_archived' using errcode = 'P0001';
    end if;
  end if;

  if new.crop_season_id is not null then
    select s.archived_at into v_archived
    from public.crop_seasons s
    where s.id = new.crop_season_id and s.farm_id = new.farm_id and s.profile_id = new.profile_id
    for share;
    if found and v_archived is not null then
      raise exception 'crop_season_archived' using errcode = 'P0001';
    end if;
  end if;

  if new.livestock_group_id is not null then
    select g.archived_at into v_archived
    from public.livestock_groups g
    where g.id = new.livestock_group_id and g.farm_id = new.farm_id and g.profile_id = new.profile_id
    for share;
    if found and v_archived is not null then
      raise exception 'livestock_group_archived' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$fn$;

-- 50. A replacement must point at a record on the same farm and owner
-- that has already been voided (correct_farm_record voids it first, in
-- the same transaction).
create function public.check_farm_record_supersedes()
returns trigger
language plpgsql
set search_path = ''
as $fn$
declare
  v_voided timestamptz;
begin
  if new.supersedes_id is null then
    return new;
  end if;

  select r.voided_at into v_voided
  from public.farm_records r
  where r.id = new.supersedes_id and r.farm_id = new.farm_id and r.profile_id = new.profile_id;

  if not found or v_voided is null then
    raise exception 'farm_record_supersede_invalid' using errcode = '22023';
  end if;
  return new;
end;
$fn$;

create trigger farm_records_10_prepare
  before insert on public.farm_records
  for each row execute function public.prepare_farm_record();

create trigger farm_records_20_check_date
  before insert on public.farm_records
  for each row execute function public.check_farm_record_date();

create trigger farm_records_30_check_kind
  before insert on public.farm_records
  for each row execute function public.check_farm_record_kind();

create trigger farm_records_40_check_parents
  before insert on public.farm_records
  for each row execute function public.check_farm_record_parents();

create trigger farm_records_50_check_supersedes
  before insert on public.farm_records
  for each row execute function public.check_farm_record_supersedes();

-- === immutable history =======================================================

-- A record never changes, with exactly two exceptions:
--  1. being voided once: voided_at (now), voided_by (the signed-in user)
--     and void_reason go from empty to set, everything else unchanged;
--  2. created_by / voided_by becoming null when that person's profile is
--     deleted (on delete set null), everything else unchanged.
-- Everything else -- editing, un-voiding, re-voiding -- is refused, even
-- for the project owner. DELETE is not blocked here: blocking it would
-- make account deletion fail, which changes deletion behaviour (M2E).
create function public.guard_farm_record_update()
returns trigger
language plpgsql
set search_path = ''
as $fn$
begin
  if (new.id, new.profile_id, new.farm_id, new.plot_id, new.crop_season_id, new.livestock_group_id,
      new.kind_id, new.occurred_on, new.description, new.input_category_id, new.input_product_name,
      new.input_quantity, new.input_unit_id, new.quantity, new.quantity_unit_id, new.labour_workers,
      new.labour_hours, new.cost_kes, new.notes, new.created_at, new.supersedes_id)
     is distinct from
     (old.id, old.profile_id, old.farm_id, old.plot_id, old.crop_season_id, old.livestock_group_id,
      old.kind_id, old.occurred_on, old.description, old.input_category_id, old.input_product_name,
      old.input_quantity, old.input_unit_id, old.quantity, old.quantity_unit_id, old.labour_workers,
      old.labour_hours, old.cost_kes, old.notes, old.created_at, old.supersedes_id) then
    raise exception 'farm_record_immutable' using errcode = 'P0001';
  end if;

  if old.voided_at is null and new.voided_at is not null then
    if new.voided_by is null
       or new.voided_by is distinct from auth.uid()
       or new.voided_at <> now()
       or new.void_reason is null
       or new.created_by is distinct from old.created_by then
      raise exception 'farm_record_immutable' using errcode = 'P0001';
    end if;
    return new;
  end if;

  if new.voided_at is not distinct from old.voided_at
     and new.void_reason is not distinct from old.void_reason
     and (new.created_by is not distinct from old.created_by or new.created_by is null)
     and (new.voided_by is not distinct from old.voided_by or new.voided_by is null) then
    return new;
  end if;

  raise exception 'farm_record_immutable' using errcode = 'P0001';
end;
$fn$;

create trigger farm_records_guard_update
  before update on public.farm_records
  for each row execute function public.guard_farm_record_update();

-- Trigger functions are only ever run by their triggers (EXECUTE is
-- checked when a trigger is created, not when it fires).
revoke all on function public.prepare_farm_record() from public, anon, authenticated, service_role;
revoke all on function public.check_farm_record_date() from public, anon, authenticated, service_role;
revoke all on function public.check_farm_record_kind() from public, anon, authenticated, service_role;
revoke all on function public.check_farm_record_parents() from public, anon, authenticated, service_role;
revoke all on function public.check_farm_record_supersedes() from public, anon, authenticated, service_role;
revoke all on function public.guard_farm_record_update() from public, anon, authenticated, service_role;

-- === privileges and RLS ======================================================

-- Supabase's default privileges grant everything on a new table to anon,
-- authenticated and service_role. Reset all three. authenticated may read
-- and may insert only the columns a farmer fills in -- never id,
-- profile_id, created_by, created_at, supersedes_id or the void columns.
-- No UPDATE, DELETE or TRUNCATE for anyone but the table owner.
revoke all on public.farm_records from anon, authenticated, service_role;
grant select on public.farm_records to authenticated;
grant insert (
  farm_id, plot_id, crop_season_id, livestock_group_id, kind_id, occurred_on, description,
  input_category_id, input_product_name, input_quantity, input_unit_id,
  quantity, quantity_unit_id, labour_workers, labour_hours, cost_kes, notes
) on public.farm_records to authenticated;
grant select on public.farm_records to service_role;

alter table public.farm_records enable row level security;

-- Includes voided records: the history stays visible to the owner.
create policy "Farmers can view their own farm records"
on public.farm_records
for select
to authenticated
using (profile_id = (select auth.uid()));

-- prepare_farm_record already sets both to the caller; the policy keeps
-- that true even if the trigger were ever removed.
create policy "Farmers can add records to their own farms"
on public.farm_records
for insert
to authenticated
with check (profile_id = (select auth.uid()) and created_by = (select auth.uid()));

-- === void and correct ========================================================

-- Voids one of the caller's own records with a reason. Allowed even when
-- its farm, plot, crop season or livestock group is archived. Someone
-- else's record (or a missing one) is 'farm_record_not_found'.
create function public.void_farm_record(p_record_id uuid, p_reason text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
set lock_timeout = '5s'
as $fn$
declare
  v_uid uuid := auth.uid();
  v_reason text := nullif(btrim(p_reason), '');
  v_voided timestamptz;
begin
  if v_uid is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if v_reason is null then
    raise exception 'void_reason_required' using errcode = '22023';
  end if;
  if char_length(v_reason) > 300 then
    raise exception 'void_reason_too_long' using errcode = '22023';
  end if;

  select r.voided_at into v_voided
  from public.farm_records r
  where r.id = p_record_id and r.profile_id = v_uid
  for update;

  if not found then
    raise exception 'farm_record_not_found' using errcode = 'P0002';
  end if;
  if v_voided is not null then
    raise exception 'farm_record_already_voided' using errcode = 'P0001';
  end if;

  update public.farm_records
  set voided_at = now(),
      voided_by = v_uid,
      void_reason = v_reason
  where id = p_record_id;
end;
$fn$;

-- Voids one of the caller's own records and adds its replacement, in one
-- transaction: if the replacement is refused for any reason, the void is
-- undone too. The replacement stays on the same farm (it may move to
-- another plot, crop season or livestock group there) and must not be
-- under an archived parent; the original's parents don't matter.
--
-- Lock order, the same as check_farm_record_parents(): the farm, then the
-- replacement's plot, crop season or livestock group (FOR SHARE), and
-- only then the original record (FOR UPDATE). Returns the replacement's
-- id.
create function public.correct_farm_record(
  p_record_id uuid,
  p_reason text,
  p_kind_id text,
  p_occurred_on date,
  p_plot_id uuid default null,
  p_crop_season_id uuid default null,
  p_livestock_group_id uuid default null,
  p_input_category_id text default null,
  p_input_product_name text default null,
  p_input_quantity numeric default null,
  p_input_unit_id text default null,
  p_notes text default null,
  p_description text default null,
  p_quantity numeric default null,
  p_quantity_unit_id text default null,
  p_labour_workers integer default null,
  p_labour_hours numeric default null,
  p_cost_kes numeric default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
set lock_timeout = '5s'
as $fn$
declare
  v_uid uuid := auth.uid();
  v_reason text := nullif(btrim(p_reason), '');
  v_farm_id uuid;
  v_voided timestamptz;
  v_archived timestamptz;
  v_new_id uuid;
begin
  if v_uid is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if v_reason is null then
    raise exception 'void_reason_required' using errcode = '22023';
  end if;
  if char_length(v_reason) > 300 then
    raise exception 'void_reason_too_long' using errcode = '22023';
  end if;

  -- The original's farm (farm_id never changes, so no lock is needed yet).
  select r.farm_id into v_farm_id
  from public.farm_records r
  where r.id = p_record_id and r.profile_id = v_uid;
  if not found then
    raise exception 'farm_record_not_found' using errcode = 'P0002';
  end if;

  -- Parents of the replacement, in lock order. Rows that aren't the
  -- caller's on this farm are not found here; the foreign keys reject
  -- them when the replacement is inserted.
  select f.archived_at into v_archived
  from public.farms f
  where f.id = v_farm_id and f.profile_id = v_uid
  for share;
  if found and v_archived is not null then
    raise exception 'farm_archived' using errcode = 'P0001';
  end if;

  if p_plot_id is not null then
    select p.archived_at into v_archived
    from public.farm_plots p
    where p.id = p_plot_id and p.farm_id = v_farm_id and p.profile_id = v_uid
    for share;
    if found and v_archived is not null then
      raise exception 'plot_archived' using errcode = 'P0001';
    end if;
  end if;

  if p_crop_season_id is not null then
    select s.archived_at into v_archived
    from public.crop_seasons s
    where s.id = p_crop_season_id and s.farm_id = v_farm_id and s.profile_id = v_uid
    for share;
    if found and v_archived is not null then
      raise exception 'crop_season_archived' using errcode = 'P0001';
    end if;
  end if;

  if p_livestock_group_id is not null then
    select g.archived_at into v_archived
    from public.livestock_groups g
    where g.id = p_livestock_group_id and g.farm_id = v_farm_id and g.profile_id = v_uid
    for share;
    if found and v_archived is not null then
      raise exception 'livestock_group_archived' using errcode = 'P0001';
    end if;
  end if;

  -- Now the original itself. A concurrent correction or void of the same
  -- record waits here, then sees it voided.
  select r.voided_at into v_voided
  from public.farm_records r
  where r.id = p_record_id and r.profile_id = v_uid
  for update;
  if not found then
    raise exception 'farm_record_not_found' using errcode = 'P0002';
  end if;
  if v_voided is not null then
    raise exception 'farm_record_already_voided' using errcode = 'P0001';
  end if;

  update public.farm_records
  set voided_at = now(),
      voided_by = v_uid,
      void_reason = v_reason
  where id = p_record_id;

  -- The insert triggers set the owner and author and check the kind,
  -- date, parents and link again.
  insert into public.farm_records (
    farm_id, plot_id, crop_season_id, livestock_group_id, kind_id, occurred_on, description,
    input_category_id, input_product_name, input_quantity, input_unit_id,
    quantity, quantity_unit_id, labour_workers, labour_hours, cost_kes, notes, supersedes_id
  )
  values (
    v_farm_id, p_plot_id, p_crop_season_id, p_livestock_group_id, p_kind_id, p_occurred_on, p_description,
    p_input_category_id, p_input_product_name, p_input_quantity, p_input_unit_id,
    p_quantity, p_quantity_unit_id, p_labour_workers, p_labour_hours, p_cost_kes, p_notes, p_record_id
  )
  returning id into v_new_id;

  return v_new_id;
end;
$fn$;

-- Supabase's default privileges grant EXECUTE on a new function to anon,
-- authenticated and service_role; `revoke ... from public` alone doesn't
-- remove those. Only signed-in farmers may call these two.
revoke all on function public.void_farm_record(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.void_farm_record(uuid, text) to authenticated;

revoke all on function public.correct_farm_record(
  uuid, text, text, date, uuid, uuid, uuid, text, text, numeric, text, text, text, numeric, text, integer, numeric, numeric
)
  from public, anon, authenticated, service_role;
grant execute on function public.correct_farm_record(
  uuid, text, text, date, uuid, uuid, uuid, text, text, numeric, text, text, text, numeric, text, integer, numeric, numeric
)
  to authenticated;
