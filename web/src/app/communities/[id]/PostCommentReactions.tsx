"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// Postgres unique_violation — hit when a duplicate reaction races the
// primary key (e.g. a double-tap). The end state is already correct, so
// this is treated as success, not an error.
const UNIQUE_VIOLATION = "23505";

const REACTIONS = [
  { type: "love", emoji: "❤️", label: "Love" },
  { type: "helpful", emoji: "👍", label: "Helpful" },
  { type: "funny", emoji: "😂", label: "Funny" },
  { type: "surprised", emoji: "😮", label: "Surprised" },
  { type: "thanks", emoji: "🙏", label: "Thanks" },
  { type: "money", emoji: "💰", label: "Money" },
] as const;

type ReactionType = (typeof REACTIONS)[number]["type"];

type Status =
  | { kind: "idle" }
  | { kind: "error"; message: string };

export function PostCommentReactions({
  commentId,
  isMember,
  initialMyReactionTypes,
  initialCounts,
}: {
  commentId: string;
  isMember: boolean;
  initialMyReactionTypes: string[];
  initialCounts: { reaction_type: string; count: number }[];
}) {
  const [myReactions, setMyReactions] = useState<Set<ReactionType>>(
    () => new Set(initialMyReactionTypes.filter(isReactionType)),
  );
  const [counts, setCounts] = useState<Record<ReactionType, number>>(() => {
    const base = {} as Record<ReactionType, number>;
    for (const reaction of REACTIONS) {
      base[reaction.type] =
        initialCounts.find((row) => row.reaction_type === reaction.type)?.count ?? 0;
    }
    return base;
  });
  const [loadingType, setLoadingType] = useState<ReactionType | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function toggleReaction(type: ReactionType) {
    if (!isMember || loadingType) return;

    setLoadingType(type);
    setStatus({ kind: "idle" });

    const alreadyReacted = myReactions.has(type);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setStatus({ kind: "error", message: "Please sign in again." });
        setLoadingType(null);
        return;
      }

      if (alreadyReacted) {
        const { error } = await supabase
          .from("comment_reactions")
          .delete()
          .eq("comment_id", commentId)
          .eq("profile_id", user.id)
          .eq("reaction_type", type);

        if (error) {
          setStatus({
            kind: "error",
            message: "We couldn't update your reaction. Please try again.",
          });
          setLoadingType(null);
          return;
        }

        setMyReactions((prev) => {
          const next = new Set(prev);
          next.delete(type);
          return next;
        });
        setCounts((prev) => ({ ...prev, [type]: Math.max(0, prev[type] - 1) }));
      } else {
        const { error } = await supabase
          .from("comment_reactions")
          .insert({ comment_id: commentId, profile_id: user.id, reaction_type: type });

        if (error && error.code !== UNIQUE_VIOLATION) {
          setStatus({
            kind: "error",
            message: "We couldn't update your reaction. Please try again.",
          });
          setLoadingType(null);
          return;
        }

        setMyReactions((prev) => new Set(prev).add(type));
        setCounts((prev) => ({ ...prev, [type]: prev[type] + 1 }));
      }
    } catch {
      setStatus({
        kind: "error",
        message: "Something went wrong. Please try again in a moment.",
      });
    } finally {
      setLoadingType(null);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-1.5">
        {REACTIONS.map((reaction) => {
          const isSelected = myReactions.has(reaction.type);
          const isLoading = loadingType === reaction.type;

          return (
            <button
              key={reaction.type}
              type="button"
              onClick={() => toggleReaction(reaction.type)}
              disabled={!isMember || isLoading}
              aria-pressed={isSelected}
              title={isMember ? reaction.label : "Join this community to react"}
              className={
                isSelected
                  ? "inline-flex items-center gap-1 rounded-shamba border border-shamba-green bg-shamba-green px-2 py-1 font-sans text-xs font-semibold text-shamba-card transition-colors disabled:cursor-not-allowed disabled:opacity-70"
                  : "inline-flex items-center gap-1 rounded-shamba border border-shamba-line bg-shamba-bg px-2 py-1 font-sans text-xs font-semibold text-shamba-ink-soft transition-colors hover:border-shamba-green disabled:cursor-not-allowed disabled:opacity-70"
              }
            >
              {isLoading ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <span
                  aria-hidden="true"
                  style={{
                    fontFamily:
                      '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif',
                  }}
                >
                  {reaction.emoji}
                </span>
              )}
              <span>{counts[reaction.type]}</span>
            </button>
          );
        })}
      </div>

      {status.kind === "error" && (
        <p role="alert" className="text-xs font-semibold text-shamba-rust">
          {status.message}
        </p>
      )}
    </div>
  );
}

function isReactionType(value: string): value is ReactionType {
  return REACTIONS.some((reaction) => reaction.type === value);
}
