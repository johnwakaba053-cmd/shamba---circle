-- Verification script for 20261007090000_add_experts_foundation.sql
--
-- Run in the Supabase SQL editor (or via the Supabase MCP execute_sql).
-- It is NOT a migration and changes nothing: it creates throwaway users
-- -- applicant A (private profile), another farmer B, moderator M, admin
-- D and a second applicant C -- exercises the expert tables, the private
-- 'expert-documents' bucket policies and every function as each of them
-- (and as anon and service_role), then ALWAYS ends with RAISE EXCEPTION,
-- which rolls every change back. The results are in the error message
-- ("VERIFY_RESULTS ...").
--
-- Storage files are simulated by inserting storage.objects rows as the
-- user, which runs the same RLS policies the Storage API does.
--
-- Expected output:
--    1 A starts a draft: ALLOWED
--    2 A sets own status to approved directly: DENIED 42501
--    3 A starts a second open application: REJECTED 23505
--    4 A adds 3 specialties, then a 4th: 3 ALLOWED / 4th REJECTED expert_limit_reached
--    5 A adds education, experience: ALLOWED
--    6 A uploads CV into own application folder: ALLOWED
--    7 A uploads into B's folder: DENIED 42501
--    8 A uploads into a folder that isn't an application of theirs: DENIED 42501
--    9 A registers a JPEG as the CV: REJECTED expert_cv_must_be_pdf
--   10 A registers a document with no uploaded file: REJECTED expert_document_not_uploaded
--   11 A registers the PDF CV; type/size come from Storage: application/pdf / 2048
--   12 A adds a qualification linked to a certificate: ALLOWED
--   13 A submits without consent: REJECTED expert_consent_required
--   14 A submits with consent: ALLOWED, status = submitted
--   15 A edits application after submit: rows changed = 0
--   16 A adds education after submit: DENIED 42501
--   17 A uploads a file after submit: DENIED 42501
--   18 B reads A's application / education / documents / files: 0 / 0 / 0 / 0
--   19 B (farmer) starts review: DENIED not_authorized
--   20 M (moderator) reads applications / files, starts review: 0 / 0 / DENIED not_authorized
--   21 D (admin) reads A's application / documents / files: 1 / 2 / 2
--   22 D starts review: ALLOWED, status = under_review
--   23 D requests changes without a note: REJECTED expert_note_required
--   24 D requests changes with a note: ALLOWED; A sees note / gets notification: true / 1
--   25 A edits and resubmits after changes requested: ALLOWED, status = submitted
--   26 A reads review events (internal notes): rows = 0
--   27 D approves: ALLOWED; A is_verified_expert = true
--   28 B reads A's experts row / specialties / credentials: 1 / 3 / 2
--   29 public credentials carry no credential or registration number: true
--   30 A (verified expert) updates own headline: ALLOWED; B updates as expert: REJECTED not_an_active_expert
--   31 D suspends A: B sees A's experts row = 0, is_verified_expert = false
--   32 suspended A starts a new application: REJECTED expert_suspended
--   33 D reinstates A: B sees A's experts row = 1
--   34 C applies, D rejects with a note: purge_after about 12 months away = true
--   35 C starts a new application within 30 days: REJECTED expert_application_cooldown
--   36 farmer calls purge functions: DENIED 42501 / 42501
--   37 service_role lists due folders (C's backdated): rows = 1; marks purged: C documents left = 0
--   38 anon reads experts / calls submit: DENIED 42501 / 42501
--
-- Uses phone numbers 19990000921-925, which must not belong to real
-- accounts.
do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  m uuid := gen_random_uuid();
  d uuid := gen_random_uuid();
  c uuid := gen_random_uuid();
  app_a uuid;
  app_b uuid;
  app_c uuid;
  cert_doc uuid;
  n int; n2 int; n3 int; n4 int;
  s text;
  ok boolean;
  r text := '';
begin
  insert into auth.users (id, aud, role, phone, created_at, updated_at) values
    (a, 'authenticated', 'authenticated', '19990000921', now(), now()),
    (b, 'authenticated', 'authenticated', '19990000922', now(), now()),
    (m, 'authenticated', 'authenticated', '19990000923', now(), now()),
    (d, 'authenticated', 'authenticated', '19990000924', now(), now()),
    (c, 'authenticated', 'authenticated', '19990000925', now(), now());
  update public.profiles set profile_visibility = 'private' where id = a;
  insert into public.staff_roles (profile_id, role) values (m, 'moderator'), (d, 'admin');

  -- B has an application of their own (for the cross-folder test).
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.expert_applications (profile_id) values (b) returning id into app_b;
  reset role;

  -- === Applicant A ===========================================================
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  begin
    insert into public.expert_applications (profile_id, professional_title, headline, bio, county_id, years_experience, languages, registration_body, registration_number)
    values (a, 'Veterinary surgeon', 'Dairy cattle health', 'Ten years with smallholder dairy farmers.',
            (select id from public.counties order by id limit 1), 10, array['English', 'Kiswahili'],
            'Kenya Veterinary Board', 'KVB-SECRET-123')
    returning id into app_a;
    r := r || E'\n 1 A starts a draft: ALLOWED';
  exception when others then r := r || E'\n 1 A starts a draft: FAILED ' || sqlstate || ' ' || sqlerrm;
  end;

  begin
    update public.expert_applications set status = 'approved' where id = app_a;
    r := r || E'\n 2 A sets own status to approved directly: ALLOWED';
  exception when others then r := r || E'\n 2 A sets own status to approved directly: DENIED ' || sqlstate;
  end;

  begin
    insert into public.expert_applications (profile_id) values (a);
    r := r || E'\n 3 A starts a second open application: ALLOWED';
  exception when others then r := r || E'\n 3 A starts a second open application: REJECTED ' || sqlstate;
  end;

  -- The 4th insert gets its own block: a failure inside a block rolls
  -- back everything else in that block too.
  insert into public.expert_application_specialties (application_id, profile_id, specialty_id) values (app_a, a, 'veterinary');
  insert into public.expert_application_specialties (application_id, profile_id, specialty_id) values (app_a, a, 'dairy');
  insert into public.expert_application_specialties (application_id, profile_id, specialty_id) values (app_a, a, 'animal_nutrition');
  select count(*) into n from public.expert_application_specialties where application_id = app_a;
  begin
    insert into public.expert_application_specialties (application_id, profile_id, specialty_id) values (app_a, a, 'poultry');
    r := r || E'\n 4 A adds 3 specialties, then a 4th: ' || n || ' ALLOWED / 4th ALLOWED';
  exception when others then r := r || E'\n 4 A adds 3 specialties, then a 4th: ' || n || ' ALLOWED / 4th REJECTED ' || sqlerrm;
  end;

  begin
    insert into public.expert_education (application_id, profile_id, institution, level, field_of_study, start_year, end_year)
    values (app_a, a, 'University of Nairobi', 'bachelors', 'Veterinary Medicine', 2008, 2013);
    insert into public.expert_experience (application_id, profile_id, organisation, role_title, start_date, description)
    values (app_a, a, 'County Livestock Office', 'Veterinary officer', date '2014-01-01', 'Herd health visits.');
    r := r || E'\n 5 A adds education, experience: ALLOWED';
  exception when others then r := r || E'\n 5 A adds education, experience: FAILED ' || sqlstate || ' ' || sqlerrm;
  end;

  begin
    insert into storage.objects (bucket_id, name, owner, owner_id, metadata) values
      ('expert-documents', a || '/' || app_a || '/cv.pdf', a, a::text, '{"mimetype":"application/pdf","size":2048}'),
      ('expert-documents', a || '/' || app_a || '/photo.jpg', a, a::text, '{"mimetype":"image/jpeg","size":1000}'),
      ('expert-documents', a || '/' || app_a || '/cert.pdf', a, a::text, '{"mimetype":"application/pdf","size":3000}');
    r := r || E'\n 6 A uploads CV into own application folder: ALLOWED';
  exception when others then r := r || E'\n 6 A uploads CV into own application folder: DENIED ' || sqlstate || ' ' || sqlerrm;
  end;

  begin
    insert into storage.objects (bucket_id, name, owner, owner_id, metadata)
    values ('expert-documents', b || '/' || app_b || '/x.pdf', a, a::text, '{"mimetype":"application/pdf","size":1}');
    r := r || E'\n 7 A uploads into B''s folder: ALLOWED';
  exception when others then r := r || E'\n 7 A uploads into B''s folder: DENIED ' || sqlstate;
  end;

  begin
    insert into storage.objects (bucket_id, name, owner, owner_id, metadata)
    values ('expert-documents', a || '/' || app_b || '/x.pdf', a, a::text, '{"mimetype":"application/pdf","size":1}');
    r := r || E'\n 8 A uploads into a folder that isn''t an application of theirs: ALLOWED';
  exception when others then r := r || E'\n 8 A uploads into a folder that isn''t an application of theirs: DENIED ' || sqlstate;
  end;

  begin
    insert into public.expert_documents (application_id, profile_id, kind, storage_path, file_name)
    values (app_a, a, 'cv', a || '/' || app_a || '/photo.jpg', 'photo.jpg');
    r := r || E'\n 9 A registers a JPEG as the CV: ALLOWED';
  exception when others then r := r || E'\n 9 A registers a JPEG as the CV: REJECTED ' || sqlerrm;
  end;

  begin
    insert into public.expert_documents (application_id, profile_id, kind, storage_path, file_name)
    values (app_a, a, 'certificate', a || '/' || app_a || '/missing.pdf', 'missing.pdf');
    r := r || E'\n10 A registers a document with no uploaded file: ALLOWED';
  exception when others then r := r || E'\n10 A registers a document with no uploaded file: REJECTED ' || sqlerrm;
  end;

  begin
    insert into public.expert_documents (application_id, profile_id, kind, storage_path, file_name)
    values (app_a, a, 'cv', a || '/' || app_a || '/cv.pdf', 'cv.pdf');
    select mime_type || ' / ' || size_bytes into s from public.expert_documents where application_id = app_a and kind = 'cv';
    r := r || E'\n11 A registers the PDF CV; type/size come from Storage: ' || s;
  exception when others then r := r || E'\n11 A registers the PDF CV: FAILED ' || sqlstate || ' ' || sqlerrm;
  end;

  begin
    insert into public.expert_documents (application_id, profile_id, kind, storage_path, file_name)
    values (app_a, a, 'certificate', a || '/' || app_a || '/cert.pdf', 'cert.pdf')
    returning id into cert_doc;
    insert into public.expert_qualifications (application_id, profile_id, title, issuing_body, credential_number, issued_on, document_id)
    values (app_a, a, 'Licensed Veterinary Surgeon', 'Kenya Veterinary Board', 'CRED-SECRET-9', date '2014-03-01', cert_doc);
    r := r || E'\n12 A adds a qualification linked to a certificate: ALLOWED';
  exception when others then r := r || E'\n12 A adds a qualification: FAILED ' || sqlstate || ' ' || sqlerrm;
  end;

  begin
    perform public.submit_expert_application(app_a, false);
    r := r || E'\n13 A submits without consent: ALLOWED';
  exception when others then r := r || E'\n13 A submits without consent: REJECTED ' || sqlerrm;
  end;

  begin
    perform public.submit_expert_application(app_a, true);
    select status into s from public.expert_applications where id = app_a;
    r := r || E'\n14 A submits with consent: ALLOWED, status = ' || s;
  exception when others then r := r || E'\n14 A submits with consent: FAILED ' || sqlerrm;
  end;

  update public.expert_applications set headline = 'Changed after submit' where id = app_a;
  get diagnostics n = row_count;
  r := r || E'\n15 A edits application after submit: rows changed = ' || n;

  begin
    insert into public.expert_education (application_id, profile_id, institution, level, field_of_study)
    values (app_a, a, 'Late College', 'diploma', 'Anything');
    r := r || E'\n16 A adds education after submit: ALLOWED';
  exception when others then r := r || E'\n16 A adds education after submit: DENIED ' || sqlstate;
  end;

  begin
    insert into storage.objects (bucket_id, name, owner, owner_id, metadata)
    values ('expert-documents', a || '/' || app_a || '/late.pdf', a, a::text, '{"mimetype":"application/pdf","size":1}');
    r := r || E'\n17 A uploads a file after submit: ALLOWED';
  exception when others then r := r || E'\n17 A uploads a file after submit: DENIED ' || sqlstate;
  end;
  reset role;

  -- === Other farmer B ========================================================
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.expert_applications where id = app_a;
  select count(*) into n2 from public.expert_education where application_id = app_a;
  select count(*) into n3 from public.expert_documents where application_id = app_a;
  select count(*) into n4 from storage.objects where bucket_id = 'expert-documents' and name like a || '/%';
  r := r || E'\n18 B reads A''s application / education / documents / files: ' || n || ' / ' || n2 || ' / ' || n3 || ' / ' || n4;
  begin
    perform public.start_expert_review(app_a);
    r := r || E'\n19 B (farmer) starts review: ALLOWED';
  exception when others then r := r || E'\n19 B (farmer) starts review: DENIED ' || sqlerrm;
  end;
  reset role;

  -- === Moderator M ===========================================================
  perform set_config('request.jwt.claims', json_build_object('sub', m, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.expert_applications where id = app_a;
  select count(*) into n2 from storage.objects where bucket_id = 'expert-documents' and name like a || '/%';
  begin
    perform public.start_expert_review(app_a);
    s := 'ALLOWED';
  exception when others then s := 'DENIED ' || sqlerrm;
  end;
  r := r || E'\n20 M (moderator) reads applications / files, starts review: ' || n || ' / ' || n2 || ' / ' || s;
  reset role;

  -- === Admin D ===============================================================
  perform set_config('request.jwt.claims', json_build_object('sub', d, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.expert_applications where id = app_a;
  select count(*) into n2 from public.expert_documents where application_id = app_a;
  select count(*) into n3 from storage.objects where bucket_id = 'expert-documents' and name like a || '/%'
    and name in (a || '/' || app_a || '/cv.pdf', a || '/' || app_a || '/cert.pdf');
  r := r || E'\n21 D (admin) reads A''s application / documents / files: ' || n || ' / ' || n2 || ' / ' || n3;

  begin
    perform public.start_expert_review(app_a);
    select status into s from public.expert_applications where id = app_a;
    r := r || E'\n22 D starts review: ALLOWED, status = ' || s;
  exception when others then r := r || E'\n22 D starts review: FAILED ' || sqlerrm;
  end;

  begin
    perform public.request_expert_application_changes(app_a, '  ', 'internal');
    r := r || E'\n23 D requests changes without a note: ALLOWED';
  exception when others then r := r || E'\n23 D requests changes without a note: REJECTED ' || sqlerrm;
  end;

  begin
    perform public.request_expert_application_changes(app_a, 'Please add your KVB licence expiry date.', 'Licence looks valid; date missing.');
    s := 'ALLOWED';
  exception when others then s := 'FAILED ' || sqlerrm;
  end;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select (applicant_note = 'Please add your KVB licence expiry date.') into ok from public.expert_applications where id = app_a;
  select count(*) into n from public.notifications where recipient_profile_id = a and type = 'expert_application_changes_requested';
  r := r || E'\n24 D requests changes with a note: ' || s || '; A sees note / gets notification: ' || coalesce(ok::text, 'null') || ' / ' || n;

  begin
    update public.expert_qualifications set expires_on = date '2030-03-01' where application_id = app_a;
    perform public.submit_expert_application(app_a, true);
    select status into s from public.expert_applications where id = app_a;
    r := r || E'\n25 A edits and resubmits after changes requested: ALLOWED, status = ' || s;
  exception when others then r := r || E'\n25 A edits and resubmits: FAILED ' || sqlerrm;
  end;

  select count(*) into n from public.expert_review_events;
  r := r || E'\n26 A reads review events (internal notes): rows = ' || n;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', d, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.approve_expert_application(app_a, 'Verified licence with KVB register.');
    s := 'ALLOWED';
  exception when others then s := 'FAILED ' || sqlerrm;
  end;
  r := r || E'\n27 D approves: ' || s || '; A is_verified_expert = ' || public.is_verified_expert(a);
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.experts where profile_id = a;
  select count(*) into n2 from public.expert_public_specialties where expert_profile_id = a;
  select count(*) into n3 from public.expert_public_credentials where expert_profile_id = a;
  r := r || E'\n28 B reads A''s experts row / specialties / credentials: ' || n || ' / ' || n2 || ' / ' || n3;
  select not exists (
    select 1 from public.expert_public_credentials pc
    where pc.expert_profile_id = a
      and (pc::text like '%SECRET%')
  ) and not exists (
    select 1 from public.experts e where e.profile_id = a and e::text like '%SECRET%'
  ) into ok;
  r := r || E'\n29 public credentials carry no credential or registration number: ' || ok;
  begin
    perform public.update_my_expert_profile('Should fail', 'Not an expert');
    s := 'ALLOWED';
  exception when others then s := 'REJECTED ' || sqlerrm;
  end;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.update_my_expert_profile('Dairy herd health and fertility', 'Ten years with smallholder dairy farmers.');
    r := r || E'\n30 A (verified expert) updates own headline: ALLOWED; B updates as expert: ' || s;
  exception when others then r := r || E'\n30 A updates own headline: FAILED ' || sqlerrm || '; B: ' || s;
  end;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', d, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.suspend_expert(a, 'Complaint under investigation.');
    s := '';
  exception when others then s := ' (suspend FAILED ' || sqlerrm || ')';
  end;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.experts where profile_id = a;
  r := r || E'\n31 D suspends A: B sees A''s experts row = ' || n || ', is_verified_expert = ' || public.is_verified_expert(a) || s;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    insert into public.expert_applications (profile_id) values (a);
    r := r || E'\n32 suspended A starts a new application: ALLOWED';
  exception when others then r := r || E'\n32 suspended A starts a new application: REJECTED ' || sqlerrm;
  end;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', d, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.reinstate_expert(a, 'Complaint dismissed.');
    s := '';
  exception when others then s := ' (reinstate FAILED ' || sqlerrm || ')';
  end;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.experts where profile_id = a;
  r := r || E'\n33 D reinstates A: B sees A''s experts row = ' || n || s;
  reset role;

  -- === Applicant C: rejection, cooldown, retention ===========================
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.expert_applications (profile_id, professional_title, headline, bio, county_id, years_experience)
  values (c, 'Agronomist', 'Maize and beans', 'Extension work.', (select id from public.counties order by id limit 1), 3)
  returning id into app_c;
  insert into public.expert_application_specialties (application_id, profile_id, specialty_id) values (app_c, c, 'crop_agronomy');
  insert into public.expert_education (application_id, profile_id, institution, level, field_of_study) values (app_c, c, 'Egerton University', 'diploma', 'Agriculture');
  insert into public.expert_experience (application_id, profile_id, organisation, role_title, start_date) values (app_c, c, 'Self', 'Farmer', date '2020-01-01');
  insert into storage.objects (bucket_id, name, owner, owner_id, metadata)
  values ('expert-documents', c || '/' || app_c || '/cv.pdf', c, c::text, '{"mimetype":"application/pdf","size":500}');
  insert into public.expert_documents (application_id, profile_id, kind, storage_path, file_name)
  values (app_c, c, 'cv', c || '/' || app_c || '/cv.pdf', 'cv.pdf');
  perform public.submit_expert_application(app_c, true);
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', d, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.reject_expert_application(app_c, 'We could not verify your diploma.', null);
    s := 'ALLOWED';
  exception when others then s := 'FAILED ' || sqlerrm;
  end;
  select purge_after between now() + interval '11 months' and now() + interval '13 months' into ok
  from public.expert_applications where id = app_c;
  r := r || E'\n34 C applies, D rejects with a note: ' || s || '; purge_after about 12 months away = ' || coalesce(ok::text, 'null');
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    insert into public.expert_applications (profile_id) values (c);
    r := r || E'\n35 C starts a new application within 30 days: ALLOWED';
  exception when others then r := r || E'\n35 C starts a new application within 30 days: REJECTED ' || sqlerrm;
  end;

  begin
    perform * from public.expert_document_folders_due_for_purge(10);
    s := 'ALLOWED';
  exception when others then s := 'DENIED ' || sqlstate;
  end;
  begin
    perform public.mark_expert_documents_purged(app_c);
    s := s || ' / ALLOWED';
  exception when others then s := s || ' / DENIED ' || sqlstate;
  end;
  r := r || E'\n36 farmer calls purge functions: ' || s;
  reset role;

  -- Backdate C's retention window, then run the purge as the job would.
  update public.expert_applications set purge_after = now() - interval '1 day' where id = app_c;
  set local role service_role;
  select count(*) into n from public.expert_document_folders_due_for_purge(200) f
  where f.application_id = app_c and f.folder = c || '/' || app_c;
  perform public.mark_expert_documents_purged(app_c);
  reset role;
  select count(*) into n2 from public.expert_documents where application_id = app_c;
  r := r || E'\n37 service_role lists due folders (C''s backdated): rows = ' || n || '; marks purged: C documents left = ' || n2;

  -- === anon ==================================================================
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  set local role anon;
  begin
    perform 1 from public.experts;
    s := 'ALLOWED';
  exception when others then s := 'DENIED ' || sqlstate;
  end;
  begin
    perform public.submit_expert_application(app_a, true);
    s := s || ' / ALLOWED';
  exception when others then s := s || ' / DENIED ' || sqlstate;
  end;
  r := r || E'\n38 anon reads experts / calls submit: ' || s;
  reset role;

  raise exception 'VERIFY_RESULTS%', r;
end $$;
