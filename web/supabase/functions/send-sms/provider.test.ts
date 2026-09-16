// Deno test suite for provider.ts.
//
// Run with: deno test supabase/functions/send-sms/provider.test.ts
// All fetch calls are mocked via the injectable `fetchImpl` option — no
// real network request to Africa's Talking is ever made by this suite.
import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildOtpMessage,
  createAfricasTalkingProvider,
  parseAfricasTalkingResponse,
  toE164,
} from "./provider.ts";

Deno.test("buildOtpMessage formats the OTP message", () => {
  assertEquals(buildOtpMessage("123456"), "Your Shamba Circle verification code is 123456");
});

Deno.test("toE164 leaves an already-'+'-prefixed number unchanged", () => {
  assertEquals(toE164("+254712345678"), "+254712345678");
});

Deno.test("toE164 adds exactly one leading '+' to a plain-digit number", () => {
  assertEquals(toE164("254712345678"), "+254712345678");
});

Deno.test("parseAfricasTalkingResponse accepts a Sent (101) recipient status", () => {
  const result = parseAfricasTalkingResponse({
    SMSMessageData: { Recipients: [{ statusCode: 101, status: "Success" }] },
  });
  assertEquals(result.ok, true);
});

Deno.test("parseAfricasTalkingResponse accepts Processed (100) and Queued (102)", () => {
  assertEquals(
    parseAfricasTalkingResponse({ SMSMessageData: { Recipients: [{ statusCode: 100 }] } }).ok,
    true,
  );
  assertEquals(
    parseAfricasTalkingResponse({ SMSMessageData: { Recipients: [{ statusCode: 102 }] } }).ok,
    true,
  );
});

Deno.test("parseAfricasTalkingResponse rejects a rejected recipient status", () => {
  const result = parseAfricasTalkingResponse({
    SMSMessageData: { Recipients: [{ statusCode: 403, status: "InvalidPhoneNumber" }] },
  });
  assertEquals(result.ok, false);
});

Deno.test("parseAfricasTalkingResponse rejects a missing/empty recipient list", () => {
  assertEquals(parseAfricasTalkingResponse({ SMSMessageData: { Recipients: [] } }).ok, false);
  assertEquals(parseAfricasTalkingResponse({ SMSMessageData: {} }).ok, false);
  assertEquals(parseAfricasTalkingResponse({}).ok, false);
  assertEquals(parseAfricasTalkingResponse(null).ok, false);
});

Deno.test("createAfricasTalkingProvider rejects and never calls fetch when credentials are missing", async () => {
  let called = false;
  const fetchImpl = (() => {
    called = true;
    return Promise.reject(new Error("fetch should not be called"));
  }) as unknown as typeof fetch;

  const provider = createAfricasTalkingProvider(
    { username: undefined, apiKey: undefined },
    { fetchImpl },
  );

  await assertRejects(() => provider.send({ phone: "+254712345678", otp: "123456" }));
  assertEquals(called, false);
});

Deno.test("createAfricasTalkingProvider rejects on a non-2xx HTTP response", async () => {
  const fetchImpl = (() =>
    Promise.resolve(new Response("bad request", { status: 400 }))) as unknown as typeof fetch;

  const provider = createAfricasTalkingProvider(
    { username: "sandbox", apiKey: "test-key" },
    { fetchImpl },
  );

  await assertRejects(() => provider.send({ phone: "+254712345678", otp: "123456" }));
});

Deno.test("createAfricasTalkingProvider rejects when the recipient status indicates failure", async () => {
  const fetchImpl = (() =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          SMSMessageData: { Recipients: [{ statusCode: 406, status: "UserInBlacklist" }] },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    )) as unknown as typeof fetch;

  const provider = createAfricasTalkingProvider(
    { username: "sandbox", apiKey: "test-key" },
    { fetchImpl },
  );

  await assertRejects(() => provider.send({ phone: "+254712345678", otp: "123456" }));
});

Deno.test("createAfricasTalkingProvider resolves on a successful recipient status", async () => {
  const fetchImpl = (() =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          SMSMessageData: { Recipients: [{ statusCode: 101, status: "Success" }] },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    )) as unknown as typeof fetch;

  const provider = createAfricasTalkingProvider(
    { username: "sandbox", apiKey: "test-key" },
    { fetchImpl },
  );

  await provider.send({ phone: "+254712345678", otp: "123456" }); // must not throw
});
