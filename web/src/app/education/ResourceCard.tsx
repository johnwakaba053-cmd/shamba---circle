import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Play, Video as VideoIcon } from "lucide-react";
import {
  EDUCATION_CATEGORY_ICON,
  EDUCATION_CATEGORY_FALLBACK_ICON,
  LEARNING_CATEGORY_LABELS,
  RESOURCE_TYPE_LABELS,
  formatVideoDuration,
  type LearningCategory,
  type ResourceType,
  type ResourceOrigin,
} from "@/lib/education";

// The single card used for every education_resources row, in both the
// Learning Library grid and the Watch & Learn section -- one component so
// the two surfaces can never visually drift apart, and so a video card
// looks the same wherever it appears. Article/document rendering is
// untouched from before Watch & Learn existed; the video-only pieces
// (thumbnail, play overlay, duration badge) are purely additive and only
// ever render when resource_type === "video".
export type EducationResourceCardData = {
  id: string;
  category_id: string;
  topic_id: string | null;
  learning_category: LearningCategory | null;
  resource_type: ResourceType;
  origin: ResourceOrigin | null;
  title: string;
  summary: string;
  source_name: string | null;
  education_sources: { name: string } | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
};

export type EducationResourceCardTopic = {
  name: string;
  emoji: string | null;
};

export function ResourceCard({
  resource,
  topic,
}: {
  resource: EducationResourceCardData;
  topic: EducationResourceCardTopic | undefined;
}) {
  const Icon =
    EDUCATION_CATEGORY_ICON[resource.category_id] ?? EDUCATION_CATEGORY_FALLBACK_ICON;
  const isVideo = resource.resource_type === "video";
  const duration = isVideo ? formatVideoDuration(resource.duration_seconds) : null;

  return (
    // A plain <article>, not a <Link> -- the title link and the
    // "Read Resource"/"Watch Video" action below both point to the same
    // detail route as separate, sibling interactive elements, so the card
    // never nests one link inside another (invalid HTML) while still
    // giving the whole card exactly one destination.
    <article className="flex flex-col gap-2 rounded-shamba border border-shamba-line bg-shamba-card p-4">
      {/* Shown only for origin = shamba_original -- distinct green fill
          (not the neutral bg-shamba-bg used for the type/topic/learning
          badges below) so a farmer can tell at a glance this is Shamba
          Space's own written guide, not an external link. */}
      {resource.origin === "shamba_original" && (
        <span className="w-fit rounded-shamba bg-shamba-green px-2 py-0.5 font-mono text-xs font-semibold text-shamba-card">
          Shamba Space Original
        </span>
      )}

      {isVideo && (
        <div className="relative aspect-video w-full overflow-hidden rounded-shamba bg-shamba-bg">
          {resource.thumbnail_url ? (
            <Image
              src={resource.thumbnail_url}
              alt={resource.title}
              fill
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              className="object-cover"
            />
          ) : (
            // No thumbnail_url -- a clean Shamba Space placeholder rather
            // than a broken image or an invented thumbnail URL.
            <div className="flex h-full w-full items-center justify-center">
              <VideoIcon
                className="size-8 text-shamba-ink-soft"
                aria-hidden="true"
              />
            </div>
          )}

          {/* Decorative only -- the type badge below and the "Watch
              Video" action already tell a screen reader this is a video,
              so this overlay carries no information of its own and never
              needs to be a separate focusable/clickable element. */}
          <div
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
            aria-hidden="true"
          >
            <span className="flex size-10 items-center justify-center rounded-full bg-black/50">
              <Play className="size-5 fill-white text-white" />
            </span>
          </div>

          {duration && (
            <span className="absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1.5 py-0.5 font-mono text-xs font-semibold text-white">
              {duration}
            </span>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded-shamba bg-shamba-bg px-2 py-0.5 font-mono text-xs font-semibold text-shamba-ink-soft">
          {RESOURCE_TYPE_LABELS[resource.resource_type]}
        </span>
        {topic && (
          <span className="rounded-shamba bg-shamba-bg px-2 py-0.5 font-mono text-xs font-semibold text-shamba-ink-soft">
            {topic.emoji ? `${topic.emoji} ` : ""}
            {topic.name}
          </span>
        )}
        {resource.learning_category && (
          <span className="rounded-shamba bg-shamba-bg px-2 py-0.5 font-mono text-xs font-semibold text-shamba-ink-soft">
            {LEARNING_CATEGORY_LABELS[resource.learning_category]}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Icon className="size-5 shrink-0 text-shamba-green" aria-hidden="true" />
        <h2 className="font-display text-base font-semibold leading-tight text-shamba-ink">
          <Link
            href={`/education/${resource.id}`}
            className="transition-colors hover:text-shamba-green hover:underline"
          >
            {resource.title}
          </Link>
        </h2>
      </div>

      <p className="text-sm leading-6 text-shamba-ink-soft">{resource.summary}</p>

      {(resource.education_sources?.name || resource.source_name) && (
        <p className="font-mono text-xs text-shamba-ink-soft">
          Source: {resource.education_sources?.name ?? resource.source_name}
        </p>
      )}

      <Link
        href={`/education/${resource.id}`}
        className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-shamba border border-shamba-line px-3 py-1.5 font-sans text-xs font-semibold text-shamba-ink transition-colors hover:border-shamba-green hover:text-shamba-green"
      >
        {isVideo ? "Watch Video" : "Read Resource"}
        {isVideo ? (
          <Play className="size-3.5" aria-hidden="true" />
        ) : (
          <ArrowRight className="size-3.5" aria-hidden="true" />
        )}
      </Link>
    </article>
  );
}
