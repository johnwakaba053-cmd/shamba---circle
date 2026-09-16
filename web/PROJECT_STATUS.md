# Shamba Circle — Project Status

This document tracks the current state of the Next.js + Supabase rebuild of
Shamba Circle. It is a snapshot, not a spec — update it as work progresses
rather than letting it drift out of date.

## 1. Product

**Shamba Circle** — community app for East African farmers.

## 2. Current Architecture

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- Supabase (database + auth)
- Supabase Auth (phone OTP)
- Supabase Send SMS Hook
- Africa's Talking (SMS delivery)
- Vercel (hosting)

## 3. Supabase Production Project

- Name: Shamba Circle
- Region: Singapore (`ap-southeast-1`)
- Project ref: `bizysofbzdjxfbovowna`

## 4. Database

Tables created (migration `20260914180902_create_profiles_and_roles.sql`):

- `public.profiles`
- `public.user_roles`

Row Level Security (RLS) is **enabled** on both tables. **No policies exist
yet** — this means both tables currently deny all access by default until
policies are written.

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
- Production deployment: **successful**
- Live URL: https://shamba-circle.vercel.app
- Supabase environment variables (`NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`) are **not yet set on Vercel** — deferred
  because the current UI doesn't call Supabase at runtime yet

## 8. Current Application State

- The deployed app is the **Next.js scaffold only** (default
  `create-next-app` starter page) — no Shamba Circle-specific UI has been
  built yet
- Supabase client factories exist (`src/lib/supabase/client.ts`,
  `src/lib/supabase/server.ts`) but are **not yet used** by any page or
  component
- No production user interface has been built yet

## 9. Important Decisions

- **Next.js + Supabase** is the chosen architecture for the rebuild
- An **Expo/native app is deferred** — not part of the current phase
- The **existing vanilla JS prototype remains as a reference** (the
  localStorage-based version at the repo root, deployable separately as a
  PWA) — it is not being deleted or replaced in place
- The team is building **incrementally**, with explicit approval at each
  step, rather than attempting the whole product at once

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
  verified reachable

### NOT YET COMPLETED
- No RLS **policies** on `profiles`/`user_roles` (RLS is on, so both tables
  currently deny all access until policies are added)
- The post-fix OTP flow has not yet been re-tested end-to-end since the
  `toE164()` fix was deployed
- No Supabase environment variables configured on Vercel (deliberately
  deferred, since the current UI doesn't call Supabase)
- No Shamba Circle application UI exists yet — the deployed app is still
  the default Next.js scaffold
- The Supabase client factories are not called from any page or component

### NEXT PLANNED PHASE
- Re-run a controlled OTP test to confirm the `toE164()` fix resolves
  delivery through the Africa's Talking Simulator
- Write RLS policies for `public.profiles` and `public.user_roles`
- Build the first real UI to use Supabase Auth (phone OTP sign-in) via the
  existing client factories
- Add `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` to Vercel
  once the UI actually needs them
- Continue building incrementally, one approved step at a time
