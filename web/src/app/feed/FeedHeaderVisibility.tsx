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

// Wraps AppHeader (unmodified, imported as-is by page.tsx) so it can
// collapse out of flow smoothly. A grid-template-rows 1fr/0fr transition
// is used instead of a fixed max-height, since AppHeader's own height
// isn't fixed -- its nav links wrap onto extra lines on narrow
// viewports -- so this animates to and from whatever its natural height
// actually is. The sibling flex-1 Reel area in page.tsx reflows to
// reclaim the freed space in the same motion, so the header never
// permanently reserves space while hidden. `inert` (not just
// aria-hidden) also keeps its nav links out of the tab order while
// collapsed, without needing to touch AppHeader's own internals.
export function FeedHeaderBar({ children }: { children: React.ReactNode }) {
  const { hidden } = useFeedHeaderVisibility();

  return (
    <div
      inert={hidden}
      className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
        hidden ? "grid-rows-[0fr]" : "grid-rows-[1fr]"
      }`}
    >
      <div className="overflow-hidden">{children}</div>
    </div>
  );
}
