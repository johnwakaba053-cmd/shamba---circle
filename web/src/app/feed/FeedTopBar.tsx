import Link from "next/link";
import { ChevronLeft, Sprout } from "lucide-react";

// The way out of the full-screen Farming Reels experience: one small,
// translucent pill in the top-left corner (clear of the notch via the
// safe-area inset), readable over both the light Stories band and dark
// Reel media. On the Feed it goes to /communities -- the same "home" the
// app logo and sign-in already lead to -- so leaving Reels never depends
// on Android's back button. The Feed stays immersive: no header bar, no
// nav row.
//
// A single Reel page (/reels/[reelId]) reuses the same pill with its own
// destination and label (back to the Farming Reels feed); the defaults
// are exactly the Feed's.
export function FeedTopBar({
  href = "/communities",
  label = "Shamba Space",
  ariaLabel = "Leave Farming Reels and go to Shamba Space home",
}: {
  href?: string;
  label?: string;
  ariaLabel?: string;
} = {}) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className="fixed left-3 top-[calc(env(safe-area-inset-top,0px)+0.75rem)] z-30 inline-flex h-9 items-center gap-1.5 rounded-full bg-black/45 pl-2 pr-3.5 font-sans text-sm font-semibold text-shamba-card shadow-sm backdrop-blur-sm transition-colors hover:bg-black/60"
    >
      <ChevronLeft className="size-4" aria-hidden="true" />
      <Sprout className="size-4 text-shamba-card" aria-hidden="true" />
      {label}
    </Link>
  );
}
