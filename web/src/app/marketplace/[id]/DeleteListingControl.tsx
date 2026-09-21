"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string };

// Same window.confirm + own-row-delete shape as communities/[id]/
// PostDeleteControl.tsx and feed/ReelDeleteControl.tsx -- this codebase's
// established pattern for "delete my own thing," not a new custom
// dialog. Only ever rendered by the detail page inside its own
// `{isOwner && (...)}` block, so there is no separate isOwner prop here
// to re-check -- the parent is the single source of truth for who sees
// this control at all.
export function DeleteListingControl({ listingId }: { listingId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const isLoading = status.kind === "loading";

  async function handleDelete() {
    if (isLoading) return;

    if (!window.confirm("Delete this listing? This cannot be undone.")) {
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

      // listing_media rows cascade away automatically once the listing
      // row is deleted (ON DELETE CASCADE) -- but the actual Storage
      // objects do not. Their paths must be read out *before* that
      // cascade removes the only record of them, so this fetch has to
      // happen first, not after. Best-effort: if a particular object
      // fails to remove, the listing itself still gets deleted below
      // rather than leaving a half-deleted listing behind -- the same
      // "authoritative record over storage tidiness" tradeoff already
      // made by StoryViewer's own delete flow.
      const { data: mediaRows } = await supabase
        .from("listing_media")
        .select("storage_path")
        .eq("listing_id", listingId);

      if (mediaRows && mediaRows.length > 0) {
        await supabase.storage
          .from("listing-media")
          .remove(mediaRows.map((row) => row.storage_path));
      }

      const { error: deleteError } = await supabase
        .from("listings")
        .delete()
        .eq("id", listingId)
        .eq("profile_id", user.id);

      if (deleteError) {
        setStatus({
          kind: "error",
          message: "We couldn't delete that listing. Please try again.",
        });
        return;
      }

      router.push("/marketplace");
    } catch {
      setStatus({
        kind: "error",
        message: "Something went wrong. Please try again in a moment.",
      });
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleDelete}
        disabled={isLoading}
        className="inline-flex items-center gap-1.5 font-sans text-xs font-semibold text-shamba-ink-soft transition-colors hover:text-shamba-rust disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isLoading ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <Trash2 className="size-3.5" aria-hidden="true" />
        )}
        {isLoading ? "Deleting…" : "Delete listing"}
      </button>

      {status.kind === "error" && (
        <p role="alert" className="text-xs font-semibold text-shamba-rust">
          {status.message}
        </p>
      )}
    </div>
  );
}
