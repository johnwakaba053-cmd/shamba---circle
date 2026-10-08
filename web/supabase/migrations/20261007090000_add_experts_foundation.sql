-- Experts E1: verified-expert applications and verification (database only).
--
-- A farmer applies to become a Verified Expert with their education,
-- qualifications/certificates, professional experience and a CV (PDF).
-- Admins -- not moderators -- review the application and approve, reject
-- or ask for changes. Only an approved, active expert gets the Verified
-- badge (public.is_verified_expert()). Consultation and payments are not
-- part of this; they come later.
--
-- Private vs public:
--  * Private (applicant + admins only): the whole application --
--    expert_applications and its education, qualification, experience,
--    specialty and document rows -- every uploaded file in the private
--    'expert-documents' bucket, registration and credential numbers, and
--    every review note. Internal review notes and who reviewed are in
--    expert_review_events, which only admins can read.
--  * Public to signed-in users, only while the expert is active: the
--    experts row (title, headline, bio, county, years of experience,
--    languages) plus expert_public_specialties and
--    expert_public_credentials, which approve_expert_application() copies
--    from the application -- titles, institutions and years only, never a
--    document, credential number or registration number.
--
-- Private-profile farmers may become experts: the expert record is an
-- opt-in public role and doesn't read profile_visibility.
--
-- Writes:
--  * Applicants edit their own application only while it is a draft or
--    changes have been requested. Column grants keep status, notes and
--    decision fields out of their reach; status only moves through the
--    functions below.
--  * Admins write nothing directly -- only through the review functions,
--    each of which records an expert_review_events row.
--  * Nobody writes experts or its public tables directly.
--
-- Retention: a rejected or withdrawn application's documents are kept for
-- 12 months (purge_after). Supabase blocks deleting Storage files with
-- SQL, so a later scheduled job (service role) asks
-- expert_document_folders_due_for_purge() which folders to delete,
-- removes the files through the Storage API, then calls
-- mark_expert_documents_purged().
--
-- Existing tables change in one place only: the notifications type and
-- entity_type checks gain the expert values. Nothing else existing is
-- touched.

-- === reference data ==========================================================

create table public.expert_specialties (
  id text primary key check (id ~ '^[a-z][a-z0-9_]*$'),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  sort_order integer not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.expert_specialties (id, name, sort_order) values
  ('crop_agronomy', 'Crop agronomy', 10),
  ('soil_fertility', 'Soil health and fertility', 20),
  ('crop_protection', 'Pests and crop diseases', 30),
  ('horticulture', 'Horticulture', 40),
  ('irrigation', 'Irrigation and water', 50),
  ('agroforestry', 'Agroforestry', 60),
  ('veterinary', 'Veterinary (animal health)', 110),
  ('animal_nutrition', 'Animal nutrition and feeds', 120),
  ('dairy', 'Dairy farming', 130),
  ('poultry', 'Poultry', 140),
  ('aquaculture', 'Fish farming', 150),
  ('beekeeping', 'Beekeeping', 160),
  ('post_harvest', 'Post-harvest handling and storage', 210),
  ('agribusiness', 'Agribusiness and farm finance', 220);

alter table public.expert_specialties enable row level security;

revoke all on public.expert_specialties from anon;
revoke all on public.expert_specialties from authenticated;
grant select on public.expert_specialties to authenticated;

create policy "Authenticated users can view expert specialties"
on public.expert_specialties
for select
to authenticated
using (true);

-- === helpers =================================================================

-- Server-set created_at / updated_at, same as set_farm_records_timestamps.
create function public.set_experts_timestamps()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
  else
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.set_experts_timestamps() from public;
revoke execute on function public.set_experts_timestamps() from anon;
revoke execute on function public.set_experts_timestamps() from authenticated;

-- Used by a check constraint: at most 8 languages, each 1-40 characters.
create function public.expert_languages_valid(p_languages text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_languages is null
    or (
      cardinality(p_languages) <= 8
      and not exists (
        select 1
        from unnest(p_languages) as l (value)
        where l.value is null or char_length(btrim(l.value)) not between 1 and 40
      )
    );
$$;

-- === expert_applications =====================================================

create table public.expert_applications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'under_review', 'changes_requested', 'approved', 'rejected', 'withdrawn')),
  -- All optional while drafting; submit_expert_application() requires
  -- title, headline, bio, county and years.
  professional_title text check (professional_title is null or char_length(btrim(professional_title)) between 1 and 80),
  headline text check (headline is null or char_length(btrim(headline)) between 1 and 140),
  bio text check (bio is null or char_length(btrim(bio)) between 1 and 1500),
  county_id text references public.counties (id),
  years_experience integer check (years_experience is null or years_experience between 0 and 70),
  languages text[] check (public.expert_languages_valid(languages)),
  -- e.g. Kenya Veterinary Board + registration number. Private.
  registration_body text check (registration_body is null or char_length(btrim(registration_body)) between 1 and 150),
  registration_number text check (registration_number is null or char_length(btrim(registration_number)) between 1 and 100),
  consent_at timestamptz,
  submitted_at timestamptz,
  decided_at timestamptz,
  -- The reviewer's message to the applicant (changes requested /
  -- rejected). Internal notes live in expert_review_events.
  applicant_note text check (applicant_note is null or char_length(applicant_note) <= 1000),
  -- Set when rejected or withdrawn: documents are deleted after this.
  purge_after timestamptz,
  documents_purged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Target for the child tables' composite foreign keys, so a child row
  -- can only belong to one of its owner's own applications.
  constraint expert_applications_id_profile_id_key unique (id, profile_id)
);

-- One open application per farmer.
create unique index expert_applications_one_open_per_profile
  on public.expert_applications (profile_id)
  where status in ('draft', 'submitted', 'under_review', 'changes_requested');

