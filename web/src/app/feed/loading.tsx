import { Loader2 } from "lucide-react";
import { FeedTopBar } from "./FeedTopBar";

// Shown instantly while the Feed's server render runs, so tapping
// "Farming Reels" never looks frozen. Same shape as the real page: the
// top control, the light Stories band, then a dark Reel area.
export default function FeedLoading() {
  return (
    <div className="relative flex h-[100dvh] flex-col overflow-hidden bg-shamba-ink">
      <FeedTopBar />

      <div className="shrink-0 border-b border-shamba-line bg-shamba-card px-4 pb-3 pt-[calc(env(safe-area-inset-top,0px)+3.5rem)]">
        <p className="font-mono text-xs font-semibold uppercase tracking-wide text-shamba-ink-soft">
          Stories
        </p>
        <div className="mt-2 flex gap-3" aria-hidden="true">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="flex w-16 shrink-0 flex-col items-center gap-1">
              <span className="size-16 animate-pulse rounded-full bg-shamba-line" />
              <span className="h-3 w-12 animate-pulse rounded bg-shamba-line" />
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center">
        <p
          role="status"
          className="inline-flex items-center gap-2 font-sans text-sm font-semibold text-shamba-card/80"
        >
          <Loader2 className="size-5 animate-spin" aria-hidden="true" />
          Loading Farming Reels…
        </p>
      </div>
    </div>
  );
}
