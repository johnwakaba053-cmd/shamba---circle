"use client";

import { useState } from "react";
import type { Reel } from "./types";
import { ReelCommentsSheet } from "./ReelCommentsSheet";
import { ReelInfo } from "./ReelInfo";
import { ReelInteractionRail } from "./ReelInteractionRail";
import { ReelMedia } from "./ReelMedia";

// One Reel, one full-viewport-height slide. sm+ shrinks to a centered,
// phone-shaped card (see ReelFeed.tsx) instead of stretching a vertical
// video across a full desktop-width screen.
export function ReelSlide({ reel }: { reel: Reel }) {
  const [commentsOpen, setCommentsOpen] = useState(false);

  return (
    <div className="relative h-full w-full shrink-0 snap-start snap-always overflow-hidden bg-shamba-ink sm:mx-auto sm:my-3 sm:h-[calc(100%-1.5rem)] sm:max-w-sm sm:rounded-shamba sm:border sm:border-shamba-line">
      <ReelMedia items={reel.media} />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />

      <ReelInfo reel={reel} />
      <ReelInteractionRail reel={reel} onOpenComments={() => setCommentsOpen(true)} />

      {commentsOpen && (
        <ReelCommentsSheet reel={reel} onClose={() => setCommentsOpen(false)} />
      )}
    </div>
  );
}
