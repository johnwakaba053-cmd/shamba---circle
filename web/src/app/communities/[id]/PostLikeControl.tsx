"use client";

import { useState } from "react";
import { Heart, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// Postgres unique_violation — hit when a duplicate like races the primary
// key (e.g. a double-tap). The end state is already correct, so this is
// treated as success, not an error.
const UNIQUE_VIOLATION = "23505";

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string };

export function PostLikeControl({
  postId,
  isMember,
  initialLiked,
  initialLikeCount,
}: {
  postId: string;
  isMember: boolean;
  initialLiked: boolean;
  initialLikeCount: number;
}) {
  const [liked, setLiked] = useState(initialLiked);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const isLoading = status.kind === "loading";

  async function handleToggle() {
    if (isLoading || !isMember) return;

    setStatus({ kind: "loading" });

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setStatus({ kind: "error", message: "Please sign in again." });
        return;
      }

      if (liked) {
        const { error } = await supabase
          .from("post_likes")
          .delete()
          .eq("post_id", postId)
          .eq("profile_id", user.id);

        if (error) {
          setStatus({
            kind: "error",
            message: "We couldn't update your like. Please try again.",
          });
          return;
        }

        setStatus({ kind: "idle" });
        setLikeCount((count) => Math.max(0, count - 1));
        setLiked(false);
      } else {
        const { error } = await supabase
          .from("post_likes")
          .insert({ post_id: postId, profile_id: user.id });

        if (error && error.code !== UNIQUE_VIOLATION) {
          setStatus({
            kind: "error",
            message: "We couldn't update your like. Please try again.",
          });
          return;
        }

        setStatus({ kind: "idle" });
        setLikeCount((count) => count + 1);
        setLiked(true);
      }
    } catch {
      setStatus({
        kind: "error",
        message: "Something went wrong. Please try again in a moment.",
      });
    }
  }

  return (
    <div className="mt-2 flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleToggle}
        disabled={isLoading || !isMember}
        aria-pressed={liked}
        title={isMember ? undefined : "Join this community to like posts"}
        className="inline-flex items-center gap-1.5 rounded-shamba border border-shamba-line px-3 py-1.5 font-sans text-sm font-semibold text-shamba-ink transition-colors hover:bg-shamba-bg disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isLoading ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Heart
            className={
              liked
                ? "size-4 fill-shamba-green text-shamba-green"
                : "size-4 text-shamba-ink-soft"
            }
            aria-hidden="true"
          />
        )}
        {likeCount} {likeCount === 1 ? "like" : "likes"}
      </button>

      {status.kind === "error" && (
        <p role="alert" className="text-xs font-semibold text-shamba-rust">
          {status.message}
        </p>
      )}
    </div>
  );
}