create index expert_applications_status_submitted_at_idx
  on public.expert_applications (status, submitted_at);
create index expert_applications_purge_idx
  on public.expert_applications (purge_after)
  where purge_after is not null and documents_purged_at is null;

create trigger set_expert_applications_timestamps
  before insert or update on public.expert_applications
  for each row
  execute function public.set_experts_timestamps();

-- === application children ====================================================

create table public.expert_application_specialties (
  application_id uuid not null,
  profile_id uuid not null,
  specialty_id text not null references public.expert_specialties (id),
  created_at timestamptz not null default now(),
  primary key (application_id, specialty_id),
  constraint expert_application_specialties_application_fkey foreign key (application_id, profile_id)
    references public.expert_applications (id, profile_id) on delete cascade
);

create index expert_application_specialties_profile_id_idx on public.expert_application_specialties (profile_id);

create table public.expert_education (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null,
  profile_id uuid not null,
  institution text not null check (char_length(btrim(institution)) between 1 and 150),
  level text not null check (level in ('certificate', 'diploma', 'bachelors', 'masters', 'doctorate', 'other')),
  field_of_study text not null check (char_length(btrim(field_of_study)) between 1 and 150),
  start_year integer check (start_year is null or start_year between 1950 and 2100),
  -- Null while still studying.
  end_year integer check (end_year is null or end_year between 1950 and 2100),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expert_education_years_order check (start_year is null or end_year is null or end_year >= start_year),
  constraint expert_education_application_fkey foreign key (application_id, profile_id)
    references public.expert_applications (id, profile_id) on delete cascade
);

create index expert_education_application_id_idx on public.expert_education (application_id, sort_order);
create index expert_education_profile_id_idx on public.expert_education (profile_id);

create table public.expert_experience (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null,
  profile_id uuid not null,
  organisation text not null check (char_length(btrim(organisation)) between 1 and 150),
  role_title text not null check (char_length(btrim(role_title)) between 1 and 150),
  start_date date not null check (start_date between date '1950-01-01' and date '2100-12-31'),
  -- Null = current role.
  end_date date check (end_date is null or end_date between date '1950-01-01' and date '2100-12-31'),
  description text check (description is null or char_length(btrim(description)) between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expert_experience_dates_order check (end_date is null or end_date >= start_date),
  constraint expert_experience_application_fkey foreign key (application_id, profile_id)
    references public.expert_applications (id, profile_id) on delete cascade
);

create index expert_experience_application_id_idx on public.expert_experience (application_id, start_date desc);
create index expert_experience_profile_id_idx on public.expert_experience (profile_id);

-- Uploaded files. mime_type and size_bytes are copied from the Storage
-- object by prepare_expert_document(), never trusted from the client.
create table public.expert_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null,
  profile_id uuid not null,
  kind text not null check (kind in ('cv', 'certificate', 'licence', 'other')),
  storage_path text not null unique,
  file_name text not null check (char_length(btrim(file_name)) between 1 and 200),
  mime_type text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png')),
  size_bytes bigint not null check (size_bytes between 1 and 10485760),
  created_at timestamptz not null default now(),
  constraint expert_documents_cv_is_pdf check (kind <> 'cv' or mime_type = 'application/pdf'),
  constraint expert_documents_id_application_id_key unique (id, application_id),
  constraint expert_documents_application_fkey foreign key (application_id, profile_id)
    references public.expert_applications (id, profile_id) on delete cascade
);

-- Exactly one CV per application (submit requires it; replacing one is
-- delete then add).
create unique index expert_documents_one_cv_per_application
  on public.expert_documents (application_id)
  where kind = 'cv';
create index expert_documents_profile_id_idx on public.expert_documents (profile_id);

create table public.expert_qualifications (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null,
  profile_id uuid not null,
  title text not null check (char_length(btrim(title)) between 1 and 150),
  issuing_body text not null check (char_length(btrim(issuing_body)) between 1 and 150),
  -- Private.
  credential_number text check (credential_number is null or char_length(btrim(credential_number)) between 1 and 100),
  issued_on date check (issued_on is null or issued_on between date '1950-01-01' and date '2100-12-31'),
  expires_on date check (expires_on is null or expires_on between date '1950-01-01' and date '2100-12-31'),
  -- Optional supporting file; must belong to the same application.
  document_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expert_qualifications_dates_order check (issued_on is null or expires_on is null or expires_on >= issued_on),
  constraint expert_qualifications_application_fkey foreign key (application_id, profile_id)
    references public.expert_applications (id, profile_id) on delete cascade,
  constraint expert_qualifications_document_fkey foreign key (document_id, application_id)
    references public.expert_documents (id, application_id) on delete set null (document_id)
);

create index expert_qualifications_application_id_idx on public.expert_qualifications (application_id);
create index expert_qualifications_profile_id_idx on public.expert_qualifications (profile_id);
create index expert_qualifications_document_idx on public.expert_qualifications (document_id, application_id)
  where document_id is not null;

create trigger set_expert_education_timestamps
  before insert or update on public.expert_education
  for each row
  execute function public.set_experts_timestamps();

create trigger set_expert_experience_timestamps
  before insert or update on public.expert_experience
  for each row
  execute function public.set_experts_timestamps();

create trigger set_expert_qualifications_timestamps
  before insert or update on public.expert_qualifications
  for each row
  execute function public.set_experts_timestamps();

-- === experts (public, approved) ==============================================

