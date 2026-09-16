import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { computeDryRunEligibility } from "@/lib/sms/eligibility";

// Internal, manual/dev-only dry-run: reports who WOULD receive an SMS
// for a given alert, without sending anything or writing to
// alert_deliveries. Gated by the same trusted internal secret already
// used for weather ingestion (INGEST_SECRET / x-ingest-secret) -- not a
// user-facing endpoint, so no farmer session is involved at all.
function secretsMatch(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);

  if (providedBuffer.length !== expectedBuffer.length) return false;

  return timingSafeEqual(providedBuffer, expectedBuffer);
}

export async function POST(request: Request) {
  const expectedSecret = process.env.INGEST_SECRET;

  if (!expectedSecret) {
    return NextResponse.json(
      { error: "SMS dry-run is not configured on this environment." },
      { status: 503 },
    );
  }

  const providedSecret = request.headers.get("x-ingest-secret");

  if (!providedSecret || !secretsMatch(providedSecret, expectedSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let alertId: string | undefined;
  try {
    const body = await request.json();
    if (typeof body?.alert_id === "string" && body.alert_id.length > 0) {
      alertId = body.alert_id;
    }
  } catch {
    // no-op, handled by the missing-alertId check below
  }

  if (!alertId) {
    return NextResponse.json({ error: "alert_id is required." }, { status: 400 });
  }

  // Read-only: no SMS provider call, no write to alert_deliveries.
  // Returns counts only -- never a phone number, never a farmer
  // identity, never anything beyond what's needed to sanity-check the
  // matching pipeline.
  const result = await computeDryRunEligibility(alertId);

  return NextResponse.json(result);
}
