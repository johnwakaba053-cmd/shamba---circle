// SMS delivery provider interface.
//
// This is intentionally a small seam: Step 6 Part 2 will add a real
// Africa's Talking-backed implementation of `SmsProvider` and swap it in
// for `notImplementedProvider` below. Nothing in this file calls out to
// Africa's Talking (or any network) yet.

export interface SendSmsInput {
  phone: string;
  otp: string;
}

export interface SmsProvider {
  send(input: SendSmsInput): Promise<void>;
}

function maskPhone(phone: string): string {
  if (phone.length <= 4) return "*".repeat(phone.length);
  return `${"*".repeat(phone.length - 4)}${phone.slice(-4)}`;
}

// Placeholder provider: performs no network call, never logs the OTP, and
// only logs a masked phone number so the request path is observable while
// real delivery is still unimplemented.
export const notImplementedProvider: SmsProvider = {
  async send(input: SendSmsInput): Promise<void> {
    console.log(
      `[send-sms] Delivery not implemented yet (Africa's Talking integration is Step 6, Part 2). ` +
        `Would send OTP to ${maskPhone(input.phone)}.`,
    );
  },
};

export interface AfricasTalkingCredentials {
  username: string | undefined;
  apiKey: string | undefined;
}

// Reads the future Africa's Talking credentials from environment variables.
// Not called from the request path yet, and does not create, populate, or
// log the values — provided so Part 2 has a single place to read from.
export function readAfricasTalkingCredentials(): AfricasTalkingCredentials {
  return {
    username: Deno.env.get("AT_USERNAME"),
    apiKey: Deno.env.get("AT_API_KEY"),
  };
}

// --- Africa's Talking (Sandbox) implementation -----------------------------
//
// Kept in its own section, behind the same SmsProvider interface, so a
// different provider can be substituted later without touching index.ts.
// This module makes no assumptions about how credentials were obtained
// (env vars, secret manager, etc.) — it just takes them as input.

const AT_SANDBOX_MESSAGING_URL = "https://api.sandbox.africastalking.com/version1/messaging";

// Africa's Talking recipient statusCode values that mean "accepted for
// delivery" (not yet a guarantee of final handset delivery): 100 Processed,
// 101 Sent, 102 Queued. Anything else (RiskHold, InvalidPhoneNumber,
// InsufficientBalance, gateway errors, etc.) is treated as a failure.
const ACCEPTED_STATUS_CODES = new Set([100, 101, 102]);

export function buildOtpMessage(otp: string): string {
  return `Your Shamba Circle verification code is ${otp}`;
}

// Africa's Talking requires E.164 numbers with a leading '+'. Supabase Auth
// does not always include one (observed as plain digits in this project's
// logs), so guarantee it here without altering an already-correct number.
export function toE164(phone: string): string {
  return phone.startsWith("+") ? phone : `+${phone}`;
}

interface AfricasTalkingRecipient {
  statusCode?: unknown;
  status?: unknown;
}

interface AfricasTalkingResponseBody {
  SMSMessageData?: {
    Recipients?: AfricasTalkingRecipient[];
  };
}

export type AfricasTalkingParseResult = { ok: true } | { ok: false; reason: string };

// Pure: interprets an already-parsed Africa's Talking response body.
// No network I/O — safe and cheap to unit test directly.
export function parseAfricasTalkingResponse(body: unknown): AfricasTalkingParseResult {
  if (typeof body !== "object" || body === null) {
    return { ok: false, reason: "Malformed response body." };
  }

  const recipients = (body as AfricasTalkingResponseBody).SMSMessageData?.Recipients;
  if (!Array.isArray(recipients) || recipients.length === 0) {
    return { ok: false, reason: "Response contained no recipients." };
  }

  const recipient = recipients[0];
  const statusCode = recipient?.statusCode;
  if (typeof statusCode !== "number" || !ACCEPTED_STATUS_CODES.has(statusCode)) {
    const status = typeof recipient?.status === "string" ? recipient.status : "unknown";
    return {
      ok: false,
      reason: `Recipient status not accepted (status: ${status}, statusCode: ${String(statusCode)}).`,
    };
  }

  return { ok: true };
}

export interface AfricasTalkingProviderOptions {
  // Injectable for tests; defaults to the global fetch. Never used to reach
  // the real API in the test suite.
  fetchImpl?: typeof fetch;
}

export function createAfricasTalkingProvider(
  creds: AfricasTalkingCredentials,
  options: AfricasTalkingProviderOptions = {},
): SmsProvider {
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    async send(input: SendSmsInput): Promise<void> {
      if (!creds.username || !creds.apiKey) {
        throw new Error("Africa's Talking credentials are not configured.");
      }

      const body = new URLSearchParams({
        username: creds.username,
        to: toE164(input.phone),
        message: buildOtpMessage(input.otp),
      });

      let res: Response;
      try {
        res = await fetchImpl(AT_SANDBOX_MESSAGING_URL, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
            apiKey: creds.apiKey,
          },
          body,
        });
      } catch {
        // Deliberately generic: fetch's own error may embed request details.
        throw new Error("Africa's Talking request failed (network error).");
      }

      if (!res.ok) {
        throw new Error(`Africa's Talking request failed (HTTP ${res.status}).`);
      }

      let json: unknown;
      try {
        json = await res.json();
      } catch {
        throw new Error("Africa's Talking returned a non-JSON response.");
      }

      const result = parseAfricasTalkingResponse(json);
      if (!result.ok) {
        throw new Error(`Africa's Talking rejected the message: ${result.reason}`);
      }

      // Success — no return value. Never log the OTP, apiKey, full phone
      // number, or request/response body here.
    },
  };
}
