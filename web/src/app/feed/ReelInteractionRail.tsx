"use client";

import { MessageCircle } from "lucide-react";
import type { Reel } from "./types";
import { ReelFollowControl } from "./ReelFollowControl";
import { ReelLikeControl } from "./ReelLikeControl";

// Vertical icon rail, lower-right, over the media -- like, comments,
// follow. Share is intentionally omitted: no share feature exists
// anywhere else in this codebase yet, and the instruction for this
// stage is to surface it only "if already available."
export function ReelInteractionRail({
  reel,
  onOpenComments,
}: {
  reel: Reel;
  onOpenComments: () => void;
}) {
  return (
    <div className="absolute bottom-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] right-3 z-20 flex flex-col items-center gap-5">
      {reel.showFollow && (
        <ReelFollowControl profileId={reel.profileId} initialFollowing={reel.isFollowing} />
      )}

      <ReelLikeControl
        postId={reel.id}
        initialLiked={reel.liked}
        initialLikeCount={reel.likeCount}
      />

      <button
        type="button"
        onClick={onOpenComments}
        aria-label="View comments"
        className="flex flex-col items-center gap-1 text-shamba-card"
      >
        <span className="flex size-11 items-center justify-center rounded-full bg-black/30 backdrop-blur-sm">
          <MessageCircle className="size-6" aria-hidden="true" />
        </span>
        <span className="font-mono text-xs font-semibold drop-shadow">{reel.comments.length}</span>
      </button>
    </div>
  );
}
