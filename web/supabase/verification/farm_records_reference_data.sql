-- Verification script for 20261001120000_add_farm_records_reference_data.sql
--
-- Run in the Supabase SQL editor (or via the Supabase MCP execute_sql). It
-- is NOT a migration and changes nothing: it checks the reference data,
-- the read-only privileges and that existing types and everything that
-- references them are untouched, then ALWAYS ends with RAISE EXCEPTION,
-- which rolls every change back. The results are in the error message
-- ("VERIFY_RESULTS ...").
--
-- To verify BEFORE the migration is applied, paste the migration's
-- statements in place of the @@MIGRATION@@ line below: the "before"
-- snapshot is taken first, so check 4 then compares across the migration.
-- Run after the migration is applied, check 4 compares a snapshot with
-- itself and only confirms nothing changed during the run.
--
-- Expected output:
--    1 counts: crop categories 7 / crop types 38 / livestock categories 8 / livestock types 13 / units 18 / input categories 12 / kinds 22 (active 12)
--    2 types without a valid category (crop / livestock): 0 / 0
--    3 existing 24 types keep exact id + name: 24 of 24
--    4 existing 24 types unchanged (id, name, created_at) / referencing rows unchanged: true / true
--    5 active kinds match the approved matrix: true; reserved inactive kinds: 10
--    6 units: all dimensions valid = true; per dimension mass 5 / volume 4 / count 8 / area 1
--    7 every category is used by at least one type (crop / livestock): true / true
--    8 signed-in reads (crop cat / livestock cat / units / input cat / kinds): rows = 7 / 8 / 18 / 12 / 22
--    9 signed-in insert / update / delete on all 5 lookup tables: denied 15 of 15
--   10 anon reads on all 5 lookup tables: denied 5 of 5
--   11 adding a crop type / livestock type without a category: REJECTED 23502 / REJECTED 23502
do $$
declare
  existing_before text;
  refs_before text;
  existing_after text;
  refs_after text;
  t text;
  n int; m int; k int;
  denied int;
  r text := '';
