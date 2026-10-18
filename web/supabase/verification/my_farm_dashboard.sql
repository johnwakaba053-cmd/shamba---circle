-- Verification script for the My Farm dashboard (/my-farm). No migration:
-- it checks that every query the page makes, run as a signed-in farmer,
-- returns only that farmer's own data under the existing RLS policies.
--
-- Run in the Supabase SQL editor (or via the Supabase MCP execute_sql).
-- It changes nothing: it creates farmer F (county, crops, livestock,
-- a farm with records, a community), farmer G (own farm and records) and
-- farmer N (nothing set), runs the page's reads as each, then ALWAYS ends
-- with RAISE EXCEPTION, which rolls every change back.
--
-- Expected output:
--    1 F preferences: county nakuru / crops 2 / livestock 1
--    2 F farms / growing seasons / livestock groups: 1 / 1 / 1 (G's hidden)
--    3 F reads G's farm, season or group directly: 0 / 0 / 0
--    4 F memberships: 1 (maize)
--    5 F price products for own crops/livestock: > 0, prices visible: > 0
--    6 F education topics matched / guides: 3 / >= 0
--    7 F live news stories: >= 0, no error
--    8 F get_my_alerts runs: OK
--    9 N preferences / crops / farms / memberships: 0 / 0 / 0 / 0
--   10 anon reads preferences / farms / memberships: denied or 0 rows
--
-- Uses phone numbers 19990000995-997, which must not belong to real
-- accounts.
do $$
declare
  f uuid := gen_random_uuid();
  g uuid := gen_random_uuid();
  nf uuid := gen_random_uuid();
  farm_f uuid;
  farm_g uuid;
  n int; n2 int; n3 int; n4 int;
  t text;
  r text := '';
begin
  insert into auth.users (id, aud, role, phone, created_at, updated_at) values
    (f, 'authenticated', 'authenticated', '19990000995', now(), now()),
    (g, 'authenticated', 'authenticated', '19990000996', now(), now()),
    (nf, 'authenticated', 'authenticated', '19990000997', now(), now());

  insert into public.farmer_preferences (profile_id, county_id) values (f, 'nakuru'), (g, 'kiambu');
  insert into public.farmer_crop_preferences (profile_id, crop_type_id) values (f, 'maize'), (f, 'beans'), (g, 'tea');
  insert into public.farmer_livestock_preferences (profile_id, livestock_type_id) values (f, 'dairy-cattle');

  insert into public.farms (profile_id, name, county_id) values (f, 'My Farm check F', 'nakuru') returning id into farm_f;
  insert into public.crop_seasons (profile_id, farm_id, crop_type_id, started_on)
    values (f, farm_f, 'maize', current_date - 30);
  insert into public.livestock_groups (profile_id, farm_id, livestock_type_id, name, head_count)
    values (f, farm_f, 'dairy-cattle', 'Cows', 3);
  insert into public.farms (profile_id, name, county_id) values (g, 'My Farm check G', 'kiambu') returning id into farm_g;
  insert into public.crop_seasons (profile_id, farm_id, crop_type_id, started_on)
    values (g, farm_g, 'tea', current_date - 10);
  insert into public.livestock_groups (profile_id, farm_id, livestock_type_id, name)
    values (g, farm_g, 'goats', 'G goats');

  insert into public.community_memberships (profile_id, community_id) values (f, 'maize'), (g, 'tea');

  -- === Farmer F =============================================================
  perform set_config('request.jwt.claims', json_build_object('sub', f, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select county_id into t from public.farmer_preferences;
  select count(*) into n from public.farmer_crop_preferences;
  select count(*) into n2 from public.farmer_livestock_preferences;
  r := r || E'\n 1 F preferences: county ' || coalesce(t, 'NULL') || ' / crops ' || n || ' / livestock ' || n2;

  select count(*) into n from public.farms where profile_id = f and archived_at is null;
  select count(*) into n2 from public.crop_seasons
    where profile_id = f and archived_at is null and started_on <= current_date and (ended_on is null or ended_on > current_date);
  select count(*) into n3 from public.livestock_groups where profile_id = f and archived_at is null;
  r := r || E'\n 2 F farms / growing seasons / livestock groups: ' || n || ' / ' || n2 || ' / ' || n3;

  select count(*) into n from public.farms where profile_id = g;
  select count(*) into n2 from public.crop_seasons where profile_id = g;
  select count(*) into n3 from public.livestock_groups where profile_id = g;
  r := r || E'\n 3 F reads G''s farm, season or group directly: ' || n || ' / ' || n2 || ' / ' || n3;

  select count(*), string_agg(community_id, ',') into n, t from public.community_memberships where profile_id = f;
  select count(*) into n2 from public.community_memberships where profile_id = g;
  r := r || E'\n 4 F memberships: ' || n || ' (' || coalesce(t, '') || '), G''s visible: ' || n2;

  select count(*) into n from public.agricultural_price_products
    where active and (crop_type_id in ('maize', 'beans') or livestock_type_id in ('dairy-cattle'));
  select count(*) into n2 from public.agricultural_prices p
    join public.agricultural_price_products pp on pp.id = p.product_id
    where pp.active and (pp.crop_type_id in ('maize', 'beans') or pp.livestock_type_id in ('dairy-cattle'));
  r := r || E'\n 5 F price products for own crops/livestock: ' || n || ', prices visible: ' || n2;

  select count(*) into n from public.education_topics
    where is_active and (crop_type_id in ('maize', 'beans') or livestock_type_id in ('dairy-cattle'));
  select count(*) into n2 from public.education_resources er
    join public.education_topics et on et.id = er.topic_id
    where er.is_published and et.is_active and (et.crop_type_id in ('maize', 'beans') or et.livestock_type_id in ('dairy-cattle'));
  r := r || E'\n 6 F education topics matched / guides: ' || n || ' / ' || n2;

  begin
    select count(*) into n from public.news_articles
      where status = 'published' and published_at <= now() and (expires_at is null or expires_at > now());
    r := r || E'\n 7 F live news stories: ' || n;
  exception when others then r := r || E'\n 7 F live news: FAILED ' || sqlstate || ' ' || sqlerrm;
  end;

  begin
    select count(*) into n from public.get_my_alerts();
    r := r || E'\n 8 F get_my_alerts runs: OK (' || n || ' alerts)';
  exception when others then r := r || E'\n 8 F get_my_alerts: FAILED ' || sqlstate || ' ' || sqlerrm;
  end;
  reset role;

  -- === Farmer N (nothing set) ===============================================
  perform set_config('request.jwt.claims', json_build_object('sub', nf, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.farmer_preferences;
  select count(*) into n2 from public.farmer_crop_preferences;
  select count(*) into n3 from public.farms;
  select count(*) into n4 from public.community_memberships;
  r := r || E'\n 9 N preferences / crops / farms / memberships: ' || n || ' / ' || n2 || ' / ' || n3 || ' / ' || n4;
  reset role;

  -- === Signed out ===========================================================
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  set local role anon;
  t := '';
  begin select count(*) into n from public.farmer_preferences; t := t || ' rows ' || n;
  exception when others then t := t || ' DENIED ' || sqlstate; end;
  begin select count(*) into n from public.farms; t := t || ' / rows ' || n;
  exception when others then t := t || ' / DENIED ' || sqlstate; end;
  begin select count(*) into n from public.community_memberships; t := t || ' / rows ' || n;
  exception when others then t := t || ' / DENIED ' || sqlstate; end;
  r := r || E'\n10 anon reads preferences / farms / memberships:' || t;
  reset role;

  raise exception 'VERIFY_RESULTS%', r;
end $$;
