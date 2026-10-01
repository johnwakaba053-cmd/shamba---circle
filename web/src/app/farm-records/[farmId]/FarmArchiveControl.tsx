"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string };

// Archiving is the only way to put a farm away -- there is no delete
// (farms has no DELETE grant or policy). An archived farm keeps its plots
// untouched and can be restored at any time. Same window.confirm shape as
// ListingStatusControl.
export function FarmArchiveControl({ farmId, isArchived }: { farmId: string; isArchived: boolean }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const isLoading = status.kind === "loading";

  async function handleToggle() {
    if (isLoading) return;

    const confirmMessage = isArchived
      ? "Restore this farm? It will appear in your Farm Records again."
      : "Archive this farm? It will move to Archived farms at the bottom of your Farm Records. Nothing is deleted, its plots are kept, and you can restore it at any time.";

    if (!window.confirm(confirmMessage)) return;

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
        .from("farms")
        .update({ archived_at: isArchived ? null : new Date().toISOString() })
        .eq("id", farmId)
        .eq("profile_id", user.id);

      if (error) {
        setStatus({ kind: "error", message: "We couldn't update this farm. Please try again." });
        return;
      }

      if (isArchived) {
        setStatus({ kind: "idle" });
        router.refresh();
      } else {
        router.push("/farm-records");
        router.refresh();
      }
    } catch {
      setStatus({ kind: "error", message: "Something went wrong. Please try again in a moment." });
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleToggle}
        disabled={isLoading}
        className="inline-flex min-h-11 items-center gap-1.5 font-sans text-xs font-semibold text-shamba-ink-soft transition-colors hover:text-shamba-ink disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isLoading ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        ) : isArchived ? (
          <ArchiveRestore className="size-3.5" aria-hidden="true" />
        ) : (
          <Archive className="size-3.5" aria-hidden="true" />
        )}
        {isLoading ? "Updating…" : isArchived ? "Restore farm" : "Archive farm"}
      </button>

      {status.kind === "error" && (
        <p role="alert" className="text-xs font-semibold text-shamba-rust">
          {status.message}
        </p>
      )}
    </div>
  );
}
