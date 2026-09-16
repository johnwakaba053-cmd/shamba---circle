"use client";

import { useState } from "react";
import { Heart, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// Rail-styled fork of communities/[id]/PostLikeControl.tsx -- identical
// post_likes read/write calls (same table, same RLS, same
// authenticated-only rule for both Community and Feed-level posts), only
// the presentation changes: a vertical icon+count suited to sitting over
// media instead of a bordered pill button. isMember is dropped since
// every Reel shown here is always engageable (Feed-level or a joined
// community -- see feed/page.tsx), so the gating that control needed
// never applies here.
const UNIQUE_VIOLATION = "23505";

export function ReelLikeControl({
  postId,
  initialLiked,
  initialLikeCount,
}: {
  postId: string;
  initialLiked: boolean;
  initialLikeCount: number;
}) {
  const [liked, setLiked] = useState(initialLiked);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [isLoading, setIsLoading] = useState(false);

  async function handleToggle() {
    if (isLoading) return;
    setIsLoading(true);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setIsLoading(false);
        return;
      }

      if (liked) {
        const { error } = await supabase
          .from("post_likes")
          .delete()
          .eq("post_id", postId)
          .eq("profile_id", user.id);

        if (!error) {
          setLikeCount((count) => Math.max(0, count - 1));
          setLiked(false);
        }
      } else {
        const { error } = await supabase
          .from("post_likes")
          .insert({ post_id: postId, profile_id: user.id });

        if (!error || error.code === UNIQUE_VIOLATION) {
          setLikeCount((count) => count + 1);
          setLiked(true);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={isLoading}
      aria-pressed={liked}
      className="flex flex-col items-center gap-1 text-shamba-card disabled:opacity-70"
    >
      <span className="flex size-11 items-center justify-center rounded-full bg-black/30 backdrop-blur-sm">
        {isLoading ? (
          <Loader2 className="size-5 animate-spin" aria-hidden="true" />
        ) : (
          <Heart
            className={liked ? "size-6 fill-shamba-green text-shamba-green" : "size-6"}
            aria-hidden="true"
          />
        )}
      </span>
      <span className="font-mono text-xs font-semibold drop-shadow">{likeCount}</span>
    </button>
  );
}
