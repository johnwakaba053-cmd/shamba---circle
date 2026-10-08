import { Images, Play } from "lucide-react";
import { newsCoverUrl, type NewsCardData } from "@/lib/news";
import { formatVideoDuration, getYouTubeThumbnailUrl } from "@/lib/youtube";
import type { NewsCardMedia } from "./newsData";

// The picture at the top of a story card, chosen by format:
//   video        the cover, else YouTube's own still -- with a play mark
//                and the duration (nothing loads from YouTube's player
//                until the reader opens the story and taps play)
//   photo_story  the cover, else the first photo -- with a photo count
//   otherwise    the cover, if there is one
// Nothing at all when there's no picture: the card reads well without.
// Always 16:9, so cards never jump while images load. Plain <img> like
// every other Storage image in the app; decorative here (the card title
// says what the story is), so alt is empty.
export function NewsCardThumbnail({
  article,
  media,
  priority = false,
}: {
  article: NewsCardData;
  media: NewsCardMedia | undefined;
  priority?: boolean;
}) {
  const cover = newsCoverUrl(article.cover_image_path);
  const videoId = article.format === "video" ? (media?.videoId ?? null) : null;
  const firstPhoto = article.format === "photo_story" ? media?.photos[0]?.url : undefined;
  const src = cover ?? (videoId ? getYouTubeThumbnailUrl(videoId) : firstPhoto) ?? null;
  if (!src) return null;

  const duration = videoId ? formatVideoDuration(media?.durationSeconds) : null;
  const photoCount = article.format === "photo_story" ? (media?.photoCount ?? 0) : 0;

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-shamba bg-shamba-bg">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        className="absolute inset-0 size-full object-cover"
      />

      {article.format === "video" && videoId && (
        <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-black/55">
            <Play className="size-6 fill-shamba-card text-shamba-card" />
          </span>
        </span>
      )}

      {duration && (
        <span className="absolute bottom-2 right-2 rounded-full bg-black/70 px-2 py-0.5 font-mono text-xs font-semibold text-shamba-card">
          <span className="sr-only">Length </span>
          {duration}
        </span>
      )}

      {photoCount > 0 && (
        <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 font-mono text-xs font-semibold text-shamba-card">
          <Images className="size-3.5" aria-hidden="true" />
          {photoCount} {photoCount === 1 ? "photo" : "photos"}
        </span>
      )}
    </div>
  );
}
