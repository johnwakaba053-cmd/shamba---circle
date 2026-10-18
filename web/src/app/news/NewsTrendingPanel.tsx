import Link from "next/link";
import { Flame } from "lucide-react";
import { formatNewsAgo, formatNewsDate, newsArticlePath, newsCredit, type NewsCardData } from "@/lib/news";
import { NewsStoryPicture } from "./NewsStoryPicture";
import type { NewsCardMedia } from "./newsData";

// Trending in Agriculture, in the /news sidebar: a numbered list -- the
// newest stories of the last 72 hours (NEWS_TRENDING_*), not view counts,
// which aren't tracked. The top three numbers are filled in ochre. Each
// row is one link with a 44px minimum height.
export function NewsTrendingPanel({
  articles,
  media,
  now,
}: {
  articles: NewsCardData[];
  media: Map<string, NewsCardMedia>;
  now: Date;
}) {
  return (
    <section
      aria-labelledby="news-trending-heading"
      className="rounded-shamba border border-shamba-line bg-shamba-card p-4 sm:p-5"
    >
      <h2 id="news-trending-heading" className="flex items-center gap-2 font-display text-xl font-bold text-shamba-ink">
        <Flame className="size-5 text-shamba-rust" aria-hidden="true" />
        Trending in Agriculture
      </h2>

      <ol className="mt-2 divide-y divide-shamba-line">
        {articles.map((article, index) => {
          const credit = newsCredit(article);
          return (
            <li key={article.id}>
              <Link
                href={newsArticlePath(article.slug)}
                className="group -mx-2 flex min-h-11 items-center gap-3 rounded-shamba px-2 py-3 transition-colors hover:bg-shamba-bg focus-visible:outline-2 focus-visible:outline-shamba-green"
              >
                <span
                  aria-hidden="true"
                  className={`flex size-7 shrink-0 items-center justify-center rounded-full font-mono text-sm font-semibold ${
                    index < 3 ? "bg-shamba-ochre text-shamba-ink" : "border border-shamba-line text-shamba-ink-soft"
                  }`}
                >
                  {index + 1}
                </span>
                <NewsStoryPicture
                  article={article}
                  media={media.get(article.id)}
                  size="small"
                  className="aspect-[4/3] w-20 shrink-0"
                />
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="line-clamp-3 font-display text-sm font-bold leading-snug text-shamba-ink group-hover:text-shamba-green-deep">
                    {article.title}
                  </span>
                  <span className="font-mono text-xs text-shamba-ink-soft">
                    {credit && <>{credit} · </>}
                    <time dateTime={article.published_at} title={formatNewsDate(article.published_at)}>
                      {formatNewsAgo(article.published_at, now)}
                    </time>
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
