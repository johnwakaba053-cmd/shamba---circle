"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

// Shared playback state for the vertical Reel viewer, so at most ONE
// Reel video plays at a time:
//   - visibleReelId: the Reel ReelFeed's IntersectionObserver reports as
//     on screen (set by ReelFeed only).
//   - activeReelId: visibleReelId, but null while the app is in the
//     background or something is "suspending" playback (a Story open on
//     top, the Reel composer open) -- ReelMedia plays only when its Reel
//     is the activeReelId.
//   - muted: one choice for the whole feed, starting muted (the only way
//     mobile browsers allow autoplay); unmuting one Reel keeps the next
//     ones unmuted, the way farmers expect from Reels apps.
type ReelPlaybackValue = {
  activeReelId: string | null;
  setVisibleReelId: (id: string | null) => void;
  muted: boolean;
  toggleMuted: () => void;
  setSuspended: (key: string, suspended: boolean) => void;
};

const ReelPlaybackContext = createContext<ReelPlaybackValue | null>(null);

export function ReelPlaybackProvider({ children }: { children: React.ReactNode }) {
  const [visibleReelId, setVisibleReelId] = useState<string | null>(null);
  const [muted, setMuted] = useState(true);
  const [suspendedKeys, setSuspendedKeys] = useState<string[]>([]);
  const [pageVisible, setPageVisible] = useState(true);

  useEffect(() => {
    function handleVisibilityChange() {
      setPageVisible(document.visibilityState === "visible");
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  const toggleMuted = useCallback(() => setMuted((value) => !value), []);

  const setSuspended = useCallback((key: string, suspended: boolean) => {
    setSuspendedKeys((keys) => {
      const has = keys.includes(key);
      if (suspended === has) return keys;
      return suspended ? [...keys, key] : keys.filter((k) => k !== key);
    });
  }, []);

  const activeReelId = pageVisible && suspendedKeys.length === 0 ? visibleReelId : null;

  const value = useMemo(
    () => ({ activeReelId, setVisibleReelId, muted, toggleMuted, setSuspended }),
    [activeReelId, muted, toggleMuted, setSuspended],
  );

  return <ReelPlaybackContext.Provider value={value}>{children}</ReelPlaybackContext.Provider>;
}

// null outside a provider -- ReelFeed uses that to supply its own
// provider when it's rendered standalone (ProfilePostViewer).
export function useOptionalReelPlayback() {
  return useContext(ReelPlaybackContext);
}

export function useReelPlayback() {
  const context = useContext(ReelPlaybackContext);
  if (!context) {
    throw new Error("useReelPlayback must be used within a ReelPlaybackProvider");
  }
  return context;
}

// Pauses every Reel while `suspended` is true (e.g. a Story or the Reel
// composer is open on top). A no-op outside a provider, so components
// that are also used elsewhere never need to know about Reels.
export function useSuspendReelPlayback(key: string, suspended: boolean) {
  const context = useContext(ReelPlaybackContext);
  const setSuspended = context?.setSuspended;

  useEffect(() => {
    if (!setSuspended) return;
    setSuspended(key, suspended);
    return () => setSuspended(key, false);
  }, [key, suspended, setSuspended]);
}
