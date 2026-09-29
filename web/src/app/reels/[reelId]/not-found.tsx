import Link from "next/link";
import { Clapperboard } from "lucide-react";
import { FeedTopBar } from "@/app/feed/FeedTopBar";

// Shown for /reels/<id> when the id is malformed or no such Reel exists
// (including one that has since been deleted). Never distinguishes the
// two, and never reveals anything about the Reel.
export default function ReelNotFound() {
  return (
    <div className="relative h-[100dvh] overflow-hidden bg-shamba-bg">
      <FeedTopBar href="/feed" label="Farming Reels" ariaLabel="Back to the Farming Reels feed" />

      <main className="absolute inset-0 flex flex-col items-center justify-center px-6 pb-[env(safe-area-inset-bottom,0px)]">
        <div className="w-full max-w-sm rounded-shamba border border-shamba-line bg-shamba-card p-6 text-center">
          <Clapperboard className="mx-auto size-8 text-shamba-ink-soft" aria-hidden="true" />
          <h1 className="mt-3 font-display text-xl font-bold text-shamba-ink">
            This Reel isn&apos;t available
          </h1>
          <p className="mt-2 text-sm leading-6 text-shamba-ink-soft">
            It may have been deleted, or the link may be wrong.
          </p>

          <div className="mt-5 flex flex-col gap-2">
            <Link
              href="/feed"
              className="inline-flex items-center justify-center rounded-shamba bg-shamba-green px-6 py-3 font-sans text-base font-semibold text-shamba-card transition-colors hover:bg-shamba-green-deep"
            >
              Watch Farming Reels
            </Link>
            <Link
              href="/communities"
              className="inline-flex items-center justify-center rounded-shamba border border-shamba-line px-6 py-3 font-sans text-base font-semibold text-shamba-ink transition-colors hover:bg-shamba-bg"
            >
              Go to Communities
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
