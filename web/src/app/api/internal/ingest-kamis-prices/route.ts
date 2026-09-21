import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import {
  getDefaultDailyIngestionWindow,
  validateKamisFetchParams,
  WHITELISTED_KAMIS_PRODUCTS,
} from "@/lib/kamis/client";
import { ingestKamisPrices } from "@/lib/kamis/ingest";

// Internal KAMIS price ingestion trigger. Two independent, equally
// valid ways in -- the same dual-auth shape already established by
// /api/internal/ingest-weather-alerts, not a new pattern invented here:
//   - GET + `Authorization: Bearer <CRON_SECRET>` -- what Vercel Cron
//     sends automatically once CRON_SECRET is configured for this
//     project (see vercel.json for the schedule). Cron invocations are
//     always a bare GET with no body, so this path always runs the
//     full whitelisted-commodity, rolling-window default below --
//     there is no way for a scheduled run to request a narrower or
//     different scope than what this file itself computes.
//   - POST + `x-ingest-secret` header -- unchanged from Stage 5, the
//     manual/controlled-test path, which still requires an explicit
//     JSON body (productIds/start/end/perPage) rather than falling
//     back to any default.
// Neither path depends on the other being configured. Never callable
// from client-side application code (nothing under src/app/**/*.tsx
// imports anything under src/lib/kamis), and neither INGEST_SECRET nor
// CRON_SECRET nor SUPABASE_SERVICE_ROLE_KEY (used inside
// ingestKamisPrices via createAdminClient) is ever read by anything
// that ships to the browser.
function secretsMatch(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);

  if (providedBuffer.length !== expectedBuffer.length) return false;

  return timingSafeEqual(providedBuffer, expectedBuffer);
}

function isCronAuthorized(request: Request): boolean {
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

const DEFAULT_SCHEDULED_PER_PAGE = 500;

// What Vercel Cron actually calls once per day (see vercel.json:
// "0 3 * * *" -- 03:00 UTC, an hour after the existing weather
// ingestion cron at 02:00 UTC, so the two never run at the exact same
// moment). Only the currently-approved commodity (Dry Maize, id "1")
// is ever requested -- WHITELISTED_KAMIS_PRODUCTS has exactly one
// entry today, and this handler deliberately derives its product list
// from that whitelist rather than hardcoding "1" a second time, so
// approving a future commodity there is the only change needed for the
// schedule to pick it up too.
export async function GET(request: Request) {
  if (!process.env.INGEST_SECRET && !process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: "KAMIS ingestion is not configured on this environment." },
      { status: 503 },
    );
  }

  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { start, end } = getDefaultDailyIngestionWindow();
  const validation = validateKamisFetchParams({
    productIds: Object.keys(WHITELISTED_KAMIS_PRODUCTS),
    start,
    end,
    perPage: DEFAULT_SCHEDULED_PER_PAGE,
  });

  if (!validation.ok) {
    // Should be unreachable -- these defaults are constructed
    // internally, not from caller input -- but never silently report
    // success if they somehow fail validation.
    return NextResponse.json({ error: validation.error }, { status: 500 });
  }

  const result = await ingestKamisPrices(validation.params);

  return NextResponse.json(result);
}

// Preserved exactly as Stage 5 built it: manual/controlled-test calls
// with an explicit, fully caller-specified scope (curl -X POST with
// x-ingest-secret and a JSON body) -- unchanged behavior.
export async function POST(request: Request) {
  const expectedSecret = process.env.INGEST_SECRET;

  if (!expectedSecret) {
    return NextResponse.json(
      { error: "KAMIS ingestion is not configured on this environment." },
      { status: 503 },
    );
  }

  const providedSecret = request.headers.get("x-ingest-secret");

  if (!providedSecret || !secretsMatch(providedSecret, expectedSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const validation = validateKamisFetchParams({
    productIds: input?.productIds,
    counties: input?.counties,
    markets: input?.markets,
    start: input?.start,
    end: input?.end,
    perPage: input?.perPage,
  });

  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const result = await ingestKamisPrices(validation.params);

  return NextResponse.json(result);
}