create table public.experts (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  -- The application this public record was last approved from.
  application_id uuid not null references public.expert_applications (id),
  status text not null default 'active' check (status in ('active', 'suspended')),
  professional_title text not null check (char_length(btrim(professional_title)) between 1 and 80),
  headline text not null check (char_length(btrim(headline)) between 1 and 140),
  bio text not null check (char_length(btrim(bio)) between 1 and 1500),
  county_id text references public.counties (id),
  years_experience integer not null check (years_experience between 0 and 70),
  languages text[] check (public.expert_languages_valid(languages)),
  verified_at timestamptz not null,
  suspended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index experts_status_idx on public.experts (status, verified_at desc);
create index experts_county_id_idx on public.experts (county_id) where status = 'active';
create index experts_application_id_idx on public.experts (application_id);

create trigger set_experts_timestamps
  before insert or update on public.experts
  for each row
  execute function public.set_experts_timestamps();

create table public.expert_public_specialties (
  expert_profile_id uuid not null references public.experts (profile_id) on delete cascade,
  specialty_id text not null references public.expert_specialties (id),
  primary key (expert_profile_id, specialty_id)
);

create index expert_public_specialties_specialty_id_idx on public.expert_public_specialties (specialty_id);

-- Public summary of education and qualifications: titles, institutions
-- and years only.
create table public.expert_public_credentials (
  id uuid primary key default gen_random_uuid(),
  expert_profile_id uuid not null references public.experts (profile_id) on delete cascade,
  kind text not null check (kind in ('education', 'qualification')),
  -- Education level (education rows only).
  level text check (level is null or level in ('certificate', 'diploma', 'bachelors', 'masters', 'doctorate', 'other')),
  title text not null,
  organisation text not null,
  year integer,
  sort_order integer not null default 0
);

create index expert_public_credentials_expert_idx on public.expert_public_credentials (expert_profile_id, kind, sort_order);

-- === review log (admins only) ================================================

create table public.expert_review_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references public.expert_applications (id) on delete cascade,
  expert_profile_id uuid not null references public.profiles (id) on delete cascade,
  action text not null check (action in (
    'submitted', 'withdrawn', 'review_started', 'changes_requested',
    'approved', 'rejected', 'suspended', 'reinstated'
  )),
  actor_profile_id uuid references public.profiles (id) on delete set null,
  applicant_note text check (applicant_note is null or char_length(applicant_note) <= 1000),
  internal_note text check (internal_note is null or char_length(internal_note) <= 1000),
  created_at timestamptz not null default now()
);

create index expert_review_events_application_idx on public.expert_review_events (application_id, created_at);
create index expert_review_events_expert_idx on public.expert_review_events (expert_profile_id, created_at);
create index expert_review_events_actor_idx on public.expert_review_events (actor_profile_id);

-- === access helpers ==========================================================

-- The Verified badge: true only for an active expert.
create function public.is_verified_expert(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.experts
    where profile_id = p_profile_id
      and status = 'active'
  );
$$;

-- True when the caller owns this application and may still edit it.
-- Runs as the caller: it only ever sees the caller's own applications.
create function public.can_edit_expert_application(p_application_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.expert_applications a
    where a.id = p_application_id
      and a.profile_id = (select auth.uid())
      and a.status in ('draft', 'changes_requested')
  );
$$;

-- The same, for a Storage folder name (a uuid as text). A malformed name
-- is simply false, never an error.
create function public.can_edit_expert_application_folder(p_folder text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_folder ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.can_edit_expert_application(p_folder::uuid);
$$;

revoke all on function public.is_verified_expert(uuid) from public;
revoke execute on function public.is_verified_expert(uuid) from anon;
grant execute on function public.is_verified_expert(uuid) to authenticated;

revoke all on function public.can_edit_expert_application(uuid) from public;
revoke execute on function public.can_edit_expert_application(uuid) from anon;
grant execute on function public.can_edit_expert_application(uuid) to authenticated;

revoke all on function public.can_edit_expert_application_folder(text) from public;
revoke execute on function public.can_edit_expert_application_folder(text) from anon;
grant execute on function public.can_edit_expert_application_folder(text) to authenticated;

-- === application guards ======================================================

-- New applications: refused while the farmer is a suspended expert, and
-- for 30 days after a rejection. Runs as the caller (own rows only).
-- Raised with fixed messages the app maps: 'expert_suspended',
-- 'expert_application_cooldown'. A second open application hits the
-- unique index (23505).
create function public.check_expert_application_allowed()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.experts e
    where e.profile_id = new.profile_id and e.status = 'suspended'
  ) then
    raise exception 'expert_suspended' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.expert_applications a
    where a.profile_id = new.profile_id
      and a.status = 'rejected'
      and a.decided_at > now() - interval '30 days'
  ) then
    raise exception 'expert_application_cooldown' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function public.check_expert_application_allowed() from public;
revoke execute on function public.check_expert_application_allowed() from anon;
revoke execute on function public.check_expert_application_allowed() from authenticated;

create trigger check_expert_application_allowed
  before insert on public.expert_applications
  for each row
  execute function public.check_expert_application_allowed();

-- Per-application limits on child rows (TG_ARGV[0]). Runs as the caller,
-- who sees all of their own rows.
create function public.enforce_expert_child_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_count integer;
begin
  execute format('select count(*) from public.%I where application_id = $1', tg_table_name)
    into v_count
    using new.application_id;

  if v_count >= tg_argv[0]::integer then
    raise exception 'expert_limit_reached' using errcode = 'P0001', detail = tg_table_name;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_expert_child_limit() from public;
revoke execute on function public.enforce_expert_child_limit() from anon;
revoke execute on function public.enforce_expert_child_limit() from authenticated;

create trigger limit_expert_application_specialties
  before insert on public.expert_application_specialties
  for each row execute function public.enforce_expert_child_limit('3');

create trigger limit_expert_education
  before insert on public.expert_education
  for each row execute function public.enforce_expert_child_limit('10');

create trigger limit_expert_experience
  before insert on public.expert_experience
  for each row execute function public.enforce_expert_child_limit('15');

create trigger limit_expert_qualifications
  before insert on public.expert_qualifications
  for each row execute function public.enforce_expert_child_limit('15');

create trigger limit_expert_documents
  before insert on public.expert_documents
  for each row execute function public.enforce_expert_child_limit('20');

