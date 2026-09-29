"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Photo/video/Story links are signed for 1 hour (lib/postMedia.ts,
// feed/stories.ts). An installed PWA can sit in the background far longer,
// and on return every image/video would be broken until a manual refresh.
//
// When the app comes back to the foreground and the links on this page
// are at least REFRESH_AFTER_MS old, this re-renders the page on the
// server with router.refresh() -- fresh links, no full reload: the Feed's
// scroll position, pages loaded in place (ReelFeed re-syncs those too) and
// all client state are kept. It never refreshes for a short trip away, on
// in-app navigation (no visibility event fires), or right after a load;
// several events for one return (visibilitychange + focus + pageshow)
// trigger at most ONE refresh, and the refreshed page brings a new
// issuedAt, so it can't loop.
const REFRESH_AFTER_MS = 50 * 60 * 1000;

export function RefreshStaleMedia({ issuedAt }: { issuedAt: number }) {
  const router = useRouter();

  useEffect(() => {
    let requested = false;

    function refreshIfStale() {
      if (requested || document.visibilityState !== "visible") return;
      if (Date.now() - issuedAt < REFRESH_AFTER_MS) return;
      requested = true;
      router.refresh();
    }

    document.addEventListener("visibilitychange", refreshIfStale);
    window.addEventListener("pageshow", refreshIfStale);
    window.addEventListener("focus", refreshIfStale);
    return () => {
      document.removeEventListener("visibilitychange", refreshIfStale);
      window.removeEventListener("pageshow", refreshIfStale);
      window.removeEventListener("focus", refreshIfStale);
    };
  }, [issuedAt, router]);

  return null;
}
