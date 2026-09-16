-- Profile privacy foundation: adds the column that lets a user decide
-- whether their profile identity is publicly visible. Privacy belongs to
-- the individual profile, not to community membership or roles — this
-- column is deliberately the only change here.
--
-- text + check constraint (not a native enum, not a boolean), matching
-- the pattern already used for user_roles.role and communities.group_name,
-- so the allowed value set stays a one-line change later instead of a
-- type migration.
--
-- NOT NULL DEFAULT 'private': Postgres backfills this default into every
-- existing row as part of adding the column, so existing profiles safely
-- become 'private' with no separate backfill statement needed. Private by
-- default so no user is ever inadvertently public before making a choice.
--
-- No RLS change, no index, no public-read function: this is schema-only.
-- The existing "own row" SELECT/UPDATE policies on profiles already cover
-- reading and writing this new column for its owner.
alter table public.profiles
  add column profile_visibility text not null default 'private'
    check (profile_visibility in ('public', 'private'));
