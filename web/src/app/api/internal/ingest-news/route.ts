import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runNewsIngest } from "@/lib/newsIngest/ingest";

// Internal Agriculture Today importer trigger (News N6b/N6c). POST only,
// with the `x-ingest-secret` header (INGEST_SECRET) and one of:
//   {"dryRun": true}        fetch and sort every active feed, log the run,
//                           write no articles (N6b)
//   {"importDrafts": true}  the same, then create each new item as a
//                           DRAFT article via import_news_draft (N6c).
//                           Nothing is ever published here.
// Anything else is refused. There is no GET/cron path yet (the scheduler
// comes later).
//
// Same secret check as /api/internal/ingest-kamis-prices. Never called
// from browser code; INGEST_SECRET and the service-role key stay
// server-side.
export const maxDuration = 60;

function secretsMatch(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(providedBuffer, expectedBuffer);
}

export async function POST(request: Request) {
  const expected = process.env.INGEST_SECRET;
  const provided = request.headers.get("x-ingest-secret");
  if (!expected || !provided || !secretsMatch(provided, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown> | null = null;
  try {
    const parsed: unknown = await request.json();
    body = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    body = null;
  }

  const dryRun = body?.dryRun === true;
  const importDrafts = body?.importDrafts === true;
  if (dryRun === importDrafts) {
    return NextResponse.json(
      { error: "choose_one_mode", message: 'Send {"dryRun": true} or {"importDrafts": true}.' },
      { status: 400 },
    );
  }

  try {
    const report = await runNewsIngest(createAdminClient(), {
      triggeredBy: "manual",
      mode: importDrafts ? "draft" : "dry_run",
    });
    return NextResponse.json(report);
  } catch {
    return NextResponse.json({ error: "ingest_failed" }, { status: 500 });
  }
}
