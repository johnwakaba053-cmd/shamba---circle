import { createClient } from "@/lib/supabase/server";
import {
  NEWS_CARD_COLUMNS,
  NEWS_FARM_TECH_CATEGORIES,
  NEWS_PAGE_SIZE,
  NEWS_SECTION_LIMITS,
  NEWS_TRENDING_MIN,
  NEWS_TRENDING_WINDOW_HOURS,
  newsCoverUrl,
  type NewsCardData,
  type NewsFormat,
  type NewsRegion,
} from "@/lib/news";
import { isYouTubeVideoId } from "@/lib/youtube";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

// Live articles only: published, published_at reached, not expired.
// RLS already limits readers to exactly this, but admins can also read
// drafts (N1's admin policy), so the public lists apply the same rule
// themselves -- an admin browsing /news sees what readers see.
export function liveNewsArticles(supabase: ServerClient, nowIso: string) {
  return supabase
    .from("news_articles")
    .select(NEWS_CARD_COLUMNS)
    .eq("status", "published")
    .lte("published_at", nowIso)
    .or(`expires_at.is.null,expires_at.gt."${nowIso}"`);
}

// === card media ==============================================================

// What a card needs from news_media (N4): a video story's YouTube ID and
// duration, a photo story's first photos and photo count.
export type NewsCardMedia = {
  videoId: string | null;
  durationSeconds: number | null;
  photos: { url: string; alt: string }[];
  photoCount: number;
};

type MediaRow = {
  article_id: string;
  kind: "image" | "video_embed";
  storage_path: string | null;
  embed_id: string | null;
  alt: string | null;
  duration_seconds: number | null;
};

const CARD_PHOTOS = 3;

// One query for every card on the page (not one per card). news_media's
// RLS returns media only for articles the reader can see.
export async function fetchCardMedia(
  supabase: ServerClient,
  articles: NewsCardData[],
): Promise<Map<string, NewsCardMedia>> {
  const result = new Map<string, NewsCardMedia>();
  const ids = articles
    .filter((article) => article.format === "video" || article.format === "photo_story")
    .map((article) => article.id);
  if (ids.length === 0) return result;

  const { data } = await supabase
    .from("news_media")
    .select("article_id, kind, storage_path, embed_id, alt, duration_seconds")
    .in("article_id", ids)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  for (const row of (data ?? []) as MediaRow[]) {
    const media = result.get(row.article_id) ?? { videoId: null, durationSeconds: null, photos: [], photoCount: 0 };

    if (row.kind === "video_embed" && !media.videoId && isYouTubeVideoId(row.embed_id)) {
      media.videoId = row.embed_id;
      media.durationSeconds = row.duration_seconds;
    } else if (row.kind === "image") {
      media.photoCount += 1;
      const url = newsCoverUrl(row.storage_path);
      if (url && media.photos.length < CARD_PHOTOS) {
        media.photos.push({ url, alt: row.alt ?? "" });
      }
    }

    result.set(row.article_id, media);
  }

  return result;
}

// === front page ==============================================================

export type NewsHome = {
  trending: NewsCardData[];
  featured: NewsCardData[];
  watch: NewsCardData[];
  photoStories: NewsCardData[];
  markets: NewsCardData[];
  farmTech: NewsCardData[];
  latest: NewsCardData[];
  hasOlder: boolean;
  media: Map<string, NewsCardMedia>;
  error: boolean;
};

// Extra rows fetched per section, so leaving out stories already shown
// higher up the page doesn't leave a section short.
const HEADROOM = 8;

