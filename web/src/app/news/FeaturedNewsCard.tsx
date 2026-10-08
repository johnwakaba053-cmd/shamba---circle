import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  NEWS_CATEGORY_FALLBACK_ICON,
  NEWS_CATEGORY_ICON,
  newsArticlePath,
  newsPlaceLabel,
  type NewsCardData,
} from "@/lib/news";
import { NewsCardMeta } from "./NewsCard";
import { NewsCardThumbnail } from "./NewsCardThumbnail";
import { NewsFormatBadge } from "./NewsFormatBadge";
import type { NewsCardMedia } from "./newsData";

// The lead Featured story (the editor's first pick): a bigger title, the
// full summary and a clear "Read the story" action. With a picture it
// sits beside the text from sm up; without one the text has the card to
// itself. Same single stretched-link pattern as NewsCard.
//
// The card fills the height it's given (the top row on /news makes it
// match Trending beside it), with the date and "Read the story" kept at
// the bottom.
export function FeaturedNewsCard({
  article,
  media,
  className = "",
}: {
  article: NewsCardData;
  media?: NewsCardMedia;
  className?: string;
}) {
  const Icon = NEWS_CATEGORY_ICON[article.category_id] ?? NEWS_CATEGORY_FALLBACK_ICON;
  const thumbnail = <NewsCardThumbnail article={article} media={media} priority />;
  const hasPicture = Boolean(
    article.cover_image_path || media?.videoId || (article.format === "photo_story" && media?.photos.length),
  );

  return (
    <article
      className={`group relative grid gap-4 rounded-shamba border border-shamba-line bg-shamba-card p-4 transition-colors hover:border-shamba-green has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-shamba-green sm:p-6 ${
        hasPicture ? "sm:grid-cols-2 sm:items-center sm:gap-6" : ""
      } ${className}`}
    >
      {thumbnail}

      <div className="flex h-full flex-col gap-3">
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

        <h3 className="font-display text-2xl font-bold leading-tight tracking-tight text-shamba-ink sm:text-3xl">
          <Link
            href={newsArticlePath(article.slug)}
            className="rounded-shamba after:absolute after:inset-0 after:rounded-shamba focus-visible:outline-none group-hover:text-shamba-green-deep"
          >
            {article.title}
          </Link>
        </h3>

        <p className="max-w-xl text-base leading-7 text-shamba-ink-soft">{article.summary}</p>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
          <NewsCardMeta article={article} />
          {/* Visual cue only -- the stretched title link above is the
              card's one link, so this isn't a second tab stop. */}
          <span
            aria-hidden="true"
            className="inline-flex items-center gap-1.5 font-sans text-sm font-semibold text-shamba-green group-hover:text-shamba-green-deep"
          >
            {article.format === "video" ? "Watch the story" : "Read the story"}
            <ArrowRight className="size-4" />
          </span>
        </div>
      </div>
    </article>
  );
}
