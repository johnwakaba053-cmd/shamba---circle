import { Loader2 } from "lucide-react";
import { FeedTopBar } from "@/app/feed/FeedTopBar";

// Shown instantly while a single Reel loads, in the same dark,
// full-screen shape the Reel itself will fill.
export default function ReelLoading() {
  return (
    <div className="relative flex h-[100dvh] items-center justify-center overflow-hidden bg-shamba-ink">
      <FeedTopBar href="/feed" label="Farming Reels" ariaLabel="Back to the Farming Reels feed" />
      <p
        role="status"
        className="inline-flex items-center gap-2 font-sans text-sm font-semibold text-shamba-card/80"
      >
        <Loader2 className="size-5 animate-spin" aria-hidden="true" />
        Loading Reel…
      </p>
    </div>
  );
}
