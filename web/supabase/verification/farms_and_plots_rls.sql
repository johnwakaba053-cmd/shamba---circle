-- Verification script for 20261001090000_add_farm_records_farms_and_plots.sql
-- and 20261001100000_add_farm_plot_name_uniqueness_and_farm_key.sql
--
-- Run in the Supabase SQL editor (or via the Supabase MCP execute_sql).
-- It is NOT a migration and changes nothing: it creates two throwaway
-- users (farmer A, farmer B), exercises the farms/farm_plots policies,
-- grants and constraints as each of them and as anon, then ALWAYS ends
-- with RAISE EXCEPTION, which rolls every change back. The results are in
-- the error message ("VERIFY_RESULTS ...").
--
-- Expected output:
--    1 A creates own farm: OK
--    2 A creates a plot on own farm: OK
--    3 A creates a farm owned by B: DENIED 42501
--    4 A reads own farms / plots: rows = 1 / 1
--    5 B reads A's farms / plots: rows = 0 / 0
--    6 B updates A's farm: rows = 0
--    7 B archives A's plot: rows = 0
--    8 B adds a plot to A's farm (as B): DENIED 23503
--    9 B adds a plot to A's farm (as A): DENIED 42501
--   10 B moves own plot onto A's farm: DENIED 23503
--   11 A gives own farm to B: DENIED 42501
--   12 A deletes own plot / farm: DENIED 42501 / DENIED 42501
--   13 invalid tenure / zero acres / blank name: REJECTED 23514 / 23514 / 23514
--   14 A backdates created_at on insert / update: created_at kept = true / true
--   15 A archives and restores own farm: rows = 1 / 1
--   16 A adds a duplicate active plot name (exact / other case + spaces): REJECTED 23505 / REJECTED 23505
--   17 A reuses the name on another own farm: OK
--   18 A reuses the name of an archived plot: OK
--   19 A restores a plot whose name is now taken: REJECTED 23505
--   20 anon reads farms / plots: DENIED 42501 / DENIED 42501
--   21 A's account deleted: A's farms / plots left = 0 / 0; B's farm kept = 1
--   22 farm_plots (id, farm_id, profile_id) key present: true
--
-- Uses phone numbers 19990000931-932, which must not belong to real
-- accounts, and the 'nakuru' / 'kiambu' counties.
do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  farm_a uuid; farm_b uuid; plot_a uuid; plot_b uuid;
  tmp uuid;
  ts timestamptz;
  n int; m int;
  r text := '';
