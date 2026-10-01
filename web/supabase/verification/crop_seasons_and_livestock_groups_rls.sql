-- Verification script for
-- 20261001110000_add_farm_records_crop_seasons_and_livestock_groups.sql
--
-- Run in the Supabase SQL editor (or via the Supabase MCP execute_sql)
-- after the migration is applied. It is NOT a migration and changes
-- nothing: it creates two throwaway users (farmer A, farmer B), exercises
-- the crop_seasons / livestock_groups policies, grants, foreign keys,
-- constraints and archived-parent trigger as each of them and as anon,
-- then ALWAYS ends with RAISE EXCEPTION, which rolls every change back.
-- The results are in the error message ("VERIFY_RESULTS ...").
--
-- To verify BEFORE the migration is applied, paste the migration's
-- statements in place of the @@MIGRATION@@ line below: they then run in
-- the same transaction and are rolled back with everything else.
--
-- Expected output:
--    1 A adds a whole-farm crop season / one on own plot: OK / OK
--    2 A adds a whole-farm livestock group / one on own plot: OK / OK
--    3 A reads own crop seasons / livestock groups: rows = 2 / 2
--    4 A edits own crop season / livestock group: rows = 1 / 1
--    5 A ends own crop season: rows = 1
--    6 A archives + restores own crop season / livestock group: rows = 1+1 / 1+1
--    7 B reads A's crop seasons / livestock groups: rows = 0 / 0
--    8 B edits A's crop season / livestock group: rows = 0 / 0
--    9 B archives A's / restores A's archived crop season: rows = 0 / 0
--   10 B archives A's / restores A's archived livestock group: rows = 0 / 0
--   11 B adds a crop season / livestock group to A's farm (as B): DENIED 23503 / DENIED 23503
--   12 B adds a crop season / livestock group to A's farm (as A): DENIED 42501 / DENIED 42501
--   13 B attaches A's plot to own crop season / livestock group: DENIED 23503 / DENIED 23503
--   14 B moves own crop season / livestock group onto A's farm: DENIED 23503 / DENIED 23503
--   15 A attaches a plot from farm 1 to a record on farm 2 (crop / livestock): DENIED 23503 / DENIED 23503
--   16 A hands own crop season / livestock group to B: DENIED 42501 / DENIED 42501
--   17 A adds a crop season / livestock group to an archived farm: REJECTED farm_archived / REJECTED farm_archived
--   18 A adds a crop season / livestock group on an archived plot: REJECTED plot_archived / REJECTED plot_archived
--   19 records on a farm archived later: kept = 1 / 1; edit = 1 / 1; archive = 1 / 1; restore REJECTED farm_archived / REJECTED farm_archived
--   20 A moves a record onto an archived plot (crop / livestock): REJECTED plot_archived / REJECTED plot_archived
--   21 end date before start / no start date / year 20026: REJECTED 23514 / 23502 / 23514
--   22 area 0 / negative area: REJECTED 23514 / 23514
--   23 head count -1 / blank group name / unknown crop type / unknown livestock type: REJECTED 23514 / 23514 / 23503 / 23503
--   24 A deletes own crop season / livestock group: DENIED 42501 / DENIED 42501
--   25 A backdates created_at on insert / update: created_at kept = true / true
--   26 A moves a plot that has records to another own farm: DENIED 23503
--   27 anon reads crop seasons / livestock groups: DENIED 42501 / DENIED 42501
--   28 anon adds a crop season / livestock group: DENIED 42501 / DENIED 42501
--   29 composite keys (crop id+profile / id+farm+profile, livestock id+profile / id+farm+profile): true / true / true / true
--   30 a later-slice child table can reference (id, farm_id, profile_id): matching = OK; other farm = DENIED 23503; other owner = DENIED 23503
--   31 earliest date: crop start 1900-01-01 = OK, 1899-12-31 = REJECTED 23514; livestock start 1900-01-01 = OK, 1899-12-31 = REJECTED 23514
--   32 overlapping seasons of the same crop on the same plot: OK
--   33 duplicate livestock groups (same type, same name, same farm): OK
--   34 derived crop states (planned / growing / growing with future end / ended / archived): planned / growing / growing / ended / archived
--   35 livestock start label (future / past): Starting / Since
--   36 A's account deleted: A's crop seasons / livestock groups left = 0 / 0; B's kept = 1 / 1
--
-- 34 and 35 check the display rules (lib/farmRecords.ts cropSeasonState /
-- livestockStartLabel) written as SQL, with "today" in Kenya time:
--   archived  archived_at is not null
--   ended     ended_on <= today
--   planned   started_on > today
--   growing   everything else (started, and no end date or a future one)
--
-- Uses phone numbers 19990000933-934, which must not belong to real
-- accounts, and the 'nakuru' / 'kiambu' counties, 'maize' / 'beans' crop
-- types and 'dairy-cattle' / 'goats' livestock types.
do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  farm_a uuid; farm_a2 uuid; farm_b uuid;
  plot_a uuid; plot_a2 uuid; plot_a3 uuid; plot_b uuid;
  cs_a uuid; cs_a_plot uuid; cs_a2 uuid; cs_b uuid;
  lg_a uuid; lg_a_plot uuid; lg_a2 uuid; lg_b uuid;
  tmp uuid;
  ts timestamptz;
  n int; m int;
  r text := '';