begin
  -- Snapshot before (the migration, if pasted, runs after this).
  select md5(string_agg(x, ',' order by x)) into existing_before from (
    select 'c|' || id || '|' || name || '|' || created_at::text as x from public.crop_types
    where id in ('avocado','bananas','beans','cabbage','cassava','coffee','groundnuts','irish-potatoes','kale','maize','mango','onions','sugarcane','sweet-potatoes','tea','tomatoes')
    union all
    select 'l|' || id || '|' || name || '|' || created_at::text from public.livestock_types
    where id in ('beef-cattle','bees','dairy-cattle','goats','pigs','poultry','rabbits','sheep')
  ) s;
  select concat_ws('/',
    (select count(*) from public.farmer_crop_preferences),
    (select count(*) from public.farmer_livestock_preferences),
    (select count(*) from public.alert_crop_types),
    (select count(*) from public.alert_livestock_types),
    (select count(*) from public.education_topics),
    (select count(*) from public.agricultural_price_products),
    (select count(*) from public.crop_seasons),
    (select count(*) from public.livestock_groups)) into refs_before;

  -- @@MIGRATION@@

  r := r || E'\n 1 counts: crop categories ' || (select count(*) from public.crop_categories)
    || ' / crop types ' || (select count(*) from public.crop_types)
    || ' / livestock categories ' || (select count(*) from public.livestock_categories)
    || ' / livestock types ' || (select count(*) from public.livestock_types)
    || ' / units ' || (select count(*) from public.measurement_units)
    || ' / input categories ' || (select count(*) from public.input_categories)
    || ' / kinds ' || (select count(*) from public.farm_record_kinds)
    || ' (active ' || (select count(*) from public.farm_record_kinds where is_active) || ')';

  select count(*) into n from public.crop_types c left join public.crop_categories cc on cc.id = c.category_id where cc.id is null;
  select count(*) into m from public.livestock_types l left join public.livestock_categories lc on lc.id = l.category_id where lc.id is null;
  r := r || E'\n 2 types without a valid category (crop / livestock): ' || n || ' / ' || m;

  select count(*) into n from (
    select 'c|' || id || '|' || name as x from public.crop_types
    union all
    select 'l|' || id || '|' || name from public.livestock_types
  ) s where x in (
    'c|avocado|Avocado', 'c|bananas|Bananas', 'c|beans|Beans', 'c|cabbage|Cabbage',
    'c|cassava|Cassava', 'c|coffee|Coffee', 'c|groundnuts|Groundnuts', 'c|irish-potatoes|Irish Potatoes',
    'c|kale|Kale (Sukuma Wiki)', 'c|maize|Maize', 'c|mango|Mango', 'c|onions|Onions',
    'c|sugarcane|Sugarcane', 'c|sweet-potatoes|Sweet Potatoes', 'c|tea|Tea', 'c|tomatoes|Tomatoes',
    'l|beef-cattle|Beef Cattle', 'l|bees|Bees', 'l|dairy-cattle|Dairy Cattle', 'l|goats|Goats',
    'l|pigs|Pigs', 'l|poultry|Poultry', 'l|rabbits|Rabbits', 'l|sheep|Sheep');
  r := r || E'\n 3 existing 24 types keep exact id + name: ' || n || ' of 24';

  select md5(string_agg(x, ',' order by x)) into existing_after from (
    select 'c|' || id || '|' || name || '|' || created_at::text as x from public.crop_types
    where id in ('avocado','bananas','beans','cabbage','cassava','coffee','groundnuts','irish-potatoes','kale','maize','mango','onions','sugarcane','sweet-potatoes','tea','tomatoes')
    union all
    select 'l|' || id || '|' || name || '|' || created_at::text from public.livestock_types
    where id in ('beef-cattle','bees','dairy-cattle','goats','pigs','poultry','rabbits','sheep')
  ) s;
  select concat_ws('/',
    (select count(*) from public.farmer_crop_preferences),
    (select count(*) from public.farmer_livestock_preferences),
    (select count(*) from public.alert_crop_types),
    (select count(*) from public.alert_livestock_types),
    (select count(*) from public.education_topics),
    (select count(*) from public.agricultural_price_products),
    (select count(*) from public.crop_seasons),
    (select count(*) from public.livestock_groups)) into refs_after;
  r := r || E'\n 4 existing 24 types unchanged (id, name, created_at) / referencing rows unchanged: '
    || (existing_before = existing_after) || ' / ' || (refs_before = refs_after);

  r := r || E'\n 5 active kinds match the approved matrix: ' || (
    (select string_agg(id || ':' || group_id || ':' || subject_mode || ':' || input_mode, ',' order by id)
     from public.farm_record_kinds where is_active)
    = 'animal_observation:livestock:livestock:none,animal_treatment:livestock:livestock:expected,'
      || 'crop_observation:crops:crop:none,crop_protection:crops:crop:expected,'
      || 'farm_work:farm:farm:optional,feeding:livestock:livestock:optional,'
      || 'fertilizer_application:crops:crop:expected,irrigation:crops:crop:none,'
      || 'land_preparation:crops:farm_or_crop:optional,note:farm:any:none,'
      || 'planting:crops:crop:optional,weeding:crops:crop:optional')
    || '; reserved inactive kinds: ' || (select count(*) from public.farm_record_kinds where not is_active);

  r := r || E'\n 6 units: all dimensions valid = '
    || (select bool_and(dimension in ('mass', 'volume', 'count', 'area')) from public.measurement_units)
    || '; per dimension mass ' || (select count(*) from public.measurement_units where dimension = 'mass')
    || ' / volume ' || (select count(*) from public.measurement_units where dimension = 'volume')
    || ' / count ' || (select count(*) from public.measurement_units where dimension = 'count')
    || ' / area ' || (select count(*) from public.measurement_units where dimension = 'area');

  r := r || E'\n 7 every category is used by at least one type (crop / livestock): '
    || (not exists (select 1 from public.crop_categories cc where not exists (select 1 from public.crop_types c where c.category_id = cc.id)))
    || ' / '
    || (not exists (select 1 from public.livestock_categories lc where not exists (select 1 from public.livestock_types l where l.category_id = lc.id)));

  -- Signed-in user (any id; the lookup policies don't depend on it).
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  set local role authenticated;
  r := r || E'\n 8 signed-in reads (crop cat / livestock cat / units / input cat / kinds): rows = '
    || (select count(*) from public.crop_categories) || ' / '
    || (select count(*) from public.livestock_categories) || ' / '
    || (select count(*) from public.measurement_units) || ' / '
    || (select count(*) from public.input_categories) || ' / '
    || (select count(*) from public.farm_record_kinds);
  denied := 0;
  foreach t in array array['crop_categories', 'livestock_categories', 'measurement_units', 'input_categories', 'farm_record_kinds'] loop
    begin
      execute format('insert into public.%I (id) values (%L)', t, 'zz_probe');
    exception when insufficient_privilege then denied := denied + 1;
    end;
    begin
      execute format('update public.%I set id = id', t);
    exception when insufficient_privilege then denied := denied + 1;
    end;
    begin
      execute format('delete from public.%I', t);
    exception when insufficient_privilege then denied := denied + 1;
    end;
  end loop;
  r := r || E'\n 9 signed-in insert / update / delete on all 5 lookup tables: denied ' || denied || ' of 15';
  reset role;

  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  set local role anon;
  denied := 0;
  foreach t in array array['crop_categories', 'livestock_categories', 'measurement_units', 'input_categories', 'farm_record_kinds'] loop
    begin
      execute format('select count(*) from public.%I', t) into k;
    exception when insufficient_privilege then denied := denied + 1;
    end;
  end loop;
  r := r || E'\n10 anon reads on all 5 lookup tables: denied ' || denied || ' of 5';
  reset role;

  r := r || E'\n11 adding a crop type / livestock type without a category: ';
  begin
    insert into public.crop_types (id, name) values ('zz-probe', 'Probe');
    r := r || 'ALLOWED';
  exception when others then r := r || 'REJECTED ' || sqlstate;
  end;
  begin
    insert into public.livestock_types (id, name) values ('zz-probe', 'Probe');
    r := r || ' / ALLOWED';
  exception when others then r := r || ' / REJECTED ' || sqlstate;
  end;

  raise exception 'VERIFY_RESULTS (rolled back):%', r;
end $$;
