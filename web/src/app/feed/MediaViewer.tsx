"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { PostMediaItem } from "@/lib/postMedia";

// Full-screen tap-to-open viewer for Reel media. Feed-only (see
// ReelMedia.tsx) -- Communities keeps its existing compact grid via
// the original, untouched PostMedia.tsx.
export function MediaViewer({
  items,
  initialIndex,
  onClose,
}: {
  items: PostMediaItem[];
  initialIndex: number;
  onClose: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(initialIndex);

  // Lock background scroll while the viewer is open.
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  // Focus the dialog so Escape/Arrow keys work immediately, and jump
  // (no animation) to whichever item was actually tapped.
  useEffect(() => {
    containerRef.current?.focus();
    const el = scrollRef.current;
    if (el) {
      el.scrollLeft = initialIndex * el.clientWidth;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function scrollToIndex(index: number) {
    const el = scrollRef.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(index, items.length - 1));
    el.scrollTo({ left: clamped * el.clientWidth, behavior: "smooth" });
    setActiveIndex(clamped);
  }

  function handleScroll() {
    const el = scrollRef.current;
    if (!el || el.clientWidth === 0) return;
    const index = Math.round(el.scrollLeft / el.clientWidth);
    setActiveIndex(Math.max(0, Math.min(index, items.length - 1)));
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      onClose();
    } else if (event.key === "ArrowLeft") {
      scrollToIndex(activeIndex - 1);
    } else if (event.key === "ArrowRight") {
      scrollToIndex(activeIndex + 1);
    }
  }

  // Tapping the dark space around the media (not the media itself)
  // dismisses the viewer -- applied to both the outer dialog and each
  // per-slide wrapper, since the per-slide wrapper is what actually
  // fills the visible letterboxed area around a contained image/video.
  function closeIfBackdrop(event: React.MouseEvent) {
    if (event.target === event.currentTarget) onClose();
  }

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label="Media viewer"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      onClick={closeIfBackdrop}
      className="fixed inset-0 z-50 flex flex-col bg-black/95 outline-none"
    >
      <div className="flex items-center justify-between px-4 pb-3 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)]">
        {items.length > 1 ? (
          <span className="font-mono text-sm font-semibold text-shamba-card">
            {activeIndex + 1} / {items.length}
          </span>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close media viewer"
          className="inline-flex size-9 items-center justify-center rounded-full bg-white/10 text-shamba-card transition-colors hover:bg-white/20"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex flex-1 snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => (
          <div
            key={item.id}
            onClick={closeIfBackdrop}
            className="flex w-full flex-none snap-center snap-always items-center justify-center"
          >
            {item.mediaType === "video" ? (
              <video
                src={item.url}
                controls
                playsInline
                className="max-h-full max-w-full"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.url} alt="" className="max-h-full max-w-full object-contain" />
            )}
          </div>
        ))}
      </div>

      {items.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => scrollToIndex(activeIndex - 1)}
            disabled={activeIndex === 0}
            aria-label="Previous photo or video"
            className="absolute left-2 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full bg-white/10 p-2 text-shamba-card transition-opacity hover:bg-white/20 disabled:opacity-0 sm:flex"
          >
            <ChevronLeft className="size-6" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => scrollToIndex(activeIndex + 1)}
            disabled={activeIndex === items.length - 1}
            aria-label="Next photo or video"
            className="absolute right-2 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full bg-white/10 p-2 text-shamba-card transition-opacity hover:bg-white/20 disabled:opacity-0 sm:flex"
          >
            <ChevronRight className="size-6" aria-hidden="true" />
          </button>

          <div className="flex items-center justify-center gap-1.5 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] pt-3">
            {items.map((_, index) => (
              <span
                key={index}
                className={`size-1.5 rounded-full transition-colors ${
                  index === activeIndex ? "bg-shamba-card" : "bg-shamba-card/40"
                }`}
                aria-hidden="true"
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
