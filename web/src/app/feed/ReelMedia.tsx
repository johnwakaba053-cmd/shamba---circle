"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import type { PostMediaItem } from "@/lib/postMedia";
import { MediaViewer } from "./MediaViewer";

// Full-bleed Reel media, filling the slide behind the caption/rail
// overlays -- replaces the old card-thumbnail FeedPostMedia.tsx, which
// doesn't fit a full-viewport Reel. Multiple items still use their own
// horizontal swipe carousel (native scroll-snap, no gesture library),
// but the page indicator moves to a thin segmented bar pinned to the top
// edge (Stories-style) instead of bottom dots, so it never collides with
// the bottom caption block or the right-side interaction rail, which
// both anchor to the bottom. Tapping any item still opens the same
// full-screen MediaViewer, unchanged, where video gets native controls
// -- never autoplaying, here or in the viewer. touch-pan-x on the
// scroller hints the browser that this element only handles horizontal
// panning itself, so it defers vertical panning to the outer vertical
// Reel scroller (ReelFeed.tsx) instead of guessing from swipe angle --
// doesn't change vertical scroll behavior, just makes the two axes
// disambiguate more reliably.
export function ReelMedia({ items }: { items: PostMediaItem[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);

  if (items.length === 0) {
    return null;
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
    <>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex h-full touch-pan-x snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setActiveIndex(index);
              setViewerOpen(true);
            }}
            aria-label={`Open ${item.mediaType} ${index + 1} of ${items.length}`}
            className="relative h-full w-full flex-none snap-center snap-always"
          >
            {item.mediaType === "video" ? (
              <>
                <video
                  src={item.url}
                  className="size-full object-cover"
                  muted
                  playsInline
                  preload="metadata"
                />
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="flex size-16 items-center justify-center rounded-full bg-black/40">
                    <Play
                      className="size-7 fill-shamba-card text-shamba-card"
                      aria-hidden="true"
                    />
                  </span>
                </span>
              </>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.url} alt="" className="size-full object-cover" />
            )}
          </button>
        ))}
      </div>

      {items.length > 1 && (
        <>
          <div className="pointer-events-none absolute inset-x-3 top-[calc(env(safe-area-inset-top,0px)+0.75rem)] z-20 flex gap-1">
            {items.map((_, index) => (
              <span
                key={index}
                className={`h-0.5 flex-1 rounded-full transition-colors ${
                  index === activeIndex ? "bg-shamba-card" : "bg-shamba-card/35"
                }`}
                aria-hidden="true"
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => scrollToIndex(activeIndex - 1)}
            disabled={activeIndex === 0}
            aria-label="Previous photo or video"
            className="absolute left-2 top-1/2 z-20 hidden -translate-y-1/2 items-center justify-center rounded-full bg-black/30 p-1.5 text-shamba-card transition-opacity hover:bg-black/50 disabled:opacity-0 sm:flex"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => scrollToIndex(activeIndex + 1)}
            disabled={activeIndex === items.length - 1}
            aria-label="Next photo or video"
            className="absolute right-2 top-1/2 z-20 hidden -translate-y-1/2 items-center justify-center rounded-full bg-black/30 p-1.5 text-shamba-card transition-opacity hover:bg-black/50 disabled:opacity-0 sm:flex"
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </>
      )}

      {viewerOpen && (
        <MediaViewer
          items={items}
          initialIndex={activeIndex}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </>
  );
}
