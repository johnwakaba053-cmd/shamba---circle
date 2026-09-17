import { UserRound } from "lucide-react";
import type { ActiveStory } from "./stories";

// One creator's ring in the Stories row. Since Step 71C this opens
// StoryViewer via onOpen -- a real <button>, not a clickable div, per
// the accessibility requirement that every control here be a genuine
// interactive element. Only ever rendered for entries already filtered
// to expires_at > now() by fetchActiveStories (stories.ts), so there is
// no separate "is this expired" check needed here -- an expired Story
// simply never produces a bubble to tap in the first place. No
// profile-image system exists (public.profiles has no such column,
// same constraint already established for Reel authors/mentions), so
// this falls back to the creator's first initial, or a generic icon
// when even the name can't be resolved (a private, non-public profile).
export function StoryBubble({ story, onOpen }: { story: ActiveStory; onOpen: () => void }) {
  const initial = story.displayName?.trim().charAt(0).toUpperCase();

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`View ${story.displayName ?? "Member"}'s Story`}
      className="flex w-16 shrink-0 flex-col items-center gap-1"
    >
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
    </button>
  );
}
