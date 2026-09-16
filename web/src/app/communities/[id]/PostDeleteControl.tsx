"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string };

export function PostDeleteControl({
  postId,
  isAuthor,
}: {
  postId: string;
  isAuthor: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const isLoading = status.kind === "loading";

  if (!isAuthor) {
    return null;
  }

  async function handleDelete() {
    if (isLoading) return;

    if (!window.confirm("Delete this post? This cannot be undone.")) {
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
        .from("posts")
        .delete()
        .eq("id", postId)
        .eq("profile_id", user.id);

      if (error) {
        setStatus({
          kind: "error",
          message: "We couldn't delete that post. Please try again.",
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

  return (
    <div className="mt-2 flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleDelete}
        disabled={isLoading}
        className="inline-flex items-center gap-1.5 font-sans text-xs font-semibold text-shamba-ink-soft transition-colors hover:text-shamba-rust disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isLoading && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
        {isLoading ? "Deleting…" : "Delete post"}
      </button>

      {status.kind === "error" && (
        <p role="alert" className="text-xs font-semibold text-shamba-rust">
          {status.message}
        </p>
      )}
    </div>
  );
}
