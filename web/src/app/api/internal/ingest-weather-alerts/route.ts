import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { ingestWeatherAlerts } from "@/lib/weather/ingest";

// Internal, unscheduled ingestion trigger for development/testing only --
// proves the WeatherAPI -> alerts pipeline before any cron/scheduling
// stage exists. Not tied to a farmer session (this isn't a user-facing
// endpoint), so it's gated by a shared secret configured out-of-band
// (INGEST_SECRET) instead: with no secret configured, or a missing/wrong
// header, the request is rejected before any provider call or database
// write happens. This is also the shape a future scheduled trigger
// (e.g. Vercel Cron, which sends its own auth header) would call.
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
      { error: "Ingestion is not configured on this environment." },
      { status: 503 },
    );
  }

  const providedSecret = request.headers.get("x-ingest-secret");

  if (!providedSecret || !secretsMatch(providedSecret, expectedSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Optional { "countyIds": ["kiambu", ...] } body restricts the run to
  // a subset of counties (e.g. for a manual test), instead of always
  // querying all 47 -- an empty/missing body processes every county.
  let countyIds: string[] | undefined;
  try {
    const body = await request.json();
    if (Array.isArray(body?.countyIds)) {
      countyIds = body.countyIds.filter((id: unknown) => typeof id === "string");
    }
  } catch {
    // No body, or not JSON -- fall through and process every county.
  }

  const result = await ingestWeatherAlerts(countyIds);

  return NextResponse.json(result);
}
