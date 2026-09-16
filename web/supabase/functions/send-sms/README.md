# send-sms Edge Function

Implements the Supabase Auth [Send SMS Hook](https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook)
contract. Part of Shamba Circle Step 6 (phone OTP authentication).

## Current status

| | |
| --- | --- |
| Exists locally (this directory) | ✅ Yes |
| Webhook signature verification | ✅ Implemented (`index.ts`) |
| Payload validation | ✅ Implemented (`validation.ts`) |
| Africa's Talking Sandbox provider | ✅ Implemented and unit-tested locally (`provider.ts`, `provider.test.ts`) |
| Provider wired into `index.ts` | ✅ `index.ts` now uses `createAfricasTalkingProvider(readAfricasTalkingCredentials())` |
| Africa's Talking credentials (`AT_USERNAME`, `AT_API_KEY`) | ✅ Configured as Edge Function secrets on `bizysofbzdjxfbovowna` (values not visible to or handled by this repo/session) |
| Function deployed | ❌ Not deployed, to `bizysofbzdjxfbovowna` (Shamba Circle, Singapore) or anywhere else |
| Supabase Auth Send SMS Hook | ❌ Not configured, in `config.toml` or the dashboard |
| SMS sent | ❌ None — the Africa's Talking provider is not on any live path, and every `provider.test.ts` case mocks `fetchImpl` instead of calling the real API |

Each unchecked item above is a deliberate, separate step requiring its own
approval before proceeding — see [Next steps](#next-steps-not-done-here).

## Request flow

1. Reject non-`POST` requests (`405`).
2. Reject requests missing the `webhook-id` / `webhook-timestamp` /
   `webhook-signature` headers (`401`).
3. Reject requests if `SEND_SMS_HOOK_SECRETS` isn't configured, or if the
   Standard Webhooks signature doesn't verify (`401`/`500` — see below).
4. Reject requests whose verified payload doesn't match the documented
   `{ user: { phone }, sms: { otp } }` shape (`400`).
5. Otherwise, call the Africa's Talking provider to deliver the OTP, and
   return `200` with an empty JSON body, per the hook's contract (no output
   is required on success).
6. Any unexpected error is caught and returns `500` without leaking
   internals.

| Outcome                              | Status |
| ------------------------------------- | ------ |
| Wrong HTTP method                     | 405    |
| Missing signature headers             | 401    |
| Invalid signature                     | 401    |
| `SEND_SMS_HOOK_SECRETS` not configured | 500    |
| Invalid/missing `user.phone` or `sms.otp` | 400 |
| Verified, valid payload               | 200    |
| Provider or unexpected error          | 500    |

## Files

- `index.ts` — the HTTP handler (Deno.serve). Now uses
  `createAfricasTalkingProvider(readAfricasTalkingCredentials())`.
- `validation.ts` — pure, Deno-free helpers for payload/header validation.
- `provider.ts` — the `SmsProvider` interface, the no-op placeholder
  implementation (`notImplementedProvider`, kept for reference/tests), and
  `createAfricasTalkingProvider()` (the real Sandbox implementation, now
  wired into `index.ts`).
- `validation.test.ts` — Deno test suite for `validation.ts`.
- `provider.test.ts` — Deno test suite for `provider.ts`, including the
  Africa's Talking response-parsing and provider logic. Uses an injectable
  `fetchImpl` to mock every HTTP call; no test reaches the real API.

## Running tests

This repo's Node/Next.js toolchain (`npm run lint`, etc.) does not execute
Deno tests. With the Supabase/Deno CLI installed, run:

```sh
deno test supabase/functions/send-sms/
```

`supabase/functions/**` is excluded from this project's `tsconfig.json` and
`eslint.config.mjs`, since it's a separate Deno runtime with its own globals
(`Deno.serve`, `Deno.env`, remote ESM imports) that the Next.js/Node
toolchain isn't configured to understand.

## Next steps (not done here)

Remaining, each requiring separate approval:

1. Generate/store `SEND_SMS_HOOK_SECRETS` as a function secret (not created
   yet — `AT_USERNAME`/`AT_API_KEY` are already configured).
2. Deploy this function to the `bizysofbzdjxfbovowna` project.
3. Configure the Send SMS Hook in Supabase Auth.
