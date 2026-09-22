"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string };

// Postgres unique_violation — hit when a duplicate join races the primary
// key (e.g. a double-tap). The end state is already correct, so this is
// treated as success, not an error.
const UNIQUE_VIOLATION = "23505";

export function MembershipControl({
  communityId,
  initialIsMember,
  initialMemberCount,
  compact = false,
}: {
  communityId: string;
  initialIsMember: boolean;
  initialMemberCount: number;
  // Slim, single-row rendering (count + button side by side, no
  // standalone heading-sized text) for the Batch 1 conversation header,
  // which has its own tighter layout than the original card-style
  // header this component was first built for. Same join/leave logic
  // either way -- this only changes what's returned.
  compact?: boolean;
}) {
  const [isMember, setIsMember] = useState(initialIsMember);
  const [memberCount, setMemberCount] = useState(initialMemberCount);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const isLoading = status.kind === "loading";

  async function handleJoin() {
    if (isLoading) return;
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

      const { error } = await supabase
        .from("community_memberships")
        .insert({ profile_id: user.id, community_id: communityId });

      if (error && error.code !== UNIQUE_VIOLATION) {
        setStatus({
          kind: "error",
          message: "We couldn't join this community. Please try again.",
        });
        return;
      }

      setStatus({ kind: "idle" });
      if (!isMember) {
        setMemberCount((count) => count + 1);
      }
      setIsMember(true);
    } catch {
      setStatus({
        kind: "error",
        message: "Something went wrong. Please try again in a moment.",
      });
    }
  }

  async function handleLeave() {
    if (isLoading) return;
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

      const { error } = await supabase
        .from("community_memberships")
        .delete()
        .eq("profile_id", user.id)
        .eq("community_id", communityId);

      if (error) {
        setStatus({
          kind: "error",
          message: "We couldn't leave this community. Please try again.",
        });
        return;
      }

      setStatus({ kind: "idle" });
      if (isMember) {
        setMemberCount((count) => Math.max(0, count - 1));
      }
      setIsMember(false);
    } catch {
      setStatus({
        kind: "error",
        message: "Something went wrong. Please try again in a moment.",
      });
    }
  }

  if (compact) {
    return (
      <div className="flex w-full items-center justify-between gap-3">
        <p className="font-mono text-xs text-shamba-ink-soft">
          {memberCount} {memberCount === 1 ? "farmer" : "farmers"}
        </p>

        <div className="flex items-center gap-2">
          {status.kind === "error" && (
            <p role="alert" className="text-xs font-semibold text-shamba-rust">
              {status.message}
            </p>
          )}

          {isMember ? (
            <button
              type="button"
              onClick={handleLeave}
              disabled={isLoading}
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-shamba border border-shamba-line px-4 font-sans text-sm font-semibold text-shamba-ink transition-colors hover:bg-shamba-bg disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isLoading && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
              {isLoading ? "Leaving…" : "Leave"}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleJoin}
              disabled={isLoading}
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-shamba bg-shamba-green px-4 font-sans text-sm font-semibold text-shamba-card transition-colors hover:bg-shamba-green-deep disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isLoading && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
              {isLoading ? "Joining…" : "Join"}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-4">
      <p className="text-sm text-shamba-ink-soft">
        {memberCount} {memberCount === 1 ? "member" : "members"}
      </p>

      {status.kind === "error" && (
        <p role="alert" className="text-sm font-semibold text-shamba-rust">
          {status.message}
        </p>
      )}

      {isMember ? (
        <button
          type="button"
          onClick={handleLeave}
          disabled={isLoading}
          className="inline-flex items-center justify-center gap-2 rounded-shamba border border-shamba-line px-6 py-3 font-sans text-base font-semibold text-shamba-ink transition-colors hover:bg-shamba-bg disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isLoading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {isLoading ? "Leaving…" : "Leave Community"}
        </button>
      ) : (
        <button
          type="button"
          onClick={handleJoin}
          disabled={isLoading}
          className="inline-flex items-center justify-center gap-2 rounded-shamba bg-shamba-green px-6 py-3 font-sans text-base font-semibold text-shamba-card transition-colors hover:bg-shamba-green-deep disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isLoading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {isLoading ? "Joining…" : "Join Community"}
        </button>
      )}
    </div>
  );
}