-- A document row must point at a file the caller already uploaded into
-- this application's own folder ({profile_id}/{application_id}/{file}).
-- Its type and size are copied from the Storage object. Runs as the
-- caller, so only the caller's own files are visible here.
-- Fixed messages: 'expert_document_path_invalid',
-- 'expert_document_not_uploaded', 'expert_cv_must_be_pdf'.
create function public.prepare_expert_document()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_metadata jsonb;
begin
  if array_length(string_to_array(new.storage_path, '/'), 1) <> 3
     or split_part(new.storage_path, '/', 1) <> new.profile_id::text
     or split_part(new.storage_path, '/', 2) <> new.application_id::text
     or split_part(new.storage_path, '/', 3) = '' then
    raise exception 'expert_document_path_invalid' using errcode = '22023';
  end if;

  select o.metadata into v_metadata
  from storage.objects o
  where o.bucket_id = 'expert-documents'
    and o.name = new.storage_path;

  if not found then
    raise exception 'expert_document_not_uploaded' using errcode = 'P0002';
  end if;

  new.mime_type := v_metadata ->> 'mimetype';
  new.size_bytes := (v_metadata ->> 'size')::bigint;

  if new.kind = 'cv' and new.mime_type is distinct from 'application/pdf' then
    raise exception 'expert_cv_must_be_pdf' using errcode = '22023';
  end if;

  return new;
end;
$$;

revoke all on function public.prepare_expert_document() from public;
revoke execute on function public.prepare_expert_document() from anon;
revoke execute on function public.prepare_expert_document() from authenticated;

create trigger prepare_expert_document
  before insert on public.expert_documents
  for each row
  execute function public.prepare_expert_document();

-- === RLS: applications and children ==========================================

alter table public.expert_applications enable row level security;
alter table public.expert_application_specialties enable row level security;
alter table public.expert_education enable row level security;
alter table public.expert_experience enable row level security;
alter table public.expert_documents enable row level security;
alter table public.expert_qualifications enable row level security;

revoke all on public.expert_applications from anon;
revoke all on public.expert_applications from authenticated;
revoke all on public.expert_application_specialties from anon;
revoke all on public.expert_application_specialties from authenticated;
revoke all on public.expert_education from anon;
revoke all on public.expert_education from authenticated;
revoke all on public.expert_experience from anon;
revoke all on public.expert_experience from authenticated;
revoke all on public.expert_documents from anon;
revoke all on public.expert_documents from authenticated;
revoke all on public.expert_qualifications from anon;
revoke all on public.expert_qualifications from authenticated;

-- Applications: status, consent, submission, decision, note and purge
-- columns are never client-writable.
grant select on public.expert_applications to authenticated;
grant insert (
  profile_id, professional_title, headline, bio, county_id, years_experience,
  languages, registration_body, registration_number
) on public.expert_applications to authenticated;
grant update (
  professional_title, headline, bio, county_id, years_experience,
  languages, registration_body, registration_number
) on public.expert_applications to authenticated;

-- Children: rows are added and removed; the owner keys (application_id,
-- profile_id) are never updatable. Documents are never updated.
grant select, delete on public.expert_application_specialties to authenticated;
grant insert (application_id, profile_id, specialty_id) on public.expert_application_specialties to authenticated;

grant select, delete on public.expert_education to authenticated;
grant insert (
  application_id, profile_id, institution, level, field_of_study, start_year, end_year, sort_order
) on public.expert_education to authenticated;
grant update (
  institution, level, field_of_study, start_year, end_year, sort_order
) on public.expert_education to authenticated;

grant select, delete on public.expert_experience to authenticated;
grant insert (
  application_id, profile_id, organisation, role_title, start_date, end_date, description
) on public.expert_experience to authenticated;
grant update (
  organisation, role_title, start_date, end_date, description
) on public.expert_experience to authenticated;

grant select, delete on public.expert_documents to authenticated;
grant insert (application_id, profile_id, kind, storage_path, file_name) on public.expert_documents to authenticated;

grant select, delete on public.expert_qualifications to authenticated;
grant insert (
  application_id, profile_id, title, issuing_body, credential_number, issued_on, expires_on, document_id
) on public.expert_qualifications to authenticated;
grant update (
  title, issuing_body, credential_number, issued_on, expires_on, document_id
) on public.expert_qualifications to authenticated;

create policy "Applicants can view their own expert applications"
on public.expert_applications
for select
to authenticated
using (profile_id = (select auth.uid()));

create policy "Admins can view all expert applications"
on public.expert_applications
for select
to authenticated
using ((select public.is_admin()));

