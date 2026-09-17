import { UserRound } from "lucide-react";
import type { ActiveStory } from "./stories";

// One creator's ring in the Stories row -- a visual shell only, per
// Step 71A: nothing here is clickable yet, since there's no Story
// viewer to open. Deliberately styled to look inviting rather than
// disabled/grayed-out -- it isn't broken, it's just not wired up yet.
// No profile-image system exists (public.profiles has no such column,
// same constraint already established for Reel authors/mentions), so
// this falls back to the creator's first initial, or a generic icon
// when even the name can't be resolved (a private, non-public profile).
export function StoryBubble({ story }: { story: ActiveStory }) {
  const initial = story.displayName?.trim().charAt(0).toUpperCase();

  return (
    <div className="flex w-16 shrink-0 flex-col items-center gap-1">
      <span className="flex size-16 items-center justify-center rounded-full bg-gradient-to-tr from-shamba-green to-shamba-ochre p-0.5">
        <span className="flex size-full items-center justify-center overflow-hidden rounded-full border-2 border-shamba-bg bg-shamba-card">
          {story.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={story.thumbnailUrl} alt="" className="size-full object-cover" />
          ) : initial ? (
            <span className="font-display text-lg font-semibold text-shamba-green">
              {initial}
            </span>
          ) : (
            <UserRound className="size-6 text-shamba-ink-soft" aria-hidden="true" />
          )}
        </span>
      </span>
      <span className="w-full truncate text-center font-mono text-xs text-shamba-ink-soft">
        {story.displayName ?? "Member"}
      </span>
    </div>
  );
}
