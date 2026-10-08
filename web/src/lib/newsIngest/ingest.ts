import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getYouTubeThumbnailUrl, getYouTubeWatchUrl, isYouTubeVideoId } from "@/lib/youtube";
import {
  DETAILS_MAX_ENTRIES,
  EXCERPT_MAX,
  FEED_CONCURRENCY,
  MAX_AGE_HOURS_TEXT,
  MAX_AGE_HOURS_VIDEO,
  OEMBED_CONCURRENCY,
  OEMBED_TIMEOUT_MS,
  STRICT_RELEVANCE_FEEDS,
  TITLE_MAX,
  USER_AGENT,
} from "./config";
import { draftSlug, draftSummary } from "./draftText";
import { fetchFeed } from "./fetchFeed";
import { parseFeed } from "./parseFeed";
import { assessRelevance, type RelevanceMode } from "./relevance";
import {
  articleExternalRef,
  canonicalArticleUrl,
  parseFeedDate,
  titleKey,
  toPlainText,
  truncate,
  videoExternalRef,
} from "./text";

// Agriculture Today importer (News N6b dry run, N6c draft import).
//
// Reads the active feeds (news_feeds, N6a), fetches each one with a time
// and size limit, and sorts every item into exactly one bucket:
//   new        becomes a draft (current, relevant, not seen before)
//   duplicate  already imported (news_articles.external_ref) or already
//              seen earlier in this run (same link, video or headline)
//   irrelevant fails the agriculture relevance or language check
//   too_old    older than the "current" window
//   invalid    no headline / https link / date, or a video that may not
//              be embedded
// Each feed's result is logged in news_ingestion_runs. One feed failing
// never stops the others.
//
// mode "dry_run" only reports: it never writes news_articles and never
// touches news_feeds' fetch state. mode "draft" also creates each new item
// as a DRAFT through import_news_draft() (N6c) -- never published -- with
// a short original summary (draftText.ts), and records each feed's fetch
// state. Uses the service-role client: server-only.

export type IngestMode = "dry_run" | "draft";

type Region = "kenya" | "africa" | "global";

type FeedRow = {
  id: string;
  source_id: string;
  kind: "rss" | "youtube_channel";
  feed_url: string;
  region: Region;
  default_category_id: string;
  relevance_mode: "agri_feed" | "keyword_filter";
  consecutive_failures: number;
  news_sources: { name: string; video_policy: "none" | "youtube_embed" } | null;
};

export type DryRunCandidate = {
  feedId: string;
  sourceName: string;
  kind: "article" | "video";
  region: Region;
  categoryId: string;
  title: string;
  url: string;
  publishedAt: string;
  excerpt: string;
  externalRef: string;
  relevanceScore: number;
  matchedTerms: string[];
  video: { id: string; thumbnailUrl: string; embeddable: true } | null;
};

export type DryRunRejection = { title: string; reason: string };

export type FeedCounts = {
  seen: number;
  new: number;
  duplicate: number;
  irrelevant: number;
  tooOld: number;
  invalid: number;
};

export type FeedDryRunResult = {
  feedId: string;
  sourceName: string;
  kind: FeedRow["kind"];
  region: Region;
  status: "completed" | "failed";
  httpStatus: number | null;
  error: string | null;
  counts: FeedCounts;
  candidates: DryRunCandidate[];
  rejected: DryRunRejection[];
  runRowId: string | null;
  // Draft mode only: what was actually written.
  drafts: {
    created: { id: string; slug: string; title: string; kind: "article" | "video"; region: Region }[];
    failed: { title: string; error: string }[];
  } | null;
};

export type DryRunReport = {
  runId: string;
  dryRun: boolean;
  mode: IngestMode;
  startedAt: string;
  completedAt: string;
  feeds: FeedDryRunResult[];
};

