import { NEWS_CATEGORY_FALLBACK_ICON, NEWS_CATEGORY_ICON, type NewsCardData } from "@/lib/news";
import { NewsCardThumbnail, newsCardImageSrc } from "./NewsCardThumbnail";
import { NEWS_REGION_TONE } from "./NewsRegionMark";
import type { NewsCardMedia } from "./newsData";

// A story's picture on /news: its own image when it has one (cover,
// YouTube still, first photo -- see NewsCardThumbnail), otherwise a
// plain panel in the region's colours with the topic's icon. The panel
// is clearly not a photo: nothing is made up or borrowed from the
// publisher. `className` sizes either one (width included); `children` are overlays.
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
  if (newsCardImageSrc(article, media)) {
    return (
      <NewsCardThumbnail article={article} media={media} className={className} size={size} priority={priority}>
        {children}
      </NewsCardThumbnail>
    );
  }

  const Icon = NEWS_CATEGORY_ICON[article.category_id] ?? NEWS_CATEGORY_FALLBACK_ICON;
  const small = size === "small";

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
        <Icon aria-hidden="true" className="absolute inset-0 m-auto size-6 text-shamba-card/90" />
      ) : (
        <>
          <Icon aria-hidden="true" className="absolute -bottom-4 -right-3 size-32 text-shamba-card/15 sm:size-40" />
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-2 font-sans text-sm font-semibold text-shamba-card">
            <Icon aria-hidden="true" className="size-5" />
            {article.news_categories?.name ?? "News"}
          </span>
        </>
      )}
      {children}
    </div>
  );
}
