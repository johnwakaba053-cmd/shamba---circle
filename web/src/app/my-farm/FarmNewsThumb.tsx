import { Play } from "lucide-react";
import { NEWS_CATEGORY_FALLBACK_ICON, NEWS_CATEGORY_ICON, type NewsCardData } from "@/lib/news";
import { newsCardImageSrc } from "@/app/news/NewsCardThumbnail";
import { NEWS_REGION_TONE } from "@/app/news/NewsRegionMark";
import type { NewsCardMedia } from "@/app/news/newsData";
import { ThumbImage } from "./ThumbImage";

// A story's small square picture on My Farm. The picture is chosen exactly
// as on /news (newsCardImageSrc: the cover, a video story's YouTube still,
// or a photo story's first photo -- signed URLs from fetchCardMedia, so
// only files the reader may see), and nothing else: imported stories
// never carry the publisher's images. Under it, always, the same plain
// region-coloured panel with the topic icon that /news shows for a story
// with no picture -- clearly an icon, not a photo -- which is what the
// reader sees when there is no picture or it fails to load. Credits stay
// with the picture on the story page, as on /news cards.
export function FarmNewsThumb({ article, media }: { article: NewsCardData; media: NewsCardMedia | undefined }) {
  const src = newsCardImageSrc(article, media);
  const Icon = NEWS_CATEGORY_ICON[article.category_id] ?? NEWS_CATEGORY_FALLBACK_ICON;
  const isVideo = article.format === "video" && Boolean(media?.videoId);

  return (
    <span
      aria-hidden="true"
      className={`relative block size-16 shrink-0 overflow-hidden rounded-xl bg-linear-to-br sm:size-[4.5rem] ${NEWS_REGION_TONE[article.region].panel}`}
    >
      <Icon className="absolute inset-0 m-auto size-6 text-shamba-card/90" />
      {src && <ThumbImage key={src} src={src} />}
      {isVideo && (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex size-7 items-center justify-center rounded-full bg-black/55">
            <Play className="size-3.5 fill-shamba-card text-shamba-card" />
          </span>
        </span>
      )}
    </span>
  );
}
