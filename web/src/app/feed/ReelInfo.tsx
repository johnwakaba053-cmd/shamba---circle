"use client";

import { useState } from "react";
import Link from "next/link";
import { Rss, Tag, UserRound } from "lucide-react";
import type { Reel } from "./types";
import { ReelDeleteControl } from "./ReelDeleteControl";

// Bottom-left info block -- author, farming/community context, optional
// topic badge, caption, optional hashtags, own-post delete. No
// profile-picture upload exists in this codebase (public.profiles has
// no such column, and the public profile page itself falls back to a
// generic icon), so this stage uses the same generic-icon fallback
// rather than building avatar upload. The topic badge only renders
// when reel.topic is set -- choosing one is optional, so most Reels
// won't show it.
const CAPTION_PREVIEW_CHARS = 140;

// Hashtags render as plain muted text (no pill background), smaller
// and lighter than the caption, so they stay visually secondary to the
// Reel itself. Capped independently of FeedComposer's own input cap
// (hashtags.ts's MAX_HASHTAGS_PER_POST) so display stays bounded even
// if a Reel somehow has more -- a long tail collapses to "+N more"
// instead of growing the info block indefinitely.
const MAX_VISIBLE_HASHTAGS = 6;

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

        {reel.topic && (
          <span className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-black/30 px-2 py-0.5 font-mono text-xs font-semibold backdrop-blur-sm">
            <Tag className="size-3" aria-hidden="true" />
            {reel.topic}
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

      {reel.hashtags.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1">
          {reel.hashtags.slice(0, MAX_VISIBLE_HASHTAGS).map((tag) => (
            <span key={tag} className="font-mono text-xs text-shamba-card/80 drop-shadow">
              #{tag}
            </span>
          ))}
          {reel.hashtags.length > MAX_VISIBLE_HASHTAGS && (
            <span className="font-mono text-xs text-shamba-card/60 drop-shadow">
              +{reel.hashtags.length - MAX_VISIBLE_HASHTAGS} more
            </span>
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
