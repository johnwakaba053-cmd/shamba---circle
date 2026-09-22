"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PackageCheck, RotateCcw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type ListingStatus = "available" | "sold";

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string };

// Owner-only status toggle -- rendered only inside the detail page's
// existing `{isOwner && (...)}` block (same gating as
// DeleteListingControl.tsx), so there is no separate isOwner prop to
// re-check here. The actual write-time authorization boundary is still
// listings' existing UPDATE RLS policy (profile_id = auth.uid()),
// unmodified by this batch -- it already permits an owner to update any
// column, including this new `status` one, the same way it already
// covers category_details (RLS is row-scoped, not column-scoped).
//
// Writes exactly one column: `status`. title/description/category/
// category_details/price/price_unit/location/seller_display_name/
// photos are all untouched by this control.
export function ListingStatusControl({
  listingId,
  initialStatus,
}: {
  listingId: string;
  initialStatus: ListingStatus;
}) {
  const router = useRouter();
  const [currentStatus, setCurrentStatus] = useState<ListingStatus>(initialStatus);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const isLoading = status.kind === "loading";
  const isSold = currentStatus === "sold";

  async function handleToggle() {
    if (isLoading) return;

    const nextStatus: ListingStatus = isSold ? "available" : "sold";
    const confirmMessage = isSold
      ? "Mark this listing as available again?"
      : "Mark this listing as sold? It will remain visible in Marketplace but buyers will see that it is sold.";

    if (!window.confirm(confirmMessage)) {
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
        .from("listings")
        .update({ status: nextStatus })
        .eq("id", listingId)
        .eq("profile_id", user.id);

      if (error) {
        setStatus({
          kind: "error",
          message: "We couldn't update this listing. Please try again.",
        });
        return;
      }

      // Instant feedback locally, then a refresh so the rest of the
      // (server-rendered) page reflects the confirmed database state --
      // same "optimistic local update + router.refresh()" shape already
      // used by ListingForm.tsx's own save flow.
      setCurrentStatus(nextStatus);
      setStatus({ kind: "idle" });
      router.refresh();
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
        onClick={handleToggle}
        disabled={isLoading}
        className="inline-flex items-center gap-1.5 font-sans text-xs font-semibold text-shamba-ink-soft transition-colors hover:text-shamba-ink disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isLoading ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        ) : isSold ? (
          <RotateCcw className="size-3.5" aria-hidden="true" />
        ) : (
          <PackageCheck className="size-3.5" aria-hidden="true" />
        )}
        {isLoading ? "Updating…" : isSold ? "Mark as Available" : "Mark as Sold"}
      </button>

      {status.kind === "error" && (
        <p role="alert" className="text-xs font-semibold text-shamba-rust">
          {status.message}
        </p>
      )}
    </div>
  );
}
