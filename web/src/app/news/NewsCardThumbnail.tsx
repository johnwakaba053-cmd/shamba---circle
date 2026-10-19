import { Images, Play } from "lucide-react";
import type { NewsCardData } from "@/lib/news";
import { formatVideoDuration, getYouTubeThumbnailUrl } from "@/lib/youtube";
import { ThumbImage } from "@/app/my-farm/ThumbImage";
import type { NewsCardMedia } from "./newsData";

// The picture at the top of a story card, chosen by format:
//   video        the cover, else YouTube's own still -- with a play mark
//                and the duration (nothing loads from YouTube's player
//                until the reader opens the story and taps play)
//   photo_story  the cover, else the first photo -- with a photo count
//   otherwise    the cover, if there is one
// Nothing at all when there's no picture: the card reads well without.
// Full-width 16:9 unless `className` sets another size, so cards never jump
// while images load. size="small" (a sidebar thumbnail) keeps a smaller
// play mark and leaves out the length and photo count. `children` are
// extra overlays, e.g. the feed's region tag. Plain <img> like every
// other Storage image in the app (ThumbImage: it hides itself if the file
// fails, so whatever is behind it shows instead of a broken-image icon);
// decorative here (the card title says what the story is), so alt is
// empty. `background` is what shows while the picture loads or if it
// fails -- transparent when NewsStoryPicture draws its panel underneath.
export function NewsCardThumbnail({
  article,
  media,
  priority = false,
  className = "aspect-video w-full",
  size = "default",
  background = "bg-shamba-bg",
  children,
}: {
  article: NewsCardData;
  media: NewsCardMedia | undefined;
  priority?: boolean;
  className?: string;
  size?: "default" | "small";
  background?: string;
  children?: React.ReactNode;
}) {
  const videoId = article.format === "video" ? (media?.videoId ?? null) : null;
  const src = newsCardImageSrc(article, media);
  if (!src) return null;

  const small = size === "small";
  const duration = videoId && !small ? formatVideoDuration(media?.durationSeconds) : null;
  const photoCount = article.format === "photo_story" && !small ? (media?.photoCount ?? 0) : 0;

  return (
    <div className={`relative overflow-hidden rounded-shamba ${background} ${className}`}>
      <ThumbImage key={src} src={src} priority={priority} />

      {article.format === "video" && videoId && (
        <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
          <span
            className={`flex items-center justify-center rounded-full bg-black/55 ${small ? "size-7" : "size-12"}`}
          >
            <Play className={`fill-shamba-card text-shamba-card ${small ? "size-3.5" : "size-6"}`} />
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

      {children}
    </div>
  );
}

// The card picture's URL, or null when the story has none (so a caller
// can show something else in its place).
export function newsCardImageSrc(article: NewsCardData, media: NewsCardMedia | undefined): string | null {
  const cover = media?.coverUrl ?? null;
  const videoId = article.format === "video" ? (media?.videoId ?? null) : null;
  const firstPhoto = article.format === "photo_story" ? media?.photos[0]?.url : undefined;
  return cover ?? (videoId ? getYouTubeThumbnailUrl(videoId) : firstPhoto) ?? null;
}
