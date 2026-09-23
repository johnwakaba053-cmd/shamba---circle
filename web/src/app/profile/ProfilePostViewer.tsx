"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import type { Reel } from "@/app/feed/types";
import { FeedHeaderVisibilityProvider } from "@/app/feed/FeedHeaderVisibility";
import { ReelFeed } from "@/app/feed/ReelFeed";

// Thin full-screen wrapper around Feed's own existing vertical viewer --
// not a second media viewer. ReelFeed/ReelSlide/ReelMedia/ReelInfo/
// ReelInteractionRail/ReelCommentsSheet are reused completely unmodified;
// this component only supplies the modal chrome (close button, Escape,
// body-scroll lock, dialog semantics) around them, the same way
// MediaViewer.tsx is already a full-screen chrome around a media
// carousel. FeedHeaderVisibilityProvider is required only because
// ReelFeed's onScroll wiring calls useFeedHeaderVisibility()
// unconditionally (see FeedHeaderVisibility.tsx) -- there is no
// AppHeader here for it to actually show/hide, it just satisfies that
// existing dependency without having to fork ReelFeed.
export function ProfilePostViewer({
  reels,
  initialIndex,
  onClose,
}: {
  reels: Reel[];
  initialIndex: number;
  onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      onClose();
    }
  }

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label="Farmer posts"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className="fixed inset-0 z-50 bg-shamba-ink outline-none"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close post viewer"
        className="absolute right-3 top-[calc(env(safe-area-inset-top,0px)+0.75rem)] z-30 inline-flex size-9 items-center justify-center rounded-full bg-black/30 text-shamba-card transition-colors hover:bg-black/50"
      >
        <X className="size-5" aria-hidden="true" />
      </button>

      <div className="absolute inset-0 overflow-hidden">
        <FeedHeaderVisibilityProvider>
          <ReelFeed reels={reels} nextCursor={null} initialIndex={initialIndex} />
        </FeedHeaderVisibilityProvider>
      </div>
    </div>
  );
}
