import Link from "next/link";
import {
  NEWS_CATEGORY_FALLBACK_ICON,
  NEWS_CATEGORY_ICON,
  formatNewsDate,
  newsArticlePath,
  newsPlaceLabel,
  type NewsCardData,
} from "@/lib/news";
import { NewsCardThumbnail } from "./NewsCardThumbnail";
import { NewsFormatBadge } from "./NewsFormatBadge";
import type { NewsCardMedia } from "./newsData";

// One story in a list -- every format, including video stories in Watch
// (the thumbnail shows the play mark and length). The whole card opens
// the article: the title link is stretched over the card (after:absolute
// inset-0), so there is one link per card and nothing nested inside
// another link.
//
// layout="horizontal" is the compact full-width version (used for a lone
// extra Featured story): from sm up the picture sits on the left, a
// third of the width, with the text beside it; with no picture it's
// simply a full-width text card. Phones always get the stacked card.
export function NewsCard({
  article,
  media,
  layout = "stacked",
}: {
  article: NewsCardData;
  media?: NewsCardMedia;
  layout?: "stacked" | "horizontal";
}) {
  const Icon = NEWS_CATEGORY_ICON[article.category_id] ?? NEWS_CATEGORY_FALLBACK_ICON;
  const horizontal = layout === "horizontal";

  return (
    <article
      className={`group relative flex flex-col gap-3 rounded-shamba border border-shamba-line bg-shamba-card p-4 transition-colors hover:border-shamba-green has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-shamba-green sm:p-5 ${
        horizontal ? "sm:flex-row sm:items-center sm:gap-5" : ""
      }`}
    >
      {horizontal ? (
        // Empty (and so hidden) when the story has no picture.
        <div className="empty:hidden sm:w-1/3 sm:shrink-0">
          <NewsCardThumbnail article={article} media={media} />
        </div>
      ) : (
        <NewsCardThumbnail article={article} media={media} />
      )}

      {/* "contents" keeps the stacked card's layout exactly as before;
          the horizontal card needs the text as one column. */}
      <div className={horizontal ? "flex min-w-0 flex-1 flex-col gap-2" : "contents"}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-shamba-green">
            <Icon className="size-4" aria-hidden="true" />
            {article.news_categories?.name ?? "News"}
          </span>
          <span className="font-mono text-xs text-shamba-ink-soft">
            {newsPlaceLabel(article.region, article.counties?.name)}
          </span>
          <NewsFormatBadge format={article.format} />
        </div>

        <h3 className="font-display text-lg font-bold leading-snug text-shamba-ink">
          <Link
            href={newsArticlePath(article.slug)}
            className="rounded-shamba after:absolute after:inset-0 after:rounded-shamba focus-visible:outline-none group-hover:text-shamba-green-deep"
          >
            {article.title}
          </Link>
        </h3>

        <p className={`${horizontal ? "line-clamp-2" : "line-clamp-3"} text-sm leading-6 text-shamba-ink-soft`}>
          {article.summary}
        </p>

        <NewsCardMeta article={article} />
      </div>
    </article>
  );
}

// "8 Oct 2026 · By Jane W." (a blog's byline), else the source.
export function NewsCardMeta({ article }: { article: NewsCardData }) {
  const credit = article.byline ? `By ${article.byline}` : article.news_sources?.name;
  return (
    <p className="mt-auto font-mono text-xs text-shamba-ink-soft">
      <time dateTime={article.published_at}>{formatNewsDate(article.published_at)}</time>
      {credit && <> · {credit}</>}
    </p>
  );
}
