import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CirclePlay, Cpu, Images, Newspaper, Scale, Star, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { fetchRecentMarketPrices, type MarketPriceCard } from "@/lib/marketPrices";
import {
  NEWS_FORMAT_FILTER_LABELS,
  NEWS_REGION_LABELS,
  buildNewsHref,
  formatNewsToday,
  isNewsFormat,
  isNewsRegion,
  parseNewsPage,
  type NewsCardData,
  type NewsHrefParams,
} from "@/lib/news";
import { FeaturedNewsCard } from "./FeaturedNewsCard";
import { MarketsPanel } from "./MarketsPanel";
import { NewsCard } from "./NewsCard";
import { NewsBrowseAll, NewsFilters } from "./NewsFilters";
import { NewsHeader } from "./NewsHeader";
import { NewsJoinCallout } from "./NewsJoinCallout";
import { NewsSection } from "./NewsSection";
import { PhotoStoryCard } from "./PhotoStoryCard";
import { TrendingList } from "./TrendingList";
import { fetchNewsHome, fetchNewsList, type NewsCardMedia, type NewsHome } from "./newsData";
import { NEWS_FALLBACK_IMAGE, NEWS_SITE_NAME, newsSiteOrigin } from "./newsMetadata";

const TITLE = "Agriculture Today";
const DESCRIPTION = "Farming news from Kenya, Africa and the world: markets, farm technology, innovation and more.";

// How many live price cards a signed-in reader sees in Markets & Prices.
const MARKET_PRICE_CARDS = 4;

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

