"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ListingMediaItem } from "@/lib/listingMedia";

// Pure display -- no Supabase calls of any kind. Signed URLs are already
// resolved server-side (see lib/listingMedia.ts) and passed in as plain
// strings, the same "resolve once on the server, render client-side"
// split already used by PostMedia.tsx/ReelMedia.tsx. "use client" is
// only needed for the >1-photo case's chevron buttons/scroll tracking
// below -- a single photo renders as a plain <img>, no state or handlers
// at all.
//
// Images only for this stage (the listing-media bucket itself only
// accepts image/jpeg, image/png, image/webp), so there's no video branch
// to handle and nothing here can autoplay.
export function ListingMedia({
  items,
  listingTitle,
}: {
  items: ListingMediaItem[];
  listingTitle: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  if (items.length === 0) {
    return null;
  }

  if (items.length === 1) {
    return (
      <div className="mt-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- private, signed-URL bucket, same as PostMedia.tsx/ReelMedia.tsx */}
        <img
          src={items[0].url}
          alt={listingTitle}
          loading="lazy"
          className="aspect-square w-full rounded-shamba border border-shamba-line object-cover"
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
    <div className="relative mt-2">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        // touch-pan-x hints the browser that this row only handles
        // horizontal panning itself, so vertical page scroll (the only
        // other gesture relevant here -- there is no outer vertical
        // scroll-snap container on this page, unlike Feed) is never
        // captured by this carousel -- same reasoning as ReelMedia.tsx's
        // identical utility on its own horizontal scroller.
        className="flex touch-pan-x snap-x snap-mandatory gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item, index) => (
          // eslint-disable-next-line @next/next/no-img-element -- private, signed-URL bucket, same as PostMedia.tsx/ReelMedia.tsx
          <img
            key={item.id}
            src={item.url}
            alt={`${listingTitle} — photo ${index + 1} of ${items.length}`}
            loading="lazy"
            className="aspect-square w-full flex-none snap-center rounded-shamba border border-shamba-line object-cover"
          />
        ))}
      </div>

      {/* Desktop-only affordance -- mirrors ReelMedia.tsx's own
          hidden-below-sm chevrons, since a mouse/trackpad has no native
          swipe gesture the way touch does. */}
      <button
        type="button"
        onClick={() => scrollToIndex(activeIndex - 1)}
        disabled={activeIndex === 0}
        aria-label="Previous photo"
        className="absolute left-2 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full bg-black/30 p-1.5 text-shamba-card transition-opacity hover:bg-black/50 disabled:opacity-0 sm:flex"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => scrollToIndex(activeIndex + 1)}
        disabled={activeIndex === items.length - 1}
        aria-label="Next photo"
        className="absolute right-2 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full bg-black/30 p-1.5 text-shamba-card transition-opacity hover:bg-black/50 disabled:opacity-0 sm:flex"
      >
        <ChevronRight className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
