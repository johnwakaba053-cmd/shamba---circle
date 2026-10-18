import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { createClient } from "@/lib/supabase/server";
import {
  NEWS_FORMAT_FILTER_LABELS,
  NEWS_REGION_LABELS,
  buildNewsHref,
  isNewsFormat,
  isNewsRegion,
  parseNewsPage,
  type NewsHrefParams,
  type NewsRegion,
} from "@/lib/news";
import { NewsByRegion } from "./NewsByRegion";
import { NewsFilters } from "./NewsFilters";
import { NewsHero } from "./NewsHero";
import { NewsRegionTabs } from "./NewsRegionTabs";
import { NewsStoryRow } from "./NewsStoryRow";
import { NewsTrendingPanel } from "./NewsTrendingPanel";
import { NewsVideosPanel } from "./NewsVideosPanel";
import { fetchNewsFront } from "./newsData";
import { NEWS_FALLBACK_IMAGE, NEWS_SITE_NAME, newsSiteOrigin } from "./newsMetadata";

const TITLE = "Agriculture Today";
const DESCRIPTION = "Farming news from Kenya, Africa and the world: markets, farm technology, innovation and more.";

// The line under the feed's heading on the Latest and region tabs.
const FEED_INTRO: Record<NewsRegion | "latest", string> = {
  latest: "Current agribusiness and farming news from Kenya, Africa and around the world.",
  kenya: "Farming and agribusiness news from across Kenya.",
  africa: "Farming and agribusiness news from across Africa.",
  global: "Farming and agribusiness news from around the world.",
};

export async function generateMetadata(): Promise<Metadata> {
  const origin = await newsSiteOrigin();
  const title = `${TITLE} — ${NEWS_SITE_NAME}`;

  return {
    metadataBase: new URL(origin),
    title,
    description: DESCRIPTION,
    alternates: { canonical: "/news" },
    openGraph: {
      type: "website",
      siteName: NEWS_SITE_NAME,
      url: "/news",
      title,
      description: DESCRIPTION,
      images: [NEWS_FALLBACK_IMAGE],
    },
    twitter: { card: "summary", title, description: DESCRIPTION, images: [NEWS_FALLBACK_IMAGE.url] },
  };
}

