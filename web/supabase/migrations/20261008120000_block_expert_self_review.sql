-- Experts: admins can't review their own expert application or change
-- their own expert status.
--
-- E1 (20261007090000_add_experts_foundation.sql) checks is_admin() in
-- every admin review function but never compares the applicant with the
-- caller, so an admin could start review of, request changes on, reject
-- or approve their own application, and suspend or reinstate themselves.
--
-- Enforced in the database, where every admin write already goes:
--  * transition_expert_application() -- the one place every application
--    status change passes through -- refuses any action other than the
--    applicant's own 'submitted' / 'withdrawn' when the applicant is the
--    caller. That covers start_expert_review, request_expert_application_
--    changes, reject_expert_application and approve_expert_application
--    (approve publishes the expert record only after the transition, so
--    a refused approval writes nothing).
--  * suspend_expert() / reinstate_expert() refuse p_profile_id = caller.
-- Fixed message: 'cannot_review_own_expert_application' (42501).
--
-- Calls with no signed-in user (SQL editor, service role) are unaffected:
-- auth.uid() is null, which never equals an applicant.
--
-- Everything else is unchanged: each function keeps its signature,
-- SECURITY DEFINER, empty search_path, volatility, checks, error messages
-- and grants (restated at the end, same sequence as E1). No table, RLS or
-- storage change; internal-note visibility is untouched.

create or replace function public.transition_expert_application(
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

  -- Only the applicant's own actions may be taken on their own
  -- application; every review action needs a different admin.
  if p_action not in ('submitted', 'withdrawn') and v_profile_id = (select auth.uid()) then
    raise exception 'cannot_review_own_expert_application' using errcode = '42501';
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

create or replace function public.suspend_expert(p_profile_id uuid, p_internal_note text default null)
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

  if p_profile_id = (select auth.uid()) then
    raise exception 'cannot_review_own_expert_application' using errcode = '42501';
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

create or replace function public.reinstate_expert(p_profile_id uuid, p_internal_note text default null)
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

  if p_profile_id = (select auth.uid()) then
    raise exception 'cannot_review_own_expert_application' using errcode = '42501';
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

-- Same grants as E1 (create or replace keeps them; restated so this file
-- alone shows them). transition_expert_application stays internal.
revoke all on function public.transition_expert_application(uuid, text[], text, text, text, text) from public;
revoke execute on function public.transition_expert_application(uuid, text[], text, text, text, text) from anon;
revoke execute on function public.transition_expert_application(uuid, text[], text, text, text, text) from authenticated;

revoke all on function public.suspend_expert(uuid, text) from public;
revoke execute on function public.suspend_expert(uuid, text) from anon;
grant execute on function public.suspend_expert(uuid, text) to authenticated;

revoke all on function public.reinstate_expert(uuid, text) from public;
revoke execute on function public.reinstate_expert(uuid, text) from anon;
grant execute on function public.reinstate_expert(uuid, text) to authenticated;
