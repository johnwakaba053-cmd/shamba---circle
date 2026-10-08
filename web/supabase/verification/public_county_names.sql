-- Verification script for 20261008150000_allow_public_county_names.sql
--
-- Run in the Supabase SQL editor (or via the Supabase MCP execute_sql).
-- It is NOT a migration and changes nothing: it tags a story with a
-- county as the owner, reads it as anon, tries to write counties as anon
-- and as a farmer, then ALWAYS ends with RAISE EXCEPTION, which rolls
-- every change back. To test the migration before it is applied, send
-- `begin; <migration> <this script>` in one call.
--
-- Expected output:
--   1 anon reads counties: rows = <all counties, e.g. 47>
--   2 anon sees a story's county name through the embed: <a county name>
--   3 anon inserts a county: DENIED 42501
--   4 anon updates a county: rows = 0
--   5 anon deletes a county: rows = 0
--   6 farmer inserts a county: DENIED 42501
--   7 farmer reads counties: rows = <same as 1>
--
-- Uses phone number 19990000961, which must not belong to a real account.
do $$
declare
  f uuid := gen_random_uuid();
  c text;
  n int;
  n_auth int;
  t text;
  r text := '';
begin
  insert into auth.users (id, aud, role, phone, created_at, updated_at)
  values (f, 'authenticated', 'authenticated', '19990000961', now(), now());

  select id into c from public.counties order by id limit 1;
  update public.news_articles set county_id = c where slug = 'welcome-to-agriculture-today';

  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  set local role anon;
  select count(*) into n from public.counties;
  r := r || E'\n 1 anon reads counties: rows = ' || n;
  select co.name into t
  from public.news_articles a
  left join public.counties co on co.id = a.county_id
  where a.slug = 'welcome-to-agriculture-today';
  r := r || E'\n 2 anon sees a story''s county name through the embed: ' || coalesce(t, '(none)');
  begin
    insert into public.counties (id, name) values ('verify-x', 'X');
    r := r || E'\n 3 anon inserts a county: ALLOWED';
  exception when others then r := r || E'\n 3 anon inserts a county: DENIED ' || sqlstate;
  end;
  begin
    update public.counties set name = 'hacked' where id = c;
    get diagnostics n = row_count;
    r := r || E'\n 4 anon updates a county: rows = ' || n;
  exception when others then r := r || E'\n 4 anon updates a county: DENIED ' || sqlstate;
  end;
  begin
    delete from public.counties where id = c;
    get diagnostics n = row_count;
    r := r || E'\n 5 anon deletes a county: rows = ' || n;
  exception when others then r := r || E'\n 5 anon deletes a county: DENIED ' || sqlstate;
  end;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', f, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    insert into public.counties (id, name) values ('verify-y', 'Y');
    r := r || E'\n 6 farmer inserts a county: ALLOWED';
  exception when others then r := r || E'\n 6 farmer inserts a county: DENIED ' || sqlstate;
  end;
  select count(*) into n_auth from public.counties;
  r := r || E'\n 7 farmer reads counties: rows = ' || n_auth;
  reset role;

  raise exception 'VERIFY_RESULTS (rolled back):%', r;
end $$;
