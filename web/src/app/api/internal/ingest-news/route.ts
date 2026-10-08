import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runNewsIngest } from "@/lib/newsIngest/ingest";

// Internal Agriculture Today importer trigger (News N6b/N6c). POST only,
// with the `x-ingest-secret` header (INGEST_SECRET) and one of:
//   {"dryRun": true}        fetch and sort every active feed, log the run,
//                           write no articles (N6b)
//   {"importDrafts": true}  the same, then create each new item as a
//                           DRAFT article via import_news_draft (N6c)
//   {"autoPublish": true}   the same, then publish each new draft that is
//                           clear-cut; questionable ones stay drafts
//                           (ingest.ts, mode "auto")
// Exactly one mode, else 400. Add "trigger": "cron" when the Supabase
// scheduler (pg_cron, every minute) is calling. There is no GET path.
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

  const modes = [
    body?.dryRun === true ? ("dry_run" as const) : null,
    body?.importDrafts === true ? ("draft" as const) : null,
    body?.autoPublish === true ? ("auto" as const) : null,
  ].filter((mode) => mode !== null);
  if (modes.length !== 1) {
    return NextResponse.json(
      {
        error: "choose_one_mode",
        message: 'Send exactly one of {"dryRun": true}, {"importDrafts": true} or {"autoPublish": true}.',
      },
      { status: 400 },
    );
  }

  try {
    const report = await runNewsIngest(createAdminClient(), {
      triggeredBy: body?.trigger === "cron" ? "cron" : "manual",
      mode: modes[0],
    });
    return NextResponse.json(report);
  } catch {
    return NextResponse.json({ error: "ingest_failed" }, { status: 500 });
  }
}
