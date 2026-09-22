"use client";

import { useEffect, useRef, useState } from "react";

// Client-only shell around the (already server-rendered) conversation
// stream and the message composer -- a Server Component can't hold the
// scroll/height state this needs, so it just renders its already-fetched
// children into this wrapper rather than fetching anything of its own.
//
// The composer is fixed to the viewport bottom (see PostComposer.tsx's
// bar layout) so it stays reachable above the on-screen keyboard on
// mobile, the same fixed-bottom-panel approach already used by
// ReelCommentsSheet.tsx elsewhere in this app. Its real rendered height
// is measured with ResizeObserver (same technique as
// PriceHistoryChart.tsx's width measurement) so the scrollable content
// above it always gets exactly enough bottom padding to never be hidden
// behind it, including when the media preview strip makes the composer
// taller.
export function CommunityConversation({
  children,
  composer,
  scrollKey,
}: {
  children: React.ReactNode;
  composer: React.ReactNode;
  scrollKey: string;
}) {
  const composerRef = useRef<HTMLDivElement>(null);
  const [composerHeight, setComposerHeight] = useState(96);

  useEffect(() => {
    const el = composerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const measured = entries[0]?.contentRect.height;
      if (measured && measured > 0) setComposerHeight(measured);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Opens scrolled to the newest message -- like walking into an ongoing
  // conversation, rather than at the oldest one -- and re-scrolls
  // whenever the newest post changes (e.g. right after this viewer sends
  // one). Plain window scrolling, matching this page's own document
  // flow (there's no separate inner scroll container).
  useEffect(() => {
    window.scrollTo({ top: document.documentElement.scrollHeight });
  }, [scrollKey]);

  return (
    <>
      <div
        className="mx-auto w-full max-w-sm flex-1 px-4 pt-4"
        style={{ paddingBottom: composerHeight + 16 }}
      >
        {children}
      </div>

      <div
        ref={composerRef}
        className="fixed inset-x-0 bottom-0 z-20 w-full border-t border-shamba-line bg-shamba-card"
      >
        <div className="mx-auto w-full max-w-sm px-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)] pt-2">
          {composer}
        </div>
      </div>
    </>
  );
}