// Runs tasks with at most `limit` in flight; results keep input order.
async function pool<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await task(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// YouTube's oEmbed endpoint answers 200 only for a public video whose
// owner allows embedding (401 = embedding off, 404 = gone/private).
async function isEmbeddable(videoId: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OEMBED_TIMEOUT_MS);
  try {
    const url = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(getYouTubeWatchUrl(videoId))}`;
    const response = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      headers: { "User-Agent": USER_AGENT },
    });
    return response.status === 200;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// Which relevance rule a feed's items get (see relevance.ts): every video
// gets the video rule; listed aggregators get the strict rule.
function relevanceModeFor(feed: FeedRow): RelevanceMode {
  if (feed.kind === "youtube_channel") return "video";
  if (STRICT_RELEVANCE_FEEDS.has(feed.id)) return "strict";
  return feed.relevance_mode;
}

// AllAfrica headlines start with the country ("Kenya: ..."); a Kenyan
// story from a pan-African feed belongs in the Kenya region.
function regionFor(feed: FeedRow, title: string): Region {
  if (feed.region === "africa" && /^kenya\s*:/i.test(title)) return "kenya";
  return feed.region;
}

export function runNewsDryRun(
  supabase: SupabaseClient,
  options: { triggeredBy: "cron" | "manual"; now?: Date },
): Promise<DryRunReport> {
  return runNewsIngest(supabase, { ...options, mode: "dry_run" });
}

export async function runNewsIngest(
  supabase: SupabaseClient,
  { triggeredBy, mode, now = new Date() }: { triggeredBy: "cron" | "manual"; mode: IngestMode; now?: Date },
): Promise<DryRunReport> {
  const runId = randomUUID();
  const startedAt = now.toISOString();

  const { data: feedRows, error: feedsError } = await supabase
    .from("news_feeds")
    .select("id, source_id, kind, feed_url, region, default_category_id, relevance_mode, consecutive_failures, news_sources(name, video_policy)")
    .eq("is_active", true)
    .order("id", { ascending: true });

  if (feedsError) {
    throw new Error(`news_feeds_unavailable: ${feedsError.message}`);
  }

  const feeds = (feedRows ?? []) as unknown as FeedRow[];

  // Shared across feeds so the same story from two feeds counts once.
  // Feeds finish in network order, so which feed "wins" a cross-feed
  // duplicate can vary between runs; the story itself is kept once.
  const seenRefs = new Set<string>();
  const seenTitles = new Set<string>();

  const results = await pool(feeds, FEED_CONCURRENCY, (feed) =>
    runFeed(supabase, feed, { runId, triggeredBy, mode, now, seenRefs, seenTitles }),
  );

  return { runId, dryRun: mode === "dry_run", mode, startedAt, completedAt: new Date().toISOString(), feeds: results };
}

async function runFeed(
  supabase: SupabaseClient,
  feed: FeedRow,
  context: {
    runId: string;
    triggeredBy: "cron" | "manual";
    mode: IngestMode;
    now: Date;
    seenRefs: Set<string>;
    seenTitles: Set<string>;
  },
): Promise<FeedDryRunResult> {
  const sourceName = feed.news_sources?.name ?? feed.source_id;
  const counts: FeedCounts = { seen: 0, new: 0, duplicate: 0, irrelevant: 0, tooOld: 0, invalid: 0 };
  const candidates: DryRunCandidate[] = [];
  const rejected: DryRunRejection[] = [];
  const result: FeedDryRunResult = {
    feedId: feed.id,
    sourceName,
    kind: feed.kind,
    region: feed.region,
    status: "failed",
    httpStatus: null,
    error: null,
    counts,
    candidates,
    rejected,
    runRowId: null,
    drafts: context.mode === "draft" ? { created: [], failed: [] } : null,
  };

  const started = new Date();
  const { data: runRow } = await supabase
    .from("news_ingestion_runs")
    .insert({
      run_id: context.runId,
      feed_id: feed.id,
      triggered_by: context.triggeredBy,
      dry_run: context.mode === "dry_run",
      status: "running",
      started_at: started.toISOString(),
    })
    .select("id")
    .single();
  result.runRowId = (runRow?.id as string | undefined) ?? null;

  try {
    const fetched = await fetchFeed(feed.feed_url);
    result.httpStatus = fetched.status;
    if (!fetched.ok) {
      result.error = fetched.error;
      return result;
    }

    const parsed = parseFeed(fetched.body);
    if (!parsed.ok) {
      result.error = parsed.error;
      return result;
    }

    const isVideoFeed = feed.kind === "youtube_channel";
    const maxAgeMs = (isVideoFeed ? MAX_AGE_HOURS_VIDEO : MAX_AGE_HOURS_TEXT) * 3600 * 1000;
    const reject = (title: string, reason: string) => {
      if (rejected.length < DETAILS_MAX_ENTRIES) rejected.push({ title: title || "(no headline)", reason });
    };

    // First pass: everything that can be decided from the feed alone.
    const pending: DryRunCandidate[] = [];
    for (const raw of parsed.items) {
      counts.seen += 1;
      const title = truncate(toPlainText(raw.title), TITLE_MAX);
      const published = parseFeedDate(raw.published);

      let url: string | null;
      let externalRef: string | null = null;
      let video: DryRunCandidate["video"] = null;
      if (isVideoFeed) {
        const videoId = raw.videoId;
        if (!isYouTubeVideoId(videoId)) {
          counts.invalid += 1;
          reject(title, "invalid_video_id");
          continue;
        }
        if (feed.news_sources?.video_policy !== "youtube_embed") {
          counts.invalid += 1;
          reject(title, "video_not_permitted");
          continue;
        }
        url = getYouTubeWatchUrl(videoId);
        externalRef = videoExternalRef(videoId);
        video = { id: videoId, thumbnailUrl: getYouTubeThumbnailUrl(videoId), embeddable: true };
      } else {
        url = canonicalArticleUrl(raw.link);
        if (url) externalRef = articleExternalRef(url);
      }

      if (!title) {
        counts.invalid += 1;
        reject(title, "no_headline");
        continue;
      }
      if (!url || !externalRef) {
        counts.invalid += 1;
        reject(title, "no_https_link");
        continue;
      }
      if (!published) {
        counts.invalid += 1;
        reject(title, "no_date");
        continue;
      }
      if (context.now.getTime() - published.getTime() > maxAgeMs) {
        counts.tooOld += 1;
        reject(title, "too_old");
        continue;
      }

      const excerpt = truncate(toPlainText(raw.description), EXCERPT_MAX);
      const relevance = assessRelevance({ title, body: excerpt }, relevanceModeFor(feed));
      if (!relevance.relevant) {
        counts.irrelevant += 1;
        reject(title, relevance.reason ?? "irrelevant");
        continue;
      }

      pending.push({
        feedId: feed.id,
        sourceName,
        kind: isVideoFeed ? "video" : "article",
        region: regionFor(feed, title),
        categoryId: feed.default_category_id,
        title,
        url,
        publishedAt: published.toISOString(),
        excerpt,
        externalRef,
        relevanceScore: relevance.score,
        matchedTerms: relevance.matched,
        video,
      });
    }

    // Already imported? One query for the whole feed.
    const refs = pending.map((item) => item.externalRef);
    const existing = new Set<string>();
    if (refs.length > 0) {
      const { data: existingRows, error: existingError } = await supabase
        .from("news_articles")
        .select("external_ref")
        .in("external_ref", refs);
      if (existingError) {
        result.error = "duplicate_check_failed";
        return result;
      }
      for (const row of existingRows ?? []) existing.add(row.external_ref as string);
    }

    const fresh: DryRunCandidate[] = [];
    for (const item of pending) {
      const key = titleKey(item.title);
      if (existing.has(item.externalRef) || context.seenRefs.has(item.externalRef) || (key && context.seenTitles.has(key))) {
        counts.duplicate += 1;
        reject(item.title, existing.has(item.externalRef) ? "already_imported" : "duplicate_in_run");
        continue;
      }
      context.seenRefs.add(item.externalRef);
      if (key) context.seenTitles.add(key);
      fresh.push(item);
    }

    // Videos: only ones YouTube still lets us embed.
    const embeddable = await pool(fresh, OEMBED_CONCURRENCY, (item) =>
      item.video ? isEmbeddable(item.video.id) : Promise.resolve(true),
    );
    fresh.forEach((item, index) => {
      if (!embeddable[index]) {
        counts.invalid += 1;
        reject(item.title, "video_not_embeddable");
        return;
      }
      counts.new += 1;
      candidates.push(item);
    });

    // Draft mode: write each new item as a draft, one at a time. A story
    // that appeared since the duplicate check (import_news_draft returns
    // null) counts as a duplicate; an insert the database refuses counts
    // as invalid, with its error kept.
    if (result.drafts) {
      for (const item of [...candidates]) {
        const slug = draftSlug(item.title, item.externalRef);
        const { data: draftId, error: importError } = await supabase.rpc("import_news_draft", {
          p_feed_id: item.feedId,
          p_external_ref: item.externalRef,
          p_slug: slug,
          p_title: item.title,
          p_summary: draftSummary(item),
          p_source_excerpt: item.excerpt,
          p_external_url: item.url,
          p_region: item.region,
          p_category_id: item.categoryId,
          p_format: item.kind,
          p_source_published_at: item.publishedAt,
          p_relevance_score: item.relevanceScore,
          p_relevance_terms: item.matchedTerms,
          p_youtube_video_id: item.video?.id ?? null,
        });
        if (importError) {
          counts.new -= 1;
          counts.invalid += 1;
          result.drafts.failed.push({ title: item.title, error: importError.message.slice(0, 200) });
          reject(item.title, "import_failed");
        } else if (!draftId) {
          counts.new -= 1;
          counts.duplicate += 1;
          reject(item.title, "already_imported");
        } else {
          result.drafts.created.push({ id: draftId as string, slug, title: item.title, kind: item.kind, region: item.region });
        }
      }
      // From here on, candidates means "drafts actually created".
      const createdTitles = new Set(result.drafts.created.map((draft) => draft.title));
      const kept = candidates.filter((item) => createdTitles.has(item.title));
      candidates.length = 0;
      candidates.push(...kept);
    }

    result.status = "completed";
    return result;
  } catch {
    result.error = "unexpected_error";
    return result;
  } finally {
    if (result.runRowId) {
      await supabase
        .from("news_ingestion_runs")
        .update({
          status: result.status,
          completed_at: new Date().toISOString(),
          http_status: result.httpStatus,
          items_seen: counts.seen,
          items_new: counts.new,
          items_duplicate: counts.duplicate,
          items_irrelevant: counts.irrelevant,
          items_too_old: counts.tooOld,
          items_invalid: counts.invalid,
          error_message: result.error,
          details: {
            candidates: candidates.slice(0, DETAILS_MAX_ENTRIES).map((item) => ({
              title: item.title,
              url: item.url,
              published_at: item.publishedAt,
              region: item.region,
              external_ref: item.externalRef,
              relevance_score: item.relevanceScore,
              video_id: item.video?.id ?? null,
            })),
            rejected,
          },
        })
        .eq("id", result.runRowId);
    }

    // Real runs record each feed's fetch state; dry runs never do.
    if (context.mode === "draft") {
      const finishedAt = new Date().toISOString();
      const ok = result.status === "completed";
      await supabase
        .from("news_feeds")
        .update({
          last_fetched_at: finishedAt,
          last_status: ok ? "ok" : "error",
          last_error: ok ? null : (result.error ?? "error").slice(0, 500),
          last_item_count: counts.seen,
          consecutive_failures: ok ? 0 : (feed.consecutive_failures ?? 0) + 1,
          ...(ok ? { last_success_at: finishedAt } : {}),
        })
        .eq("id", feed.id);
    }
  }
}
