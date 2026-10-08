import {
  BrainCircuit,
  ChartLine,
  CirclePlay,
  Cpu,
  FileText,
  Images,
  Newspaper,
  Scale,
  Sprout,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

// Agriculture Today: shared rules for the public /news pages (N3, N5).
// The data model is N1 (20261008130000) + N4 (20261008160000) and the
// admin write functions N2/N4; these helpers only read.

export const NEWS_REGIONS = ["kenya", "africa", "global"] as const;

export type NewsRegion = (typeof NEWS_REGIONS)[number];

export const NEWS_REGION_LABELS: Record<NewsRegion, string> = {
  kenya: "Kenya",
  africa: "Africa",
  global: "Global",
};

export function isNewsRegion(value: unknown): value is NewsRegion {
  return typeof value === "string" && (NEWS_REGIONS as readonly string[]).includes(value);
}

// One icon per seeded news_categories id. A category added later without
// an entry here falls back to NEWS_CATEGORY_FALLBACK_ICON.
export const NEWS_CATEGORY_ICON: Record<string, LucideIcon> = {
  agriculture: Sprout,
  // TrendingUp matches the Market Prices nav tab.
  "markets-prices": TrendingUp,
  "agri-stocks": ChartLine,
  "farm-tech": Cpu,
  "ai-innovation": BrainCircuit,
};

export const NEWS_CATEGORY_FALLBACK_ICON = Newspaper;

// Story formats (N4's news_articles.format check constraint -- keep in
// sync). Separate from topic (category) and region.
export const NEWS_FORMATS = ["article", "photo_story", "video", "market_update"] as const;

export type NewsFormat = (typeof NEWS_FORMATS)[number];

export function isNewsFormat(value: unknown): value is NewsFormat {
  return typeof value === "string" && (NEWS_FORMATS as readonly string[]).includes(value);
}

export const NEWS_FORMAT_LABELS: Record<NewsFormat, string> = {
  article: "Article",
  photo_story: "Photo story",
  video: "Video",
  market_update: "Market update",
};

// Plural labels for the format filter pills.
export const NEWS_FORMAT_FILTER_LABELS: Record<NewsFormat, string> = {
  article: "Articles",
  photo_story: "Photo stories",
  video: "Videos",
  market_update: "Market updates",
};

export const NEWS_FORMAT_ICON: Record<NewsFormat, LucideIcon> = {
  article: FileText,
  photo_story: Images,
  video: CirclePlay,
  market_update: Scale,
};

export type NewsOrigin = "external_linked" | "external_redistributable" | "shamba_original";

export type NewsStatus = "draft" | "published" | "archived";

// What a reader sees an article as. "scheduled" and "expired" are not
// stored: they're a published article whose published_at hasn't come yet
// or whose expires_at has passed -- the same rule as N1's RLS policy.
export type NewsDisplayStatus = "draft" | "scheduled" | "live" | "expired" | "archived";

export function newsDisplayStatus(
  article: { status: NewsStatus; published_at: string | null; expires_at: string | null },
  now: Date = new Date(),
): NewsDisplayStatus {
  if (article.status === "draft") return "draft";
  if (article.status === "archived") return "archived";
  if (!article.published_at || new Date(article.published_at) > now) return "scheduled";
  if (article.expires_at && new Date(article.expires_at) <= now) return "expired";
  return "live";
}

// The columns a card needs. N1's column grants hide created_by,
// updated_by and external_ref, so every query names its columns.
export const NEWS_CARD_COLUMNS =
  "id, slug, category_id, region, county_id, format, byline, title, summary, origin, cover_image_path, cover_image_alt, is_featured, featured_rank, published_at, news_categories(name), news_sources(name), counties(name)";

export type NewsCardData = {
  id: string;
  slug: string;
  category_id: string;
  region: NewsRegion;
  county_id: string | null;
  format: NewsFormat;
  byline: string | null;
  title: string;
  summary: string;
  origin: NewsOrigin;
  cover_image_path: string | null;
  cover_image_alt: string | null;
  is_featured: boolean;
  featured_rank: number | null;
  published_at: string;
  news_categories: { name: string } | null;
  news_sources: { name: string } | null;
  counties: { name: string } | null;
};

export const NEWS_PAGE_SIZE = 12;

// How many stories each section of the /news front page shows (N5).
export const NEWS_SECTION_LIMITS = {
  trending: 5,
  featured: 3,
  watch: 6,
  photoStories: 4,
  markets: 3,
  farmTech: 4,
} as const;

// Trending (decided, interim "option C"): the newest live stories from
// the last 72 hours, leaving out Featured. Hidden when fewer than
// NEWS_TRENDING_MIN stories qualify.
export const NEWS_TRENDING_WINDOW_HOURS = 72;
export const NEWS_TRENDING_MIN = 3;

// The topics the "Farm Tech & AI" section collects.
export const NEWS_FARM_TECH_CATEGORIES = ["farm-tech", "ai-innovation"] as const;

// /news?format=&region=&category=&page= -- same "build the next href from the
// current one" shape as buildEducationHref. A field explicitly set to
// undefined in `overrides` clears it; a field left out keeps its value.
// Changing a filter always goes back to page 1.
//
// Page numbers rather than a published_at cursor: several stories can
// share a publish time (the N1 seeds do), and a time cursor would skip
// some of them at a page break.
export type NewsHrefParams = {
  format?: NewsFormat;
  region?: NewsRegion;
  category?: string;
  page?: number;
};

export function buildNewsHref(current: NewsHrefParams, overrides: NewsHrefParams): string {
  const filterChanged = "format" in overrides || "region" in overrides || "category" in overrides;
  const merged: NewsHrefParams = {
    ...current,
    ...(filterChanged ? { page: undefined } : {}),
    ...overrides,
  };
  const params = new URLSearchParams();
  if (merged.format) params.set("format", merged.format);
  if (merged.region) params.set("region", merged.region);
  if (merged.category) params.set("category", merged.category);
  if (merged.page && merged.page > 1) params.set("page", String(merged.page));
  const query = params.toString();
  return query ? `/news?${query}` : "/news";
}

export function newsArticlePath(slug: string): string {
  return `/news/${slug}`;
}

// Same rule as N1's slug check constraint, so a malformed URL is a 404
// before any query runs.
const NEWS_SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function isNewsSlug(value: string): boolean {
  return value.length <= 120 && NEWS_SLUG_PATTERN.test(value);
}

export const NEWS_MAX_PAGE = 50;

// ?page= as a whole number from 1 to NEWS_MAX_PAGE; anything else is 1.
export function parseNewsPage(value: unknown): number {
  if (typeof value !== "string" || !/^\d{1,3}$/.test(value)) return 1;
  const page = Number(value);
  return page >= 1 && page <= NEWS_MAX_PAGE ? page : 1;
}

// Covers live in the public 'news-media' bucket (N1), so this is a plain
// public URL -- stable for link previews, nothing to sign. N1's check
// constraint already limits the path to '<uuid>/<file>'.
export function newsCoverUrl(path: string | null): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  if (!path || !base) return null;
  return `${base}/storage/v1/object/public/news-media/${path.split("/").map(encodeURIComponent).join("/")}`;
}

// Only ever rendered as an <a href> after this check: https only.
export function safeExternalUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

// Dates are shown in Kenya time, like the rest of the app (see
// formatMessageTime.ts), so the day never depends on the server's zone.
const TIME_ZONE = "Africa/Nairobi";

export function formatNewsDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    timeZone: TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatNewsToday(now: Date = new Date()): string {
  return now.toLocaleDateString("en-GB", {
    timeZone: TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// The body is plain text: blank lines separate blocks and a "## " line
// is a section heading -- the same convention as Education guides.
// Never rendered as HTML.
export type NewsBodyBlock = { kind: "heading" | "paragraph"; text: string };

export function parseNewsBody(body: string | null): NewsBodyBlock[] {
  if (!body) return [];
  return body
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) =>
      block.startsWith("## ")
        ? { kind: "heading" as const, text: block.slice(3).trim() }
        : { kind: "paragraph" as const, text: block },
    );
}

// "Kenya · Nakuru" or just "Kenya".
export function newsPlaceLabel(region: NewsRegion, countyName: string | null | undefined): string {
  return countyName ? `${NEWS_REGION_LABELS[region]} · ${countyName}` : NEWS_REGION_LABELS[region];
}
