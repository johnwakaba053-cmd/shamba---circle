-- Verification script for
-- supabase/migrations/20261020130000_lock_archived_farm_record_parents.sql
-- (promoted unchanged from
-- supabase/drafts/20261020170000_guard_plots_on_archived_farms.sql).
--
-- Run as the project owner (the Supabase SQL editor, or locally as the
-- non-superuser owner role) after the migration is applied. It is NOT a
-- migration and changes nothing: it creates two throwaway users (farmer A,
-- farmer B), exercises farm_plots, crop_seasons and livestock_groups under
-- archived and restored parents as each of them and as the owner, then
-- ALWAYS ends with RAISE EXCEPTION, which rolls every change back. The
-- results are in the error message ("VERIFY_RESULTS ...").
--
-- The row locks themselves need two sessions and can't be tested in one
-- script; lines 13-14 only confirm the functions carry the settings. See
-- the local concurrency harness described in the review.
--
-- To verify BEFORE the migration is applied, run it in one transaction
-- after the migration's statements (begin; <migration>; <this script>);
-- the final RAISE EXCEPTION rolls both back.
--
-- Expected output:
--    1 A adds a plot to own archived farm: REJECTED P0001 farm_archived
--    2 A restores an archived plot while its farm is archived: REJECTED P0001 farm_archived
--    3 A moves a plot from an active farm onto own archived farm: REJECTED P0001 farm_archived
--    4 A renames / resizes / archives a plot on the archived farm: rows = 1 / 1 / 1
--    5 A moves a plot off the archived farm onto an active farm: rows = 1
--    6 A restores the farm, then the archived plot: rows = 1 / 1
--    7 A adds a plot to the restored farm: OK
--    8 A moves a plot that has a crop season onto another active farm: DENIED 23503
--    9 B adds a plot to A's archived farm (as B / as A): DENIED 23503 / DENIED 42501
--   10 B moves own plot onto A's archived farm: DENIED 23503
--   11 owner adds a plot to an archived farm: REJECTED P0001 farm_archived
--   12 duplicate active name on restore / created_at kept / delete: REJECTED 23505 / true / DENIED 42501
--   13 plot guard / parents guard executable by anon, authenticated or public: false / false
--   14 plot guard / parents guard security invoker, empty search_path, lock_timeout 5s: true / true
--   15 crop season on archived farm / on archived plot: REJECTED P0001 farm_archived / REJECTED P0001 plot_archived
--   16 livestock group on archived farm / on archived plot: REJECTED P0001 farm_archived / REJECTED P0001 plot_archived
--   17 crop season restored on archived plot / livestock group moved onto archived plot: REJECTED P0001 plot_archived / REJECTED P0001 plot_archived
--   18 crop season / livestock group edited on archived farm: rows = 1 / 1
--
-- Uses phone numbers 19990001011-012, which must not belong to real
-- accounts, and the 'nakuru' / 'kiambu' counties.
do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  farm_a uuid; farm_x uuid; farm_y uuid; farm_z uuid; farm_b uuid;
  p_active uuid; p_archived uuid; p_mover uuid; p_leaver uuid; p_seasoned uuid; p_dup uuid; plot_b uuid;
  pz_ok uuid; pz_arch uuid; cs_p uuid; lg_m uuid;
  tmp uuid;
  ts timestamptz;
  n int; m int; k int;
  r text := '';
