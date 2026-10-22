-- Farm Records: archived parents, safe under concurrency.
--
-- Promoted from supabase/drafts/20261020170000_guard_plots_on_archived_farms.sql
-- with its SQL unchanged. Must be applied before the farm activity log
-- (FR-1a), whose verification expects this migration's extra trigger.
-- Verification: supabase/verification/farm_plots_archived_farm.sql
--
-- Two changes:
--
-- 1. farm_plots gets the archived-farm rule crop_seasons and
--    livestock_groups already have: no new plot on an archived farm, no
--    plot moved onto one, and no plot restored while its farm is archived.
--    Renaming, resizing or archiving a plot on an archived farm is still
--    allowed, exactly as R2 still allows editing and archiving records on
--    an archived farm.
--
-- 2. check_farm_record_parents_active (R2, crop_seasons and
--    livestock_groups) keeps its rules but now locks what it checks.
--
-- Why the locks. Without them, the check reads the farm or plot as it was
-- last committed. If another transaction is archiving that farm or plot
-- at the same moment, the check sees it still active, the write goes
-- through, both commit, and an active plot, crop season or livestock
-- group ends up under an archived parent. (Reproduced locally for plots;
-- the R2 function has the same shape.)
--
-- Each check now reads its parent rows FOR SHARE. Archiving a farm or plot
-- is an UPDATE, which needs a lock FOR SHARE conflicts with, so the two
-- can no longer pass each other:
--   - archive first: the write waits for the archive to commit, then sees
--     the parent archived and is refused (farm_archived / plot_archived);
--   - write first: the archive waits for the write to commit, then
--     archives as usual (the record simply predates the archive, which is
--     the normal case for anything already on a farm).
-- FOR SHARE is the weakest lock that works: FOR KEY SHARE does not
-- conflict with a plain (non-key) UPDATE such as archiving.
--
-- Lock order: always the farm row first, then the plot row -- the same
-- order the farm activity log draft (FR-1a) uses for farm, plot, then
-- crop season or livestock group. Archiving a farm and archiving a plot
-- are separate single-statement requests in the app, so they never hold
-- one lock while waiting for the other. Any future function that changes
-- a farm and its plots in one transaction must also take the farm before
-- the plots.
--
-- Bounded wait: each function runs with lock_timeout = 5s. A write that
-- would wait longer is cancelled with SQLSTATE 55P03 (lock_not_available)
-- instead of hanging until the API's statement timeout. In normal use the
-- wait is a few milliseconds. The app should map 55P03 to a "try again"
-- message.
--
-- The checks still run as the caller (not SECURITY DEFINER), so they only
-- see -- and only lock -- the caller's own farms and plots under RLS.
-- Someone else's farm or plot is invisible here: nothing is locked or
-- waited on, and the request falls through to the composite foreign keys,
-- which reject it (23503) without revealing whether it exists or is
-- archived. SELECT ... FOR SHARE needs UPDATE privilege and the UPDATE
-- policy; authenticated has both on its own farms and plots.
--
-- Nothing else changes: no columns, constraints, indexes, policies or
-- grants. The R2 function keeps its name, owner, privileges, triggers and
-- error messages; only its body and settings are replaced. Existing rows
-- are not checked or changed.
--
-- Errors (SQLSTATE): farm_archived, plot_archived (P0001, unchanged);
-- lock timeout (55P03, new).

-- === plots ===================================================================

create function public.check_farm_plot_farm_active()
returns trigger
language plpgsql
set search_path = ''
set lock_timeout = '5s'
as $fn$
declare
  v_archived_at timestamptz;
begin
  -- Updates that keep the plot on the same farm and don't restore it
  -- (rename, resize, archive) are always allowed.
  if tg_op = 'UPDATE'
     and new.farm_id is not distinct from old.farm_id
     and not (old.archived_at is not null and new.archived_at is null) then
    return new;
  end if;

  select f.archived_at into v_archived_at
  from public.farms f
  where f.id = new.farm_id
  for share;
  if found and v_archived_at is not null then
    raise exception 'farm_archived' using errcode = 'P0001';
  end if;

  return new;
end;
$fn$;

revoke all on function public.check_farm_plot_farm_active() from public;
revoke execute on function public.check_farm_plot_farm_active() from anon;
revoke execute on function public.check_farm_plot_farm_active() from authenticated;

create trigger check_farm_plots_farm_active
  before insert or update on public.farm_plots
  for each row
  execute function public.check_farm_plot_farm_active();

-- === crop seasons and livestock groups (R2) ==================================
--
-- Same rules as 20261001110000: checked on insert, when farm_id or plot_id
-- change, and when an archived record is restored; other updates (rename,
-- end a season, archive) pass. Farm first, then plot.

create or replace function public.check_farm_record_parents_active()
returns trigger
language plpgsql
set search_path = ''
set lock_timeout = '5s'
as $fn$
declare
  v_archived_at timestamptz;
begin
  if tg_op = 'UPDATE'
     and new.farm_id is not distinct from old.farm_id
     and new.plot_id is not distinct from old.plot_id
     and not (old.archived_at is not null and new.archived_at is null) then
    return new;
  end if;

  select f.archived_at into v_archived_at
  from public.farms f
  where f.id = new.farm_id
  for share;
  if found and v_archived_at is not null then
    raise exception 'farm_archived' using errcode = 'P0001';
  end if;

  if new.plot_id is not null then
    select p.archived_at into v_archived_at
    from public.farm_plots p
    where p.id = new.plot_id
    for share;
    if found and v_archived_at is not null then
      raise exception 'plot_archived' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$fn$;
