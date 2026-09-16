// Supabase Auth "Send SMS Hook" endpoint.
//
// This function verifies the webhook signature, validates the payload
// shape, and delivers the OTP via Africa's Talking (Sandbox). Supabase Auth
// remains the source of truth for OTP generation and verification — this
// function only relays the code it's given; see provider.ts and README.md.
// It is not deployed and the Supabase Auth hook is not configured yet.
//
// Payload contract: https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";
import { hasRequiredWebhookHeaders, validateSendSmsPayload } from "./validation.ts";
import {
  createAfricasTalkingProvider,
  readAfricasTalkingCredentials,
  type SmsProvider,
} from "./provider.ts";

// AT_USERNAME / AT_API_KEY are read from Deno.env at call time inside
// readAfricasTalkingCredentials() — never hard-coded, never logged.
const provider: SmsProvider = createAfricasTalkingProvider(readAfricasTalkingCredentials());

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function getWebhookSecret(): string | undefined {
  // SEND_SMS_HOOK_SECRETS is read here for when it exists, but it is not
  // created or populated by this change — see README.md.
  const raw = Deno.env.get("SEND_SMS_HOOK_SECRETS");
  if (!raw) return undefined;

  // The env var is plural/pipe-separated to support secret rotation; the
  // Standard Webhooks client only needs one secret to verify against.
  const first = raw.split("|")[0]?.trim();
  if (!first) return undefined;

  return first.replace(/^v1,whsec_/, "");
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== "POST") {
      return jsonResponse(405, { error: { message: "Method not allowed." } });
    }

    const headers = Object.fromEntries(req.headers);

    if (!hasRequiredWebhookHeaders(headers)) {
      return jsonResponse(401, {
        error: { message: "Missing required webhook signature headers." },
      });
    }

    const secret = getWebhookSecret();
    if (!secret) {
      // Expected until SEND_SMS_HOOK_SECRETS is configured (Step 6, Part 2+).
      console.error("[send-sms] SEND_SMS_HOOK_SECRETS is not configured.");
      return jsonResponse(500, { error: { message: "Server misconfiguration." } });
    }

    const rawBody = await req.text();

    let verifiedPayload: unknown;
    try {
      const wh = new Webhook(secret);
      verifiedPayload = wh.verify(rawBody, headers);
    } catch {
      // Never echo signature/secret details back to the caller.
      return jsonResponse(401, { error: { message: "Invalid webhook signature." } });
    }

    const result = validateSendSmsPayload(verifiedPayload);
    if (!result.ok) {
      return jsonResponse(400, { error: { message: result.reason } });
    }

    const { user, sms } = result.payload;

    try {
      await provider.send({ phone: user.phone, otp: sms.otp });
    } catch (err) {
      console.error(
        "[send-sms] Provider error:",
        err instanceof Error ? err.message : "unknown error",
      );
      return jsonResponse(500, { error: { message: "Failed to process SMS delivery." } });
    }

    // Supabase Auth requires no response body on success — an empty 200 is fine.
    return jsonResponse(200, {});
  } catch (err) {
    console.error(
      "[send-sms] Unexpected error:",
      err instanceof Error ? err.message : "unknown error",
    );
    return jsonResponse(500, { error: { message: "Internal server error." } });
  }
});