// Every section is queried in parallel, then each story is kept only in
// the first section that claims it, in this order: Featured (the
// editor's choice always wins), Trending, Watch, Photo Stories,
// Markets & Prices, Farm Tech & AI, Latest. Display order on the page is
// Trending first; see page.tsx.
export async function fetchNewsHome(supabase: ServerClient, now: Date): Promise<NewsHome> {
  const nowIso = now.toISOString();
  const trendingSince = new Date(now.getTime() - NEWS_TRENDING_WINDOW_HOURS * 3600 * 1000).toISOString();
  const live = () => liveNewsArticles(supabase, nowIso);
  const newest = { ascending: false } as const;

  const results = await Promise.all([
    live()
      .eq("is_featured", true)
      .order("featured_rank", { ascending: true, nullsFirst: false })
      .order("published_at", newest)
      .limit(NEWS_SECTION_LIMITS.featured),
    live()
      .eq("is_featured", false)
      .gte("published_at", trendingSince)
      .order("published_at", newest)
      .order("id", { ascending: true })
      .limit(NEWS_SECTION_LIMITS.trending + HEADROOM),
    live().eq("format", "video").order("published_at", newest).limit(NEWS_SECTION_LIMITS.watch + HEADROOM),
    live()
      .eq("format", "photo_story")
      .order("published_at", newest)
      .limit(NEWS_SECTION_LIMITS.photoStories + HEADROOM),
    live()
      .eq("category_id", "markets-prices")
      .order("published_at", newest)
      .limit(NEWS_SECTION_LIMITS.markets + HEADROOM),
    live()
      .in("category_id", [...NEWS_FARM_TECH_CATEGORIES])
      .order("published_at", newest)
      .limit(NEWS_SECTION_LIMITS.farmTech + HEADROOM),
    // Latest, page 1, plus one row to tell whether an older page exists.
    live().order("published_at", newest).order("id", { ascending: true }).range(0, NEWS_PAGE_SIZE),
  ]);

  const error = results.some((result) => Boolean(result.error));
  const [featuredRows, trendingRows, watchRows, photoRows, marketRows, techRows, latestRows] = results.map(
    (result) => (result.data ?? []) as unknown as NewsCardData[],
  );

  const shown = new Set<string>();
  const take = (rows: NewsCardData[], limit: number) => {
    const picked: NewsCardData[] = [];
    for (const row of rows) {
      if (picked.length >= limit) break;
      if (shown.has(row.id)) continue;
      shown.add(row.id);
      picked.push(row);
    }
    return picked;
  };

  const featured = take(featuredRows, NEWS_SECTION_LIMITS.featured);
  let trending = take(trendingRows, NEWS_SECTION_LIMITS.trending);
  if (trending.length < NEWS_TRENDING_MIN) {
    // Too few to be worth a section: hand them back to the sections below.
    trending.forEach((article) => shown.delete(article.id));
    trending = [];
  }
  const watch = take(watchRows, NEWS_SECTION_LIMITS.watch);
  const photoStories = take(photoRows, NEWS_SECTION_LIMITS.photoStories);
  const markets = take(marketRows, NEWS_SECTION_LIMITS.markets);
  const farmTech = take(techRows, NEWS_SECTION_LIMITS.farmTech);

  // Latest counts every story for paging (so page 2 starts at story 13
  // whatever page 1 left out), but page 1 doesn't repeat stories above.
  const hasOlder = latestRows.length > NEWS_PAGE_SIZE;
  const latest = latestRows.slice(0, NEWS_PAGE_SIZE).filter((article) => !shown.has(article.id));

  const media = await fetchCardMedia(supabase, [
    ...trending,
    ...featured,
    ...watch,
    ...photoStories,
    ...markets,
    ...farmTech,
    ...latest,
  ]);

  return { trending, featured, watch, photoStories, markets, farmTech, latest, hasOlder, media, error };
}

// === filtered list ===========================================================

export type NewsListFilters = {
  format?: NewsFormat;
  region?: NewsRegion;
  category?: string;
  page: number;
};

// A filtered view, or page 2+ of everything: one list, newest first.
export async function fetchNewsList(supabase: ServerClient, now: Date, filters: NewsListFilters) {
  let query = liveNewsArticles(supabase, now.toISOString());
  if (filters.format) query = query.eq("format", filters.format);
  if (filters.region) query = query.eq("region", filters.region);
  if (filters.category) query = query.eq("category_id", filters.category);

  const from = (filters.page - 1) * NEWS_PAGE_SIZE;
  const { data, error } = await query
    .order("published_at", { ascending: false })
    .order("id", { ascending: true })
    .range(from, from + NEWS_PAGE_SIZE);

  const rows = (data ?? []) as unknown as NewsCardData[];
  const articles = rows.slice(0, NEWS_PAGE_SIZE);
  const media = await fetchCardMedia(supabase, articles);

  return { articles, hasOlder: rows.length > NEWS_PAGE_SIZE, media, error: Boolean(error) };
}
