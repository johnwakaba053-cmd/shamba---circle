# Shamba Circle — Project Status

This document tracks the current state of the Next.js + Supabase rebuild of
Shamba Circle. It is a snapshot, not a spec — update it as work progresses
rather than letting it drift out of date.

## 1. Product

**Shamba Circle** — community app for East African farmers. The app is
branded **Shamba Space** in the UI, page titles and PWA manifest ("Everything
farming. In one space."); the repository, Supabase project and Vercel project
still use the Shamba Circle name.

## 2. Current Architecture

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- Supabase (database + auth + Storage for post, story, listing, education
  and avatar media)
- Supabase Auth (phone OTP)
- Supabase Send SMS Hook
- Africa's Talking (SMS delivery)
- WeatherAPI.com (weather screen and weather alert ingestion)
- KAMIS (agricultural market price ingestion)
- Vercel (hosting, plus daily Cron jobs in `vercel.json`)
- PWA: web app manifest (`src/app/manifest.ts`) and a minimal service worker
  (`public/sw.js`)

## 3. Supabase Production Project

- Name: Shamba Circle
- Region: Singapore (`ap-southeast-1`)
- Project ref: `bizysofbzdjxfbovowna`

## 4. Database

The schema is defined by the migrations in `supabase/migrations/` (82 as of
2026-09-29, starting with `20260914180902_create_profiles_and_roles.sql`).
Production has 81 applied (verified 2026-09-29): every migration except
`20260929120000_unpublish_test_seed_alerts.sql`, which is deliberately not
applied — production never had the `[TEST]` seed alerts it unpublishes.
Production records its own apply timestamps, so its versions don't match
the file names.

- **Profiles & roles:** `public.profiles` and `public.user_roles`, with RLS
  policies — farmers can view/update their own profile and view/add/remove
  their own roles. Public profile data is exposed through
  `get_public_profile`; avatars and bios, profile post privacy and follows
  were added later
- **Social:** communities and memberships; posts (community and feed-level),
  likes, comments, comment reactions, post media, hashtags, mentions,
  topics, stories and story views, batched engagement counts
- **Marketplace:** listings with media, categories, status, county and hire
  fields
- **Farmer preferences & alerts:** farmer preferences (county, crops,
  livestock, notification settings), alerts, alert reads, alert deliveries
  and SMS matching functions (`get_my_alerts`, `alert_matches_farmer`, …)
- **Market prices:** agricultural products, markets, prices and KAMIS
  ingestion mappings
- **Education:** education resources, topics, learning categories and
  sources
- **Notifications & messaging:** in-app notifications with social-activity
  and private-message triggers; private conversations and messages with
  RPCs

RLS is enabled on all 49 `public` tables the migrations create, with access
going through RLS policies or security-definer RPCs. Storage buckets are created by migrations for post,
story, listing, education and avatar media.

## 5. Authentication Status

- Phone provider: **enabled**
- Phone confirmations: **enabled**
- Send SMS Hook: **enabled**
- Hook target: deployed Edge Function `send-sms`
- Edge Function `verify_jwt`: **false** (required — the hook fires before a
  user session/JWT exists; authenticity is enforced via Standard Webhooks
  signature verification instead)

## 6. Africa's Talking Integration

- Environment: **Sandbox**
- Credentials (`AT_USERNAME`, `AT_API_KEY`) stored **only** as Supabase Edge
  Function secrets — never in source, never in `.env` files committed to
  the repo
- Phone numbers are normalized to E.164 (leading `+`) via `toE164()` in
  `supabase/functions/send-sms/provider.ts` before being sent to Africa's
  Talking, since Supabase Auth does not always supply a leading `+`
- Provider unit tests: **11/11 passed** (`provider.test.ts`, all HTTP calls
  mocked — no test reaches the real Africa's Talking API)

## 7. Deployment

- Vercel project: `shamba-circle`
- Live URL: https://shamba-circle.vercel.app
- **Current production deployment** (verified 2026-09-29):
  `dpl_8phMxYAqbzJr5AyReVFZSThsiopF`, deployed 2026-09-24 via the Vercel
  CLI, matching commit `95717fd` ("Add private message notification UI").
  It does **not** include the Weather screen, PWA, Feed/Reels refinements
  or `/reels/[reelId]` (`/weather`, `/reels`, `/sw.js` and
  `/manifest.webmanifest` all return 404 in production)
- Deploys are manual: the Vercel project is not connected to GitHub, so a
  push to `origin/main` does not trigger a deployment
- Production environment variables (verified 2026-09-29 with
  `vercel env ls production`, values not read): `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
  `INGEST_SECRET`, `CRON_SECRET` and `WEATHER_API_KEY` are all set, and all
  are marked Sensitive (so `vercel env pull` returns placeholders only)
- Vercel Cron (`vercel.json`): weather alert ingestion daily at 02:00 UTC
  and KAMIS price ingestion daily at 03:00 UTC. Both are registered on the
  production deployment. KAMIS runs daily (~03:53 UTC). A manual run of the
  weather cron on 2026-09-29 returned HTTP 200: 47/47 counties processed,
  0 failed, 0 provider alerts, 0 qualified, 0 errors
- Production runtime logs are only retained for about an hour

## 8. Current Application State

The Shamba Space UI is built on top of the Supabase client factories
(`src/lib/supabase/client.ts`, `server.ts`), with a request proxy
(`src/proxy.ts`) that keeps the auth session fresh. Main features:

- **Landing, sign-in and onboarding:** landing page (`/`), phone OTP
  sign-in (`/sign-in`) and farmer onboarding (`/onboarding`)
- **Feed / Farming Reels (`/feed`):** a vertical reel feed with Farming
  Stories (create, view, view tracking, delete) in the same scroll; likes,
  comments and comment reactions; hashtags, @mentions and optional farming
  topics; media-only posts; shareable reel pages (`/reels/[reelId]`)
- **Communities (`/communities`, `/communities/[id]`):** community directory,
  membership and community conversations
- **Marketplace (`/marketplace`):** listings with photos, categories, status,
  county and hire options; listing detail, create and edit pages; discovery
  filters
- **Messaging (`/messages`, `/messages/[conversationId]`):** private
  farmer-to-farmer conversations
- **Notifications (`/notifications`):** in-app notifications for social
  activity and private messages, with a header notification bell
- **PWA:** installable via the web app manifest and icons; the service worker
  only shows an offline page (`public/offline.html`) and caches nothing
  else. It registers only in a secure context (HTTPS or localhost)
- **Weather (`/weather`):** Weather Steps 1–4 — current weather, hourly
  forecast, multi-day forecast, Farm Alerts and Farm Outlook (see section 10)
- **Also built:** profiles (`/profile`, `/profile/[id]`) with avatars, bios,
  posts, privacy and following; Education (`/education`); Market Prices
  (`/market-prices`); personalized alerts (`/alerts`); internal routes for
  weather alert and KAMIS ingestion and an SMS dry-run (no SMS is sent)

As of 2026-09-29, `origin/main` is at `def0483` ("Fix weather alert upsert
conflict target and log ingest summary"), one commit ahead of the deployed
`95717fd`. The PWA files, Weather screen, Feed/Reels refinements, landing/
onboarding updates, session-refresh proxy and the three latest applied
migrations (`20260929090000`–`20260929110000`) are still uncommitted local
changes; they form one release and must be committed and deployed together
(many modified files import new, untracked ones).

## 9. Important Decisions

- **Next.js + Supabase** is the chosen architecture for the rebuild
- An **Expo/native app is deferred** — not part of the current phase
- The **existing vanilla JS prototype remains as a reference** (the
  localStorage-based version at the repo root, deployable separately as a
  PWA) — it is not being deleted or replaced in place
- The team is building **incrementally**, with explicit approval at each
  step, rather than attempting the whole product at once

## 10. Weather Screen (`/weather`)

Weather Steps 1–4 are **complete and tested** (2026-09-29). The screen is
signed-in only and shows weather for the county the farmer set in Profile
(county-level query points from `src/lib/weather/countyLocations.ts` — never
the farmer's own GPS/IP location). Farmers with no county see a prompt to
choose one.

- **Step 1 — Current weather:** temperature, condition, chance of rain,
  humidity and wind, with a "Change county" link and WeatherAPI.com
  attribution (`src/app/weather/page.tsx`, `src/lib/weather/currentWeather.ts`)
- **Step 2 — Hourly forecast:** a scrolling strip for the next 24 hours
  (time, icon, temperature, chance of rain)
- **Step 2 — Multi-day forecast:** daily high/low, condition and chance of
  rain; shows however many days the WeatherAPI plan returns (3 on the free
  plan, up to 7) (`src/app/weather/ForecastSections.tsx`,
  `src/lib/weather/forecast.ts`)
- **Step 3 — Farm Alerts:** the farmer's matched alerts, reusing the
  existing `get_my_alerts()` RPC and `AlertCard` from `/alerts` — no second
  alert system (`src/app/weather/FarmAlertsSection.tsx`)
- **Step 4 — Farm Outlook:** simple rule-based farming tips (rain,
  thunderstorms, dry spells, heat, cold nights, wind, disease pressure,
  spraying and irrigation) built from the current weather and forecast
  already loaded — no extra API calls. Clearly framed as general guidance,
  not guaranteed agronomic advice (`src/lib/weather/farmOutlook.ts`,
  `src/app/weather/FarmOutlookSection.tsx`)

Behaviour notes:

- WeatherAPI responses are cached for 10 minutes per county; network
  failures are retried once
- The forecast, Farm Alerts and Farm Outlook stream in separately, each with
  its own loading placeholder, so a slow or failed section never blocks the
  others. Each has its own error/empty state; Farm Alerts still show if
  WeatherAPI is down
- Mobile-first layout throughout
- Requires the server-only `WEATHER_API_KEY` environment variable (no
  `NEXT_PUBLIC_` prefix; the key is never logged or sent to the browser)
- Known limit: Farm Outlook wind tips use the current wind only (the
  forecast data does not include hourly wind)

Weather alert ingestion (verified 2026-09-29):

- Every ingestion upsert used to fail with Postgres error 42P10, because
  `alerts.external_ref` only had a *partial* unique index, which
  `ON CONFLICT (external_ref)` can't target. Fixed by
  `20260929130000_make_alerts_external_ref_unique_constraint.sql` (a plain
  `UNIQUE` constraint; NULL refs still allowed) — **applied to production**
- Commit `def0483` (that migration, plus a summary-counts-only log line in
  `/api/internal/ingest-weather-alerts`) is pushed to `origin/main` but
  **not yet deployed**, so production doesn't log run summaries yet
- Production `public.alerts` and `public.alert_counties` currently have
  **0 rows**. That is expected: WeatherAPI returned no alerts for any of the
  47 counties, and it rarely publishes alerts for Kenya

---

## Status Summary

### COMPLETED
- Supabase production project created (Singapore, `bizysofbzdjxfbovowna`)
- `public.profiles` and `public.user_roles` tables created, RLS enabled
- Phone auth provider enabled; phone confirmations enabled
- `send-sms` Edge Function implemented: Standard Webhooks signature
  verification, Send SMS Hook payload validation, Africa's Talking Sandbox
  provider, phone normalization (`toE164`)
- `send-sms` deployed with `verify_jwt=false`
- `AT_USERNAME`, `AT_API_KEY`, `SEND_SMS_HOOK_SECRETS` configured as Edge
  Function secrets
- Send SMS Hook enabled in Supabase Auth, pointing at the deployed function
- Africa's Talking Sandbox connected; Simulator registered for testing
- A controlled OTP test surfaced and diagnosed a `403 InvalidPhoneNumber`
  failure at Africa's Talking; root-caused to a missing `+` prefix; fixed
  via `toE164()` and redeployed
- Next.js dev server verified reachable from a phone on the local network
- Vercel production readiness check passed (build, lint, typecheck all
  clean)
- Production deployment to Vercel (`shamba-circle`) successful, live URL
  verified reachable (currently commit `95717fd`, 2026-09-24 — see
  section 7)
- Weather Steps 1–4 complete and tested on `/weather` (see section 10):
  current weather, hourly forecast, multi-day forecast, Farm Alerts and
  Farm Outlook; type-check and lint clean
- PWA (manifest, icons, offline page, service worker) complete and tested
  locally
- Feed/Farming Reels refinements and shareable `/reels/[reelId]` pages
  complete and tested locally
- Weather alert ingestion upsert bug (42P10) fixed; the migration is applied
  to production (commit `def0483`, pushed)
- Production environment variables confirmed set on Vercel, including
  `WEATHER_API_KEY`; weather and KAMIS crons registered, and a manual
  weather cron run returned HTTP 200 with no errors
- RLS policies for `profiles` (own select/update) and `user_roles` (own
  select/insert/delete)
- Shamba Space application UI built on Supabase (see section 8): phone OTP
  sign-in and onboarding, Feed/Farming Reels with Stories, Communities,
  Marketplace, Messaging, Notifications, Profiles, Education, Market Prices,
  Alerts, PWA install/offline support and the Weather screen

### NOT YET COMPLETED
- The post-fix OTP flow has not yet been re-tested end-to-end since the
  `toE164()` fix was deployed
- The local release (Weather screen, PWA, Feed/Reels refinements,
  landing/onboarding, session refresh, notifications updates and the three
  applied 2026-09-29 migrations) is prepared and inventoried but **not yet
  committed or deployed**; production still runs `95717fd`
- `def0483` (weather ingest fix + run-summary logging) is pushed but not
  deployed
- No weather alert has yet been stored end to end in production (none
  qualified so far)

### NEXT PLANNED PHASE
- Commit the local release (excluding `gcm-diagnose.log` and `.mcp.json`),
  run `next build`, then deploy that exact commit to production from a
  clean checkout
- After deploying, confirm `/weather`, `/reels/[reelId]` and the PWA files
  respond in production, and that the next weather cron run logs a
  `[weather-ingest] run summary` line
- Re-run a controlled OTP test to confirm the `toE164()` fix resolves
  delivery through the Africa's Talking Simulator
- Continue building incrementally, one approved step at a time
