"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { randomId } from "@/lib/randomId";

// Android/browser Back closes the open overlay (comments sheet, composer,
// Story viewer/composer, full-screen media, profile Reel viewer) instead
// of leaving the page -- so a half-written comment or Reel and the
// farmer's place in the Feed are never lost.
//
// While active, an overlay owns exactly ONE extra history entry for the
// SAME URL (no address change, no reload: Next.js's patched pushState
// copies its router state into the entry, so Back is a normal in-app
// restore). A module-level stack records which overlay owns which entry,
// so with nested overlays (full-screen media inside the profile viewer)
// one Back closes only the topmost one.
//
// Closing paths:
//   - Back / popstate: the topmost overlay closes.
//   - X, Escape, backdrop: call the returned requestClose(), which pops
//     the overlay's own entry (history.back()), so no entry is left over.
//   - Programmatic (posted, published, last Story ended...): the entry is
//     removed as the overlay deactivates -- but only if the URL is still
//     the one it was opened on, so following a link out of an overlay is
//     never pulled back. Cleanup is deferred one tick so React's dev
//     double-mount (StrictMode) neither pushes twice nor drops the entry.
//
// The URL is compared rather than history.state because Next.js rewrites
// the current entry's state on router.refresh() (e.g. after posting a
// comment), dropping custom keys.
type OverlayEntry = { token: string; href: string; close: () => void };

const overlayStack: OverlayEntry[] = [];
let ignoredPops = 0;
let listening = false;

function ensurePopStateListener() {
  if (listening) return;
  listening = true;
  window.addEventListener("popstate", () => {
    if (ignoredPops > 0) {
      ignoredPops -= 1; // our own history.back() from a programmatic close
      return;
    }
    overlayStack.pop()?.close();
  });
}

export function useBackToClose(active: boolean, onClose: () => void): () => void {
  const [token] = useState(randomId);
  const onCloseRef = useRef(onClose);
  const liveRef = useRef(false);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!active) return;

    liveRef.current = true;
    ensurePopStateListener();

    if (!overlayStack.some((entry) => entry.token === token)) {
      overlayStack.push({ token, href: window.location.href, close: () => onCloseRef.current() });
      window.history.pushState({ shambaOverlay: token }, "");
    }

    return () => {
      liveRef.current = false;
      window.setTimeout(() => {
        if (liveRef.current) return; // re-activated (StrictMode remount) -- keep the entry

        const index = overlayStack.findIndex((entry) => entry.token === token);
        if (index === -1) return; // already popped by Back

        const [entry] = overlayStack.splice(index, 1);
        const wasTop = index === overlayStack.length;
        if (wasTop && window.location.href === entry.href) {
          ignoredPops += 1;
          window.history.back();
        }
      }, 0);
    };
  }, [active, token]);

  return useCallback(() => {
    if (overlayStack.some((entry) => entry.token === token)) {
      window.history.back(); // popstate closes the topmost overlay: this one
    } else {
      onCloseRef.current();
    }
  }, [token]);
}
