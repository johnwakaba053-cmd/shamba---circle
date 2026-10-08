import Link from "next/link";
import { Images } from "lucide-react";
import {
  NEWS_CATEGORY_FALLBACK_ICON,
  NEWS_CATEGORY_ICON,
  newsArticlePath,
  newsPlaceLabel,
  type NewsCardData,
} from "@/lib/news";
import { NewsCardMeta } from "./NewsCard";
import type { NewsCardMedia } from "./newsData";

// A photo story in the Photo Stories section: its first photo large and
// the next two small beside it (a fixed 4:3 frame, so nothing jumps
// while loading), with the photo count. Falls back to one photo, or to a
// plain card, when there are fewer. Same single stretched-link pattern
// as NewsCard; the photos are decorative here, so alt is empty.
export function PhotoStoryCard({ article, media }: { article: NewsCardData; media?: NewsCardMedia }) {
  const Icon = NEWS_CATEGORY_ICON[article.category_id] ?? NEWS_CATEGORY_FALLBACK_ICON;
  const photos = media?.photos ?? [];
  const [first, ...rest] = photos;
  const side = rest.slice(0, 2);

  return (
    <article className="group relative flex flex-col gap-3 rounded-shamba border border-shamba-line bg-shamba-card p-4 transition-colors hover:border-shamba-green has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-shamba-green sm:p-5">
      {first && (
        <div className={`relative grid aspect-[4/3] gap-1.5 overflow-hidden rounded-shamba ${side.length > 0 ? "grid-cols-3 grid-rows-2" : ""}`}>
          <Photo url={first.url} className={side.length > 0 ? "col-span-2 row-span-2" : ""} />
          {side.map((photo) => (
            <Photo key={photo.url} url={photo.url} className={side.length === 1 ? "row-span-2" : ""} />
          ))}
          {media && media.photoCount > 0 && (
            <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 font-mono text-xs font-semibold text-shamba-card">
              <Images className="size-3.5" aria-hidden="true" />
              {media.photoCount} {media.photoCount === 1 ? "photo" : "photos"}
            </span>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-shamba-green">
          <Icon className="size-4" aria-hidden="true" />
          {article.news_categories?.name ?? "News"}
        </span>
        <span className="font-mono text-xs text-shamba-ink-soft">
          {newsPlaceLabel(article.region, article.counties?.name)}
        </span>
      </div>

      <h3 className="font-display text-lg font-bold leading-snug text-shamba-ink">
        <Link
          href={newsArticlePath(article.slug)}
          className="rounded-shamba after:absolute after:inset-0 after:rounded-shamba focus-visible:outline-none group-hover:text-shamba-green-deep"
        >
          {article.title}
        </Link>
      </h3>

      <p className="line-clamp-2 text-sm leading-6 text-shamba-ink-soft">{article.summary}</p>

      <NewsCardMeta article={article} />
    </article>
  );
}

function Photo({ url, className }: { url: string; className: string }) {
  return (
    <div className={`relative min-h-0 bg-shamba-bg ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />
    </div>
  );
}
