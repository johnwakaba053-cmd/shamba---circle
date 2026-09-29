-- Trust & Safety Step 2: reporting & moderation backend.
--
-- Farmers report a profile, post/reel, comment, listing, story or private
-- message through report_content(); staff (can_moderate(), Step 1) read
-- the reports and resolve them through resolve_report(). No existing
-- table, policy or trigger changes: private messages stay
-- participant-only, and moderators never get general access to them.
--
-- Design points:
--   - target_id has NO foreign key, and snapshot holds a server-made copy
--     of the reported item, because authors can hard-delete their own
--     posts, comments, stories, listings and messages (and a deleted
--     profile cascades to all of them). A report and its evidence outlive
--     the content.
--   - The snapshot is built by report_content() from the real row, never
--     sent by the client, so it can't be forged. It never includes a
--     phone number. A message report copies only that one message.
--   - report_content() only accepts items the caller can actually see
--     (a message only from a participant of its conversation, a story
--     only while it's active), and answers "not found" otherwise, so it
--     never confirms that something hidden exists.
--   - One open report per reporter per item, and at most 20 reports per
--     reporter per 24 hours.
--   - Reporters can't read reports back, and reported users never see
--     them. Only staff can read, and only through resolve_report() can
--     anything change.

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  -- Kept (as NULL) if the reporter's account is later deleted.
  reporter_profile_id uuid references public.profiles (id) on delete set null,
  target_type text not null
    check (target_type in ('profile', 'post', 'comment', 'listing', 'story', 'message')),
  target_id uuid not null,
  -- Who owns the reported item (set by report_content()), so staff can
  -- spot repeat offenders. Kept (as NULL) if that account is deleted.
  target_profile_id uuid references public.profiles (id) on delete set null,
  reason text not null
    check (reason in (
      'spam', 'scam_or_fraud', 'harassment', 'hate_speech', 'violence',
      'sexual_content', 'prohibited_item', 'misinformation', 'other'
    )),
  details text check (details is null or char_length(details) <= 1000),
  snapshot jsonb not null,
  status text not null default 'open'
    check (status in ('open', 'reviewing', 'actioned', 'dismissed')),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  resolution_note text check (resolution_note is null or char_length(resolution_note) <= 1000),
  created_at timestamptz not null default now()
);

-- A reporter can't pile up open reports on the same item. Once staff
-- resolve it, a new report is allowed (e.g. the problem came back).
create unique index reports_one_open_per_reporter_target
  on public.reports (reporter_profile_id, target_type, target_id)
  where status in ('open', 'reviewing');

-- The staff queue, repeat-offender lookups, and the rate limit.
create index reports_status_created_at_idx on public.reports (status, created_at desc);
create index reports_target_profile_id_idx on public.reports (target_profile_id);
create index reports_reporter_created_at_idx on public.reports (reporter_profile_id, created_at);

alter table public.reports enable row level security;

-- Same reset as staff_roles: default privileges grant everything to anon
-- and authenticated. Writes only happen inside the two functions below.
revoke all on public.reports from anon;
revoke all on public.reports from authenticated;
grant select on public.reports to authenticated;

create policy "Staff can view reports"
on public.reports
for select
to authenticated
using ((select public.can_moderate()));

