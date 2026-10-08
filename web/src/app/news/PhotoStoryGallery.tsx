"use client";

import { useState } from "react";
import { Expand } from "lucide-react";
import { MediaViewer } from "@/app/feed/MediaViewer";

export type PhotoStoryPhoto = {
  id: string;
  url: string;
  alt: string;
  caption: string | null;
  credit: string;
  width: number | null;
  height: number | null;
};

// A photo story's photos, in the editor's order, each with its caption
// and credit (N4 requires alt text and a credit on every image). Tapping
// a photo opens the Feed's full-screen MediaViewer (swipe, arrows,
// Escape, Android Back), which already takes {id, mediaType, url}.
// width/height are passed when known so the page doesn't jump while
// photos load; the first photo loads straight away, the rest lazily.
export function PhotoStoryGallery({ photos }: { photos: PhotoStoryPhoto[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="mt-8 flex flex-col gap-8">
      {photos.map((photo, index) => (
        <figure key={photo.id} className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setOpenIndex(index)}
            className="group relative block w-full overflow-hidden rounded-shamba border border-shamba-line bg-shamba-bg"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.url}
              alt={photo.alt}
              width={photo.width ?? undefined}
              height={photo.height ?? undefined}
              loading={index === 0 ? "eager" : "lazy"}
              decoding="async"
              className="block h-auto w-full"
            />
            <span
              aria-hidden="true"
              className="absolute right-2 top-2 flex size-9 items-center justify-center rounded-full bg-black/55 text-shamba-card opacity-90 transition-opacity group-hover:opacity-100"
            >
              <Expand className="size-4" />
            </span>
            <span className="sr-only">Open photo {index + 1} of {photos.length} full screen</span>
          </button>
          <figcaption className="flex flex-col gap-0.5">
            {photo.caption && <span className="text-base leading-7 text-shamba-ink">{photo.caption}</span>}
            <span className="font-mono text-xs text-shamba-ink-soft">Photo: {photo.credit}</span>
          </figcaption>
        </figure>
      ))}

      {openIndex !== null && (
        <MediaViewer
          items={photos.map((photo) => ({ id: photo.id, mediaType: "image" as const, url: photo.url }))}
          initialIndex={openIndex}
          onClose={() => setOpenIndex(null)}
        />
      )}
    </div>
  );
}
