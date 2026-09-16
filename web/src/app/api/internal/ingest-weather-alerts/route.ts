import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { ingestWeatherAlerts } from "@/lib/weather/ingest";

// Internal ingestion trigger -- proves/runs the WeatherAPI -> alerts
// pipeline. Not tied to a farmer session, so it's gated by a secret
// instead: with neither secret configured, or a missing/wrong one, the
// request is rejected before any provider call or database write
// happens. Two independent, equally-valid ways in:
//   - x-ingest-secret header against INGEST_SECRET -- the original
//     manual/internal path, unchanged.
//   - `Authorization: Bearer <CRON_SECRET>` -- what Vercel Cron sends
//     automatically once a CRON_SECRET env var exists for this project
//     (see vercel.json for the schedule).
// Neither path depends on the other being configured.
function secretsMatch(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);

  if (providedBuffer.length !== expectedBuffer.length) return false;

  return timingSafeEqual(providedBuffer, expectedBuffer);
}

function isAuthorized(request: Request): boolean {
  const ingestSecret = process.env.INGEST_SECRET;
  const providedIngestSecret = request.headers.get("x-ingest-secret");
  if (ingestSecret && providedIngestSecret && secretsMatch(providedIngestSecret, ingestSecret)) {
    return true;
  }

  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  const providedCronSecret = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (cronSecret && providedCronSecret && secretsMatch(providedCronSecret, cronSecret)) {
    return true;
  }

  return false;
}

async function handleIngestRequest(request: Request) {
  if (!process.env.INGEST_SECRET && !process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: "Ingestion is not configured on this environment." },
      { status: 503 },
    );
  }

  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Optional { "countyIds": ["kiambu", ...] } body restricts the run to
  // a subset of counties (e.g. for a manual test), instead of always
  // querying all 47 -- an empty/missing body (always true for Vercel
  // Cron's GET invocation, which never has one) processes every county.
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

// What Vercel Cron actually calls (cron invocations are always GET).
export async function GET(request: Request) {
  return handleIngestRequest(request);
}

// Preserved for manual/internal calls (curl -X POST with
// x-ingest-secret and an optional {countyIds} body) -- unchanged
// behavior from before.
export async function POST(request: Request) {
  return handleIngestRequest(request);
}