// /news -- Agriculture Today. Members only, like the rest of the app:
// signed-out visitors go to sign-in.
//
// Laid out like a news front page: the Agriculture Today banner, the
// Latest / Kenya / Africa / Global tabs, then the story feed beside a
// sidebar of Trending in Agriculture, Videos and By Region (below the
// feed on phones). The feed is Latest -- on the unfiltered
// first page the editor's Featured stories lead it -- or a region tab,
// or whatever the filters pick, newest first, with paging. Only live
// stories ever show (fetchNewsFront); drafts stay on /admin/news.
export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<{ format?: string; region?: string; category?: string; page?: string; view?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const now = new Date();

  const { data: categoryRows, error: categoriesError } = await supabase
    .from("news_categories")
    .select("id, name")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  const categories = categoryRows ?? [];

  // Only trust filter values that match something real; anything else is
  // treated as no filter.
  const format = isNewsFormat(params.format) ? params.format : undefined;
  const region = isNewsRegion(params.region) ? params.region : undefined;
  const category = categories.some((c) => c.id === params.category) ? params.category : undefined;
  const page = parseNewsPage(params.page);
  const current: NewsHrefParams = { format, region, category, page };
  const isFiltered = Boolean(format || region || category);
  const viewAll = params.view === "all";
  const frontPage = !isFiltered && page === 1 && !viewAll;

  const front = await fetchNewsFront(supabase, now, { format, region, category, page, frontPage });
  const hasError = Boolean(categoriesError || front.error);
  const { feed, media } = front;

  // A region tab reads "Kenya Agriculture News"; any other filter is
  // named the way the filters name it.
  const byFormatOrTopic = Boolean(format || category);
  const feedTitle = byFormatOrTopic
    ? [
        format ? NEWS_FORMAT_FILTER_LABELS[format] : null,
        region ? NEWS_REGION_LABELS[region] : null,
        category ? categories.find((c) => c.id === category)?.name : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : region
      ? `${NEWS_REGION_LABELS[region]} Agriculture News`
      : viewAll
        ? "All stories"
        : "Latest Agriculture News";
  const feedIntro = byFormatOrTopic ? null : FEED_INTRO[region ?? "latest"];

  return (
    <div className="flex flex-1 flex-col bg-shamba-bg">
      <AppHeader />
      <NewsHero now={now} />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 pb-20 pt-6 sm:px-10">
        <NewsRegionTabs region={region} />

        {hasError && (
          <p role="alert" className="rounded-shamba border border-shamba-line bg-shamba-card p-4 text-sm font-semibold text-shamba-rust">
            We couldn&apos;t load the news right now. Please check your connection and try again.
          </p>
        )}

        {!hasError && (
          <div className="grid grid-cols-1 gap-10 md:grid-cols-[minmax(0,1fr)_16rem] md:gap-6 lg:grid-cols-3 lg:gap-8">
            <section aria-labelledby="news-feed-heading" className="flex min-w-0 flex-col gap-5 lg:col-span-2">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <h2
                    id="news-feed-heading"
                    className="font-display text-2xl font-bold leading-tight tracking-tight text-shamba-ink sm:text-3xl"
                  >
                    {feedTitle}
                  </h2>
                  <NewsFilters current={current} categories={categories} />
                </div>
                {feedIntro && <p className="mt-1 text-base leading-7 text-shamba-ink-soft">{feedIntro}</p>}
                {page > 1 && <p className="mt-1 font-mono text-xs text-shamba-ink-soft">Page {page}</p>}
              </div>

              {feed.length > 0 ? (
                <div className="flex flex-col gap-4">
                  {feed.map((article, index) => (
                    <NewsStoryRow
                      key={article.id}
                      article={article}
                      media={media.get(article.id)}
                      now={now}
                      priority={index === 0}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-shamba border border-dashed border-shamba-line bg-shamba-card p-6 text-center">
                  <p className="font-display text-base font-bold text-shamba-ink">
                    {isFiltered ? "No stories here yet" : page > 1 ? "No more stories" : "No stories yet"}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-shamba-ink-soft">
                    {isFiltered
                      ? "Try another region, format or topic, or see all the news."
                      : "New farming stories appear here as soon as they're published."}
                  </p>
                  {isFiltered && (
                    <Link
                      href="/news"
                      className="mt-4 inline-flex min-h-11 items-center justify-center rounded-shamba border border-shamba-line px-4 font-sans text-sm font-semibold text-shamba-ink transition-colors hover:bg-shamba-bg"
                    >
                      See all news
                    </Link>
                  )}
                </div>
              )}

              {(page > 1 || front.hasOlder) && (
                <nav aria-label="More stories" className="flex flex-wrap items-center justify-between gap-3">
                  {page > 1 ? (
                    <Link
                      href={buildNewsHref(current, { page: page - 1 })}
                      className="inline-flex min-h-11 items-center gap-2 rounded-shamba border border-shamba-line px-4 font-sans text-sm font-semibold text-shamba-ink transition-colors hover:bg-shamba-card"
                    >
                      <ArrowLeft className="size-4" aria-hidden="true" />
                      Newer stories
                    </Link>
                  ) : (
                    <span />
                  )}
                  {front.hasOlder && (
                    <Link
                      href={buildNewsHref(current, { page: page + 1 })}
                      className="inline-flex min-h-11 items-center gap-2 rounded-shamba border border-shamba-line px-4 font-sans text-sm font-semibold text-shamba-ink transition-colors hover:bg-shamba-card"
                    >
                      Older stories
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </Link>
                  )}
                </nav>
              )}
            </section>

            {/* The sidebar, on the right from md up: the same on every view.
                Trending hides when too few stories qualify; Videos and By
                Region always show. */}
            <div className="flex min-w-0 flex-col gap-6">
              {front.trending.length > 0 && (
                <NewsTrendingPanel articles={front.trending} media={media} now={now} />
              )}
              <NewsVideosPanel articles={front.videos} media={media} now={now} />
              <NewsByRegion />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
