-- Phase 0, Step 5: core profiles + role stub.
--
-- Scope, deliberately: just enough shape to be correct, nothing that
-- assumes it's final. No policies, no triggers, no seed data, no other
-- application tables. See project planning docs for what's deferred and
-- why.

-- public.profiles: one row per authenticated user, keyed 1:1 to
-- auth.users so ownership checks are a direct auth.uid() = id
-- comparison with no join.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  phone text unique,
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- public.user_roles: one row per (profile, role) rather than boolean
-- flag columns on profiles, so a person can hold more than one role
-- (farmer + seller, etc.) without a schema change per new combination.
-- `role` is a text + check constraint, not a Postgres enum type, so
-- the allowed values are a one-line change later rather than an enum
-- migration.
create table public.user_roles (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('farmer', 'buyer', 'seller')),
  created_at timestamptz not null default now(),
  primary key (profile_id, role)
);

alter table public.user_roles enable row level security;
