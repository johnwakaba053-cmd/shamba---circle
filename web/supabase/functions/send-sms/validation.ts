// Pure, Deno-free validation helpers for the Send SMS Hook payload.
// Kept free of Deno/network APIs so they stay easy to unit test.

const OTP_PATTERN = /^[0-9]{6}$/;

export interface SendSmsPayload {
  user: { id: string; phone: string };
  sms: { otp: string };
}

export type PayloadValidationResult =
  | { ok: true; payload: SendSmsPayload }
  | { ok: false; reason: string };

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

export function isValidPhone(value: unknown): value is string {
  // The hook always sends E.164-formatted numbers (e.g. +2547...); we only
  // guard against missing/empty/non-string values here, not full E.164 shape,
  // since Supabase Auth is the source of truth for phone formatting.
  return isNonEmptyString(value);
}

export function isValidOtp(value: unknown): value is string {
  return typeof value === "string" && OTP_PATTERN.test(value);
}

export function validateSendSmsPayload(input: unknown): PayloadValidationResult {
  if (typeof input !== "object" || input === null) {
    return { ok: false, reason: "Payload must be a JSON object." };
  }

  const body = input as Record<string, unknown>;
  const user = body.user;
  const sms = body.sms;

  if (typeof user !== "object" || user === null) {
    return { ok: false, reason: "Missing or invalid 'user' object." };
  }
  const userRecord = user as Record<string, unknown>;
  if (!isValidPhone(userRecord.phone)) {
    return { ok: false, reason: "Missing or invalid 'user.phone'." };
  }

  if (typeof sms !== "object" || sms === null) {
    return { ok: false, reason: "Missing or invalid 'sms' object." };
  }
  const smsRecord = sms as Record<string, unknown>;
  if (!isValidOtp(smsRecord.otp)) {
    return { ok: false, reason: "Missing or invalid 'sms.otp' (must be exactly 6 digits)." };
  }

  return {
    ok: true,
    payload: {
      user: {
        id: isNonEmptyString(userRecord.id) ? userRecord.id : "",
        phone: userRecord.phone,
      },
      sms: { otp: smsRecord.otp },
    },
  };
}

const REQUIRED_WEBHOOK_HEADERS = ["webhook-id", "webhook-timestamp", "webhook-signature"] as const;

export function hasRequiredWebhookHeaders(headers: Headers | Record<string, string | undefined>): boolean {
  const get = (name: string): string | null | undefined =>
    headers instanceof Headers ? headers.get(name) : headers[name];

  return REQUIRED_WEBHOOK_HEADERS.every((name) => Boolean(get(name)));
}
