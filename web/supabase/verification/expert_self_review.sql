-- Verification script for 20261008120000_block_expert_self_review.sql
--
-- Run in the Supabase SQL editor (or via the Supabase MCP execute_sql)
-- after the migration. It is NOT a migration and changes nothing: it
-- creates throwaway users -- admin A (who also applies), applicants B and
-- C, a second admin D, admin E (applies, then withdraws) and farmer F --
-- exercises every admin review function as each of them, then ALWAYS
-- ends with RAISE EXCEPTION, which rolls every change back. The results
-- are in the error message ("VERIFY_RESULTS ...").
--
-- Expected output:
--    1 A, B, C, E submit complete applications (A and E are admins): ALLOWED
--    2 A starts review of own application: DENIED cannot_review_own_expert_application
--    3 A requests changes on own application: DENIED cannot_review_own_expert_application
--    4 A rejects own application: DENIED cannot_review_own_expert_application
--    5 A approves own application: DENIED cannot_review_own_expert_application
--    6 after 2-5, A's status / review events / experts row / notifications: submitted / 1 / 0 / 0
--    7 A starts review of B: ALLOWED, status = under_review
--    8 A requests changes on B (with note): ALLOWED, status = changes_requested
--    9 B resubmits: ALLOWED, status = submitted
--   10 A approves B: ALLOWED, B is_verified_expert = true
--   11 A rejects C (with note): ALLOWED, status = rejected
--   12 A suspends B / reinstates B: ALLOWED / ALLOWED, B active = true
--   13 D (second admin) starts review of A and approves: ALLOWED, A is_verified_expert = true
--   14 A suspends self: DENIED cannot_review_own_expert_application, A active = true
--   15 D suspends A: ALLOWED; A reinstates self: DENIED cannot_review_own_expert_application, A suspended = true
--   16 D reinstates A: ALLOWED, A active = true
--   17 E (admin) withdraws own application: ALLOWED, status = withdrawn
--   18 F (farmer) starts review of C / suspends B: DENIED not_authorized / DENIED not_authorized
--   19 functions keep SECURITY DEFINER, search_path, owner: true / true / true
--   20 grants: transition internal only / suspend+reinstate authenticated, not anon: true / true
--
-- Uses phone numbers 19990000931-936, which must not belong to real
-- accounts.
do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  c uuid := gen_random_uuid();
  d uuid := gen_random_uuid();
  e uuid := gen_random_uuid();
  f uuid := gen_random_uuid();
  applicants uuid[];
  apps uuid[] := '{}';
  app uuid;
  app_a uuid;
  app_b uuid;
  app_c uuid;
  app_e uuid;
  who uuid;
  county text := (select id from public.counties order by id limit 1);
  n int; n2 int; n3 int;
  s text;
  ok boolean; ok2 boolean; ok3 boolean;
  r text := '';
