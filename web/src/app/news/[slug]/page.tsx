import type { Metadata } from "next";
import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { fetchMarketPricesForProducts, type MarketPriceCard } from "@/lib/marketPrices";
import {
  NEWS_CATEGORY_FALLBACK_ICON,
  NEWS_CATEGORY_ICON,
  buildNewsHref,
  formatNewsDate,
  isNewsSlug,
  newsArticlePath,
  newsCoverUrl,
  newsDisplayStatus,
  newsPlaceLabel,
  parseNewsBody,
  safeExternalUrl,
  type NewsCardData,
  type NewsFormat,
  type NewsOrigin,
  type NewsRegion,
  type NewsStatus,
} from "@/lib/news";
import {
  formatVideoDuration,
  getYouTubeThumbnailUrl,
  getYouTubeWatchUrl,
  isYouTubeVideoId,
} from "@/lib/youtube";
import { NewsCard } from "../NewsCard";
import { NewsCoverImage } from "../NewsCoverImage";
import { NewsFormatBadge } from "../NewsFormatBadge";
import { NewsHeader } from "../NewsHeader";
import { NewsJoinCallout } from "../NewsJoinCallout";
import { NewsPricePanel } from "../NewsPricePanel";
import { NewsStatusBadge } from "../NewsStatusBadge";
import { PhotoStoryGallery, type PhotoStoryPhoto } from "../PhotoStoryGallery";
import { YouTubeFacade } from "../YouTubeFacade";
import { fetchCardMedia, liveNewsArticles } from "../newsData";
import { NEWS_FALLBACK_IMAGE, NEWS_SITE_NAME, newsSiteOrigin, previewText } from "../newsMetadata";

type NewsArticleDetail = {
  id: string;
  slug: string;
  category_id: string;
  region: NewsRegion;
  format: NewsFormat;
  byline: string | null;
  title: string;
  summary: string;
  body: string | null;
  origin: NewsOrigin;
  external_url: string | null;
  cover_image_path: string | null;
  cover_image_alt: string | null;
  cover_image_credit: string | null;
  status: NewsStatus;
  published_at: string | null;
  expires_at: string | null;
  updated_at: string;
  news_categories: { name: string } | null;
  news_sources: { name: string; url: string | null } | null;
  counties: { name: string } | null;
};

type MediaRow = {
  id: string;
  kind: "image" | "video_embed";
  storage_path: string | null;
  embed_id: string | null;
  alt: string | null;
  caption: string | null;
  credit: string | null;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
};

const DETAIL_COLUMNS =
  "id, slug, category_id, region, format, byline, title, summary, body, origin, external_url, cover_image_path, cover_image_alt, cover_image_credit, status, published_at, expires_at, updated_at, news_categories(name), news_sources(name, url), counties(name)";

type NewsArticlePageProps = { params: Promise<{ slug: string }> };

// One lookup per request, shared by generateMetadata and the page: the
// article and its media (N4). RLS decides what comes back: readers get
// live articles (and their media) only; admins also get drafts,
// scheduled, expired and archived ones (shown with a status badge and
// kept out of search engines).
const loadArticle = cache(async (slug: string) => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isNewsSlug(slug)) {
    return { supabase, user, article: null, photos: [], videoId: null, durationSeconds: null, error: false };
  }

  const { data, error } = await supabase
    .from("news_articles")
    .select(DETAIL_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();
  const article = data as unknown as NewsArticleDetail | null;

  let photos: PhotoStoryPhoto[] = [];
  let videoId: string | null = null;
  let durationSeconds: number | null = null;

  if (article && (article.format === "photo_story" || article.format === "video")) {
    const { data: mediaRows } = await supabase
      .from("news_media")
      .select("id, kind, storage_path, embed_id, alt, caption, credit, width, height, duration_seconds")
      .eq("article_id", article.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    for (const row of (mediaRows ?? []) as MediaRow[]) {
      if (row.kind === "video_embed" && !videoId && isYouTubeVideoId(row.embed_id)) {
        videoId = row.embed_id;
        durationSeconds = row.duration_seconds;
      } else if (row.kind === "image") {
        const url = newsCoverUrl(row.storage_path);
        // N4 requires alt and credit on every image; skip a row that
        // somehow lacks them rather than show an uncredited photo.
        if (url && row.alt && row.credit) {
          photos.push({
            id: row.id,
            url,
            alt: row.alt,
            caption: row.caption,
            credit: row.credit,
            width: row.width,
            height: row.height,
          });
        }
      }
    }

    // Only a photo story shows a gallery (the database only allows
    // images there anyway, but the page doesn't rely on that).
    if (article.format !== "photo_story") photos = [];
  }

  return { supabase, user, article, photos, videoId, durationSeconds, error: Boolean(error) };
});

