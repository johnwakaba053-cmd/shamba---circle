"use client";

import { useState } from "react";
import type { Reel } from "./types";
import { ReelCommentsSheet } from "./ReelCommentsSheet";
import { ReelInfo } from "./ReelInfo";
import { ReelInteractionRail } from "./ReelInteractionRail";
import { ReelMedia } from "./ReelMedia";
import { useOptionalReelPlayback } from "./ReelPlayback";
import { ReelTextCard } from "./ReelTextCard";

// One Reel, one full-viewport-height slide. sm+ shrinks to a centered,
// phone-shaped card (see ReelFeed.tsx) instead of stretching a vertical
// video across a full desktop-width screen.
//
// data-reel-id is how ReelFeed's IntersectionObserver knows which Reel
// is on screen; isActive (from ReelPlayback) lets only that one play.
// A Reel with no photo/video renders as a text card (ReelTextCard), and
// ReelInfo then skips repeating the caption underneath it.
export function ReelSlide({ reel }: { reel: Reel }) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const playback = useOptionalReelPlayback();
  const isActive = playback?.activeReelId === reel.id;
  const isTextOnly = reel.media.length === 0;

  return (
    <div
      data-reel-id={reel.id}
      className="relative h-full w-full shrink-0 snap-start snap-always overflow-hidden bg-shamba-ink sm:mx-auto sm:my-3 sm:h-[calc(100%-1.5rem)] sm:max-w-sm sm:rounded-shamba sm:border sm:border-shamba-line"
    >
      {isTextOnly ? (
        <ReelTextCard body={reel.body} />
      ) : (
        <ReelMedia items={reel.media} isActive={isActive} />
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />

      <ReelInfo reel={reel} hideCaption={isTextOnly} />
      <ReelInteractionRail reel={reel} onOpenComments={() => setCommentsOpen(true)} />

      {commentsOpen && (
        <ReelCommentsSheet reel={reel} onClose={() => setCommentsOpen(false)} />
      )}
    </div>
  );
}