// /news -- Agriculture Today. Public: no sign-in redirect.
//
// The unfiltered first page is the front page, in this order: Trending,
// Featured, Watch, Photo Stories, Markets & Prices, Farm Tech & AI, then
// Latest with the filters. Each story appears once (see fetchNewsHome)
// and an empty section isn't shown; when every story is already in the
// sections, Latest becomes a compact "Browse all stories" row. A
// filtered view, page 2 onward, or ?view=all (that row's "More
// filters") is just the filters and one newest-first list.
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
  const isFrontPage = !isFiltered && page === 1 && !viewAll;

  let home: NewsHome | null = null;
  let list: { articles: NewsCardData[]; hasOlder: boolean; media: Map<string, NewsCardMedia>; error: boolean };
  // Live prices only for a signed-in reader (prices stay signed-in only);
  // null means "show the sign-in prompt".
  let prices: MarketPriceCard[] | null = null;

  if (isFrontPage) {
    const [homeResult, priceCards] = await Promise.all([
      fetchNewsHome(supabase, now),
      user ? fetchRecentMarketPrices(supabase) : Promise.resolve(null),
    ]);
    home = homeResult;
    prices = priceCards ? priceCards.slice(0, MARKET_PRICE_CARDS) : null;
    list = { articles: home.latest, hasOlder: home.hasOlder, media: home.media, error: home.error };
  } else {
    list = await fetchNewsList(supabase, now, { format, region, category, page });
  }

  const hasError = Boolean(categoriesError || list.error);
  const media = list.media;
  const filterLabel = [
    format ? NEWS_FORMAT_FILTER_LABELS[format] : null,
    region ? NEWS_REGION_LABELS[region] : null,
    category ? categories.find((c) => c.id === category)?.name : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-1 flex-col bg-shamba-bg">
      <NewsHeader signedIn={Boolean(user)} />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-12 px-6 pb-20 pt-8 sm:px-10 sm:pt-12">
        <div>
          <p className="font-mono text-xs font-medium uppercase tracking-wider text-shamba-ochre">
            {formatNewsToday(now)}
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold leading-tight tracking-tight text-shamba-ink sm:text-4xl">
            {TITLE}
          </h1>
          <p className="mt-2 max-w-2xl text-base leading-7 text-shamba-ink-soft">
            Farming news from Kenya, Africa and the world: markets and prices, farm technology, innovation and more.
          </p>
        </div>

        {hasError && (
          <p role="alert" className="rounded-shamba border border-shamba-line bg-shamba-card p-4 text-sm font-semibold text-shamba-rust">
            We couldn&apos;t load the news right now. Please check your connection and try again.
          </p>
        )}

        {!hasError && home && <FrontPageSections home={home} prices={prices} />}

        {!hasError && isFrontPage && list.articles.length === 0 && (
          <NewsBrowseAll olderHref={list.hasOlder ? buildNewsHref({}, { page: 2 }) : null} />
        )}

        {!hasError && !(isFrontPage && list.articles.length === 0) && (
          <NewsSection
            id="latest"
            title={isFiltered ? filterLabel : viewAll ? "All stories" : "Latest stories"}
            icon={Newspaper}
            tone="bg-shamba-green/10 text-shamba-green"
          >
            {page > 1 && <p className="-mt-2 font-mono text-xs text-shamba-ink-soft">Page {page}</p>}

            <NewsFilters current={current} categories={categories} />

            {list.articles.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {list.articles.map((article) => (
                  <NewsCard key={article.id} article={article} media={media.get(article.id)} />
                ))}
              </div>
            ) : (
              <div className="rounded-shamba border border-dashed border-shamba-line bg-shamba-card p-6 text-center">
                <p className="font-display text-base font-bold text-shamba-ink">
                  {isFiltered ? "No stories here yet" : page > 1 ? "No more stories" : "No stories yet"}
                </p>
                <p className="mt-1 text-sm leading-6 text-shamba-ink-soft">
                  {isFiltered
                    ? "Try another format, region or topic, or see all the news."
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

            {(page > 1 || list.hasOlder) && (
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
                {list.hasOlder && (
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
          </NewsSection>
        )}

        {!user && <NewsJoinCallout />}
      </main>
    </div>
  );
}

// Trending -> Featured -> Watch -> Photo Stories -> Markets & Prices ->
// Farm Tech & AI. On phones that's the reading order top to bottom.
//
// From md up, the top row is balanced: the lead Featured story beside
// Trending, both stretched to the same height -- 3:2 on tablets (so
// Trending's titles aren't squeezed), 2:1 from lg; any other Featured stories follow in a full-width row below --
// a lone one as a compact horizontal card, two side by side. This is CSS
// grid placement only, so the document (and screen-reader) order stays
// Trending, Featured, more Featured.
function FrontPageSections({ home, prices }: { home: NewsHome; prices: MarketPriceCard[] | null }) {
  const { trending, featured, watch, photoStories, markets, farmTech, media } = home;
  const [lead, ...moreFeatured] = featured;
  const both = trending.length > 0 && Boolean(lead);

  return (
    <>
      {(trending.length > 0 || lead) && (
        <div className="grid grid-cols-1 gap-y-12 md:grid-cols-5 md:gap-x-6 md:gap-y-6 lg:grid-cols-3 lg:gap-x-8">
          {trending.length > 0 && (
            <NewsSection
              id="trending"
              title="Trending"
              icon={TrendingUp}
              tone="bg-shamba-ochre/15 text-shamba-ochre"
              className={
                both
                  ? "md:col-span-2 md:col-start-4 md:row-start-1 lg:col-span-1 lg:col-start-3"
                  : "md:col-span-5 lg:col-span-3"
              }
            >
              <TrendingList articles={trending} />
            </NewsSection>
          )}

          {lead && (
            <NewsSection
              id="featured"
              title="Featured"
              icon={Star}
              tone="bg-shamba-green/10 text-shamba-green"
              className={
                both
                  ? "md:col-span-3 md:col-start-1 md:row-start-1 lg:col-span-2"
                  : "md:col-span-5 lg:col-span-3"
              }
            >
              <FeaturedNewsCard article={lead} media={media.get(lead.id)} className="flex-1" />
            </NewsSection>
          )}

          {moreFeatured.length > 0 && (
            // Still the editor's Featured picks, just laid out below the
            // top row. -mt-8 pulls it up to the lead card on phones (the
            // grid's 48px section gap is meant for separate sections).
            <section aria-label="More featured stories" className="-mt-8 md:col-span-5 md:mt-0 lg:col-span-3">
              {moreFeatured.length === 1 ? (
                <NewsCard article={moreFeatured[0]} media={media.get(moreFeatured[0].id)} layout="horizontal" />
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {moreFeatured.map((article) => (
                    <NewsCard key={article.id} article={article} media={media.get(article.id)} />
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {watch.length > 0 && (
        <NewsSection
          id="watch"
          title="Watch"
          icon={CirclePlay}
          tone="bg-shamba-rust/10 text-shamba-rust"
          seeAllHref={buildNewsHref({}, { format: "video" })}
          seeAllLabel="All videos"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {watch.map((article) => (
              <NewsCard key={article.id} article={article} media={media.get(article.id)} />
            ))}
          </div>
        </NewsSection>
      )}

      {photoStories.length > 0 && (
        <NewsSection
          id="photo-stories"
          title="Photo Stories"
          icon={Images}
          tone="bg-shamba-ochre/15 text-shamba-ochre"
          seeAllHref={buildNewsHref({}, { format: "photo_story" })}
          seeAllLabel="All photo stories"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {photoStories.map((article) => (
              <PhotoStoryCard key={article.id} article={article} media={media.get(article.id)} />
            ))}
          </div>
        </NewsSection>
      )}

      <NewsSection
        id="markets"
        title="Markets & Prices"
        icon={Scale}
        tone="bg-shamba-blue/10 text-shamba-blue"
        seeAllHref={buildNewsHref({}, { category: "markets-prices" })}
        seeAllLabel="Market news"
      >
        <MarketsPanel prices={prices} />
        {markets.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {markets.map((article) => (
              <NewsCard key={article.id} article={article} media={media.get(article.id)} />
            ))}
          </div>
        )}
      </NewsSection>

      {farmTech.length > 0 && (
        <NewsSection id="farm-tech" title="Farm Tech & AI" icon={Cpu} tone="bg-shamba-green/10 text-shamba-green">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {farmTech.map((article) => (
              <NewsCard key={article.id} article={article} media={media.get(article.id)} />
            ))}
          </div>
        </NewsSection>
      )}
    </>
  );
}