export async function generateMetadata({ params }: NewsArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const [{ article, photos, videoId }, origin] = await Promise.all([loadArticle(slug), newsSiteOrigin()]);

  if (!article) {
    return { title: `Agriculture Today — ${NEWS_SITE_NAME}`, robots: { index: false, follow: false } };
  }

  const canonical = newsArticlePath(article.slug);
  const isLive = newsDisplayStatus(article) === "live";
  const title = article.title;
  const description = previewText(article.summary);

  // Share picture: the cover, else a photo story's first photo, else the
  // video's YouTube still, else the app icon.
  const cover = newsCoverUrl(article.cover_image_path);
  const picture = cover
    ? { url: cover, alt: article.cover_image_alt ?? article.title }
    : photos[0]
      ? { url: photos[0].url, alt: photos[0].alt }
      : videoId
        ? { url: getYouTubeThumbnailUrl(videoId), alt: article.title }
        : null;
  const image = picture ?? NEWS_FALLBACK_IMAGE;

  return {
    metadataBase: new URL(origin),
    title: `${title} — Agriculture Today`,
    description,
    alternates: { canonical },
    // An admin previewing an unpublished article: never indexed.
    robots: isLive ? undefined : { index: false, follow: false },
    openGraph: {
      type: "article",
      siteName: NEWS_SITE_NAME,
      url: canonical,
      title,
      description,
      publishedTime: article.published_at ?? undefined,
      modifiedTime: article.updated_at,
      section: article.news_categories?.name,
      authors: article.byline ? [article.byline] : undefined,
      images: [image],
    },
    twitter: {
      card: picture ? "summary_large_image" : "summary",
      title,
      description,
      images: [image.url],
    },
  };
}

