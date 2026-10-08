// Agriculture Today importer (News N6b) -- fixed limits. Server-only:
// nothing under src/lib/newsIngest is imported by browser code.

// Each feed request is cut off after this long (connect + full body).
export const FEED_TIMEOUT_MS = 10_000;

// A feed response larger than this is abandoned, not parsed.
export const FEED_MAX_BYTES = 2 * 1024 * 1024;

// Only this many items from the top of each feed are looked at.
export const FEED_MAX_ITEMS = 30;

// How many feeds are fetched at the same time.
export const FEED_CONCURRENCY = 4;

// "Current" news: older items are counted as too old. Official video
// channels post a few times a month, so they get a wider window.
export const MAX_AGE_HOURS_TEXT = 72;
export const MAX_AGE_HOURS_VIDEO = 7 * 24;

// YouTube's oEmbed endpoint answers 200 only for a public video whose
// owner allows embedding -- checked for every video we'd show.
export const OEMBED_TIMEOUT_MS = 8_000;
export const OEMBED_CONCURRENCY = 4;

// Draft text limits (match news_articles' check constraints).
export const TITLE_MAX = 200;
export const EXCERPT_MAX = 500;

// How many candidates / rejections each feed's run row keeps in details.
export const DETAILS_MAX_ENTRIES = 40;

export const USER_AGENT =
  "ShambaSpaceBot/1.0 (+https://shamba-circle.vercel.app/news; agriculture news headlines with links)";

// Text feeds checked with the strict relevance rule (see relevance.ts):
// aggregators whose agriculture section also carries politics, crime,
// recipes and lifestyle stories. Kept here rather than in news_feeds so
// tightening a feed needs no database change during the dry-run phase.
export const STRICT_RELEVANCE_FEEDS: ReadonlySet<string> = new Set(["allafrica-agriculture"]);
