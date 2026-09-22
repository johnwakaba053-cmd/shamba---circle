"use client";

import { useState } from "react";
import type { PostMediaItem } from "@/lib/postMedia";
import { MediaViewer } from "@/app/feed/MediaViewer";

// Inline conversation media (Batch 1.1 polish): still the same
// signed-URL items resolved server-side in lib/postMedia.ts, still the
// same compact 1-or-2-column grid, just no longer wrapped in its own
// separately bordered "post card" -- that per-message card chrome moved
// out of the message entirely (see page.tsx's burst grouping). Tapping
// a photo or video opens the existing full-screen MediaViewer already
// built for Feed, reused completely unmodified rather than duplicated
// -- it has no Feed-specific dependency, it only takes
// PostMediaItem[] + an index + onClose.
export function PostMedia({ items }: { items: PostMediaItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (items.length === 0) {
    return null;
  }

  return (
    <>
      <div
        className={
          items.length === 1
            ? "mt-2 grid grid-cols-1 gap-2"
            : "mt-2 grid grid-cols-2 gap-2"
        }
      >
        {items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setOpenIndex(index)}
            aria-label={item.mediaType === "video" ? "Open video" : "Open photo"}
            className="aspect-square overflow-hidden rounded-shamba border border-shamba-line"
          >
            {item.mediaType === "video" ? (
              <video src={item.url} muted className="size-full object-cover" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.url} alt="" className="size-full object-cover" />
            )}
          </button>
        ))}
      </div>

      {openIndex !== null && (
        <MediaViewer items={items} initialIndex={openIndex} onClose={() => setOpenIndex(null)} />
      )}
    </>
  );
}