export default async function NewsArticlePage({ params }: NewsArticlePageProps) {
  const { slug } = await params;
  const { supabase, user, article, photos, videoId, durationSeconds, error } = await loadArticle(slug);

  if (!error && !article) {
    notFound();
  }

  const status = article ? newsDisplayStatus(article) : "live";
  const Icon = (article && NEWS_CATEGORY_ICON[article.category_id]) ?? NEWS_CATEGORY_FALLBACK_ICON;
  const blocks = parseNewsBody(article?.body ?? null);
  const externalUrl = safeExternalUrl(article?.external_url ?? null);
  const sourceUrl = safeExternalUrl(article?.news_sources?.url ?? null);
  const sourceName = article?.news_sources?.name;
  const isVideo = article?.format === "video" && Boolean(videoId);

  // "More from <topic>" (up to three other live stories in the same
  // topic) and, for a market update, the linked products' live prices --
  // signed-in only (prices stay protected); null means "show the
  // sign-in prompt".
  let related: NewsCardData[] = [];
  let prices: MarketPriceCard[] | null = null;
  if (article) {
    const [relatedResult, priceCards] = await Promise.all([
      liveNewsArticles(supabase, new Date().toISOString())
        .eq("category_id", article.category_id)
        .neq("id", article.id)
        .order("published_at", { ascending: false })
        .limit(3),
      article.format === "market_update" && user
        ? supabase
            .from("news_article_price_products")
            .select("product_id")
            .eq("article_id", article.id)
            .order("sort_order", { ascending: true })
            .then(({ data }) =>
              fetchMarketPricesForProducts(
                supabase,
                (data ?? []).map((row) => row.product_id as string),
              ),
            )
        : Promise.resolve(null),
    ]);
    related = (relatedResult.data ?? []) as unknown as NewsCardData[];
    prices = priceCards;
  }
  const relatedMedia = await fetchCardMedia(supabase, related);

  return (
    <div className="flex flex-1 flex-col bg-shamba-bg">
      <NewsHeader signedIn={Boolean(user)} />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center gap-10 px-6 pb-20 pt-6 sm:px-10 sm:pt-10">
        <div className="w-full max-w-2xl">
          <Link
            href="/news"
            className="relative touch-target inline-flex items-center gap-2 font-sans text-sm font-semibold text-shamba-ink-soft transition-colors hover:text-shamba-ink"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Agriculture Today
          </Link>
        </div>

        {error && (
          <p
            role="alert"
            className="w-full max-w-2xl rounded-shamba border border-shamba-line bg-shamba-card p-4 text-sm font-semibold text-shamba-rust"
          >
            We couldn&apos;t load this story right now. Please check your connection and try again.
          </p>
        )}

        {!error && article && (
          <article className="w-full max-w-2xl">
            {status !== "live" && (
              // Only admins can reach a non-live article (RLS).
              <div className="mb-5 flex flex-wrap items-center gap-3 rounded-shamba border border-shamba-line bg-shamba-card p-3">
                <NewsStatusBadge status={status} />
                <p className="text-sm text-shamba-ink-soft">
                  {status === "scheduled" && article.published_at
                    ? `Admin preview. Goes live on ${formatNewsDate(article.published_at)}.`
                    : "Admin preview. Readers can't see this story."}
                </p>
              </div>
            )}

            <header className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Link
                  href={buildNewsHref({}, { category: article.category_id })}
                  className="relative touch-target inline-flex items-center gap-1.5 rounded-shamba font-mono text-xs font-semibold text-shamba-green transition-colors hover:text-shamba-green-deep"
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {article.news_categories?.name ?? "News"}
                </Link>
                <Link
                  href={buildNewsHref({}, { region: article.region })}
                  className="relative touch-target rounded-shamba font-mono text-xs text-shamba-ink-soft transition-colors hover:text-shamba-ink"
                >
                  {newsPlaceLabel(article.region, article.counties?.name)}
                </Link>
                <NewsFormatBadge format={article.format} />
                {article.origin === "shamba_original" && (
                  <span className="rounded-full bg-shamba-green px-2.5 py-0.5 font-mono text-xs font-semibold text-shamba-card">
                    Shamba Space Original
                  </span>
                )}
              </div>

              <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-shamba-ink sm:text-4xl">
                {article.title}
              </h1>

              <p className="text-lg leading-8 text-shamba-ink-soft">{article.summary}</p>

              <p className="font-mono text-xs text-shamba-ink-soft">
                {[
                  article.published_at ? formatNewsDate(article.published_at) : null,
                  article.byline ? `By ${article.byline}` : null,
                  sourceName,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </header>

            {/* A video story leads with its player; anything else with its
                cover. */}
            {isVideo && videoId ? (
              <div className="mt-6 flex flex-col gap-2">
                <YouTubeFacade
                  videoId={videoId}
                  title={article.title}
                  durationLabel={formatVideoDuration(durationSeconds)}
                />
                <a
                  href={getYouTubeWatchUrl(videoId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative touch-target inline-flex w-fit items-center gap-1.5 rounded-shamba font-sans text-sm font-semibold text-shamba-ink-soft transition-colors hover:text-shamba-ink"
                >
                  Watch on YouTube
                  <ExternalLink className="size-4" aria-hidden="true" />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              </div>
            ) : (
              article.cover_image_path && (
                <figure className="mt-6">
                  <NewsCoverImage path={article.cover_image_path} alt={article.cover_image_alt} priority />
                  {article.cover_image_credit && (
                    <figcaption className="mt-2 font-mono text-xs text-shamba-ink-soft">
                      Photo: {article.cover_image_credit}
                    </figcaption>
                  )}
                </figure>
              )
            )}

            {blocks.length > 0 && (
              <div className="mt-8 flex flex-col gap-5 border-t border-shamba-line pt-8">
                {blocks.map((block, index) =>
                  block.kind === "heading" ? (
                    <h2 key={index} className="mt-2 font-display text-xl font-bold text-shamba-ink">
                      {block.text}
                    </h2>
                  ) : (
                    <p key={index} className="whitespace-pre-line text-base leading-7 text-shamba-ink">
                      {block.text}
                    </p>
                  ),
                )}
              </div>
            )}

            {photos.length > 0 && <PhotoStoryGallery photos={photos} />}

            {article.format === "market_update" && <NewsPricePanel prices={prices} />}

            {/* A linked story's full text lives on the publisher's site
                (N1: external_linked articles have no body). Opened in a
                new tab, https only (safeExternalUrl). */}
            {externalUrl && (
              <div className={blocks.length > 0 || photos.length > 0 ? "mt-8" : "mt-8 border-t border-shamba-line pt-8"}>
                <a
                  href={externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 rounded-shamba bg-shamba-green px-5 font-sans text-sm font-semibold text-shamba-card transition-colors hover:bg-shamba-green-deep"
                >
                  {article.origin === "external_linked"
                    ? sourceName
                      ? `Read the full story on ${sourceName}`
                      : "Read the full story"
                    : "View the original source"}
                  <ExternalLink className="size-4" aria-hidden="true" />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              </div>
            )}

            {sourceName && (
              <p className="mt-8 border-t border-shamba-line pt-4 text-sm text-shamba-ink-soft">
                Source:{" "}
                {sourceUrl ? (
                  <a
                    href={sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-shamba-blue transition-colors hover:text-shamba-green-deep"
                  >
                    {sourceName}
                  </a>
                ) : (
                  <span className="font-semibold text-shamba-ink">{sourceName}</span>
                )}
              </p>
            )}
          </article>
        )}

        {!error && article && related.length > 0 && (
          <section aria-labelledby="news-related-heading" className="flex w-full flex-col gap-4">
            <h2 id="news-related-heading" className="font-display text-xl font-bold text-shamba-ink">
              More from {article.news_categories?.name ?? "Agriculture Today"}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((item) => (
                <NewsCard key={item.id} article={item} media={relatedMedia.get(item.id)} />
              ))}
            </div>
          </section>
        )}

        {!user && (
          <div className="w-full">
            <NewsJoinCallout />
          </div>
        )}
      </main>
    </div>
  );
}