-- New applications always start as drafts (the column default; status
-- isn't insertable).
create policy "Farmers can start their own expert application"
on public.expert_applications
for insert
to authenticated
with check (profile_id = (select auth.uid()));

create policy "Applicants can edit their own open expert application"
on public.expert_applications
for update
to authenticated
using (profile_id = (select auth.uid()) and status in ('draft', 'changes_requested'))
with check (profile_id = (select auth.uid()) and status in ('draft', 'changes_requested'));

-- The same four policies on each child table: owner reads always, admins
-- read all, owner writes only while the application is editable.
create policy "Applicants can view their own expert specialties"
on public.expert_application_specialties for select to authenticated
using (profile_id = (select auth.uid()));
create policy "Admins can view all expert application specialties"
on public.expert_application_specialties for select to authenticated
using ((select public.is_admin()));
create policy "Applicants can add specialties to an editable application"
on public.expert_application_specialties for insert to authenticated
with check (profile_id = (select auth.uid()) and public.can_edit_expert_application(application_id));
create policy "Applicants can remove specialties from an editable application"
on public.expert_application_specialties for delete to authenticated
using (profile_id = (select auth.uid()) and public.can_edit_expert_application(application_id));

create policy "Applicants can view their own expert education"
on public.expert_education for select to authenticated
using (profile_id = (select auth.uid()));
create policy "Admins can view all expert education"
on public.expert_education for select to authenticated
using ((select public.is_admin()));
create policy "Applicants can add education to an editable application"
on public.expert_education for insert to authenticated
with check (profile_id = (select auth.uid()) and public.can_edit_expert_application(application_id));
create policy "Applicants can edit education on an editable application"
on public.expert_education for update to authenticated
using (profile_id = (select auth.uid()) and public.can_edit_expert_application(application_id))
with check (profile_id = (select auth.uid()) and public.can_edit_expert_application(application_id));
create policy "Applicants can remove education from an editable application"
on public.expert_education for delete to authenticated
using (profile_id = (select auth.uid()) and public.can_edit_expert_application(application_id));

create policy "Applicants can view their own expert experience"
on public.expert_experience for select to authenticated
using (profile_id = (select auth.uid()));
create policy "Admins can view all expert experience"
on public.expert_experience for select to authenticated
using ((select public.is_admin()));
create policy "Applicants can add experience to an editable application"
on public.expert_experience for insert to authenticated
with check (profile_id = (select auth.uid()) and public.can_edit_expert_application(application_id));
create policy "Applicants can edit experience on an editable application"
on public.expert_experience for update to authenticated
using (profile_id = (select auth.uid()) and public.can_edit_expert_application(application_id))
with check (profile_id = (select auth.uid()) and public.can_edit_expert_application(application_id));
create policy "Applicants can remove experience from an editable application"
on public.expert_experience for delete to authenticated
using (profile_id = (select auth.uid()) and public.can_edit_expert_application(application_id));

create policy "Applicants can view their own expert documents"
on public.expert_documents for select to authenticated
using (profile_id = (select auth.uid()));
create policy "Admins can view all expert documents"
on public.expert_documents for select to authenticated
using ((select public.is_admin()));
create policy "Applicants can add documents to an editable application"
on public.expert_documents for insert to authenticated
with check (profile_id = (select auth.uid()) and public.can_edit_expert_application(application_id));
create policy "Applicants can remove documents from an editable application"
on public.expert_documents for delete to authenticated
using (profile_id = (select auth.uid()) and public.can_edit_expert_application(application_id));

create policy "Applicants can view their own expert qualifications"
on public.expert_qualifications for select to authenticated
using (profile_id = (select auth.uid()));
create policy "Admins can view all expert qualifications"
on public.expert_qualifications for select to authenticated
using ((select public.is_admin()));
create policy "Applicants can add qualifications to an editable application"
on public.expert_qualifications for insert to authenticated
with check (profile_id = (select auth.uid()) and public.can_edit_expert_application(application_id));
create policy "Applicants can edit qualifications on an editable application"
on public.expert_qualifications for update to authenticated
using (profile_id = (select auth.uid()) and public.can_edit_expert_application(application_id))
with check (profile_id = (select auth.uid()) and public.can_edit_expert_application(application_id));
create policy "Applicants can remove qualifications from an editable application"
on public.expert_qualifications for delete to authenticated
using (profile_id = (select auth.uid()) and public.can_edit_expert_application(application_id));

-- === RLS: public expert tables and review log ================================

alter table public.experts enable row level security;
alter table public.expert_public_specialties enable row level security;
alter table public.expert_public_credentials enable row level security;
alter table public.expert_review_events enable row level security;

revoke all on public.experts from anon;
revoke all on public.experts from authenticated;
revoke all on public.expert_public_specialties from anon;
revoke all on public.expert_public_specialties from authenticated;
revoke all on public.expert_public_credentials from anon;
revoke all on public.expert_public_credentials from authenticated;
revoke all on public.expert_review_events from anon;
revoke all on public.expert_review_events from authenticated;

grant select on public.experts to authenticated;
grant select on public.expert_public_specialties to authenticated;
grant select on public.expert_public_credentials to authenticated;
grant select on public.expert_review_events to authenticated;

create policy "Authenticated users can view active experts"
on public.experts for select to authenticated
using (status = 'active');
create policy "Experts can view their own expert record"
on public.experts for select to authenticated
using (profile_id = (select auth.uid()));
create policy "Admins can view all experts"
on public.experts for select to authenticated
using ((select public.is_admin()));

create policy "Authenticated users can view active experts' specialties"
on public.expert_public_specialties for select to authenticated
using (
  public.is_verified_expert(expert_profile_id)
  or expert_profile_id = (select auth.uid())
  or (select public.is_admin())
);

create policy "Authenticated users can view active experts' credentials"
on public.expert_public_credentials for select to authenticated
using (
  public.is_verified_expert(expert_profile_id)
  or expert_profile_id = (select auth.uid())
  or (select public.is_admin())
);

-- Internal notes and reviewer identities: admins only. Applicants see
-- their status and applicant_note on the application instead.
create policy "Admins can view expert review events"
on public.expert_review_events for select to authenticated
using ((select public.is_admin()));

-- === private storage bucket ==================================================

-- Path: {profile_id}/{application_id}/{file}. Private: no public URLs;
-- admins open files through short-lived signed URLs made server-side.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'expert-documents',
  'expert-documents',
  false,
  10485760, -- 10MB
  array['application/pdf', 'image/jpeg', 'image/png']
);

create policy "Applicants can upload expert documents to an editable application"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'expert-documents'
  and array_length(storage.foldername(objects.name), 1) = 2
  and (storage.foldername(objects.name))[1] = (select auth.uid())::text
  and public.can_edit_expert_application_folder((storage.foldername(objects.name))[2])
);

create policy "Applicants and admins can view expert documents"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'expert-documents'
  and (
    (storage.foldername(objects.name))[1] = (select auth.uid())::text
    or (select public.is_admin())
  )
);

