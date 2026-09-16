"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const MAX_BODY_LENGTH = 2000;

type Mode = "view" | "editing";

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success" }
  | { kind: "error"; message: string };

export function PostCommentItem({
  commentId,
  authorDisplayName,
  body,
  isAuthor,
}: {
  commentId: string;
  authorDisplayName: string;
  body: string;
  isAuthor: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("view");
  const [editBody, setEditBody] = useState(body);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const isLoading = status.kind === "loading";
  const trimmedLength = editBody.trim().length;
  const remaining = MAX_BODY_LENGTH - editBody.length;

  function startEditing() {
    setEditBody(body);
    setStatus({ kind: "idle" });
    setMode("editing");
  }

  function cancelEditing() {
    setEditBody(body);
    setStatus({ kind: "idle" });
    setMode("view");
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isLoading) return;

    const trimmed = editBody.trim();
    if (trimmed.length === 0) {
      setStatus({ kind: "error", message: "Write a comment before saving." });
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

      const { error } = await supabase
        .from("post_comments")
        .update({ body: trimmed, updated_at: new Date().toISOString() })
        .eq("id", commentId)
        .eq("profile_id", user.id);

      if (error) {
        setStatus({
          kind: "error",
          message: "We couldn't save your changes. Please try again.",
        });
        return;
      }

      setStatus({ kind: "success" });
      router.refresh();
    } catch {
      setStatus({
        kind: "error",
        message: "Something went wrong. Please try again in a moment.",
      });
    }
  }

  async function handleDelete() {
    if (isLoading) return;

    if (!window.confirm("Delete this comment? This cannot be undone.")) {
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

      const { error } = await supabase
        .from("post_comments")
        .delete()
        .eq("id", commentId)
        .eq("profile_id", user.id);

      if (error) {
        setStatus({
          kind: "error",
          message: "We couldn't delete that comment. Please try again.",
        });
        return;
      }

      router.refresh();
    } catch {
      setStatus({
        kind: "error",
        message: "Something went wrong. Please try again in a moment.",
      });
    }
  }

  if (mode === "editing") {
    return (
      <form onSubmit={handleSave} className="flex flex-col gap-2">
        <span className="font-semibold text-shamba-ink text-sm">
          {authorDisplayName}
        </span>
        <textarea
          value={editBody}
          onChange={(event) => setEditBody(event.target.value.slice(0, MAX_BODY_LENGTH))}
          disabled={isLoading}
          rows={2}
          maxLength={MAX_BODY_LENGTH}
          className="rounded-shamba border border-shamba-line bg-shamba-bg px-3 py-2 font-sans text-sm text-shamba-ink focus:outline-none focus:ring-2 focus:ring-shamba-green disabled:opacity-60"
        />

        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-xs text-shamba-ink-soft">
            {remaining} characters left
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={cancelEditing}
              disabled={isLoading}
              className="inline-flex items-center justify-center rounded-shamba px-3 py-1.5 font-sans text-sm font-semibold text-shamba-ink-soft transition-colors hover:text-shamba-ink disabled:cursor-not-allowed disabled:opacity-70"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || trimmedLength === 0}
              className="inline-flex items-center justify-center gap-2 rounded-shamba border border-shamba-line px-4 py-1.5 font-sans text-sm font-semibold text-shamba-ink transition-colors hover:bg-shamba-bg disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isLoading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {isLoading ? "Saving…" : "Save"}
            </button>
          </div>
        </div>

        {status.kind === "error" && (
          <p role="alert" className="text-xs font-semibold text-shamba-rust">
            {status.message}
          </p>
        )}

        {status.kind === "success" && (
          <p role="status" className="text-xs font-semibold text-shamba-green">
            Saved.
          </p>
        )}
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-1 text-sm leading-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="font-semibold text-shamba-ink">{authorDisplayName}</span>{" "}
          <span className="text-shamba-ink-soft">{body}</span>
        </div>

        {isAuthor && (
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={startEditing}
              disabled={isLoading}
              className="font-sans text-xs font-semibold text-shamba-ink-soft transition-colors hover:text-shamba-ink disabled:cursor-not-allowed disabled:opacity-70"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isLoading}
              className="font-sans text-xs font-semibold text-shamba-ink-soft transition-colors hover:text-shamba-rust disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isLoading ? "Deleting…" : "Delete"}
            </button>
          </div>
        )}
      </div>

      {status.kind === "error" && (
        <p role="alert" className="text-xs font-semibold text-shamba-rust">
          {status.message}
        </p>
      )}
    </div>
  );
}