begin
  -- @@MIGRATION@@

  insert into auth.users (id, aud, role, phone, created_at, updated_at) values
    (a, 'authenticated', 'authenticated', '19990000933', now(), now()),
    (b, 'authenticated', 'authenticated', '19990000934', now(), now());

  -- Farmer A: two farms, a plot on each.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.farms (profile_id, name, county_id) values (a, 'Dry run farm A1', 'nakuru') returning id into farm_a;
  insert into public.farms (profile_id, name, county_id) values (a, 'Dry run farm A2', 'nakuru') returning id into farm_a2;
  insert into public.farm_plots (farm_id, profile_id, name) values (farm_a, a, 'Plot A1') returning id into plot_a;
  insert into public.farm_plots (farm_id, profile_id, name) values (farm_a2, a, 'Plot A2') returning id into plot_a2;

  r := r || E'\n 1 A adds a whole-farm crop season / one on own plot: ';
  begin
    insert into public.crop_seasons (profile_id, farm_id, crop_type_id, label, started_on, area_acres)
    values (a, farm_a, 'maize', 'Long rains 2026', date '2026-03-15', 1.5) returning id into cs_a;
    r := r || 'OK';
  exception when others then r := r || 'FAILED ' || sqlstate || ' ' || sqlerrm;
  end;
  begin
    insert into public.crop_seasons (profile_id, farm_id, plot_id, crop_type_id, started_on)
    values (a, farm_a, plot_a, 'beans', date '2026-04-01') returning id into cs_a_plot;
    r := r || ' / OK';
  exception when others then r := r || ' / FAILED ' || sqlstate || ' ' || sqlerrm;
  end;

  r := r || E'\n 2 A adds a whole-farm livestock group / one on own plot: ';
  begin
    insert into public.livestock_groups (profile_id, farm_id, livestock_type_id, name, head_count, started_on)
    values (a, farm_a, 'dairy-cattle', 'Milking cows', 4, date '2025-06-01') returning id into lg_a;
    r := r || 'OK';
  exception when others then r := r || 'FAILED ' || sqlstate || ' ' || sqlerrm;
  end;
  begin
    insert into public.livestock_groups (profile_id, farm_id, plot_id, livestock_type_id, name)
    values (a, farm_a, plot_a, 'goats', 'Goats') returning id into lg_a_plot;
    r := r || ' / OK';
  exception when others then r := r || ' / FAILED ' || sqlstate || ' ' || sqlerrm;
  end;

  select count(*) into n from public.crop_seasons;
  select count(*) into m from public.livestock_groups;
  r := r || E'\n 3 A reads own crop seasons / livestock groups: rows = ' || n || ' / ' || m;

  update public.crop_seasons set label = 'Long rains', area_acres = 2 where id = cs_a;
  get diagnostics n = row_count;
  update public.livestock_groups set head_count = 5, name = 'Dairy herd' where id = lg_a;
  get diagnostics m = row_count;
  r := r || E'\n 4 A edits own crop season / livestock group: rows = ' || n || ' / ' || m;

  update public.crop_seasons set ended_on = date '2026-08-01' where id = cs_a_plot;
  get diagnostics n = row_count;
  r := r || E'\n 5 A ends own crop season: rows = ' || n;

  r := r || E'\n 6 A archives + restores own crop season / livestock group: rows = ';
  update public.crop_seasons set archived_at = now() where id = cs_a;
  get diagnostics n = row_count;
  update public.crop_seasons set archived_at = null where id = cs_a;
  get diagnostics m = row_count;
  r := r || n || '+' || m;
  update public.livestock_groups set archived_at = now() where id = lg_a;
  get diagnostics n = row_count;
  update public.livestock_groups set archived_at = null where id = lg_a;
  get diagnostics m = row_count;
  r := r || ' / ' || n || '+' || m;
  reset role;

  -- Farmer B: own farm, plot and records.
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.farms (profile_id, name, county_id) values (b, 'Dry run farm B', 'kiambu') returning id into farm_b;
  insert into public.farm_plots (farm_id, profile_id, name) values (farm_b, b, 'Plot B') returning id into plot_b;
  insert into public.crop_seasons (profile_id, farm_id, crop_type_id, started_on)
  values (b, farm_b, 'maize', date '2026-03-01') returning id into cs_b;
  insert into public.livestock_groups (profile_id, farm_id, livestock_type_id, name)
  values (b, farm_b, 'goats', 'B goats') returning id into lg_b;

  select count(*) into n from public.crop_seasons where profile_id = a;
  select count(*) into m from public.livestock_groups where profile_id = a;
  r := r || E'\n 7 B reads A''s crop seasons / livestock groups: rows = ' || n || ' / ' || m;

  update public.crop_seasons set label = 'Hijacked' where id = cs_a;
  get diagnostics n = row_count;
  update public.livestock_groups set name = 'Hijacked' where id = lg_a;
  get diagnostics m = row_count;
  r := r || E'\n 8 B edits A''s crop season / livestock group: rows = ' || n || ' / ' || m;
  reset role;

  -- A archives one of each so B can try to restore them.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.crop_seasons set archived_at = now() where id = cs_a_plot;
  update public.livestock_groups set archived_at = now() where id = lg_a_plot;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.crop_seasons set archived_at = now() where id = cs_a;
  get diagnostics n = row_count;
  update public.crop_seasons set archived_at = null where id = cs_a_plot;
  get diagnostics m = row_count;
  r := r || E'\n 9 B archives A''s / restores A''s archived crop season: rows = ' || n || ' / ' || m;
  update public.livestock_groups set archived_at = now() where id = lg_a;
  get diagnostics n = row_count;
  update public.livestock_groups set archived_at = null where id = lg_a_plot;
  get diagnostics m = row_count;
  r := r || E'\n10 B archives A''s / restores A''s archived livestock group: rows = ' || n || ' / ' || m;

  r := r || E'\n11 B adds a crop season / livestock group to A''s farm (as B): ';
  begin
    insert into public.crop_seasons (profile_id, farm_id, crop_type_id, started_on) values (b, farm_a, 'maize', current_date);
    r := r || 'ALLOWED';
  exception when others then r := r || 'DENIED ' || sqlstate;
  end;
  begin
    insert into public.livestock_groups (profile_id, farm_id, livestock_type_id, name) values (b, farm_a, 'goats', 'Forged');
    r := r || ' / ALLOWED';
  exception when others then r := r || ' / DENIED ' || sqlstate;
  end;

  r := r || E'\n12 B adds a crop season / livestock group to A''s farm (as A): ';
  begin
    insert into public.crop_seasons (profile_id, farm_id, crop_type_id, started_on) values (a, farm_a, 'maize', current_date);
    r := r || 'ALLOWED';
  exception when others then r := r || 'DENIED ' || sqlstate;
  end;
  begin
    insert into public.livestock_groups (profile_id, farm_id, livestock_type_id, name) values (a, farm_a, 'goats', 'Forged');
    r := r || ' / ALLOWED';
  exception when others then r := r || ' / DENIED ' || sqlstate;
  end;

  r := r || E'\n13 B attaches A''s plot to own crop season / livestock group: ';
  begin
    update public.crop_seasons set plot_id = plot_a where id = cs_b;
    get diagnostics n = row_count;
    r := r || 'ALLOWED rows = ' || n;
  exception when others then r := r || 'DENIED ' || sqlstate;
  end;
  begin
    update public.livestock_groups set plot_id = plot_a where id = lg_b;
    get diagnostics n = row_count;
    r := r || ' / ALLOWED rows = ' || n;
  exception when others then r := r || ' / DENIED ' || sqlstate;
  end;

  r := r || E'\n14 B moves own crop season / livestock group onto A''s farm: ';
  begin
    update public.crop_seasons set farm_id = farm_a where id = cs_b;
    get diagnostics n = row_count;
    r := r || 'ALLOWED rows = ' || n;
  exception when others then r := r || 'DENIED ' || sqlstate;
  end;
  begin
    update public.livestock_groups set farm_id = farm_a where id = lg_b;
    get diagnostics n = row_count;
    r := r || ' / ALLOWED rows = ' || n;
  exception when others then r := r || ' / DENIED ' || sqlstate;
  end;
  reset role;

  -- Back to farmer A.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  r := r || E'\n15 A attaches a plot from farm 1 to a record on farm 2 (crop / livestock): ';
  begin
    insert into public.crop_seasons (profile_id, farm_id, plot_id, crop_type_id, started_on)
    values (a, farm_a2, plot_a, 'maize', current_date);
    r := r || 'ALLOWED';
  exception when others then r := r || 'DENIED ' || sqlstate;
  end;
  begin
    insert into public.livestock_groups (profile_id, farm_id, plot_id, livestock_type_id, name)
    values (a, farm_a2, plot_a, 'goats', 'Wrong farm');
    r := r || ' / ALLOWED';
  exception when others then r := r || ' / DENIED ' || sqlstate;
  end;

  r := r || E'\n16 A hands own crop season / livestock group to B: ';
  begin
    update public.crop_seasons set profile_id = b where id = cs_a;
    get diagnostics n = row_count;
    r := r || 'ALLOWED rows = ' || n;
  exception when others then r := r || 'DENIED ' || sqlstate;
  end;
  begin
    update public.livestock_groups set profile_id = b where id = lg_a;
    get diagnostics n = row_count;
    r := r || ' / ALLOWED rows = ' || n;
  exception when others then r := r || ' / DENIED ' || sqlstate;
  end;

  -- Records that exist on farm A2 before it is archived.
  insert into public.crop_seasons (profile_id, farm_id, crop_type_id, started_on)
  values (a, farm_a2, 'maize', date '2026-02-01') returning id into cs_a2;
  insert into public.livestock_groups (profile_id, farm_id, livestock_type_id, name)
  values (a, farm_a2, 'goats', 'A2 goats') returning id into lg_a2;
  update public.farms set archived_at = now() where id = farm_a2;

  r := r || E'\n17 A adds a crop season / livestock group to an archived farm: ';
  begin
    insert into public.crop_seasons (profile_id, farm_id, crop_type_id, started_on) values (a, farm_a2, 'maize', current_date);
    r := r || 'ALLOWED';
  exception when others then r := r || 'REJECTED ' || sqlerrm;
  end;
  begin
    insert into public.livestock_groups (profile_id, farm_id, livestock_type_id, name) values (a, farm_a2, 'goats', 'Late');
    r := r || ' / ALLOWED';
  exception when others then r := r || ' / REJECTED ' || sqlerrm;
  end;

  -- An archived plot on an active farm.
  insert into public.farm_plots (farm_id, profile_id, name) values (farm_a, a, 'Old field') returning id into plot_a3;
  update public.farm_plots set archived_at = now() where id = plot_a3;

  r := r || E'\n18 A adds a crop season / livestock group on an archived plot: ';
  begin
    insert into public.crop_seasons (profile_id, farm_id, plot_id, crop_type_id, started_on) values (a, farm_a, plot_a3, 'maize', current_date);
    r := r || 'ALLOWED';
  exception when others then r := r || 'REJECTED ' || sqlerrm;
  end;
  begin
    insert into public.livestock_groups (profile_id, farm_id, plot_id, livestock_type_id, name) values (a, farm_a, plot_a3, 'goats', 'Late');
    r := r || ' / ALLOWED';
  exception when others then r := r || ' / REJECTED ' || sqlerrm;
  end;

  r := r || E'\n19 records on a farm archived later: kept = ';
  select count(*) into n from public.crop_seasons where id = cs_a2 and archived_at is null;
  select count(*) into m from public.livestock_groups where id = lg_a2 and archived_at is null;
  r := r || n || ' / ' || m || '; edit = ';
  update public.crop_seasons set label = 'Short rains', ended_on = date '2026-06-01' where id = cs_a2;
  get diagnostics n = row_count;
  update public.livestock_groups set head_count = 7 where id = lg_a2;
  get diagnostics m = row_count;
  r := r || n || ' / ' || m || '; archive = ';
  update public.crop_seasons set archived_at = now() where id = cs_a2;
  get diagnostics n = row_count;
  update public.livestock_groups set archived_at = now() where id = lg_a2;
  get diagnostics m = row_count;
  r := r || n || ' / ' || m || '; restore ';
  begin
    update public.crop_seasons set archived_at = null where id = cs_a2;
    r := r || 'ALLOWED';
  exception when others then r := r || 'REJECTED ' || sqlerrm;
  end;
  begin
    update public.livestock_groups set archived_at = null where id = lg_a2;
    r := r || ' / ALLOWED';
  exception when others then r := r || ' / REJECTED ' || sqlerrm;
  end;

  r := r || E'\n20 A moves a record onto an archived plot (crop / livestock): ';
  begin
    update public.crop_seasons set plot_id = plot_a3 where id = cs_a;
    r := r || 'ALLOWED';
  exception when others then r := r || 'REJECTED ' || sqlerrm;
  end;
  begin
    update public.livestock_groups set plot_id = plot_a3 where id = lg_a;
    r := r || ' / ALLOWED';
  exception when others then r := r || ' / REJECTED ' || sqlerrm;
  end;

  r := r || E'\n21 end date before start / no start date / year 20026: ';
  begin
    insert into public.crop_seasons (profile_id, farm_id, crop_type_id, started_on, ended_on)
    values (a, farm_a, 'maize', date '2026-05-01', date '2026-04-30');
    r := r || 'ALLOWED';
  exception when others then r := r || 'REJECTED ' || sqlstate;
  end;
  begin
    insert into public.crop_seasons (profile_id, farm_id, crop_type_id) values (a, farm_a, 'maize');
    r := r || ' / ALLOWED';
  exception when others then r := r || ' / ' || sqlstate;
  end;
  begin
    insert into public.crop_seasons (profile_id, farm_id, crop_type_id, started_on) values (a, farm_a, 'maize', date '20026-01-01');
    r := r || ' / ALLOWED';
  exception when others then r := r || ' / ' || sqlstate;
  end;

  r := r || E'\n22 area 0 / negative area: ';
  begin
    insert into public.crop_seasons (profile_id, farm_id, crop_type_id, started_on, area_acres) values (a, farm_a, 'maize', current_date, 0);
    r := r || 'ALLOWED';
  exception when others then r := r || 'REJECTED ' || sqlstate;
  end;
  begin
    insert into public.crop_seasons (profile_id, farm_id, crop_type_id, started_on, area_acres) values (a, farm_a, 'maize', current_date, -2);
    r := r || ' / ALLOWED';
  exception when others then r := r || ' / ' || sqlstate;
  end;

  r := r || E'\n23 head count -1 / blank group name / unknown crop type / unknown livestock type: ';
  begin
    insert into public.livestock_groups (profile_id, farm_id, livestock_type_id, name, head_count) values (a, farm_a, 'goats', 'Goats', -1);
    r := r || 'ALLOWED';
  exception when others then r := r || 'REJECTED ' || sqlstate;
  end;
  begin
    insert into public.livestock_groups (profile_id, farm_id, livestock_type_id, name) values (a, farm_a, 'goats', '   ');
    r := r || ' / ALLOWED';
  exception when others then r := r || ' / ' || sqlstate;
  end;
  begin
    insert into public.crop_seasons (profile_id, farm_id, crop_type_id, started_on) values (a, farm_a, 'not-a-crop', current_date);
    r := r || ' / ALLOWED';
  exception when others then r := r || ' / ' || sqlstate;
  end;
  begin
    insert into public.livestock_groups (profile_id, farm_id, livestock_type_id, name) values (a, farm_a, 'unicorns', 'Herd');
    r := r || ' / ALLOWED';
  exception when others then r := r || ' / ' || sqlstate;
  end;

  r := r || E'\n24 A deletes own crop season / livestock group: ';
  begin
    delete from public.crop_seasons where id = cs_a;
    get diagnostics n = row_count;
    r := r || 'ALLOWED rows = ' || n;
  exception when others then r := r || 'DENIED ' || sqlstate;
  end;
  begin
    delete from public.livestock_groups where id = lg_a;
    get diagnostics n = row_count;
    r := r || ' / ALLOWED rows = ' || n;
  exception when others then r := r || ' / DENIED ' || sqlstate;
  end;

  r := r || E'\n25 A backdates created_at on insert / update: created_at kept = ';
  insert into public.crop_seasons (profile_id, farm_id, crop_type_id, started_on, created_at)
  values (a, farm_a, 'maize', current_date, timestamptz '2001-01-01') returning id, created_at into tmp, ts;
  r := r || (ts > timestamptz '2020-01-01');
  update public.livestock_groups set created_at = timestamptz '2001-01-01' where id = lg_a;
  select created_at into ts from public.livestock_groups where id = lg_a;
  r := r || ' / ' || (ts > timestamptz '2020-01-01');

  r := r || E'\n26 A moves a plot that has records to another own farm: ';
  begin
    update public.farm_plots set farm_id = farm_a2 where id = plot_a;
    get diagnostics n = row_count;
    r := r || 'ALLOWED rows = ' || n;
  exception when others then r := r || 'DENIED ' || sqlstate;
  end;
  reset role;

  -- Anonymous.
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  set local role anon;
  r := r || E'\n27 anon reads crop seasons / livestock groups: ';
  begin
    select count(*) into n from public.crop_seasons;
    r := r || 'rows = ' || n;
  exception when others then r := r || 'DENIED ' || sqlstate;
  end;
  begin
    select count(*) into n from public.livestock_groups;
    r := r || ' / rows = ' || n;
  exception when others then r := r || ' / DENIED ' || sqlstate;
  end;
  r := r || E'\n28 anon adds a crop season / livestock group: ';
  begin
    insert into public.crop_seasons (profile_id, farm_id, crop_type_id, started_on) values (a, farm_a, 'maize', current_date);
    r := r || 'ALLOWED';
  exception when others then r := r || 'DENIED ' || sqlstate;
  end;
  begin
    insert into public.livestock_groups (profile_id, farm_id, livestock_type_id, name) values (a, farm_a, 'goats', 'Anon');
    r := r || ' / ALLOWED';
  exception when others then r := r || ' / DENIED ' || sqlstate;
  end;
  reset role;

  -- Keys for later slices (as the project owner).
  r := r || E'\n29 composite keys (crop id+profile / id+farm+profile, livestock id+profile / id+farm+profile): '
    || exists (select 1 from pg_constraint where conrelid = 'public.crop_seasons'::regclass and conname = 'crop_seasons_id_profile_id_key' and contype = 'u')
    || ' / ' || exists (select 1 from pg_constraint where conrelid = 'public.crop_seasons'::regclass and conname = 'crop_seasons_id_farm_id_profile_id_key' and contype = 'u')
    || ' / ' || exists (select 1 from pg_constraint where conrelid = 'public.livestock_groups'::regclass and conname = 'livestock_groups_id_profile_id_key' and contype = 'u')
    || ' / ' || exists (select 1 from pg_constraint where conrelid = 'public.livestock_groups'::regclass and conname = 'livestock_groups_id_farm_id_profile_id_key' and contype = 'u');

  -- A throwaway child table shaped like a future harvest record, to prove
  -- the key works as a composite foreign-key target. Rolled back below.
  create table public.r2_verify_child_probe (
    season_id uuid not null,
    farm_id uuid not null,
    profile_id uuid not null,
    foreign key (season_id, farm_id, profile_id) references public.crop_seasons (id, farm_id, profile_id)
  );
  r := r || E'\n30 a later-slice child table can reference (id, farm_id, profile_id): ';
  begin
    insert into public.r2_verify_child_probe values (cs_a, farm_a, a);
    r := r || 'matching = OK';
  exception when others then r := r || 'matching = FAILED ' || sqlstate;
  end;
  begin
    insert into public.r2_verify_child_probe values (cs_a, farm_a2, a);
    r := r || '; other farm = ALLOWED';
  exception when others then r := r || '; other farm = DENIED ' || sqlstate;
  end;
  begin
    insert into public.r2_verify_child_probe values (cs_a, farm_a, b);
    r := r || '; other owner = ALLOWED';
  exception when others then r := r || '; other owner = DENIED ' || sqlstate;
  end;

  -- Back to farmer A for the date, overlap, duplicate and state checks.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  r := r || E'\n31 earliest date: crop start 1900-01-01 = ';
  begin
    insert into public.crop_seasons (profile_id, farm_id, crop_type_id, label, started_on) values (a, farm_a, 'tea', 'Grandfather''s tea', date '1900-01-01');
    r := r || 'OK';
  exception when others then r := r || 'FAILED ' || sqlstate;
  end;
  begin
    insert into public.crop_seasons (profile_id, farm_id, crop_type_id, started_on) values (a, farm_a, 'tea', date '1899-12-31');
    r := r || ', 1899-12-31 = ALLOWED';
  exception when others then r := r || ', 1899-12-31 = REJECTED ' || sqlstate;
  end;
  begin
    insert into public.livestock_groups (profile_id, farm_id, livestock_type_id, name, started_on) values (a, farm_a, 'goats', 'Old herd', date '1900-01-01');
    r := r || '; livestock start 1900-01-01 = OK';
  exception when others then r := r || '; livestock start 1900-01-01 = FAILED ' || sqlstate;
  end;
  begin
    insert into public.livestock_groups (profile_id, farm_id, livestock_type_id, name, started_on) values (a, farm_a, 'goats', 'Older herd', date '1899-12-31');
    r := r || ', 1899-12-31 = ALLOWED';
  exception when others then r := r || ', 1899-12-31 = REJECTED ' || sqlstate;
  end;

  r := r || E'\n32 overlapping seasons of the same crop on the same plot: ';
  begin
    insert into public.crop_seasons (profile_id, farm_id, plot_id, crop_type_id, started_on, ended_on)
    values (a, farm_a, plot_a, 'maize', date '2026-01-10', date '2026-06-30');
    insert into public.crop_seasons (profile_id, farm_id, plot_id, crop_type_id, started_on, ended_on)
    values (a, farm_a, plot_a, 'maize', date '2026-03-01', date '2026-08-31');
    r := r || 'OK';
  exception when others then r := r || 'FAILED ' || sqlstate;
  end;

  r := r || E'\n33 duplicate livestock groups (same type, same name, same farm): ';
  begin
    insert into public.livestock_groups (profile_id, farm_id, livestock_type_id, name) values (a, farm_a, 'dairy-cattle', 'Dairy cows');
    insert into public.livestock_groups (profile_id, farm_id, livestock_type_id, name) values (a, farm_a, 'dairy-cattle', 'Dairy cows');
    r := r || 'OK';
  exception when others then r := r || 'FAILED ' || sqlstate;
  end;

  r := r || E'\n34 derived crop states (planned / growing / growing with future end / ended / archived): ';
  declare
    today date := (now() at time zone 'Africa/Nairobi')::date;
    ids uuid[] := array[]::uuid[];
    s text;
  begin
    insert into public.crop_seasons (profile_id, farm_id, crop_type_id, started_on) values (a, farm_a, 'maize', today + 45) returning id into tmp;
    ids := ids || tmp;
    insert into public.crop_seasons (profile_id, farm_id, crop_type_id, started_on) values (a, farm_a, 'maize', today - 30) returning id into tmp;
    ids := ids || tmp;
    insert into public.crop_seasons (profile_id, farm_id, crop_type_id, started_on, ended_on) values (a, farm_a, 'maize', today - 30, today + 60) returning id into tmp;
    ids := ids || tmp;
    insert into public.crop_seasons (profile_id, farm_id, crop_type_id, started_on, ended_on) values (a, farm_a, 'maize', today - 200, today - 10) returning id into tmp;
    ids := ids || tmp;
    insert into public.crop_seasons (profile_id, farm_id, crop_type_id, started_on, archived_at) values (a, farm_a, 'maize', today - 30, now()) returning id into tmp;
    ids := ids || tmp;
    select string_agg(
      case
        when c.archived_at is not null then 'archived'
        when c.ended_on is not null and c.ended_on <= today then 'ended'
        when c.started_on > today then 'planned'
        else 'growing'
      end, ' / ' order by x.ord)
    into s
    from unnest(ids) with ordinality as x (id, ord)
    join public.crop_seasons c on c.id = x.id;
    r := r || s;
  end;

  r := r || E'\n35 livestock start label (future / past): ';
  declare
    today date := (now() at time zone 'Africa/Nairobi')::date;
    s text;
  begin
    insert into public.livestock_groups (profile_id, farm_id, livestock_type_id, name, started_on) values (a, farm_a, 'poultry', 'New flock', today + 20) returning id into tmp;
    select case when started_on > today then 'Starting' else 'Since' end into s from public.livestock_groups where id = tmp;
    r := r || s;
    insert into public.livestock_groups (profile_id, farm_id, livestock_type_id, name, started_on) values (a, farm_a, 'poultry', 'Old flock', today - 20) returning id into tmp;
    select case when started_on > today then 'Starting' else 'Since' end into s from public.livestock_groups where id = tmp;
    r := r || ' / ' || s;
  end;
  reset role;

  -- Account deletion cascades (as the project owner).
  delete from public.r2_verify_child_probe;
  delete from auth.users where id = a;
  select count(*) into n from public.crop_seasons where profile_id = a;
  select count(*) into m from public.livestock_groups where profile_id = a;
  r := r || E'\n36 A''s account deleted: A''s crop seasons / livestock groups left = ' || n || ' / ' || m;
  select count(*) into n from public.crop_seasons where id = cs_b;
  select count(*) into m from public.livestock_groups where id = lg_b;
  r := r || '; B''s kept = ' || n || ' / ' || m;

  raise exception 'VERIFY_RESULTS (rolled back):%', r;
end $$;