-- No UPDATE policy: files are never overwritten, only removed and
-- re-uploaded, and only while the application is editable.
create policy "Applicants can delete expert documents from an editable application"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'expert-documents'
  and (storage.foldername(objects.name))[1] = (select auth.uid())::text
  and public.can_edit_expert_application_folder((storage.foldername(objects.name))[2])
);

-- === notifications ===========================================================

alter table public.notifications drop constraint notifications_type_check;

alter table public.notifications add constraint notifications_type_check
  check (
    type = any (
      array[
        'alert',
        'new_follower',
        'post_comment',
        'post_reaction',
        'mention',
        'marketplace',
        'education',
        'private_message',
        'expert_application_changes_requested',
        'expert_application_approved',
        'expert_application_rejected',
        'expert_suspended',
        'expert_reinstated'
      ]
    )
  );

alter table public.notifications drop constraint notifications_entity_type_check;

alter table public.notifications add constraint notifications_entity_type_check
  check (
    entity_type = any (
      array[
        'alert',
        'profile',
        'post',
        'post_comment',
        'listing',
        'education_resource',
        'conversation',
        'expert_application'
      ]
    )
  );

-- === internal workflow helpers (not callable by API roles) ===================

-- Moves an application from one of p_from to p_to, locking the row,
-- and records the review event. Returns the applicant's profile id.
-- Fixed messages: 'expert_application_not_found',
-- 'invalid_expert_application_state' (current status in DETAIL).
create function public.transition_expert_application(
  p_application_id uuid,
  p_from text[],
  p_to text,
  p_action text,
  p_applicant_note text,
  p_internal_note text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_status text;
begin
  select a.profile_id, a.status
    into v_profile_id, v_status
  from public.expert_applications a
  where a.id = p_application_id
  for update;

  if not found then
    raise exception 'expert_application_not_found' using errcode = 'P0002';
  end if;

  if not (v_status = any (p_from)) then
    raise exception 'invalid_expert_application_state' using errcode = 'P0001', detail = v_status;
  end if;

  update public.expert_applications
  set status = p_to,
      applicant_note = case
        when p_to in ('changes_requested', 'rejected') then nullif(btrim(p_applicant_note), '')
        when p_to = 'submitted' then null
        else applicant_note
      end,
      decided_at = case when p_to in ('approved', 'rejected', 'withdrawn') then now() else decided_at end,
      purge_after = case when p_to in ('rejected', 'withdrawn') then now() + interval '12 months' else purge_after end
  where id = p_application_id;

  insert into public.expert_review_events (
    application_id, expert_profile_id, action, actor_profile_id, applicant_note, internal_note
  )
  values (
    p_application_id, v_profile_id, p_action, (select auth.uid()),
    nullif(btrim(p_applicant_note), ''), nullif(btrim(p_internal_note), '')
  );

  return v_profile_id;
end;
$$;

create function public.notify_expert(
  p_recipient uuid,
  p_type text,
  p_entity_type text,
  p_entity_id uuid,
  p_title text,
  p_body text
)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.notifications (
    recipient_profile_id, actor_profile_id, type, entity_type, entity_id, title, body, payload
  )
  values (p_recipient, null, p_type, p_entity_type, p_entity_id, p_title, p_body, '{}'::jsonb);
$$;

revoke all on function public.transition_expert_application(uuid, text[], text, text, text, text) from public;
revoke execute on function public.transition_expert_application(uuid, text[], text, text, text, text) from anon;
revoke execute on function public.transition_expert_application(uuid, text[], text, text, text, text) from authenticated;

revoke all on function public.notify_expert(uuid, text, text, uuid, text, text) from public;
revoke execute on function public.notify_expert(uuid, text, text, uuid, text, text) from anon;
revoke execute on function public.notify_expert(uuid, text, text, uuid, text, text) from authenticated;

-- === applicant functions =====================================================

-- Submits (or re-submits after changes were requested). Requires consent
-- and a complete application; otherwise raises
-- 'expert_application_incomplete' with the missing parts, comma-separated,
-- in DETAIL: professional_title, headline, bio, county, years_experience,
-- specialties, education, experience, cv.
create function public.submit_expert_application(p_application_id uuid, p_consent boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_app public.expert_applications%rowtype;
  v_specialties integer;
  v_missing text[] := '{}';
begin
  if v_uid is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;

  select * into v_app
  from public.expert_applications
  where id = p_application_id and profile_id = v_uid
  for update;

  if not found then
    raise exception 'expert_application_not_found' using errcode = 'P0002';
  end if;

  if v_app.status not in ('draft', 'changes_requested') then
    raise exception 'invalid_expert_application_state' using errcode = 'P0001', detail = v_app.status;
  end if;

  if p_consent is not true then
    raise exception 'expert_consent_required' using errcode = '22023';
  end if;

  if exists (select 1 from public.experts where profile_id = v_uid and status = 'suspended') then
    raise exception 'expert_suspended' using errcode = 'P0001';
  end if;

  if v_app.professional_title is null then v_missing := v_missing || 'professional_title'; end if;
  if v_app.headline is null then v_missing := v_missing || 'headline'; end if;
  if v_app.bio is null then v_missing := v_missing || 'bio'; end if;
  if v_app.county_id is null then v_missing := v_missing || 'county'; end if;
  if v_app.years_experience is null then v_missing := v_missing || 'years_experience'; end if;

  select count(*) into v_specialties
  from public.expert_application_specialties s
  join public.expert_specialties es on es.id = s.specialty_id and es.is_active
  where s.application_id = p_application_id;
  if v_specialties = 0 then v_missing := v_missing || 'specialties'; end if;

  if not exists (select 1 from public.expert_education where application_id = p_application_id) then
    v_missing := v_missing || 'education';
  end if;
  if not exists (select 1 from public.expert_experience where application_id = p_application_id) then
    v_missing := v_missing || 'experience';
  end if;
  if not exists (select 1 from public.expert_documents where application_id = p_application_id and kind = 'cv') then
    v_missing := v_missing || 'cv';
  end if;

  if cardinality(v_missing) > 0 then
    raise exception 'expert_application_incomplete' using errcode = '22023', detail = array_to_string(v_missing, ',');
  end if;

  update public.expert_applications
  set consent_at = now(),
      submitted_at = now()
  where id = p_application_id;

  perform public.transition_expert_application(
    p_application_id, array['draft', 'changes_requested'], 'submitted', 'submitted', null, null
  );
end;
$$;

create function public.withdraw_expert_application(p_application_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.expert_applications
    where id = p_application_id and profile_id = (select auth.uid())
  ) then
    raise exception 'expert_application_not_found' using errcode = 'P0002';
  end if;

  perform public.transition_expert_application(
    p_application_id,
    array['draft', 'submitted', 'under_review', 'changes_requested'],
    'withdrawn', 'withdrawn', null, null
  );
end;
$$;

-- An active expert may update their public headline and bio. Title,
-- specialties and credentials change only through a new, reviewed
-- application. Fixed message: 'not_an_active_expert'.
create function public.update_my_expert_profile(p_headline text, p_bio text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;

  update public.experts
  set headline = btrim(p_headline),
      bio = btrim(p_bio)
  where profile_id = (select auth.uid())
    and status = 'active';

  if not found then
    raise exception 'not_an_active_expert' using errcode = 'P0001';
  end if;
end;
$$;

-- === admin functions =========================================================

-- Every admin function: 'not_authorized' (42501) unless is_admin().
-- Notes to the applicant are required when asking for changes or
-- rejecting ('expert_note_required').

create function public.start_expert_review(p_application_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  perform public.transition_expert_application(
    p_application_id, array['submitted'], 'under_review', 'review_started', null, null
  );
end;
$$;

create function public.request_expert_application_changes(
  p_application_id uuid,
  p_applicant_note text,
  p_internal_note text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if nullif(btrim(p_applicant_note), '') is null then
    raise exception 'expert_note_required' using errcode = '22023';
  end if;

  v_profile_id := public.transition_expert_application(
    p_application_id, array['submitted', 'under_review'], 'changes_requested', 'changes_requested',
    p_applicant_note, p_internal_note
  );

  perform public.notify_expert(
    v_profile_id, 'expert_application_changes_requested', 'expert_application', p_application_id,
    'Your expert application needs changes', null
  );
end;
$$;

create function public.reject_expert_application(
  p_application_id uuid,
  p_applicant_note text,
  p_internal_note text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if nullif(btrim(p_applicant_note), '') is null then
    raise exception 'expert_note_required' using errcode = '22023';
  end if;

  v_profile_id := public.transition_expert_application(
    p_application_id, array['submitted', 'under_review'], 'rejected', 'rejected',
    p_applicant_note, p_internal_note
  );

  perform public.notify_expert(
    v_profile_id, 'expert_application_rejected', 'expert_application', p_application_id,
    'Your expert application was not approved', null
  );
end;
$$;

-- Approves: publishes (or replaces) the public expert record, specialties
-- and credential summary from this application. Refused for a suspended
-- expert ('expert_suspended').
create function public.approve_expert_application(
  p_application_id uuid,
  p_internal_note text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_app public.expert_applications%rowtype;
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select * into v_app from public.expert_applications where id = p_application_id for update;
  if not found then
    raise exception 'expert_application_not_found' using errcode = 'P0002';
  end if;

  if exists (select 1 from public.experts where profile_id = v_app.profile_id and status = 'suspended') then
    raise exception 'expert_suspended' using errcode = 'P0001';
  end if;

  perform public.transition_expert_application(
    p_application_id, array['submitted', 'under_review'], 'approved', 'approved', null, p_internal_note
  );

  insert into public.experts (
    profile_id, application_id, status, professional_title, headline, bio,
    county_id, years_experience, languages, verified_at
  )
  values (
    v_app.profile_id, v_app.id, 'active', btrim(v_app.professional_title), btrim(v_app.headline),
    btrim(v_app.bio), v_app.county_id, v_app.years_experience, v_app.languages, now()
  )
  on conflict (profile_id) do update
  set application_id = excluded.application_id,
      status = 'active',
      professional_title = excluded.professional_title,
      headline = excluded.headline,
      bio = excluded.bio,
      county_id = excluded.county_id,
      years_experience = excluded.years_experience,
      languages = excluded.languages,
      verified_at = excluded.verified_at,
      suspended_at = null;

  delete from public.expert_public_specialties where expert_profile_id = v_app.profile_id;
  insert into public.expert_public_specialties (expert_profile_id, specialty_id)
  select v_app.profile_id, s.specialty_id
  from public.expert_application_specialties s
  where s.application_id = v_app.id;

  delete from public.expert_public_credentials where expert_profile_id = v_app.profile_id;
  insert into public.expert_public_credentials (expert_profile_id, kind, level, title, organisation, year, sort_order)
  select v_app.profile_id, 'education', e.level, btrim(e.field_of_study), btrim(e.institution), e.end_year, e.sort_order
  from public.expert_education e
  where e.application_id = v_app.id
  union all
  select v_app.profile_id, 'qualification', null, btrim(q.title), btrim(q.issuing_body),
         extract(year from q.issued_on)::integer, 0
  from public.expert_qualifications q
  where q.application_id = v_app.id;

  perform public.notify_expert(
    v_app.profile_id, 'expert_application_approved', 'expert_application', v_app.id,
    'You are now a Verified Expert', null
  );
end;
$$;

-- Suspending hides the expert (no badge, not listed); reinstating
-- restores them. Fixed messages: 'expert_not_found',
-- 'invalid_expert_state'.
create function public.suspend_expert(p_profile_id uuid, p_internal_note text default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_application_id uuid;
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  update public.experts
  set status = 'suspended',
      suspended_at = now()
  where profile_id = p_profile_id
    and status = 'active'
  returning application_id into v_application_id;

  if not found then
    if exists (select 1 from public.experts where profile_id = p_profile_id) then
      raise exception 'invalid_expert_state' using errcode = 'P0001';
    end if;
    raise exception 'expert_not_found' using errcode = 'P0002';
  end if;

  insert into public.expert_review_events (application_id, expert_profile_id, action, actor_profile_id, internal_note)
  values (v_application_id, p_profile_id, 'suspended', (select auth.uid()), nullif(btrim(p_internal_note), ''));

  perform public.notify_expert(
    p_profile_id, 'expert_suspended', 'profile', p_profile_id,
    'Your Verified Expert status has been suspended', null
  );
end;
$$;

create function public.reinstate_expert(p_profile_id uuid, p_internal_note text default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_application_id uuid;
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  update public.experts
  set status = 'active',
      suspended_at = null
  where profile_id = p_profile_id
    and status = 'suspended'
  returning application_id into v_application_id;

  if not found then
    if exists (select 1 from public.experts where profile_id = p_profile_id) then
      raise exception 'invalid_expert_state' using errcode = 'P0001';
    end if;
    raise exception 'expert_not_found' using errcode = 'P0002';
  end if;

  insert into public.expert_review_events (application_id, expert_profile_id, action, actor_profile_id, internal_note)
  values (v_application_id, p_profile_id, 'reinstated', (select auth.uid()), nullif(btrim(p_internal_note), ''));

  perform public.notify_expert(
    p_profile_id, 'expert_reinstated', 'profile', p_profile_id,
    'Your Verified Expert status has been restored', null
  );
end;
$$;

-- === retention (service role only) ===========================================

-- Folders ({profile_id}/{application_id}) whose files are due for
-- deletion: rejected or withdrawn more than 12 months ago and not yet
-- purged. The job deletes every file under each folder through the
-- Storage API, then calls mark_expert_documents_purged().
create function public.expert_document_folders_due_for_purge(p_limit integer default 50)
returns table (application_id uuid, folder text)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.profile_id::text || '/' || a.id::text
  from public.expert_applications a
  where a.status in ('rejected', 'withdrawn')
    and a.purge_after <= now()
    and a.documents_purged_at is null
  order by a.purge_after
  limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;

create function public.mark_expert_documents_purged(p_application_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  update public.expert_applications
  set documents_purged_at = now()
  where id = p_application_id
    and status in ('rejected', 'withdrawn')
    and purge_after <= now()
    and documents_purged_at is null;

  if not found then
    raise exception 'expert_documents_not_due' using errcode = 'P0001';
  end if;

  -- Qualification links are cleared by the foreign key (set null).
  delete from public.expert_documents where application_id = p_application_id;
end;
$$;

-- === function grants =========================================================

-- Same explicit revoke/grant sequence as every function in this project:
-- `revoke ... from public` alone doesn't remove Supabase's default direct
-- grant to anon on a new function.
revoke all on function public.expert_languages_valid(text[]) from public;
revoke execute on function public.expert_languages_valid(text[]) from anon;
grant execute on function public.expert_languages_valid(text[]) to authenticated;

revoke all on function public.submit_expert_application(uuid, boolean) from public;
revoke execute on function public.submit_expert_application(uuid, boolean) from anon;
grant execute on function public.submit_expert_application(uuid, boolean) to authenticated;

revoke all on function public.withdraw_expert_application(uuid) from public;
revoke execute on function public.withdraw_expert_application(uuid) from anon;
grant execute on function public.withdraw_expert_application(uuid) to authenticated;

revoke all on function public.update_my_expert_profile(text, text) from public;
revoke execute on function public.update_my_expert_profile(text, text) from anon;
grant execute on function public.update_my_expert_profile(text, text) to authenticated;

revoke all on function public.start_expert_review(uuid) from public;
revoke execute on function public.start_expert_review(uuid) from anon;
grant execute on function public.start_expert_review(uuid) to authenticated;

revoke all on function public.request_expert_application_changes(uuid, text, text) from public;
revoke execute on function public.request_expert_application_changes(uuid, text, text) from anon;
grant execute on function public.request_expert_application_changes(uuid, text, text) to authenticated;

revoke all on function public.reject_expert_application(uuid, text, text) from public;
revoke execute on function public.reject_expert_application(uuid, text, text) from anon;
grant execute on function public.reject_expert_application(uuid, text, text) to authenticated;

revoke all on function public.approve_expert_application(uuid, text) from public;
revoke execute on function public.approve_expert_application(uuid, text) from anon;
grant execute on function public.approve_expert_application(uuid, text) to authenticated;

revoke all on function public.suspend_expert(uuid, text) from public;
revoke execute on function public.suspend_expert(uuid, text) from anon;
grant execute on function public.suspend_expert(uuid, text) to authenticated;

revoke all on function public.reinstate_expert(uuid, text) from public;
revoke execute on function public.reinstate_expert(uuid, text) from anon;
grant execute on function public.reinstate_expert(uuid, text) to authenticated;

revoke all on function public.expert_document_folders_due_for_purge(integer) from public;
revoke execute on function public.expert_document_folders_due_for_purge(integer) from anon;
revoke execute on function public.expert_document_folders_due_for_purge(integer) from authenticated;
grant execute on function public.expert_document_folders_due_for_purge(integer) to service_role;

revoke all on function public.mark_expert_documents_purged(uuid) from public;
revoke execute on function public.mark_expert_documents_purged(uuid) from anon;
revoke execute on function public.mark_expert_documents_purged(uuid) from authenticated;
grant execute on function public.mark_expert_documents_purged(uuid) to service_role;
