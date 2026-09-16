"use client";

import { useState } from "react";
import { Loader2, UserCheck, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// First UI for the public.follows table added in the Stage A database
// migration -- no prior frontend used it. Same insert/delete shape as
// every other own-row toggle control in this codebase (PostLikeControl,
// PostCommentReactions): follower_profile_id must equal the caller, and
// the table's own CHECK constraint plus RLS both independently block a
// self-follow, so this never needs to special-case it beyond simply not
// rendering the control on the viewer's own Reels (see Reel.showFollow).
const UNIQUE_VIOLATION = "23505";

export function ReelFollowControl({
  profileId,
  initialFollowing,
}: {
  profileId: string;
  initialFollowing: boolean;
}) {
  const [following, setFollowing] = useState(initialFollowing);
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

      if (following) {
        const { error } = await supabase
          .from("follows")
          .delete()
          .eq("follower_profile_id", user.id)
          .eq("followed_profile_id", profileId);

        if (!error) {
          setFollowing(false);
        }
      } else {
        const { error } = await supabase
          .from("follows")
          .insert({ follower_profile_id: user.id, followed_profile_id: profileId });

        if (!error || error.code === UNIQUE_VIOLATION) {
          setFollowing(true);
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
      aria-pressed={following}
      aria-label={following ? "Unfollow" : "Follow"}
      title={following ? "Unfollow" : "Follow"}
      className="flex flex-col items-center gap-1 text-shamba-card disabled:opacity-70"
    >
      <span
        className={
          following
            ? "flex size-11 items-center justify-center rounded-full bg-shamba-green"
            : "flex size-11 items-center justify-center rounded-full bg-black/30 backdrop-blur-sm"
        }
      >
        {isLoading ? (
          <Loader2 className="size-5 animate-spin" aria-hidden="true" />
        ) : following ? (
          <UserCheck className="size-5" aria-hidden="true" />
        ) : (
          <UserPlus className="size-5" aria-hidden="true" />
        )}
      </span>
    </button>
  );
}
