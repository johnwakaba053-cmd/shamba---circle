"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const MAX_BODY_LENGTH = 2000;

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success" }
  | { kind: "error"; message: string };

export function PostCommentComposer({
  postId,
  isMember,
}: {
  postId: string;
  isMember: boolean;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const isLoading = status.kind === "loading";
  const trimmedLength = body.trim().length;
  const remaining = MAX_BODY_LENGTH - body.length;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isLoading) return;

    const trimmed = body.trim();
    if (trimmed.length === 0) {
      setStatus({ kind: "error", message: "Write a comment before submitting." });
      return;
    }

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

      const { error } = await supabase.from("post_comments").insert({
        post_id: postId,
        profile_id: user.id,
        body: trimmed,
      });

      if (error) {
        setStatus({
          kind: "error",
          message: "We couldn't add your comment. Please try again.",
        });
        return;
      }

      setBody("");
      setStatus({ kind: "success" });
      router.refresh();
    } catch {
      setStatus({
        kind: "error",
        message: "Something went wrong. Please try again in a moment.",
      });
    }
  }

  if (!isMember) {
    return (
      <p className="text-xs text-shamba-ink-soft">
        Join this community to comment.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value.slice(0, MAX_BODY_LENGTH))}
        disabled={isLoading}
        rows={2}
        maxLength={MAX_BODY_LENGTH}
        placeholder="Write a comment…"
        className="rounded-shamba border border-shamba-line bg-shamba-bg px-3 py-2 font-sans text-sm text-shamba-ink placeholder:text-shamba-ink-soft focus:outline-none focus:ring-2 focus:ring-shamba-green disabled:opacity-60"
      />

      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-shamba-ink-soft">
          {remaining} characters left
        </span>

        <button
          type="submit"
          disabled={isLoading || trimmedLength === 0}
          className="inline-flex items-center justify-center gap-2 rounded-shamba border border-shamba-line px-4 py-1.5 font-sans text-sm font-semibold text-shamba-ink transition-colors hover:bg-shamba-bg disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isLoading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {isLoading ? "Sending…" : "Comment"}
        </button>
      </div>

      {status.kind === "error" && (
        <p role="alert" className="text-xs font-semibold text-shamba-rust">
          {status.message}
        </p>
      )}

      {status.kind === "success" && (
        <p role="status" className="text-xs font-semibold text-shamba-green">
          Comment posted.
        </p>
      )}
    </form>
  );
}
