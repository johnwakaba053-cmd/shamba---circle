"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { ActiveStory } from "./stories";
import { StoryBubble } from "./StoryBubble";
import { StoryComposer } from "./StoryComposer";
import { StoryViewer } from "./StoryViewer";

// Rendered as ReelFeed's `header` -- the first child inside its own
// scroll-snap container (see ReelFeed.tsx), not a separate non-scrolling
// sibling above it. `snap-start` makes it a real snap point: scrolling
// down moves it off-screen into Reel 1 like any other scrolled-past
// content, and scrolling back up returns to it, with no JS-driven show/
// hide logic at all. This is still safe alongside the Reel viewport's
// stability work from Steps 56-58: that fix was about an *animated*
// resize of the scroll container's own box height (clientHeight) mid-
// gesture, which corrupts scroll position -- this row's own height is
// static (no show/hide toggle, no animation, content fully resolved
// server-side before the page ever renders client-side), so it only ever
// changes the container's scrollHeight, which is exactly what
// overflow-y-auto/scroll-snap are designed to handle.
//
// "use client" became necessary in Step 71B (composer) and stays for
// Step 71C's viewer state. This component only coordinates *which*
// overlay is open (composer vs. viewer) and, for the viewer, which
// creator index to start at -- StoryComposer and StoryViewer each own
// all of their own internal logic.
export function StoriesRow({ stories }: { stories: ActiveStory[] }) {
  const [composerOpen, setComposerOpen] = useState(false);
  const [viewerCreatorIndex, setViewerCreatorIndex] = useState<number | null>(null);
  const [checkingOwnStory, setCheckingOwnStory] = useState(false);

  // "Your Story" routes to one of two places: if this viewer already
  // has an active Story (found in the row's own already-fetched
  // `stories` list -- a fast, synchronous check, not a fresh query),
  // open their sequence in StoryViewer; otherwise open StoryComposer,
  // unchanged from Step 71B. StoryViewer itself re-verifies freshly via
  // fetchCreatorActiveStories once it actually opens, so this routing
  // check only ever needs to be "good enough to pick the right UI," not
  // the authoritative expiry check.
  async function handleYourStoryClick() {
    if (checkingOwnStory) return;
    setCheckingOwnStory(true);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    setCheckingOwnStory(false);

    if (!user) return;

    const ownIndex = stories.findIndex((story) => story.profileId === user.id);
    if (ownIndex !== -1) {
      setViewerCreatorIndex(ownIndex);
    } else {
      setComposerOpen(true);
    }
  }

  return (
    <div className="shrink-0 snap-start border-b border-shamba-line bg-shamba-card px-4 pb-3 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)]">
      <h2 className="font-mono text-xs font-semibold uppercase tracking-wide text-shamba-ink-soft">
        Stories
      </h2>

      <div className="mt-2 flex touch-pan-x gap-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={handleYourStoryClick}
          disabled={checkingOwnStory}
          className="flex w-16 shrink-0 flex-col items-center gap-1 disabled:opacity-70"
        >
          <span className="flex size-16 items-center justify-center rounded-full border-2 border-dashed border-shamba-line bg-shamba-bg transition-colors hover:border-shamba-green">
            <Plus className="size-6 text-shamba-green" aria-hidden="true" />
          </span>
          <span className="w-full truncate text-center font-mono text-xs text-shamba-ink-soft">
            Your Story
          </span>
        </button>

        {stories.map((story, index) => (
          <StoryBubble key={story.id} story={story} onOpen={() => setViewerCreatorIndex(index)} />
        ))}
      </div>

      {composerOpen && (
        <StoryComposer
          onClose={() => setComposerOpen(false)}
          onPublished={() => setComposerOpen(false)}
        />
      )}

      {viewerCreatorIndex !== null && (
        <StoryViewer
          creators={stories}
          initialCreatorIndex={viewerCreatorIndex}
          onClose={() => setViewerCreatorIndex(null)}
        />
      )}
    </div>
  );
}
