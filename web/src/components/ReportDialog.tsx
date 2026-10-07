"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Loader2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useBackToClose } from "@/lib/useBackToClose";
import {
  REPORT_DETAILS_MAX_LENGTH,
  REPORT_REASONS,
  REPORT_TARGET_LABELS,
  submitReport,
  type ReportReason,
  type ReportTargetType,
} from "@/lib/reports";

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "done"; alreadyReported: boolean }
  | { kind: "error"; message: string };

// Bottom sheet for reporting someone else's content -- the same shell as
// feed/ReelCommentsSheet.tsx (role="dialog", aria-modal, focus on open,
// Escape/backdrop/X close, body scroll lock, Android Back via
// useBackToClose, safe-area padding).
//
// Rendered through a portal into <body>, one layer above every existing
// full-screen overlay (z-50), because it opens from inside them: the
// Story viewer, the comments sheet, the profile Reel viewer. Keyboard,
// click and pointer events are stopped here so they never reach those
// parents (React events bubble through portals) -- e.g. Escape must
// close this sheet, not the Story viewer behind it, and arrow keys in
// the text box must not change Story.
//
// Only the target's type and id, the chosen reason and optional details
// are sent; report_content() snapshots the content itself server-side.
export function ReportDialog({
  targetType,
  targetId,
  onClose,
}: {
  targetType: ReportTargetType;
  targetId: string;
  onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const requestClose = useBackToClose(true, onClose);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const label = REPORT_TARGET_LABELS[targetType];
  const isSubmitting = status.kind === "submitting";
  const titleId = `report-dialog-title-${targetId}`;

  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  function close() {
    if (!isSubmitting) requestClose();
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!reason || isSubmitting) return;

    setStatus({ kind: "submitting" });
    try {
      const result = await submitReport(createClient(), { targetType, targetId, reason, details });
      if (result.kind === "error") {
        setStatus({ kind: "error", message: result.message });
      } else {
        setStatus({ kind: "done", alreadyReported: result.kind === "already_reported" });
      }
    } catch {
      setStatus({ kind: "error", message: "Something went wrong. Please try again in a moment." });
    }
  }

  return createPortal(
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Escape") close();
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        if (event.target === event.currentTarget) close();
      }}
      className="fixed inset-0 z-[60] flex flex-col justify-end bg-black/50 outline-none"
    >
      <div className="flex max-h-[85dvh] flex-col rounded-t-shamba border-t border-shamba-line bg-shamba-card sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex items-center justify-between border-b border-shamba-line px-4 py-3">
          <h2 id={titleId} className="font-display text-base font-semibold text-shamba-ink">
            Report this {label}
          </h2>
          <button
            type="button"
            onClick={close}
            disabled={isSubmitting}
            aria-label="Close report"
            className="inline-flex size-8 items-center justify-center rounded-full text-shamba-ink-soft transition-colors hover:bg-shamba-bg hover:text-shamba-ink disabled:cursor-not-allowed disabled:opacity-60"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        {status.kind === "done" ? (
          <div className="flex flex-col items-center gap-3 px-4 py-8 pb-[calc(env(safe-area-inset-bottom,0px)+2rem)] text-center">
            <CheckCircle2 className="size-8 text-shamba-green" aria-hidden="true" />
            <p role="status" className="font-sans text-base font-semibold text-shamba-ink">
              {status.alreadyReported
                ? `You've already reported this ${label}.`
                : "Thanks for letting us know."}
            </p>
            <p className="max-w-xs text-sm text-shamba-ink-soft">
              Our team will review it. The person won&apos;t be told who reported them.
            </p>
            <button
              type="button"
              onClick={close}
              className="mt-2 inline-flex items-center justify-center rounded-shamba border border-shamba-line px-6 py-2 font-sans text-sm font-semibold text-shamba-ink transition-colors hover:bg-shamba-bg"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 overflow-y-auto px-4 py-3">
              <fieldset disabled={isSubmitting} className="flex flex-col gap-2">
                <legend className="mb-2 font-sans text-sm text-shamba-ink-soft">
                  Why are you reporting this {label}?
                </legend>
                {REPORT_REASONS.map((option) => (
                  <label
                    key={option.value}
                    className="flex items-center gap-3 rounded-shamba border border-shamba-line bg-shamba-bg px-4 py-2.5 font-sans text-sm text-shamba-ink"
                  >
                    <input
                      type="radio"
                      name={`report-reason-${targetId}`}
                      value={option.value}
                      checked={reason === option.value}
                      onChange={() => setReason(option.value)}
                      className="size-5 border-shamba-line text-shamba-green focus:outline-none focus:ring-2 focus:ring-shamba-green disabled:opacity-60"
                    />
                    <span className="font-semibold">{option.label}</span>
                  </label>
                ))}

                <label className="mt-2 flex flex-col gap-1.5 font-sans text-sm text-shamba-ink-soft">
                  Anything else we should know? (optional)
                  <textarea
                    value={details}
                    onChange={(event) =>
                      setDetails(event.target.value.slice(0, REPORT_DETAILS_MAX_LENGTH))
                    }
                    rows={3}
                    maxLength={REPORT_DETAILS_MAX_LENGTH}
                    className="rounded-shamba border border-shamba-line bg-shamba-bg px-3 py-2 font-sans text-sm text-shamba-ink placeholder:text-shamba-ink-soft focus:outline-none focus:ring-2 focus:ring-shamba-green disabled:opacity-60"
                  />
                  <span className="font-mono text-xs">
                    {REPORT_DETAILS_MAX_LENGTH - details.length} characters left
                  </span>
                </label>
              </fieldset>

              {status.kind === "error" && (
                <p role="alert" className="mt-3 text-sm font-semibold text-shamba-rust">
                  {status.message}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-shamba-line px-4 py-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]">
              <p className="text-xs text-shamba-ink-soft">Reports are private.</p>
              <button
                type="submit"
                disabled={!reason || isSubmitting}
                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-shamba bg-shamba-green px-4 font-sans text-sm font-semibold text-shamba-card transition-colors hover:bg-shamba-green-deep disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                {isSubmitting ? "Sending…" : "Send report"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}
