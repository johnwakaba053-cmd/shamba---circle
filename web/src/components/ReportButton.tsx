"use client";

import { useState } from "react";
import { Flag } from "lucide-react";
import { ReportDialog } from "@/components/ReportDialog";
import { REPORT_TARGET_LABELS, type ReportTargetType } from "@/lib/reports";

// Opens ReportDialog for one piece of someone else's content. Callers
// only render it when the viewer ISN'T the owner (the same checks that
// already gate each surface's own Delete/Edit controls) -- that's for a
// tidy UI only: report_content() itself refuses own content and anything
// the caller can't see.
//
// Variants follow the controls each surface already uses:
//   - "overlay":      light-on-dark text link over media (ReelDeleteControl)
//   - "overlay-icon": round translucent icon button (Story viewer header)
//   - "inline":       muted text link on light surfaces ("Edit listing",
//                     comment Edit/Delete)
//   - "icon":         small muted icon (a message bubble's time row)
const VARIANT_CLASSES = {
  overlay:
    "inline-flex items-center gap-1.5 font-sans text-xs font-semibold text-shamba-card/80 drop-shadow transition-colors hover:text-shamba-card",
  "overlay-icon":
    "inline-flex size-8 items-center justify-center rounded-full bg-black/30 text-shamba-card backdrop-blur-sm",
  inline:
    "inline-flex items-center gap-1.5 font-sans text-xs font-semibold text-shamba-ink-soft transition-colors hover:text-shamba-rust",
  icon: "text-shamba-ink-soft transition-colors hover:text-shamba-rust",
} as const;

export function ReportButton({
  targetType,
  targetId,
  variant = "inline",
  label,
  onOpenChange,
}: {
  targetType: ReportTargetType;
  targetId: string;
  variant?: keyof typeof VARIANT_CLASSES;
  label?: string;
  // Lets a host pause itself while the dialog is open (Story viewer).
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const iconOnly = variant === "overlay-icon" || variant === "icon";
  const text = label ?? "Report";

  function setDialogOpen(next: boolean) {
    setOpen(next);
    onOpenChange?.(next);
  }

  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          // Never let the tap reach a parent's own handler (e.g. a Reel's
          // tap-to-pause).
          event.stopPropagation();
          setDialogOpen(true);
        }}
        aria-label={iconOnly ? `Report this ${REPORT_TARGET_LABELS[targetType]}` : undefined}
        aria-haspopup="dialog"
        className={`${VARIANT_CLASSES[variant]} relative touch-target`}
      >
        <Flag className={variant === "overlay-icon" ? "size-4" : "size-3.5"} aria-hidden="true" />
        {!iconOnly && text}
      </button>

      {open && (
        <ReportDialog
          targetType={targetType}
          targetId={targetId}
          onClose={() => setDialogOpen(false)}
        />
      )}
    </>
  );
}
