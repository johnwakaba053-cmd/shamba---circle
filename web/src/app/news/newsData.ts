import { createClient } from "@/lib/supabase/server";
import {
  NEWS_CARD_COLUMNS,
  NEWS_PAGE_SIZE,
  NEWS_SECTION_LIMITS,
  NEWS_TRENDING_MIN,
  NEWS_TRENDING_WINDOW_HOURS,
  type NewsCardData,
  type NewsFormat,
  type NewsRegion,
} from "@/lib/news";
import { signNewsMediaPaths } from "@/lib/newsMedia";
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

// What a card needs for its picture: the cover's signed URL (the bucket
// is private, see lib/newsMedia.ts), and from news_media (N4) a video
// story's YouTube ID and duration, a photo story's first photos and
// photo count.
export type NewsCardMedia = {
  coverUrl: string | null;
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

// One media query and one signing request for every card on the page
// (not one per card). news_media's RLS returns media only for articles
// the reader can see, and Storage signs only files the reader may read.
export async function fetchCardMedia(
  supabase: ServerClient,
  articles: NewsCardData[],
): Promise<Map<string, NewsCardMedia>> {
  const result = new Map<string, NewsCardMedia>();
  const ids = articles
    .filter((article) => article.format === "video" || article.format === "photo_story")
    .map((article) => article.id);

  const { data } =
    ids.length > 0
      ? await supabase
          .from("news_media")
          .select("article_id, kind, storage_path, embed_id, alt, duration_seconds")
          .in("article_id", ids)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true })
      : { data: [] };
  const rows = (data ?? []) as MediaRow[];

  const urls = await signNewsMediaPaths(supabase, [
    ...articles.map((article) => article.cover_image_path),
    ...rows.map((row) => row.storage_path),
  ]);
  const entry = (articleId: string) => {
    const media = result.get(articleId) ?? {
      coverUrl: null,
      videoId: null,
      durationSeconds: null,
      photos: [],
      photoCount: 0,
    };
    result.set(articleId, media);
    return media;
  };

  for (const article of articles) {
    const coverUrl = article.cover_image_path ? urls.get(article.cover_image_path) : undefined;
    if (coverUrl) entry(article.id).coverUrl = coverUrl;
  }

  for (const row of rows) {
    const media = entry(row.article_id);

    if (row.kind === "video_embed" && !media.videoId && isYouTubeVideoId(row.embed_id)) {
      media.videoId = row.embed_id;
      media.durationSeconds = row.duration_seconds;
    } else if (row.kind === "image") {
      media.photoCount += 1;
      const url = row.storage_path ? urls.get(row.storage_path) : undefined;
      if (url && media.photos.length < CARD_PHOTOS) {
        media.photos.push({ url, alt: row.alt ?? "" });
      }
    }
  }

  return result;
}

// === the /news page ==========================================================

export type NewsListFilters = {
  format?: NewsFormat;
  region?: NewsRegion;
  category?: string;
  page: number;
};

export type NewsFront = {
  // The main feed: on the front page, Featured first, then the newest
  // stories; otherwise one filtered, newest-first page.
  feed: NewsCardData[];
  hasOlder: boolean;
  // The sidebar.
  trending: NewsCardData[];
  videos: NewsCardData[];
  media: Map<string, NewsCardMedia>;
  error: boolean;
};

// Everything /news shows, queried in parallel. The sidebar (Trending,
// Videos) is the same on every view and may repeat a story from the feed,
// like a newspaper's "most read" column. Only the feed pages.
export async function fetchNewsFront(
  supabase: ServerClient,
  now: Date,
  filters: NewsListFilters & { frontPage: boolean },
): Promise<NewsFront> {
  const nowIso = now.toISOString();
  const trendingSince = new Date(now.getTime() - NEWS_TRENDING_WINDOW_HOURS * 3600 * 1000).toISOString();
  const live = () => liveNewsArticles(supabase, nowIso);
  const newest = { ascending: false } as const;

  // One page of the feed (plus one row to tell whether an older page
  // exists). Page numbers count every story, so page 2 starts at story 13
  // whatever Featured moved to the top of page 1.
  let feedQuery = live();
  if (filters.format) feedQuery = feedQuery.eq("format", filters.format);
  if (filters.region) feedQuery = feedQuery.eq("region", filters.region);
  if (filters.category) feedQuery = feedQuery.eq("category_id", filters.category);
  const from = (filters.page - 1) * NEWS_PAGE_SIZE;

  const results = await Promise.all([
    feedQuery
      .order("published_at", newest)
      .order("id", { ascending: true })
      .range(from, from + NEWS_PAGE_SIZE),
    filters.frontPage
      ? live()
          .eq("is_featured", true)
          .order("featured_rank", { ascending: true, nullsFirst: false })
          .order("published_at", newest)
          .limit(NEWS_SECTION_LIMITS.featured)
      : Promise.resolve({ data: [], error: null }),
    live()
      .eq("is_featured", false)
      .gte("published_at", trendingSince)
      .order("published_at", newest)
      .order("id", { ascending: true })
      .limit(NEWS_SECTION_LIMITS.trending),
    live().eq("format", "video").order("published_at", newest).limit(NEWS_SECTION_LIMITS.videos),
  ]);

  const error = results.some((result) => Boolean(result.error));
  const [feedRows, featuredRows, trendingRows, videos] = results.map(
    (result) => (result.data ?? []) as unknown as NewsCardData[],
  );

  const hasOlder = feedRows.length > NEWS_PAGE_SIZE;
  const featuredIds = new Set(featuredRows.map((article) => article.id));
  const feed = [
    ...featuredRows,
    ...feedRows.slice(0, NEWS_PAGE_SIZE).filter((article) => !featuredIds.has(article.id)),
  ];
  // Too few to be worth a list: no Trending at all.
  const trending = trendingRows.length >= NEWS_TRENDING_MIN ? trendingRows : [];

  const unique = new Map<string, NewsCardData>();
  for (const article of [...feed, ...trending, ...videos]) unique.set(article.id, article);
  const media = await fetchCardMedia(supabase, [...unique.values()]);

  return { feed, hasOlder, trending, videos, media, error };
}
