"use client";

import { useState } from "react";
import Link from "next/link";
import { Rss, UserRound } from "lucide-react";
import type { Reel } from "./types";
import { ReelDeleteControl } from "./ReelDeleteControl";

// Bottom-left info block -- author, farming/community context, caption,
// own-post delete. No profile-picture upload exists in this codebase
// (public.profiles has no such column, and the public profile page
// itself falls back to a generic icon), so this stage uses the same
// generic-icon fallback rather than building avatar upload.
const CAPTION_PREVIEW_CHARS = 140;

export function ReelInfo({ reel }: { reel: Reel }) {
  const [expanded, setExpanded] = useState(false);
  const isLongCaption = reel.body.length > CAPTION_PREVIEW_CHARS;

  return (
    <div className="absolute bottom-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] left-3 right-16 z-20 text-shamba-card">
      <div className="flex items-center gap-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-black/30 backdrop-blur-sm">
          <UserRound className="size-4" aria-hidden="true" />
        </span>
        <Link
          href={`/profile/${reel.profileId}`}
          className="font-sans text-sm font-semibold drop-shadow transition-colors hover:text-shamba-green"
        >
          {reel.authorDisplayName}
        </Link>
      </div>

      <div className="mt-2">
        {reel.communityId && reel.communityName ? (
          <Link
            href={`/communities/${reel.communityId}`}
            className="inline-flex items-center gap-1 rounded-full bg-black/30 px-2 py-0.5 font-mono text-xs font-semibold backdrop-blur-sm transition-colors hover:text-shamba-green"
          >
            {reel.communityName}
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-black/30 px-2 py-0.5 font-mono text-xs font-semibold backdrop-blur-sm">
            <Rss className="size-3" aria-hidden="true" />
            Farming Reel
          </span>
        )}
      </div>

      {reel.body && (
        <div className="mt-2 text-sm leading-5 drop-shadow">
          <p
            className={
              expanded
                ? "max-h-[35vh] overflow-y-auto overscroll-contain whitespace-pre-wrap pr-1"
                : "line-clamp-3 whitespace-pre-wrap"
            }
          >
            {reel.body}
          </p>
          {isLongCaption && (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className="mt-0.5 font-mono text-xs font-semibold text-shamba-card/80 hover:text-shamba-card"
            >
              {expanded ? "Show less" : "Show more"}
            </button>
          )}
        </div>
      )}

      {reel.isAuthor && (
        <div className="mt-2">
          <ReelDeleteControl postId={reel.id} />
        </div>
      )}
    </div>
  );
}
