import { NEWS_CATEGORY_FALLBACK_ICON, NEWS_CATEGORY_ICON, type NewsCardData } from "@/lib/news";
import { NewsCardThumbnail, newsCardImageSrc } from "./NewsCardThumbnail";
import { NEWS_REGION_TONE } from "./NewsRegionMark";
import type { NewsCardMedia } from "./newsData";

// A story's picture on /news: a plain panel in the region's colours with
// the topic's icon, and on top of it the story's own image when it has
// one (cover, YouTube still, first photo -- see NewsCardThumbnail). The
// panel is always drawn, so it is what shows while the image loads or if
// it fails -- never an empty box (as on My Farm, FarmNewsThumb). It is
// clearly not a photo: nothing is made up or borrowed from the publisher.
// `className` sizes it (width included); `children` are overlays.
export function NewsStoryPicture({
  article,
  media,
  className,
  size = "default",
  priority = false,
  children,
}: {
  article: NewsCardData;
  media: NewsCardMedia | undefined;
  className: string;
  size?: "default" | "small";
  priority?: boolean;
  children?: React.ReactNode;
}) {
  const hasImage = Boolean(newsCardImageSrc(article, media));
  const Icon = NEWS_CATEGORY_ICON[article.category_id] ?? NEWS_CATEGORY_FALLBACK_ICON;
  const small = size === "small";
  // A video's play mark sits in the middle of the picture (NewsCardThumbnail);
  // a small panel's topic icon would sit right under it, so the play mark
  // stands in for it there.
  const playMark = hasImage && article.format === "video" && Boolean(media?.videoId);

  return (
    <div
      className={`relative overflow-hidden rounded-shamba bg-linear-to-br ${NEWS_REGION_TONE[article.region].panel} ${className}`}
    >
      {/* Faint crop rows -- texture only. */}
      <span
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(-24deg, rgb(255 255 255 / 0.07) 0 2px, transparent 2px 16px)",
        }}
      />
      {small ? (
        !playMark && <Icon aria-hidden="true" className="absolute inset-0 m-auto size-6 text-shamba-card/90" />
      ) : (
        <>
          <Icon aria-hidden="true" className="absolute -bottom-4 -right-3 size-32 text-shamba-card/15 sm:size-40" />
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-2 font-sans text-sm font-semibold text-shamba-card">
            <Icon aria-hidden="true" className="size-5" />
            {article.news_categories?.name ?? "News"}
          </span>
        </>
      )}
      {hasImage ? (
        <div className="absolute inset-0">
          <NewsCardThumbnail
            article={article}
            media={media}
            className="size-full"
            size={size}
            priority={priority}
            background="bg-transparent"
          >
            {children}
          </NewsCardThumbnail>
        </div>
      ) : (
        children
      )}
    </div>
  );
}
