"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// Light-on-dark fork of communities/[id]/PostDeleteControl.tsx -- same
// delete call (own-row, RLS-enforced), restyled to stay readable over
// media instead of the card list's plain-ink text link. Only rendered
// for the Reel's own author (see Reel.isAuthor in feed/page.tsx), same
// as the original.
export function ReelDeleteControl({ postId }: { postId: string }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (isLoading) return;

    if (!window.confirm("Delete this Reel? This cannot be undone.")) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("Please sign in again.");
        setIsLoading(false);
        return;
      }

      const { error: deleteError } = await supabase
        .from("posts")
        .delete()
        .eq("id", postId)
        .eq("profile_id", user.id);

      if (deleteError) {
        setError("We couldn't delete that Reel. Please try again.");
        setIsLoading(false);
        return;
      }

      router.refresh();
    } catch {
      setError("Something went wrong. Please try again in a moment.");
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleDelete}
        disabled={isLoading}
        className="inline-flex items-center gap-1.5 font-sans text-xs font-semibold text-shamba-card/80 drop-shadow transition-colors hover:text-shamba-card disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isLoading ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <Trash2 className="size-3.5" aria-hidden="true" />
        )}
        {isLoading ? "Deleting…" : "Delete Reel"}
      </button>

      {error && (
        <p role="alert" className="text-xs font-semibold text-shamba-rust">
          {error}
        </p>
      )}
    </div>
  );
}
