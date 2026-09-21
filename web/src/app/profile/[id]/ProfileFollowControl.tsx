"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// Same public.follows table and insert/delete shape as ReelFollowControl
// (src/app/feed/ReelFollowControl.tsx) -- this is a second, differently
// -styled control over the identical data, not a second follow system.
// follower_profile_id must equal the caller; the table's own
// follows_no_self_follow CHECK constraint and RLS policies both
// independently block a self-follow regardless of what this component
// does, and this control is never rendered on the viewer's own profile
// in the first place (see page.tsx's `!isOwnProfile` guard).
const UNIQUE_VIOLATION = "23505";

export function ProfileFollowControl({
  profileId,
  initialFollowing,
}: {
  profileId: string;
  initialFollowing: boolean;
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleToggle() {
    if (isLoading) return;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setErrorMessage("Please sign in again.");
        return;
      }

      if (following) {
        const { error } = await supabase
          .from("follows")
          .delete()
          .eq("follower_profile_id", user.id)
          .eq("followed_profile_id", profileId);

        if (error) {
          setErrorMessage("We couldn't unfollow right now. Please try again.");
          return;
        }
        setFollowing(false);
      } else {
        const { error } = await supabase
          .from("follows")
          .insert({ follower_profile_id: user.id, followed_profile_id: profileId });

        // A duplicate insert (23505) means the end state is already
        // correct -- treated as success, same convention already used
        // by MembershipControl.tsx for a raced double-tap join.
        if (error && error.code !== UNIQUE_VIOLATION) {
          setErrorMessage("We couldn't follow right now. Please try again.");
          return;
        }
        setFollowing(true);
      }
    } catch {
      setErrorMessage("Something went wrong. Please try again in a moment.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={handleToggle}
        disabled={isLoading}
        aria-pressed={following}
        className={
          following
            ? "inline-flex items-center justify-center gap-2 rounded-shamba border border-shamba-line px-6 py-2.5 font-sans text-sm font-semibold text-shamba-ink transition-colors hover:bg-shamba-bg disabled:cursor-not-allowed disabled:opacity-70"
            : "inline-flex items-center justify-center gap-2 rounded-shamba bg-shamba-green px-6 py-2.5 font-sans text-sm font-semibold text-shamba-card transition-colors hover:bg-shamba-green-deep disabled:cursor-not-allowed disabled:opacity-70"
        }
      >
        {isLoading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        {isLoading ? (following ? "Unfollowing…" : "Following…") : following ? "Following" : "Follow"}
      </button>

      {errorMessage && (
        <p role="alert" className="text-xs font-semibold text-shamba-rust">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
