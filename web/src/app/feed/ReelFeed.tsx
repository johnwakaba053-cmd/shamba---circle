"use client";

import Link from "next/link";
import { ArrowDown } from "lucide-react";
import type { Reel } from "./types";
import { ReelSlide } from "./ReelSlide";

// The vertical, one-Reel-per-screen viewer. Native CSS scroll-snap
// (overflow-y-auto + snap-y snap-mandatory), not a gesture/carousel
// library -- consistent with the horizontal media carousel this project
// already built the same way. Pagination stays the same keyset
// (?before=) navigation as the old card feed; it's simply presented as
// one more full-height slide at the end instead of a "Load more" link
// below a list.
export function ReelFeed({ reels, nextCursor }: { reels: Reel[]; nextCursor: string | null }) {
  return (
    <div className="h-full snap-y snap-mandatory overflow-y-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:bg-shamba-bg">
      {reels.map((reel) => (
        <ReelSlide key={reel.id} reel={reel} />
      ))}

      {nextCursor && (
        <div className="flex h-full w-full shrink-0 snap-start snap-always items-center justify-center sm:mx-auto sm:my-3 sm:h-[calc(100%-1.5rem)] sm:max-w-sm">
          <Link
            href={`/feed?before=${encodeURIComponent(nextCursor)}`}
            className="inline-flex flex-col items-center gap-2 rounded-shamba border border-shamba-line bg-shamba-card px-6 py-4 font-sans text-sm font-semibold text-shamba-ink transition-colors hover:border-shamba-green"
          >
            <ArrowDown className="size-5 text-shamba-green" aria-hidden="true" />
            Load more Reels
          </Link>
        </div>
      )}
    </div>
  );
}
