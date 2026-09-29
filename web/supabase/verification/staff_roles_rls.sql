-- Verification script for 20260929140000_add_staff_roles_foundation.sql
--
-- Run in the Supabase SQL editor (or via the Supabase MCP execute_sql).
-- It is NOT a migration and changes nothing: it creates three throwaway
-- users (farmer F, moderator M, admin A), exercises staff_roles and the
-- is_admin() / can_moderate() helpers as each of them and as anon, then
-- ALWAYS ends with RAISE EXCEPTION, which rolls every change back. The
-- results are in the error message ("VERIFY_RESULTS ...").
--
-- Expected output:
--    1 farmer is_admin / can_moderate: false / false
--    2 farmer self-grants admin in staff_roles: DENIED 42501
--    3 farmer adds 'admin' to user_roles: REJECTED 23514
--    4 farmer reads staff_roles: rows = 0
--    5 farmer adds own 'farmer' user_role: ALLOWED
--    6 moderator is_admin / can_moderate: false / true
--    7 moderator reads staff_roles: rows = 1
--    8 admin is_admin / can_moderate: true / true
--    9 admin reads staff_roles: rows = 2 (plus any real staff)
--   10 admin grants moderator via the API: DENIED 42501
--   11 admin removes own staff role via the API: DENIED 42501
--   12 anon calls is_admin(): DENIED 42501
--   13 anon reads staff_roles: DENIED 42501
--
-- Uses phone numbers 19990000911-913, which must not belong to real
-- accounts.
do $$
declare
  f uuid := gen_random_uuid();
  m uuid := gen_random_uuid();
  a uuid := gen_random_uuid();
  b1 boolean; b2 boolean;
  n int;
  r text := '';
begin
  insert into auth.users (id, aud, role, phone, created_at, updated_at) values
    (f, 'authenticated', 'authenticated', '19990000911', now(), now()),
    (m, 'authenticated', 'authenticated', '19990000912', now(), now()),
    (a, 'authenticated', 'authenticated', '19990000913', now(), now());
  -- Granted the only way the migration allows: as the project owner.
  insert into public.staff_roles (profile_id, role) values (m, 'moderator'), (a, 'admin');

  -- Farmer F.
  perform set_config('request.jwt.claims', json_build_object('sub', f, 'role', 'authenticated')::text, true);
  set local role authenticated;
  b1 := public.is_admin(); b2 := public.can_moderate();
  r := r || E'\n 1 farmer is_admin / can_moderate: ' || b1 || ' / ' || b2;
  begin
    insert into public.staff_roles (profile_id, role) values (f, 'admin');
    r := r || E'\n 2 farmer self-grants admin in staff_roles: ALLOWED';
  exception when others then r := r || E'\n 2 farmer self-grants admin in staff_roles: DENIED ' || sqlstate;
  end;
  begin
    insert into public.user_roles (profile_id, role) values (f, 'admin');
    r := r || E'\n 3 farmer adds ''admin'' to user_roles: ALLOWED';
  exception when others then r := r || E'\n 3 farmer adds ''admin'' to user_roles: REJECTED ' || sqlstate;
  end;
  select count(*) into n from public.staff_roles;
  r := r || E'\n 4 farmer reads staff_roles: rows = ' || n;
  begin
    insert into public.user_roles (profile_id, role) values (f, 'farmer');
    r := r || E'\n 5 farmer adds own ''farmer'' user_role: ALLOWED';
  exception when others then r := r || E'\n 5 farmer adds own ''farmer'' user_role: DENIED ' || sqlstate;
  end;
  reset role;

  -- Moderator M.
  perform set_config('request.jwt.claims', json_build_object('sub', m, 'role', 'authenticated')::text, true);
  set local role authenticated;
  b1 := public.is_admin(); b2 := public.can_moderate();
  r := r || E'\n 6 moderator is_admin / can_moderate: ' || b1 || ' / ' || b2;
  select count(*) into n from public.staff_roles;
  r := r || E'\n 7 moderator reads staff_roles: rows = ' || n;
  reset role;

  -- Admin A.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  b1 := public.is_admin(); b2 := public.can_moderate();
  r := r || E'\n 8 admin is_admin / can_moderate: ' || b1 || ' / ' || b2;
  select count(*) into n from public.staff_roles;
  r := r || E'\n 9 admin reads staff_roles: rows = ' || n;
  begin
    insert into public.staff_roles (profile_id, role) values (f, 'moderator');
    r := r || E'\n10 admin grants moderator via the API: ALLOWED';
  exception when others then r := r || E'\n10 admin grants moderator via the API: DENIED ' || sqlstate;
  end;
  begin
    delete from public.staff_roles where profile_id = a;
    get diagnostics n = row_count;
    r := r || E'\n11 admin removes own staff role via the API: rows = ' || n;
  exception when others then r := r || E'\n11 admin removes own staff role via the API: DENIED ' || sqlstate;
  end;
  reset role;

  -- Anonymous.
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  set local role anon;
  begin
    b1 := public.is_admin();
    r := r || E'\n12 anon calls is_admin(): ALLOWED (' || b1 || ')';
  exception when others then r := r || E'\n12 anon calls is_admin(): DENIED ' || sqlstate;
  end;
  begin
    select count(*) into n from public.staff_roles;
    r := r || E'\n13 anon reads staff_roles: rows = ' || n;
  exception when others then r := r || E'\n13 anon reads staff_roles: DENIED ' || sqlstate;
  end;
  reset role;

  raise exception 'VERIFY_RESULTS (rolled back):%', r;
end $$;
