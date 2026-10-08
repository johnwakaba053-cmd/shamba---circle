import { newsCoverUrl } from "@/lib/news";

// An article's cover photo from the public news-media bucket, at a fixed
// 16:9 so the page never jumps while it loads. Renders nothing when an
// article has no cover: cards and the article page are laid out to read
// well without one, rather than showing a placeholder picture.
//
// A plain <img>, like every other Supabase Storage image in this app
// (see next.config.ts): next/image would need the Storage host allowed.
export function NewsCoverImage({
  path,
  alt,
  priority = false,
  className = "",
}: {
  path: string | null;
  alt: string | null;
  // The first image on the page (Trending's lead story, an article's own
  // cover): loaded straight away instead of lazily.
  priority?: boolean;
  className?: string;
}) {
  const src = newsCoverUrl(path);
  if (!src) return null;

  return (
    <div className={`relative aspect-video w-full overflow-hidden rounded-shamba bg-shamba-bg ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt ?? ""}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        className="absolute inset-0 size-full object-cover"
      />
    </div>
  );
}
