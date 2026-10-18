import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  formatNewsAgo,
  formatNewsDate,
  newsArticlePath,
  newsCredit,
  newsPlaceLabel,
  type NewsCardData,
} from "@/lib/news";
import { NewsFormatBadge } from "./NewsFormatBadge";
import { NEWS_REGION_TONE } from "./NewsRegionMark";
import { NewsStoryPicture } from "./NewsStoryPicture";
import type { NewsCardMedia } from "./newsData";

// One story in the Latest feed: a big picture (or the region panel) with
// the region tag, then source and time, headline, summary and "Read full
// story". Side by side on a large phone and from lg up; stacked on a
// small phone and on a tablet, where the sidebar narrows the feed. The whole card
// opens the article page -- where the reader finds the full summary, the
// YouTube player and the link to the original: the title link is
// stretched over the card, and "Read full story" is just its visible cue
// (one link per card, nothing nested).
export function NewsStoryRow({
  article,
  media,
  now,
  priority = false,
}: {
  article: NewsCardData;
  media: NewsCardMedia | undefined;
  now: Date;
  priority?: boolean;
}) {
  const credit = newsCredit(article);

  return (
    <article className="group relative grid grid-cols-1 gap-4 rounded-shamba border border-shamba-line bg-shamba-card p-3 transition-colors hover:border-shamba-green has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-shamba-green sm:grid-cols-[minmax(0,9fr)_minmax(0,11fr)] sm:gap-5 sm:p-4 md:grid-cols-1 lg:grid-cols-[minmax(0,9fr)_minmax(0,11fr)]">
      <NewsStoryPicture
        article={article}
        media={media}
        priority={priority}
        className="aspect-video w-full sm:aspect-auto sm:h-full sm:min-h-52 md:aspect-video md:h-auto md:min-h-0 lg:aspect-auto lg:h-full lg:min-h-52"
      >
        <span
          className={`absolute left-3 top-3 rounded-md px-2.5 py-1 font-mono text-xs font-semibold uppercase tracking-wider ${NEWS_REGION_TONE[article.region].tag}`}
        >
          {newsPlaceLabel(article.region, article.counties?.name)}
        </span>
      </NewsStoryPicture>

      <div className="flex min-w-0 flex-col gap-2 px-1 pb-1 sm:px-0 sm:py-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-shamba-ink-soft">
          {credit && (
            <>
              <span className="font-semibold text-shamba-ink">{credit}</span>
              <span aria-hidden="true">·</span>
            </>
          )}
          <time dateTime={article.published_at} title={formatNewsDate(article.published_at)}>
            {formatNewsAgo(article.published_at, now)}
          </time>
          <NewsFormatBadge format={article.format} />
        </p>

        <h3 className="font-display text-xl font-bold leading-snug text-shamba-ink sm:text-2xl sm:leading-tight">
          <Link
            href={newsArticlePath(article.slug)}
            className="rounded-shamba after:absolute after:inset-0 after:rounded-shamba focus-visible:outline-none group-hover:text-shamba-green-deep"
          >
            {article.title}
          </Link>
        </h3>

        <p className="line-clamp-3 text-sm leading-6 text-shamba-ink-soft sm:text-base">{article.summary}</p>

        <span
          aria-hidden="true"
          className="mt-auto inline-flex min-h-10 w-fit items-center gap-2 rounded-shamba bg-shamba-green px-4 font-sans text-sm font-semibold text-shamba-card transition-colors group-hover:bg-shamba-green-deep"
        >
          Read full story
          <ArrowRight className="size-4" />
        </span>
      </div>
    </article>
  );
}
