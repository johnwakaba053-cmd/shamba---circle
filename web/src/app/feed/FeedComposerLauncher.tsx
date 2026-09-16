"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { FeedComposer } from "./FeedComposer";

// A large always-visible composer box no longer fits a one-Reel-fills-
// the-viewport experience, so post creation moves behind a floating
// action button -- same FeedComposer component and upload flow
// underneath, unmodified, just triggered from a modal instead of being
// permanently docked above the feed.
//
// The FAB stays on the right (natural one-handed thumb reach) but is
// raised well above ReelInteractionRail's tallest possible stack --
// Follow (44px) + gap (20px) + Like (44px icon + 4px gap + ~16px count
// text = 64px) + gap (20px) + Comment (64px) = 212px of content sitting
// on a 24px (safe-area + 1.5rem) base offset, i.e. up to 236px from the
// bottom edge. 16rem (256px) clears that with room to spare even if the
// rail's own spacing changes slightly later -- previously this button
// sat at 1.25rem and visually overlapped the rail's bottom-most
// (Comment) control on mobile, where a Reel fills the whole viewport.
export function FeedComposerLauncher() {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.focus();
  }, [open]);

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Post a Farming Reel"
        className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+16rem)] right-4 z-30 inline-flex size-14 items-center justify-center rounded-full bg-shamba-green text-shamba-card shadow-lg transition-colors hover:bg-shamba-green-deep"
      >
        <Plus className="size-6" aria-hidden="true" />
      </button>

      {open && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="feed-composer-title"
          tabIndex={-1}
          onKeyDown={handleKeyDown}
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50 outline-none sm:items-center sm:justify-center"
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div className="max-h-[85dvh] overflow-y-auto rounded-t-shamba border-t border-shamba-line bg-shamba-bg p-4 sm:w-full sm:max-w-sm sm:rounded-shamba sm:border">
            <div className="mb-3 flex items-center justify-between">
              <h2
                id="feed-composer-title"
                className="font-display text-lg font-semibold text-shamba-ink"
              >
                New Farming Reel
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="inline-flex size-8 items-center justify-center rounded-full text-shamba-ink-soft transition-colors hover:bg-shamba-card hover:text-shamba-ink"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            <FeedComposer onPosted={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
