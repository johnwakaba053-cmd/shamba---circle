// Deno test suite for validation.ts.
//
// Run with: deno test supabase/functions/send-sms/validation.test.ts
// (Not executed as part of `npm run lint`/`npm test` — this project's
// Node/Next.js toolchain doesn't run Deno tests. See README.md.)
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  hasRequiredWebhookHeaders,
  isValidOtp,
  isValidPhone,
  validateSendSmsPayload,
} from "./validation.ts";

Deno.test("isValidOtp accepts exactly 6 digits", () => {
  assertEquals(isValidOtp("123456"), true);
  assertEquals(isValidOtp("12345"), false);
  assertEquals(isValidOtp("1234567"), false);
  assertEquals(isValidOtp("12a456"), false);
  assertEquals(isValidOtp(123456), false);
  assertEquals(isValidOtp(undefined), false);
});

Deno.test("isValidPhone rejects empty/non-string values", () => {
  assertEquals(isValidPhone("+254712345678"), true);
  assertEquals(isValidPhone(""), false);
  assertEquals(isValidPhone(undefined), false);
  assertEquals(isValidPhone(12345), false);
});

Deno.test("validateSendSmsPayload accepts a well-formed payload", () => {
  const result = validateSendSmsPayload({
    user: { id: "6481a5c1-3d37-4a56-9f6a-bee08c554965", phone: "+254712345678" },
    sms: { otp: "561166" },
  });
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.payload.user.phone, "+254712345678");
    assertEquals(result.payload.sms.otp, "561166");
  }
});

Deno.test("validateSendSmsPayload rejects a missing otp", () => {
  const result = validateSendSmsPayload({
    user: { phone: "+254712345678" },
    sms: {},
  });
  assertEquals(result.ok, false);
});

Deno.test("validateSendSmsPayload rejects a non-6-digit otp", () => {
  const result = validateSendSmsPayload({
    user: { phone: "+254712345678" },
    sms: { otp: "12345" },
  });
  assertEquals(result.ok, false);
});

Deno.test("validateSendSmsPayload rejects a missing phone", () => {
  const result = validateSendSmsPayload({
    user: {},
    sms: { otp: "561166" },
  });
  assertEquals(result.ok, false);
});

Deno.test("validateSendSmsPayload rejects a non-object payload", () => {
  assertEquals(validateSendSmsPayload(null).ok, false);
  assertEquals(validateSendSmsPayload("not json").ok, false);
  assertEquals(validateSendSmsPayload(undefined).ok, false);
});

Deno.test("hasRequiredWebhookHeaders requires all three headers", () => {
  assertEquals(
    hasRequiredWebhookHeaders({
      "webhook-id": "id",
      "webhook-timestamp": "123",
      "webhook-signature": "sig",
    }),
    true,
  );
  assertEquals(hasRequiredWebhookHeaders({ "webhook-id": "id" }), false);
  assertEquals(hasRequiredWebhookHeaders({}), false);
});
