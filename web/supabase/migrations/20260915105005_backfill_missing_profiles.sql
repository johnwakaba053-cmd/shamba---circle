-- One-time backfill: create a profiles row for any auth.users row that
-- predates the on_auth_user_created trigger (added in
-- 20260915101310_create_profile_on_signup_trigger.sql) and so never got
-- one automatically.
--
-- Idempotent by construction (WHERE NOT EXISTS): safe to run more than
-- once, and safe regardless of ordering relative to the trigger, since it
-- only reads/writes profiles and never touches auth.users.
insert into public.profiles (id, phone)
select u.id, u.phone
from auth.users u
where not exists (
  select 1
  from public.profiles p
  where p.id = u.id
);
