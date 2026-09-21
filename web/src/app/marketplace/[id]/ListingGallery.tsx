"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import type { ListingMediaItem } from "@/lib/listingMedia";

// The detail page's own gallery, deliberately not a reuse of
// ListingMedia.tsx: that component is sized and styled for a small
// browse-card thumbnail (aspect-square, gapped multi-image row), while
// this one needs to read as the page's hero image -- a single larger,
// seamless frame, not several small tiles. Both share the same
// underlying data shape (ListingMediaItem[], already-resolved signed
// URLs) and the same "use client" scope, since only the >1-photo case
// needs any state at all.
//
// Deliberately inline, not a fullscreen modal like MediaViewer.tsx --
// per the product direction, Marketplace stays a plain buying/selling
// page, not a Reels-style tap-to-expand experience.
const GALLERY_ASPECT_CLASS = "aspect-[4/3]";
const GALLERY_FRAME_CLASS =
  "relative w-full overflow-hidden rounded-shamba border border-shamba-line bg-shamba-card";

export function ListingGallery({
  items,
  listingTitle,
}: {
  items: ListingMediaItem[];
  listingTitle: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  if (items.length === 0) {
    return (
      <div
        className={`${GALLERY_FRAME_CLASS} ${GALLERY_ASPECT_CLASS} flex items-center justify-center text-shamba-ink-soft`}
      >
        <ImageOff className="size-10" aria-hidden="true" />
      </div>
    );
  }

  if (items.length === 1) {
    return (
      <div className={GALLERY_FRAME_CLASS}>
        {/* eslint-disable-next-line @next/next/no-img-element -- private, signed-URL bucket, same as ListingMedia.tsx */}
        <img
          src={items[0].url}
          alt={listingTitle}
          className={`${GALLERY_ASPECT_CLASS} w-full object-cover`}
        />
      </div>
    );
  }

  function handleScroll() {
    const el = scrollRef.current;
    if (!el || el.clientWidth === 0) return;
    const index = Math.round(el.scrollLeft / el.clientWidth);
    setActiveIndex(Math.max(0, Math.min(index, items.length - 1)));
  }

  function scrollToIndex(index: number) {
    const el = scrollRef.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(index, items.length - 1));
    el.scrollTo({ left: clamped * el.clientWidth, behavior: "smooth" });
    setActiveIndex(clamped);
  }

  return (
    <div>
      <div className={GALLERY_FRAME_CLASS}>
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          // touch-pan-x hints the browser that this row only handles
          // horizontal panning itself -- same reasoning as
          // ListingMedia.tsx/ReelMedia.tsx's identical utility, so a
          // vertical page scroll starting on the gallery is never
          // captured by it.
          className={`flex touch-pan-x snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}
        >
          {items.map((item, index) => (
            // eslint-disable-next-line @next/next/no-img-element -- private, signed-URL bucket, same as ListingMedia.tsx
            <img
              key={item.id}
              src={item.url}
              alt={`${listingTitle} — photo ${index + 1} of ${items.length}`}
              loading={index === 0 ? "eager" : "lazy"}
              className={`${GALLERY_ASPECT_CLASS} w-full flex-none snap-center object-cover`}
            />
          ))}
        </div>

        <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/55 px-2 py-0.5 font-mono text-xs font-semibold text-shamba-card">
          {activeIndex + 1} / {items.length}
        </span>

        <button
          type="button"
          onClick={() => scrollToIndex(activeIndex - 1)}
          disabled={activeIndex === 0}
          aria-label="Previous photo"
          className="absolute left-2 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full bg-black/40 p-1.5 text-shamba-card transition-opacity hover:bg-black/60 disabled:opacity-0 sm:flex"
        >
          <ChevronLeft className="size-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => scrollToIndex(activeIndex + 1)}
          disabled={activeIndex === items.length - 1}
          aria-label="Next photo"
          className="absolute right-2 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full bg-black/40 p-1.5 text-shamba-card transition-opacity hover:bg-black/60 disabled:opacity-0 sm:flex"
        >
          <ChevronRight className="size-5" aria-hidden="true" />
        </button>
      </div>

      <div className="mt-2 flex items-center justify-center gap-1.5">
        {items.map((_, index) => (
          <span
            key={index}
            className={`size-1.5 rounded-full transition-colors ${
              index === activeIndex ? "bg-shamba-green" : "bg-shamba-line"
            }`}
            aria-hidden="true"
          />
        ))}
      </div>
    </div>
  );
}