begin
  insert into auth.users (id, aud, role, phone, created_at, updated_at) values
    (a, 'authenticated', 'authenticated', '19990000931', now(), now()),
    (b, 'authenticated', 'authenticated', '19990000932', now(), now()),
    (c, 'authenticated', 'authenticated', '19990000933', now(), now()),
    (d, 'authenticated', 'authenticated', '19990000934', now(), now()),
    (e, 'authenticated', 'authenticated', '19990000935', now(), now()),
    (f, 'authenticated', 'authenticated', '19990000936', now(), now());
  insert into public.staff_roles (profile_id, role) values (a, 'admin'), (d, 'admin'), (e, 'admin');

  -- === 1. complete, submitted applications for A, B, C and E ================
  applicants := array[a, b, c, e];
  begin
    foreach who in array applicants loop
      perform set_config('request.jwt.claims', json_build_object('sub', who, 'role', 'authenticated')::text, true);
      set local role authenticated;

      insert into public.expert_applications (profile_id, professional_title, headline, bio, county_id, years_experience)
      values (who, 'Agronomist', 'Maize and beans', 'Works with smallholder farmers.', county, 5)
      returning id into app;
      insert into public.expert_application_specialties (application_id, profile_id, specialty_id)
      values (app, who, (select id from public.expert_specialties where is_active order by sort_order limit 1));
      insert into public.expert_education (application_id, profile_id, institution, level, field_of_study, end_year)
      values (app, who, 'Egerton University', 'bachelors', 'Agronomy', 2015);
      insert into public.expert_experience (application_id, profile_id, organisation, role_title, start_date)
      values (app, who, 'County Agriculture Office', 'Extension officer', date '2016-01-01');
      insert into storage.objects (bucket_id, name, owner, owner_id, metadata)
      values ('expert-documents', who || '/' || app || '/cv.pdf', who, who::text, '{"mimetype":"application/pdf","size":2048}');
      insert into public.expert_documents (application_id, profile_id, kind, storage_path, file_name)
      values (app, who, 'cv', who || '/' || app || '/cv.pdf', 'cv.pdf');
      perform public.submit_expert_application(app, true);

      reset role;
      apps := apps || app;
    end loop;
    app_a := apps[1]; app_b := apps[2]; app_c := apps[3]; app_e := apps[4];
    r := r || E'\n 1 A, B, C, E submit complete applications (A and E are admins): ALLOWED';
  exception when others then
    r := r || E'\n 1 A, B, C, E submit complete applications (A and E are admins): FAILED ' || sqlstate || ' ' || sqlerrm;
    raise exception 'VERIFY_RESULTS%', r;
  end;

  -- === 2-6. admin A on their own application ================================
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  begin
    perform public.start_expert_review(app_a);
    r := r || E'\n 2 A starts review of own application: ALLOWED';
  exception when others then r := r || E'\n 2 A starts review of own application: DENIED ' || sqlerrm;
  end;

  begin
    perform public.request_expert_application_changes(app_a, 'Please add more detail.', null);
    r := r || E'\n 3 A requests changes on own application: ALLOWED';
  exception when others then r := r || E'\n 3 A requests changes on own application: DENIED ' || sqlerrm;
  end;

  begin
    perform public.reject_expert_application(app_a, 'Not this time.', null);
    r := r || E'\n 4 A rejects own application: ALLOWED';
  exception when others then r := r || E'\n 4 A rejects own application: DENIED ' || sqlerrm;
  end;

  begin
    perform public.approve_expert_application(app_a, null);
    r := r || E'\n 5 A approves own application: ALLOWED';
  exception when others then r := r || E'\n 5 A approves own application: DENIED ' || sqlerrm;
  end;

  reset role;
  select status into s from public.expert_applications where id = app_a;
  select count(*) into n from public.expert_review_events where application_id = app_a;
  select count(*) into n2 from public.experts where profile_id = a;
  select count(*) into n3 from public.notifications where recipient_profile_id = a;
  r := r || E'\n 6 after 2-5, A''s status / review events / experts row / notifications: '
         || s || ' / ' || n || ' / ' || n2 || ' / ' || n3;

  -- === 7-12. admin A reviews other applicants normally =======================
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  begin
    perform public.start_expert_review(app_b);
    reset role;
    select status into s from public.expert_applications where id = app_b;
    r := r || E'\n 7 A starts review of B: ALLOWED, status = ' || s;
  exception when others then r := r || E'\n 7 A starts review of B: FAILED ' || sqlerrm;
  end;

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.request_expert_application_changes(app_b, 'Please upload a clearer CV.', 'internal');
    reset role;
    select status into s from public.expert_applications where id = app_b;
    r := r || E'\n 8 A requests changes on B (with note): ALLOWED, status = ' || s;
  exception when others then r := r || E'\n 8 A requests changes on B (with note): FAILED ' || sqlerrm;
  end;

  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.submit_expert_application(app_b, true);
    reset role;
    select status into s from public.expert_applications where id = app_b;
    r := r || E'\n 9 B resubmits: ALLOWED, status = ' || s;
  exception when others then r := r || E'\n 9 B resubmits: FAILED ' || sqlerrm;
  end;

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.approve_expert_application(app_b, null);
    r := r || E'\n10 A approves B: ALLOWED, B is_verified_expert = ' || public.is_verified_expert(b);
  exception when others then r := r || E'\n10 A approves B: FAILED ' || sqlerrm;
  end;

  begin
    perform public.reject_expert_application(app_c, 'We could not verify your experience.', null);
    reset role;
    select status into s from public.expert_applications where id = app_c;
    r := r || E'\n11 A rejects C (with note): ALLOWED, status = ' || s;
  exception when others then r := r || E'\n11 A rejects C (with note): FAILED ' || sqlerrm;
  end;

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.suspend_expert(b, null);
    perform public.reinstate_expert(b, null);
    r := r || E'\n12 A suspends B / reinstates B: ALLOWED / ALLOWED, B active = ' || public.is_verified_expert(b);
  exception when others then r := r || E'\n12 A suspends B / reinstates B: FAILED ' || sqlerrm;
  end;
  reset role;

  -- === 13. a different admin reviews A's application =========================
  perform set_config('request.jwt.claims', json_build_object('sub', d, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.start_expert_review(app_a);
    perform public.approve_expert_application(app_a, null);
    r := r || E'\n13 D (second admin) starts review of A and approves: ALLOWED, A is_verified_expert = ' || public.is_verified_expert(a);
  exception when others then r := r || E'\n13 D (second admin) starts review of A and approves: FAILED ' || sqlerrm;
  end;
  reset role;

  -- === 14-16. suspend / reinstate on yourself ================================
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.suspend_expert(a, null);
    r := r || E'\n14 A suspends self: ALLOWED';
  exception when others then r := r || E'\n14 A suspends self: DENIED ' || sqlerrm;
  end;
  reset role;
  r := r || ', A active = ' || public.is_verified_expert(a);

  perform set_config('request.jwt.claims', json_build_object('sub', d, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.suspend_expert(a, null);
    r := r || E'\n15 D suspends A: ALLOWED';
  exception when others then r := r || E'\n15 D suspends A: FAILED ' || sqlerrm;
  end;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.reinstate_expert(a, null);
    r := r || '; A reinstates self: ALLOWED';
  exception when others then r := r || '; A reinstates self: DENIED ' || sqlerrm;
  end;
  reset role;
  select status = 'suspended' into ok from public.experts where profile_id = a;
  r := r || ', A suspended = ' || coalesce(ok::text, 'no row');

  perform set_config('request.jwt.claims', json_build_object('sub', d, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.reinstate_expert(a, null);
    r := r || E'\n16 D reinstates A: ALLOWED, A active = ' || public.is_verified_expert(a);
  exception when others then r := r || E'\n16 D reinstates A: FAILED ' || sqlerrm;
  end;
  reset role;

  -- === 17. an admin's own applicant actions still work =======================
  perform set_config('request.jwt.claims', json_build_object('sub', e, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.withdraw_expert_application(app_e);
    reset role;
    select status into s from public.expert_applications where id = app_e;
    r := r || E'\n17 E (admin) withdraws own application: ALLOWED, status = ' || s;
  exception when others then r := r || E'\n17 E (admin) withdraws own application: FAILED ' || sqlerrm;
  end;
  reset role;

  -- === 18. non-admins are still refused ======================================
  perform set_config('request.jwt.claims', json_build_object('sub', f, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.start_expert_review(app_c);
    r := r || E'\n18 F (farmer) starts review of C: ALLOWED';
  exception when others then r := r || E'\n18 F (farmer) starts review of C: DENIED ' || sqlerrm;
  end;
  begin
    perform public.suspend_expert(b, null);
    r := r || ' / suspends B: ALLOWED';
  exception when others then r := r || ' / suspends B: DENIED ' || sqlerrm;
  end;
  reset role;

  -- === 19-20. security characteristics unchanged =============================
  select bool_and(p.prosecdef),
         bool_and(p.proconfig = array['search_path=""']),
         bool_and(p.proowner = 'postgres'::regrole)
    into ok, ok2, ok3
  from pg_proc p
  where p.oid in (
    'public.transition_expert_application(uuid, text[], text, text, text, text)'::regprocedure,
    'public.suspend_expert(uuid, text)'::regprocedure,
    'public.reinstate_expert(uuid, text)'::regprocedure
  );
  r := r || E'\n19 functions keep SECURITY DEFINER, search_path, owner: ' || ok || ' / ' || ok2 || ' / ' || ok3;

  ok := not has_function_privilege('authenticated', 'public.transition_expert_application(uuid, text[], text, text, text, text)', 'execute')
        and not has_function_privilege('anon', 'public.transition_expert_application(uuid, text[], text, text, text, text)', 'execute');
  ok2 := has_function_privilege('authenticated', 'public.suspend_expert(uuid, text)', 'execute')
         and has_function_privilege('authenticated', 'public.reinstate_expert(uuid, text)', 'execute')
         and not has_function_privilege('anon', 'public.suspend_expert(uuid, text)', 'execute')
         and not has_function_privilege('anon', 'public.reinstate_expert(uuid, text)', 'execute');
  r := r || E'\n20 grants: transition internal only / suspend+reinstate authenticated, not anon: ' || ok || ' / ' || ok2;

  raise exception 'VERIFY_RESULTS%', r;
end;
$$;
