import Link from "next/link";
import { ArrowRight, Clapperboard } from "lucide-react";
import {
  buildNewsHref,
  formatNewsAgo,
  formatNewsDate,
  newsArticlePath,
  newsCredit,
  type NewsCardData,
} from "@/lib/news";
import { NewsStoryPicture } from "./NewsStoryPicture";
import type { NewsCardMedia } from "./newsData";

// Videos, in the /news sidebar: the newest video story large, the next
// two as small rows, and "View all" to /news?format=video. Always shown:
// until a video story is published it says so instead. Pictures are
// YouTube's own stills; each card opens the story page, where the video
// plays in the YouTube player (nothing loads from YouTube here). One
// stretched link per card.
export function NewsVideosPanel({
  articles,
  media,
  now,
}: {
  articles: NewsCardData[];
  media: Map<string, NewsCardMedia>;
  now: Date;
}) {
  const [lead, ...more] = articles;

  return (
    <section
      aria-labelledby="news-videos-heading"
      className="rounded-shamba border border-shamba-line bg-shamba-card p-4 sm:p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="news-videos-heading" className="flex items-center gap-2 font-display text-xl font-bold text-shamba-ink">
          <Clapperboard className="size-5 text-shamba-ink" aria-hidden="true" />
          Videos
        </h2>
        <Link
          href={buildNewsHref({}, { format: "video" })}
          className="relative touch-target inline-flex shrink-0 items-center gap-1 rounded-shamba font-sans text-sm font-semibold text-shamba-blue transition-colors hover:text-shamba-green-deep"
        >
          View all
          <span className="sr-only"> videos</span>
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>

      {lead ? (
        <article className="group relative mt-3 flex flex-col gap-2">
          <NewsStoryPicture article={lead} media={media.get(lead.id)} className="aspect-video w-full" />
          <h3 className="font-display text-lg font-bold leading-snug text-shamba-ink">
            <VideoLink article={lead} />
          </h3>
          <VideoMeta article={lead} now={now} />
        </article>
      ) : (
        <p className="mt-3 rounded-shamba border border-dashed border-shamba-line p-4 text-sm leading-6 text-shamba-ink-soft">
          No videos yet. New farming videos appear here as soon as they&apos;re published.
        </p>
      )}

      {more.length > 0 && (
        <ul className="mt-3 divide-y divide-shamba-line border-t border-shamba-line">
          {more.map((article) => (
            <li key={article.id}>
              <article className="group relative flex items-start gap-3 py-3">
                <NewsStoryPicture
                  article={article}
                  media={media.get(article.id)}
                  size="small"
                  className="aspect-video w-28 shrink-0"
                />
                <div className="flex min-w-0 flex-col gap-1">
                  <h3 className="line-clamp-3 font-display text-sm font-bold leading-snug text-shamba-ink">
                    <VideoLink article={article} />
                  </h3>
                  <VideoMeta article={article} now={now} />
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function VideoLink({ article }: { article: NewsCardData }) {
  return (
    <Link
      href={newsArticlePath(article.slug)}
      className="rounded-shamba after:absolute after:inset-0 after:rounded-shamba focus-visible:outline-2 focus-visible:outline-shamba-green group-hover:text-shamba-green-deep"
    >
      {article.title}
    </Link>
  );
}

function VideoMeta({ article, now }: { article: NewsCardData; now: Date }) {
  const credit = newsCredit(article);
  return (
    <p className="font-mono text-xs text-shamba-ink-soft">
      {credit && <>{credit} · </>}
      <time dateTime={article.published_at} title={formatNewsDate(article.published_at)}>
        {formatNewsAgo(article.published_at, now)}
      </time>
    </p>
  );
}
