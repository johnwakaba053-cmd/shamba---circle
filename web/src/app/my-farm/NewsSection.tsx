import Link from "next/link";
import { ChevronRight, Newspaper } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatNewsDate, newsArticlePath, type NewsCardData } from "@/lib/news";
import { fetchCardMedia, liveNewsArticles, type NewsCardMedia } from "@/app/news/newsData";
import { DashboardCard, EmptyLine } from "./DashboardCard";
import { FarmNewsThumb } from "./FarmNewsThumb";

// My Farm's news: the newest live Agriculture Today stories, by the same
// "live" rule as the News page (liveNewsArticles: published, publish time
// reached, not expired). Stories aren't tagged by crop yet and none carry
// a county, so this is honestly labelled "Latest news", not "for you".
// Each story gets a small square picture chosen exactly as on /news (see
// FarmNewsThumb), from the same fetchCardMedia() load: one news_media
// query and one signed-URL request for all the stories together.

const MAX_STORIES = 3;

export type FarmNewsResult =
  | { ok: true; stories: NewsCardData[]; media: Map<string, NewsCardMedia> }
  | { ok: false };

export async function loadFarmNews(): Promise<FarmNewsResult> {
  try {
    const supabase = await createClient();
    const { data, error } = await liveNewsArticles(supabase, new Date().toISOString())
      .order("published_at", { ascending: false })
      .limit(MAX_STORIES);
    if (error) {
      console.error("[my-farm] news unavailable:", error.message);
      return { ok: false };
    }
    const stories = (data ?? []) as unknown as NewsCardData[];

    // Pictures are extra: if they can't be loaded, the stories still show,
    // each with its plain topic panel.
    let media = new Map<string, NewsCardMedia>();
    try {
      media = await fetchCardMedia(supabase, stories);
    } catch (err) {
      console.error("[my-farm] news pictures unavailable:", err instanceof Error ? err.message : err);
    }

    return { ok: true, stories, media };
  } catch (err) {
    console.error("[my-farm] news unavailable:", err instanceof Error ? err.message : err);
    return { ok: false };
  }
}

export async function NewsSection({ news }: { news: Promise<FarmNewsResult> }) {
  return <NewsCard result={await news} />;
}

export function NewsCard({ result }: { result: FarmNewsResult }) {
  return (
    <DashboardCard
      icon={Newspaper}
      tone="bg-shamba-blue/10 text-shamba-blue"
      title="Latest news"
      subtitle="From Agriculture Today"
      href="/news"
      linkLabel="All news"
    >
      {!result.ok ? (
        <EmptyLine href="/news" linkLabel="Open Agriculture Today">
          We couldn&apos;t load the news right now.
        </EmptyLine>
      ) : result.stories.length === 0 ? (
        <EmptyLine>No stories have been published yet.</EmptyLine>
      ) : (
        <ul className="-my-3 flex flex-col divide-y divide-shamba-line">
          {result.stories.map((story) => (
            <li key={story.slug}>
              <Link
                href={newsArticlePath(story.slug)}
                className="group flex min-h-11 items-center gap-3 rounded-xl py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-shamba-green"
              >
                <FarmNewsThumb article={story} media={result.media.get(story.id)} />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="line-clamp-2 text-sm font-semibold leading-5 text-shamba-ink transition-colors group-hover:text-shamba-green">
                    {story.title}
                  </span>
                  <span className="font-mono text-xs font-medium text-shamba-ink-soft">
                    {formatNewsDate(story.published_at)}
                  </span>
                </span>
                <ChevronRight
                  className="size-4 shrink-0 text-shamba-ink-soft transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}