begin
  insert into auth.users (id, aud, role, phone, created_at, updated_at) values
    (a, 'authenticated', 'authenticated', '19990001011', now(), now()),
    (b, 'authenticated', 'authenticated', '19990001012', now(), now());

  -- Farmer A: farm_x gets archived; farm_a and farm_y stay active.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.farms (profile_id, name, county_id) values (a, 'Dry run farm A', 'nakuru') returning id into farm_a;
  insert into public.farms (profile_id, name, county_id) values (a, 'Dry run farm X', 'nakuru') returning id into farm_x;
  insert into public.farms (profile_id, name, county_id) values (a, 'Dry run farm Y', 'kiambu') returning id into farm_y;
  insert into public.farm_plots (farm_id, profile_id, name) values (farm_x, a, 'Active X') returning id into p_active;
  insert into public.farm_plots (farm_id, profile_id, name) values (farm_x, a, 'Archived X') returning id into p_archived;
  insert into public.farm_plots (farm_id, profile_id, name) values (farm_x, a, 'Leaver X') returning id into p_leaver;
  insert into public.farm_plots (farm_id, profile_id, name) values (farm_a, a, 'Mover A') returning id into p_mover;
  insert into public.farm_plots (farm_id, profile_id, name) values (farm_a, a, 'Seasoned A') returning id into p_seasoned;
  insert into public.crop_seasons (profile_id, farm_id, plot_id, crop_type_id, started_on)
  values (a, farm_a, p_seasoned, 'maize', current_date);
  update public.farm_plots set archived_at = now() where id = p_archived;
  update public.farms set archived_at = now() where id = farm_x;

  begin
    insert into public.farm_plots (farm_id, profile_id, name) values (farm_x, a, 'Late plot');
    r := r || E'\n 1 A adds a plot to own archived farm: ALLOWED';
  exception when others then r := r || E'\n 1 A adds a plot to own archived farm: REJECTED ' || sqlstate || ' ' || sqlerrm;
  end;
  begin
    update public.farm_plots set archived_at = null where id = p_archived;
    get diagnostics n = row_count;
    r := r || E'\n 2 A restores an archived plot while its farm is archived: ALLOWED rows = ' || n;
  exception when others then r := r || E'\n 2 A restores an archived plot while its farm is archived: REJECTED ' || sqlstate || ' ' || sqlerrm;
  end;
  begin
    update public.farm_plots set farm_id = farm_x where id = p_mover;
    get diagnostics n = row_count;
    r := r || E'\n 3 A moves a plot from an active farm onto own archived farm: ALLOWED rows = ' || n;
  exception when others then r := r || E'\n 3 A moves a plot from an active farm onto own archived farm: REJECTED ' || sqlstate || ' ' || sqlerrm;
  end;
  r := r || E'\n 4 A renames / resizes / archives a plot on the archived farm: ';
  begin
    update public.farm_plots set name = 'Active X renamed' where id = p_active;
    get diagnostics n = row_count;
    update public.farm_plots set size_acres = 1.5 where id = p_active;
    get diagnostics m = row_count;
    update public.farm_plots set archived_at = now() where id = p_active;
    get diagnostics k = row_count;
    r := r || 'rows = ' || n || ' / ' || m || ' / ' || k;
  exception when others then r := r || 'REJECTED ' || sqlstate || ' ' || sqlerrm;
  end;
  begin
    update public.farm_plots set farm_id = farm_a where id = p_leaver;
    get diagnostics n = row_count;
    r := r || E'\n 5 A moves a plot off the archived farm onto an active farm: rows = ' || n;
  exception when others then r := r || E'\n 5 A moves a plot off the archived farm onto an active farm: REJECTED ' || sqlstate || ' ' || sqlerrm;
  end;
  r := r || E'\n 6 A restores the farm, then the archived plot: ';
  begin
    update public.farms set archived_at = null where id = farm_x;
    get diagnostics n = row_count;
    update public.farm_plots set archived_at = null where id = p_archived;
    get diagnostics m = row_count;
    r := r || 'rows = ' || n || ' / ' || m;
  exception when others then r := r || 'REJECTED ' || sqlstate || ' ' || sqlerrm;
  end;
  begin
    insert into public.farm_plots (farm_id, profile_id, name) values (farm_x, a, 'Late plot');
    r := r || E'\n 7 A adds a plot to the restored farm: OK';
  exception when others then r := r || E'\n 7 A adds a plot to the restored farm: FAILED ' || sqlstate || ' ' || sqlerrm;
  end;
  -- A plot with records stays on its farm (the records' composite foreign
  -- keys), also when the target farm is active.
  begin
    update public.farm_plots set farm_id = farm_y where id = p_seasoned;
    get diagnostics n = row_count;
    r := r || E'\n 8 A moves a plot that has a crop season onto another active farm: ALLOWED rows = ' || n;
  exception when others then r := r || E'\n 8 A moves a plot that has a crop season onto another active farm: DENIED ' || sqlstate;
  end;
  -- Archive farm_x again for B's and the owner's attempts.
  update public.farms set archived_at = now() where id = farm_x;
  reset role;

  -- Farmer B: A's farm is invisible, so the refusal is the foreign key or
  -- RLS, never farm_archived (which would reveal that the farm exists).
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.farms (profile_id, name, county_id) values (b, 'Dry run farm B', 'kiambu') returning id into farm_b;
  insert into public.farm_plots (farm_id, profile_id, name) values (farm_b, b, 'Plot B') returning id into plot_b;
  r := r || E'\n 9 B adds a plot to A''s archived farm (as B / as A): ';
  begin
    insert into public.farm_plots (farm_id, profile_id, name) values (farm_x, b, 'Intruder');
    r := r || 'ALLOWED';
  exception when others then r := r || 'DENIED ' || sqlstate;
  end;
  begin
    insert into public.farm_plots (farm_id, profile_id, name) values (farm_x, a, 'Intruder');
    r := r || ' / ALLOWED';
  exception when others then r := r || ' / DENIED ' || sqlstate;
  end;
  begin
    update public.farm_plots set farm_id = farm_x where id = plot_b;
    get diagnostics n = row_count;
    r := r || E'\n10 B moves own plot onto A''s archived farm: ALLOWED rows = ' || n;
  exception when others then r := r || E'\n10 B moves own plot onto A''s archived farm: DENIED ' || sqlstate;
  end;
  reset role;

  -- The project owner (no RLS) is refused too: the rule is a trigger, not
  -- a policy.
  begin
    insert into public.farm_plots (farm_id, profile_id, name) values (farm_x, a, 'Owner plot');
    r := r || E'\n11 owner adds a plot to an archived farm: ALLOWED';
  exception when others then r := r || E'\n11 owner adds a plot to an archived farm: REJECTED ' || sqlstate || ' ' || sqlerrm;
  end;

  -- Existing protections still hold on an active farm.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  r := r || E'\n12 duplicate active name on restore / created_at kept / delete: ';
  insert into public.farm_plots (farm_id, profile_id, name) values (farm_a, a, 'Dup') returning id into p_dup;
  update public.farm_plots set archived_at = now() where id = p_dup;
  insert into public.farm_plots (farm_id, profile_id, name) values (farm_a, a, 'dup ');
  begin
    update public.farm_plots set archived_at = null where id = p_dup;
    get diagnostics n = row_count;
    r := r || 'ALLOWED rows = ' || n;
  exception when others then r := r || 'REJECTED ' || sqlstate;
  end;
  insert into public.farm_plots (farm_id, profile_id, name, created_at)
  values (farm_a, a, 'Backdated', '2000-01-01') returning id, created_at into tmp, ts;
  r := r || ' / ' || (ts > '2001-01-01');
  begin
    delete from public.farm_plots where id = tmp;
    get diagnostics n = row_count;
    r := r || ' / ALLOWED rows = ' || n;
  exception when others then r := r || ' / DENIED ' || sqlstate;
  end;
  reset role;

  r := r || E'\n13 plot guard / parents guard executable by anon, authenticated or public: '
    || (
      has_function_privilege('anon', 'public.check_farm_plot_farm_active()', 'execute')
      or has_function_privilege('authenticated', 'public.check_farm_plot_farm_active()', 'execute')
      or exists (
        select 1 from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
        where p.oid = 'public.check_farm_plot_farm_active()'::regprocedure
          and acl.grantee = 0 and acl.privilege_type = 'EXECUTE')
    ) || ' / ' || (
      has_function_privilege('anon', 'public.check_farm_record_parents_active()', 'execute')
      or has_function_privilege('authenticated', 'public.check_farm_record_parents_active()', 'execute')
      or exists (
        select 1 from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
        where p.oid = 'public.check_farm_record_parents_active()'::regprocedure
          and acl.grantee = 0 and acl.privilege_type = 'EXECUTE')
    );
  r := r || E'\n14 plot guard / parents guard security invoker, empty search_path, lock_timeout 5s: '
    || (select not p.prosecdef and p.proconfig @> array['search_path=""', 'lock_timeout=5s']
        from pg_proc p where p.oid = 'public.check_farm_plot_farm_active()'::regprocedure)
    || ' / '
    || (select not p.prosecdef and p.proconfig @> array['search_path=""', 'lock_timeout=5s']
        from pg_proc p where p.oid = 'public.check_farm_record_parents_active()'::regprocedure);

  -- Crop seasons and livestock groups (R2's rules, now with locks). farm_x
  -- is archived; farm_z is active with one active and one archived plot.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.farms (profile_id, name, county_id) values (a, 'Dry run farm Z', 'nakuru') returning id into farm_z;
  insert into public.farm_plots (farm_id, profile_id, name) values (farm_z, a, 'Z ok') returning id into pz_ok;
  insert into public.farm_plots (farm_id, profile_id, name) values (farm_z, a, 'Z archived') returning id into pz_arch;
  update public.farm_plots set archived_at = now() where id = pz_arch;
  r := r || E'\n15 crop season on archived farm / on archived plot: ';
  begin
    insert into public.crop_seasons (profile_id, farm_id, crop_type_id, started_on) values (a, farm_x, 'maize', current_date);
    r := r || 'ALLOWED';
  exception when others then r := r || 'REJECTED ' || sqlstate || ' ' || sqlerrm;
  end;
  begin
    insert into public.crop_seasons (profile_id, farm_id, plot_id, crop_type_id, started_on) values (a, farm_z, pz_arch, 'maize', current_date);
    r := r || ' / ALLOWED';
  exception when others then r := r || ' / REJECTED ' || sqlstate || ' ' || sqlerrm;
  end;
  r := r || E'\n16 livestock group on archived farm / on archived plot: ';
  begin
    insert into public.livestock_groups (profile_id, farm_id, livestock_type_id, name) values (a, farm_x, 'goats', 'Late goats');
    r := r || 'ALLOWED';
  exception when others then r := r || 'REJECTED ' || sqlstate || ' ' || sqlerrm;
  end;
  begin
    insert into public.livestock_groups (profile_id, farm_id, plot_id, livestock_type_id, name) values (a, farm_z, pz_arch, 'goats', 'Late goats');
    r := r || ' / ALLOWED';
  exception when others then r := r || ' / REJECTED ' || sqlstate || ' ' || sqlerrm;
  end;
  -- cs_p sits on pz_ok, is archived, then pz_ok is archived; lg_m is a
  -- whole-farm group on farm_z.
  insert into public.crop_seasons (profile_id, farm_id, plot_id, crop_type_id, started_on)
  values (a, farm_z, pz_ok, 'maize', current_date) returning id into cs_p;
  insert into public.livestock_groups (profile_id, farm_id, livestock_type_id, name)
  values (a, farm_z, 'goats', 'Z goats') returning id into lg_m;
  update public.crop_seasons set archived_at = now() where id = cs_p;
  update public.farm_plots set archived_at = now() where id = pz_ok;
  r := r || E'\n17 crop season restored on archived plot / livestock group moved onto archived plot: ';
  begin
    update public.crop_seasons set archived_at = null where id = cs_p;
    get diagnostics n = row_count;
    r := r || 'ALLOWED rows = ' || n;
  exception when others then r := r || 'REJECTED ' || sqlstate || ' ' || sqlerrm;
  end;
  begin
    update public.livestock_groups set plot_id = pz_arch where id = lg_m;
    get diagnostics n = row_count;
    r := r || ' / ALLOWED rows = ' || n;
  exception when others then r := r || ' / REJECTED ' || sqlstate || ' ' || sqlerrm;
  end;
  update public.farms set archived_at = now() where id = farm_z;
  r := r || E'\n18 crop season / livestock group edited on archived farm: ';
  begin
    update public.crop_seasons set label = 'Renamed' where id = cs_p;
    get diagnostics n = row_count;
    update public.livestock_groups set name = 'Renamed goats' where id = lg_m;
    get diagnostics m = row_count;
    r := r || 'rows = ' || n || ' / ' || m;
  exception when others then r := r || 'REJECTED ' || sqlstate || ' ' || sqlerrm;
  end;
  reset role;

  raise exception 'VERIFY_RESULTS (rolled back):%', r;
end $$;