create function public.report_content(
  p_target_type text,
  p_target_id uuid,
  p_reason text,
  p_details text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_owner uuid;
  v_snapshot jsonb;
  v_report_id uuid;
begin
  if v_uid is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;

  if p_target_type is null
     or p_target_type not in ('profile', 'post', 'comment', 'listing', 'story', 'message') then
    raise exception 'invalid_report_target_type' using errcode = '22023';
  end if;

  -- Serialise one reporter's calls so the rate limit can't be raced.
  perform pg_advisory_xact_lock(hashtextextended('report_content:' || v_uid::text, 0));

  if (
    select count(*)
    from public.reports
    where reporter_profile_id = v_uid
      and created_at > now() - interval '24 hours'
  ) >= 20 then
    raise exception 'report_rate_limited' using errcode = 'P0001';
  end if;

  case p_target_type
    when 'post' then
      select p.profile_id,
             jsonb_build_object(
               'body', p.body,
               'topic', p.topic,
               'community_id', p.community_id,
               'author_display_name', p.author_display_name,
               'created_at', p.created_at,
               'media', coalesce((
                 select jsonb_agg(
                          jsonb_build_object('storage_path', m.storage_path, 'media_type', m.media_type)
                          order by m.created_at)
                 from public.post_media m
                 where m.post_id = p.id
               ), '[]'::jsonb)
             )
        into v_owner, v_snapshot
      from public.posts p
      where p.id = p_target_id;

    when 'comment' then
      select c.profile_id,
             jsonb_build_object(
               'body', c.body,
               'post_id', c.post_id,
               'author_display_name', c.author_display_name,
               'created_at', c.created_at
             )
        into v_owner, v_snapshot
      from public.post_comments c
      where c.id = p_target_id;

    when 'listing' then
      select l.profile_id,
             jsonb_build_object(
               'title', l.title,
               'description', l.description,
               'listing_type', l.listing_type,
               'category_id', l.category_id,
               'price', l.price,
               'price_unit', l.price_unit,
               'status', l.status,
               'county_id', l.county_id,
               'seller_display_name', l.seller_display_name,
               'created_at', l.created_at,
               'media', coalesce((
                 select jsonb_agg(
                          jsonb_build_object('storage_path', m.storage_path, 'media_type', m.media_type)
                          order by m.created_at)
                 from public.listing_media m
                 where m.listing_id = l.id
               ), '[]'::jsonb)
             )
        into v_owner, v_snapshot
      from public.listings l
      where l.id = p_target_id;

    when 'story' then
      -- Only while it's active: the same rule as the stories SELECT
      -- policy for everyone but the author.
      select s.profile_id,
             jsonb_build_object(
               'caption', s.caption,
               'topic', s.topic,
               'media_type', s.media_type,
               'media_path', s.media_path,
               'created_at', s.created_at,
               'expires_at', s.expires_at
             )
        into v_owner, v_snapshot
      from public.stories s
      where s.id = p_target_id
        and s.expires_at > now();

    when 'message' then
      -- Only a participant of the message's conversation can report it,
      -- and only that one message is copied.
      select m.sender_profile_id,
             jsonb_build_object(
               'body', m.body,
               'conversation_id', m.conversation_id,
               'created_at', m.created_at
             )
        into v_owner, v_snapshot
      from public.messages m
      join public.conversations c on c.id = m.conversation_id
      where m.id = p_target_id
        and v_uid in (c.participant_one_id, c.participant_two_id);

    when 'profile' then
      -- Never the phone number.
      select pr.id,
             jsonb_build_object(
               'display_name', pr.display_name,
               'bio', pr.bio,
               'avatar_path', pr.avatar_path,
               'profile_visibility', pr.profile_visibility,
               'created_at', pr.created_at
             )
        into v_owner, v_snapshot
      from public.profiles pr
      where pr.id = p_target_id;
  end case;

  if v_snapshot is null then
    raise exception 'report_target_not_found' using errcode = 'P0002';
  end if;

  if v_owner = v_uid then
    raise exception 'cannot_report_own_content' using errcode = '22023';
  end if;

  v_snapshot := v_snapshot || jsonb_build_object(
    'owner_display_name', (select pr.display_name from public.profiles pr where pr.id = v_owner)
  );

  begin
    insert into public.reports (
      reporter_profile_id, target_type, target_id, target_profile_id,
      reason, details, snapshot
    )
    values (
      v_uid, p_target_type, p_target_id, v_owner,
      p_reason, nullif(btrim(p_details), ''), v_snapshot
    )
    returning id into v_report_id;
  exception when unique_violation then
    raise exception 'report_already_open' using errcode = '23505';
  end;

  return v_report_id;
end;
$$;

create function public.resolve_report(
  p_report_id uuid,
  p_status text,
  p_note text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.can_moderate() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if p_status is null or p_status not in ('reviewing', 'actioned', 'dismissed') then
    raise exception 'invalid_report_status' using errcode = '22023';
  end if;

  update public.reports
  set status = p_status,
      reviewed_by = (select auth.uid()),
      reviewed_at = now(),
      resolution_note = nullif(btrim(p_note), '')
  where id = p_report_id;

  if not found then
    raise exception 'report_not_found' using errcode = 'P0002';
  end if;
end;
$$;

-- Same explicit revoke/grant sequence as every function in this project:
-- `revoke ... from public` alone doesn't remove Supabase's default direct
-- grant to anon on a new function.
revoke all on function public.report_content(text, uuid, text, text) from public;
revoke execute on function public.report_content(text, uuid, text, text) from anon;
grant execute on function public.report_content(text, uuid, text, text) to authenticated;

revoke all on function public.resolve_report(uuid, text, text) from public;
revoke execute on function public.resolve_report(uuid, text, text) from anon;
grant execute on function public.resolve_report(uuid, text, text) to authenticated;
