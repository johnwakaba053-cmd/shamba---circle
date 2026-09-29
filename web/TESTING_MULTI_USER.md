# Multi-user testing — test accounts & test plan

How to sign in as 2–3 separate test farmers without real SMS delivery,
and what to check across them. Nothing here changes the normal OTP flow:
every real phone number still goes Supabase Auth → Send SMS Hook →
`send-sms` Edge Function → Africa's Talking **Sandbox**.

## 1. How test sign-in works

Supabase Auth has a built-in **Test Phone Numbers and OTPs** list. For a
number on that list, Auth skips SMS delivery completely (the Send SMS Hook
and Africa's Talking are never called) and accepts only the fixed code
mapped to that number. Every other number is unaffected.

- No code change, no migration, and no change to `send-sms` is needed.
- The app's existing sign-in screen is used as-is (`signInWithOtp` →
  `verifyOtp`).
- The first successful sign-in creates the `auth.users` row, and the
  existing `handle_new_user` trigger creates the `profiles` row, exactly
  like a real farmer. The user then goes through `/onboarding`.

## 2. Test numbers (safe to use)

The numbers come from the North American **555-0100 to 555-0199** range,
which is reserved for fictional use and is never assigned to a real
subscriber. So:

- no real person can ever own or receive SMS on these numbers, and
- `normalizeKenyanPhone()` (`src/lib/sms/phone.ts`) rejects them, so test
  accounts are **automatically excluded from SMS alert fan-out**.

| Account | Type this on the sign-in screen | Stored as (no `+`) | Test OTP |
| --- | --- | --- | --- |
| User A | `+1 202 555 0101` | `12025550101` | `101010` |
| User B | `+1 202 555 0102` | `12025550102` | `202020` |
| User C (optional) | `+1 202 555 0103` | `12025550103` | `303030` |

Type the leading `+1`. Without a `+`, the sign-in screen assumes a Kenyan
number and prefixes `+254`.

Do **not** use Kenyan-looking numbers (`+2547…`, `+2541…`) as test
numbers. They could belong to a real person, and whoever knows the fixed
code could sign in as that account.

## 3. One-time Supabase dashboard setup (manual)

The Supabase MCP/CLI tools used in this repo can't edit hosted Auth
settings, so this is a manual step:

1. Supabase Dashboard → project **Shamba Circle**
   (`bizysofbzdjxfbovowna`) → **Authentication** → **Sign In / Providers**
   → **Phone**.
2. Leave **Enable Phone provider** on. Leave the SMS provider / **Send
   SMS Hook** settings unchanged.
3. In **Test Phone Numbers and OTPs**, enter (comma-separated, no `+`,
   no spaces):

   ```
   12025550101=101010,12025550102=202020,12025550103=303030
   ```

   If the field's placeholder shows a different separator, follow the
   placeholder. Supabase's self-hosted docs show `number:otp`, and the
   hosted dashboard field uses `number=otp`.
4. Set **Test OTPs Valid Until** to a near date, e.g. `2026-12-31`. After
   that date the test numbers stop working automatically.
5. **Save**.
6. Make sure **Allow new users to sign up** (Authentication → Sign In /
   Providers, user signups) is still enabled, or the first sign-in for a
   test number will be rejected.

Remove the test numbers before a public launch. Anyone who knows a test
number and its code can sign in to that test account on the live site.

## 4. Using the accounts from an Android phone

The installed PWA and normal Chrome tabs **share the same session**.
Signing in as User B in a normal Chrome tab signs the PWA in as User B
too. To run two users at once:

| Option | User A | User B |
| --- | --- | --- |
| One phone (recommended) | Installed Shamba Space PWA | Chrome **Incognito** tab on the same site URL |
| Phone + laptop | Phone PWA | Laptop browser (or its Incognito window) |
| Two phones | Phone 1 PWA | Phone 2 PWA or Chrome |

Incognito keeps its own cookies, so both sessions stay signed in side by
side. Closing all Incognito tabs signs User B out.

