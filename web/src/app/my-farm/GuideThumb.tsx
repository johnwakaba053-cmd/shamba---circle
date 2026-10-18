import { Play } from "lucide-react";
import { EDUCATION_CATEGORY_FALLBACK_ICON, EDUCATION_CATEGORY_ICON } from "@/lib/education";
import { ThumbImage } from "./ThumbImage";

// The topic's colours: green for a crop topic, ochre for a livestock one.
// Full class strings so Tailwind can see them.
const TOPIC_TONE = {
  crop: "bg-shamba-green/10 text-shamba-green",
  livestock: "bg-shamba-ochre/15 text-shamba-ochre",
} as const;

export type GuideTopicKind = keyof typeof TOPIC_TONE;

// The only guide picture permitted today: a Watch & Learn video's own
// YouTube still -- the one image host next.config.ts allows for
// education_resources.thumbnail_url. Anything else is ignored, never
// loaded.
export function permittedGuideThumbnail(resourceType: string, thumbnailUrl: string | null): string | null {
  if (resourceType !== "video" || !thumbnailUrl) return null;
  try {
    const url = new URL(thumbnailUrl);
    return url.protocol === "https:" && url.hostname === "i.ytimg.com" ? url.toString() : null;
  } catch {
    return null;
  }
}

// A guide's small square on My Farm: a flat panel in its topic's colour
// with its topic's own emoji from education_topics (the category's icon
// only if the topic has none) -- plainly an icon, never dressed up as a
// photo -- and on top of it, when there is one, a video's permitted
// still (with a play mark) or an article's licensed cover photo, whose
// credit the row shows beside it (the panel shows again if it fails).
export function GuideThumb({
  emoji,
  categoryId,
  topicKind,
  thumbnailSrc,
  showPlay,
}: {
  emoji: string | null;
  categoryId: string;
  topicKind: GuideTopicKind;
  thumbnailSrc: string | null;
  showPlay: boolean;
}) {
  const Icon = EDUCATION_CATEGORY_ICON[categoryId] ?? EDUCATION_CATEGORY_FALLBACK_ICON;

  return (
    <span
      aria-hidden="true"
      className={`relative block size-12 shrink-0 overflow-hidden rounded-xl ${TOPIC_TONE[topicKind]}`}
    >
      {emoji ? (
        <span className="absolute inset-0 flex items-center justify-center text-2xl leading-none">{emoji}</span>
      ) : (
        <Icon className="absolute inset-0 m-auto size-6" />
      )}
      {thumbnailSrc && (
        <>
          <ThumbImage key={thumbnailSrc} src={thumbnailSrc} />
          {showPlay && (
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex size-6 items-center justify-center rounded-full bg-black/55">
                <Play className="size-3 fill-shamba-card text-shamba-card" />
              </span>
            </span>
          )}
        </>
      )}
    </span>
  );
}
