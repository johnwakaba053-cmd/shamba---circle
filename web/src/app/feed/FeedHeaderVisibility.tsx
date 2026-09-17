"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

// Scroll-direction source is ReelFeed's own vertical scroll container --
// its onScroll handler calls reportScrollTop below, so there is no
// separate page-level scroll listener. AppHeader sits above that
// container as a sibling in page.tsx (not a descendant of it), so a
// small shared context is the simplest way to let that distant scroll
// event drive the header's visibility without restructuring page.tsx's
// existing error/empty/populated branching.
const HIDE_THRESHOLD_PX = 8;

type FeedHeaderVisibilityContextValue = {
  hidden: boolean;
  reportScrollTop: (scrollTop: number) => void;
};

const FeedHeaderVisibilityContext = createContext<FeedHeaderVisibilityContextValue | null>(null);

export function FeedHeaderVisibilityProvider({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState(false);
  const lastScrollTop = useRef(0);

  const reportScrollTop = useCallback((scrollTop: number) => {
    // Always visible at the top of the feed, regardless of direction --
    // covers the initial load and scrolling/rubber-banding back up to
    // the first Reel.
    if (scrollTop <= 0) {
      lastScrollTop.current = 0;
      setHidden(false);
      return;
    }

    const delta = scrollTop - lastScrollTop.current;

    // A small deadzone avoids flicker from sub-pixel/momentum scroll
    // events and scroll-snap settling, which fire far more often than
    // an actual intentional swipe.
    if (delta > HIDE_THRESHOLD_PX) {
      lastScrollTop.current = scrollTop;
      setHidden(true);
    } else if (delta < -HIDE_THRESHOLD_PX) {
      lastScrollTop.current = scrollTop;
      setHidden(false);
    }
  }, []);

  return (
    <FeedHeaderVisibilityContext.Provider value={{ hidden, reportScrollTop }}>
      {children}
    </FeedHeaderVisibilityContext.Provider>
  );
}

export function useFeedHeaderVisibility() {
  const context = useContext(FeedHeaderVisibilityContext);
  if (!context) {
    throw new Error("useFeedHeaderVisibility must be used within a FeedHeaderVisibilityProvider");
  }
  return context;
}

// Wraps AppHeader (unmodified, imported as-is by page.tsx) as a fixed-
// height overlay pinned to the top of the Feed shell -- not a normal
// flex/grid layout participant. It used to collapse via an animated
// grid-template-rows, which changed its real rendered height on every
// frame of the transition; because it sat in normal flex flow next to
// main (flex-1), that resize propagated straight into ReelFeed's
// scroll-snap container (h-full, sized off main's live height) while
// the user was actively scrolled into it -- producing a visible jump,
// worse on upward scroll specifically, since revealing the header
// shrank the scroll container out from under the user's position
// mid-gesture. Animating only transform/opacity here means the
// header's own box never changes size or enters/leaves layout flow at
// all -- main and ReelFeed stay a fully stable height regardless of
// `hidden`, so the scroll-snap container is never resized by a scroll
// event that its own header transition caused. `inert` (not just
// aria-hidden) keeps its nav links out of the tab order while hidden,
// and pointer-events-none (on top of translating fully off-screen)
// stops it from intercepting taps on the Reel below it during the
// transition -- all without touching AppHeader's own internals.
export function FeedHeaderBar({ children }: { children: React.ReactNode }) {
  const { hidden } = useFeedHeaderVisibility();

  return (
    <div
      inert={hidden}
      className={`absolute inset-x-0 top-0 z-40 transition-[transform,opacity] duration-300 ease-in-out ${
        hidden ? "pointer-events-none -translate-y-full opacity-0" : "translate-y-0 opacity-100"
      }`}
    >
      {children}
    </div>
  );
}