begin
  insert into auth.users (id, aud, role, phone, created_at, updated_at) values
    (a, 'authenticated', 'authenticated', '19990000931', now(), now()),
    (b, 'authenticated', 'authenticated', '19990000932', now(), now());

  -- Farmer A.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    insert into public.farms (profile_id, name, county_id, location_text, size_acres, tenure)
    values (a, 'Dry run farm A', 'nakuru', 'Near the market', 2.5, 'owned')
    returning id into farm_a;
    r := r || E'\n 1 A creates own farm: OK';
  exception when others then r := r || E'\n 1 A creates own farm: FAILED ' || sqlstate;
  end;
  begin
    insert into public.farm_plots (farm_id, profile_id, name, size_acres)
    values (farm_a, a, 'Plot A', 1) returning id into plot_a;
    r := r || E'\n 2 A creates a plot on own farm: OK';
  exception when others then r := r || E'\n 2 A creates a plot on own farm: FAILED ' || sqlstate;
  end;
  begin
    insert into public.farms (profile_id, name, county_id) values (b, 'Forged', 'nakuru');
    r := r || E'\n 3 A creates a farm owned by B: ALLOWED';
  exception when others then r := r || E'\n 3 A creates a farm owned by B: DENIED ' || sqlstate;
  end;
  select count(*) into n from public.farms;
  select count(*) into m from public.farm_plots;
  r := r || E'\n 4 A reads own farms / plots: rows = ' || n || ' / ' || m;
  reset role;

  -- Farmer B.
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.farms (profile_id, name, county_id) values (b, 'Dry run farm B', 'kiambu') returning id into farm_b;
  insert into public.farm_plots (farm_id, profile_id, name) values (farm_b, b, 'Plot B') returning id into plot_b;
  select count(*) into n from public.farms where profile_id = a;
  select count(*) into m from public.farm_plots where profile_id = a;
  r := r || E'\n 5 B reads A''s farms / plots: rows = ' || n || ' / ' || m;
  update public.farms set name = 'Hijacked' where id = farm_a;
  get diagnostics n = row_count;
  r := r || E'\n 6 B updates A''s farm: rows = ' || n;
  update public.farm_plots set archived_at = now() where id = plot_a;
  get diagnostics n = row_count;
  r := r || E'\n 7 B archives A''s plot: rows = ' || n;
  begin
    insert into public.farm_plots (farm_id, profile_id, name) values (farm_a, b, 'Intruder plot');
    r := r || E'\n 8 B adds a plot to A''s farm (as B): ALLOWED';
  exception when others then r := r || E'\n 8 B adds a plot to A''s farm (as B): DENIED ' || sqlstate;
  end;
  begin
    insert into public.farm_plots (farm_id, profile_id, name) values (farm_a, a, 'Intruder plot');
    r := r || E'\n 9 B adds a plot to A''s farm (as A): ALLOWED';
  exception when others then r := r || E'\n 9 B adds a plot to A''s farm (as A): DENIED ' || sqlstate;
  end;
  begin
    update public.farm_plots set farm_id = farm_a where id = plot_b;
    get diagnostics n = row_count;
    r := r || E'\n10 B moves own plot onto A''s farm: ALLOWED rows = ' || n;
  exception when others then r := r || E'\n10 B moves own plot onto A''s farm: DENIED ' || sqlstate;
  end;
  reset role;

  -- Farmer A again.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    update public.farms set profile_id = b where id = farm_a;
    get diagnostics n = row_count;
    r := r || E'\n11 A gives own farm to B: ALLOWED rows = ' || n;
  exception when others then r := r || E'\n11 A gives own farm to B: DENIED ' || sqlstate;
  end;
  r := r || E'\n12 A deletes own plot / farm: ';
  begin
    delete from public.farm_plots where id = plot_a;
    get diagnostics n = row_count;
    r := r || 'ALLOWED rows = ' || n;
  exception when others then r := r || 'DENIED ' || sqlstate;
  end;
  begin
    delete from public.farms where id = farm_a;
    get diagnostics n = row_count;
    r := r || ' / ALLOWED rows = ' || n;
  exception when others then r := r || ' / DENIED ' || sqlstate;
  end;
  r := r || E'\n13 invalid tenure / zero acres / blank name: ';
  begin
    insert into public.farms (profile_id, name, county_id, tenure) values (a, 'X', 'nakuru', 'rented');
    r := r || 'ALLOWED';
  exception when others then r := r || 'REJECTED ' || sqlstate;
  end;
  begin
    insert into public.farm_plots (farm_id, profile_id, name, size_acres) values (farm_a, a, 'X', 0);
    r := r || ' / ALLOWED';
  exception when others then r := r || ' / REJECTED ' || sqlstate;
  end;
  begin
    insert into public.farms (profile_id, name, county_id) values (a, '   ', 'nakuru');
    r := r || ' / ALLOWED';
  exception when others then r := r || ' / REJECTED ' || sqlstate;
  end;
  insert into public.farms (profile_id, name, county_id, created_at)
  values (a, 'Backdated', 'nakuru', '2000-01-01') returning id, created_at into tmp, ts;
  r := r || E'\n14 A backdates created_at on insert / update: created_at kept = ' || (ts > '2001-01-01');
  update public.farms set created_at = '2000-01-01' where id = farm_a;
  select created_at into ts from public.farms where id = farm_a;
  r := r || ' / ' || (ts > '2001-01-01');
  update public.farms set archived_at = now() where id = farm_a;
  get diagnostics n = row_count;
  update public.farms set archived_at = null where id = farm_a;
  get diagnostics m = row_count;
  r := r || E'\n15 A archives and restores own farm: rows = ' || n || ' / ' || m;
  -- Active plot names are unique per farm (case and outer spaces ignored);
  -- archived plots don't count. plot_a is 'Plot A' on farm_a; tmp is A's
  -- 'Backdated' farm from step 14.
  r := r || E'\n16 A adds a duplicate active plot name (exact / other case + spaces): ';
  begin
    insert into public.farm_plots (farm_id, profile_id, name) values (farm_a, a, 'Plot A');
    r := r || 'ALLOWED';
  exception when others then r := r || 'REJECTED ' || sqlstate;
  end;
  begin
    insert into public.farm_plots (farm_id, profile_id, name) values (farm_a, a, '  plot a ');
    r := r || ' / ALLOWED';
  exception when others then r := r || ' / REJECTED ' || sqlstate;
  end;
  begin
    insert into public.farm_plots (farm_id, profile_id, name) values (tmp, a, 'Plot A');
    r := r || E'\n17 A reuses the name on another own farm: OK';
  exception when others then r := r || E'\n17 A reuses the name on another own farm: FAILED ' || sqlstate;
  end;
  update public.farm_plots set archived_at = now() where id = plot_a;
  begin
    insert into public.farm_plots (farm_id, profile_id, name) values (farm_a, a, 'PLOT A');
    r := r || E'\n18 A reuses the name of an archived plot: OK';
  exception when others then r := r || E'\n18 A reuses the name of an archived plot: FAILED ' || sqlstate;
  end;
  begin
    update public.farm_plots set archived_at = null where id = plot_a;
    get diagnostics n = row_count;
    r := r || E'\n19 A restores a plot whose name is now taken: ALLOWED rows = ' || n;
  exception when others then r := r || E'\n19 A restores a plot whose name is now taken: REJECTED ' || sqlstate;
  end;
  reset role;

  -- Anonymous.
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  set local role anon;
  r := r || E'\n20 anon reads farms / plots: ';
  begin
    select count(*) into n from public.farms;
    r := r || 'rows = ' || n;
  exception when others then r := r || 'DENIED ' || sqlstate;
  end;
  begin
    select count(*) into n from public.farm_plots;
    r := r || ' / rows = ' || n;
  exception when others then r := r || ' / DENIED ' || sqlstate;
  end;
  reset role;

  -- Account deletion cascades (as the project owner).
  delete from auth.users where id = a;
  select count(*) into n from public.farms where profile_id = a;
  select count(*) into m from public.farm_plots where profile_id = a;
  r := r || E'\n21 A''s account deleted: A''s farms / plots left = ' || n || ' / ' || m;
  select count(*) into n from public.farms where id = farm_b;
  r := r || '; B''s farm kept = ' || n;

  -- The key R2's composite foreign keys will reference.
  r := r || E'\n22 farm_plots (id, farm_id, profile_id) key present: ' || exists (
    select 1 from pg_constraint
    where conrelid = 'public.farm_plots'::regclass
      and conname = 'farm_plots_id_farm_id_profile_id_key'
      and contype = 'u'
  );

  raise exception 'VERIFY_RESULTS (rolled back):%', r;
end $$;
