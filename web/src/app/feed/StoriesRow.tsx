import { Plus } from "lucide-react";
import type { ActiveStory } from "./stories";
import { StoryBubble } from "./StoryBubble";

// Sits above ReelFeed as a fixed-height strip in normal flex flow -- see
// page.tsx for the layout it's mounted in. This is safe alongside the
// Reel viewport's stability work from Steps 56-58 specifically because
// this row's height never changes after the page mounts: there's no
// show/hide toggle, no animation, and its content is fully resolved
// server-side before the page ever renders client-side. The original
// flicker bug was caused by an *animated* header collapse resizing the
// Reel scroll container mid-gesture -- a sibling with a constant height
// for its whole mounted lifetime doesn't have that failure mode, even
// though the flex-col + flex-1 shape looks structurally similar.
//
// "Your Story" is a visual shell only -- Step 71A builds no composer,
// so it's deliberately not a button and has no onClick. Real Story
// bubbles are the same: nothing here is tappable yet, since there's no
// viewer to open either.
export function StoriesRow({ stories }: { stories: ActiveStory[] }) {
  return (
    <div className="shrink-0 border-b border-shamba-line bg-shamba-card px-4 py-3">
      <h2 className="font-mono text-xs font-semibold uppercase tracking-wide text-shamba-ink-soft">
        Stories
      </h2>

      <div className="mt-2 flex touch-pan-x gap-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex w-16 shrink-0 flex-col items-center gap-1">
          <span className="flex size-16 items-center justify-center rounded-full border-2 border-dashed border-shamba-line bg-shamba-bg">
            <Plus className="size-6 text-shamba-green" aria-hidden="true" />
          </span>
          <span className="w-full truncate text-center font-mono text-xs text-shamba-ink-soft">
            Your Story
          </span>
        </div>

        {stories.map((story) => (
          <StoryBubble key={story.id} story={story} />
        ))}
      </div>
    </div>
  );
}