To switch the PWA itself between users: Profile → **Sign out**, then sign
in with the other test number.

### First sign-in for each test user

1. Open the sign-in screen → enter the test number (with `+1`) → **Send
   verification code**. No SMS arrives, and that's expected.
2. Enter that number's test OTP → **Verify**.
3. Complete onboarding with a clearly fake name, e.g. **Test Farmer A** /
   **Test Farmer B** / **Test Farmer C**, and any role.
4. Go to Profile → settings → **Profile visibility → Public**. This
   matters: new profiles default to **private**. A private profile can't
   be followed or messaged from its profile page, and it can't be
   @mentioned (mention search only returns public profiles).
5. Join the **same community** with every test user. Posting, liking,
   commenting and comment reactions inside a community require
   membership.

### Seeing new activity

Messages and notifications are **not realtime**. They load when a page
loads. An installed Android PWA has no pull-to-refresh, so to see
something the other user just did, navigate away and back (e.g. tap
Messages / the Inbox icon again). The Inbox badge count updates on every
page navigation.

## 5. Test plan

Set up User A and User B as in §4 (both public, both in the same
community). "A" = acting as User A, "B" = acting as User B.

### 5.1 Sign in & profile

| # | Steps | Expected |
| --- | --- | --- |
| 1 | A: sign in with the test number + OTP | No SMS sent. Lands on onboarding (first time) or Communities |
| 2 | A: wrong OTP (e.g. `000000`) | "That code didn't work…" error, no sign-in |
| 3 | A: complete onboarding | Profile shows name + role badge |
| 4 | A: set bio, avatar, visibility Public | Saved and shown on own profile |
| 5 | B: open A's profile (via A's post author link) | Name, bio, avatar, follower counts, Follow + Message buttons |
| 6 | A: switch to Private. B: reload A's profile | B sees the locked/private state, with no Follow or Message button. Switch A back to Public afterwards |
| 7 | Your real account: sign in with your own Kenyan number | Still goes through the normal Africa's Talking Sandbox flow (see §6) |

### 5.2 Follow / unfollow

| # | Steps | Expected |
| --- | --- | --- |
| 1 | B: Follow A (profile page or Reel follow button) | Button becomes Following; A's follower count +1 |
| 2 | A: open Notifications | "Test Farmer B started following you", unread; tapping it opens B's profile |
| 3 | B: Unfollow A | Count −1, no new notification |
| 4 | B: Follow A again | A gets a **second** follow notification (expected: one notification per follow insert) |

### 5.3 Direct messages

| # | Steps | Expected |
| --- | --- | --- |
| 1 | A: B's profile → **Message** | Opens an empty thread "No messages yet…" |
| 2 | A: send "Hello from A" | Appears right-aligned, green |
| 3 | B: open Messages | Conversation with A, unread count 1 |
| 4 | B: open the thread | A's message left-aligned; unread count clears when going back to Messages |
| 5 | B: reply. A: navigate back to the thread | Reply visible after reload/navigation (not realtime) |
| 6 | B: Message A from A's profile | Opens the **same** conversation, never a duplicate |
| 7 | A: delete own message | Removed. There's no delete icon on B's messages |
| 8 | User C (optional): type A–B's conversation URL | 404, since C isn't a participant |

### 5.4 Message notifications

| # | Steps | Expected |
| --- | --- | --- |
| 1 | A sends B a message | B's Inbox badge +1 on next navigation; "Test Farmer A sent you a message" |
| 2 | B: tap the notification | Opens `/messages/<id>` and the notification becomes read |
| 3 | Check notification text | Never contains the message body (by design) |
| 4 | B reads the thread from Messages instead | The message notification stays **unread** until tapped or "Mark all as read". This is known V1 behaviour: conversation read state and notification read state are separate |

### 5.5 Likes (post reactions)

| # | Steps | Expected |
| --- | --- | --- |
| 1 | A: post a Feed Reel or community post | Visible to B |
| 2 | B: like it | A gets "Test Farmer B reacted to your post" (no link: posts have no single-post route yet, so tapping only marks it read) |
| 3 | B: unlike, then like again | Second notification on re-like, none on unlike |
| 4 | A: like own post | No notification |

### 5.6 Comments

| # | Steps | Expected |
| --- | --- | --- |
| 1 | B: comment on A's post | A: "Test Farmer B commented on your post" |
| 2 | A: comment on own post | No notification |
| 3 | B: edit/delete own comment | Works; A can't edit/delete B's comment |

### 5.7 Comment reactions (community posts only)

| # | Steps | Expected |
| --- | --- | --- |
| 1 | A: comment on a community post | — |
| 2 | B (a member of that community): react to A's comment | A: "Test Farmer B reacted to your comment" |
| 3 | A: react to own comment | No notification |
| 4 | C, **not** a member: try to react | Not allowed |

### 5.8 Mentions

| # | Steps | Expected |
| --- | --- | --- |
| 1 | A: Feed composer, type `@Test` | B (public) appears in suggestions |
| 2 | A: publish with @Test Farmer B | B: "Test Farmer A mentioned you in a post" |
| 3 | B set to Private, A types `@Test` | B no longer suggested |
| 4 | A mentions themselves | No notification |

### 5.9 Community activity

| # | Steps | Expected |
| --- | --- | --- |
| 1 | A and B join the same community | Member count reflects both |
| 2 | A posts in it | B sees it after reload |
| 3 | C, not a member, opens the community | Can read, but can't post, like, comment or react until they join |
| 4 | B leaves the community | B can no longer post, like or comment there |

### 5.10 Notification read / unread state

| # | Steps | Expected |
| --- | --- | --- |
| 1 | Generate 3+ notifications for A | Badge shows the count; "N unread" on the Notifications page; unread cards have a green border + dot |
| 2 | A: tap one | That one becomes read (check mark); count −1 |
| 3 | A: **Mark all as read** | All read, badge gone |
| 4 | Reload / navigate away and back | Read state persists (server-side) |
| 5 | B's badge | Unaffected by anything A marks read |

## 6. Africa's Talking Sandbox limitations

- The Sandbox **does not deliver SMS to real phones**. Messages appear only
  in the Africa's Talking **Simulator** (simulator.africastalking.com) for
  numbers registered there. Real-number sign-in during development means
  reading the OTP from the Simulator.
- Sandbox has its own API key and username (`sandbox`), which are
  separate from production. Switching to paid production SMS is a separate,
  deliberate change and has not been done.
- Supabase Auth rate limits still apply to real numbers (SMS sends per hour,
  OTP verifications per 5 minutes per IP). Test numbers don't send SMS,
  but verification attempts still count toward the per-IP limit.
- Sender ID / short code, delivery reports and Kenyan carrier behaviour
  (Safaricom/Airtel/Telkom) can't be verified in Sandbox, only in
  production.

## 7. Useful read-only checks (SQL editor)

```sql
-- Test accounts and their profiles
select u.id, u.phone, u.last_sign_in_at, p.display_name, p.profile_visibility
from auth.users u join public.profiles p on p.id = u.id
where u.phone like '1202555010%';

-- Latest notifications for the test accounts
select n.created_at, rp.display_name as recipient, n.type, n.title, n.read_at
from public.notifications n
join public.profiles rp on rp.id = n.recipient_profile_id
join auth.users u on u.id = n.recipient_profile_id
where u.phone like '1202555010%'
order by n.created_at desc
limit 50;
```

## 8. Cleaning up later (don't run until testing is finished)

Remove the test numbers from the dashboard field (§3). Test users can be
deleted from Authentication → Users, which cascades to their profile,
roles, posts, comments, likes, follows, conversations, messages and
notifications (all foreign keys are `on delete cascade`, except
`notifications.actor_profile_id`, which becomes `null`). Uploaded files
(avatars, post/story/listing media) live in Storage and are **not**
removed by that cascade, so delete them from the Storage buckets
separately.
