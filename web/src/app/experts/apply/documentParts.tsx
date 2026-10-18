"use client";

import { useState } from "react";
import { FileText, ImageIcon, Loader2, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatFileSize, openExpertDocument, type ExpertDocument } from "@/lib/experts";

// One uploaded file: its name and size, View (a short-lived private link)
// and, optionally, Remove or Replace actions supplied by the step.
export function DocumentCard({ document, actions }: { document: ExpertDocument; actions?: React.ReactNode }) {
  const [opening, setOpening] = useState(false);
  const [openFailed, setOpenFailed] = useState(false);
  const Icon = document.mime_type === "application/pdf" ? FileText : ImageIcon;

  async function handleView() {
    if (opening) return;
    setOpening(true);
    setOpenFailed(false);
    try {
      const ok = await openExpertDocument(createClient(), document);
      setOpenFailed(!ok);
    } catch {
      setOpenFailed(true);
    } finally {
      setOpening(false);
    }
  }

  return (
    <div className="rounded-shamba border border-shamba-line bg-shamba-bg px-4 py-3">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-shamba-green/10 text-shamba-green">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="break-all font-sans text-sm font-semibold leading-5 text-shamba-ink">{document.file_name}</p>
          <p className="font-mono text-xs text-shamba-ink-soft">{formatFileSize(document.size_bytes)}</p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 pl-12">
        <button
          type="button"
          onClick={handleView}
          disabled={opening}
          className="inline-flex min-h-11 items-center gap-1.5 font-sans text-sm font-semibold text-shamba-green hover:text-shamba-green-deep disabled:opacity-70"
        >
          {opening && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          View
        </button>
        {actions}
      </div>
      {openFailed && (
        <p role="alert" className="mt-1 pl-12 text-sm font-semibold text-shamba-rust">
          We couldn&apos;t open that file. Please try again.
        </p>
      )}
    </div>
  );
}

// A file picker styled as a secondary button. The real input is visually
// hidden but still focusable, so keyboard and screen-reader users can use
// it; its value is cleared after each pick so choosing the same file
// again still works.
export function FilePickButton({
  id,
  accept,
  label,
  busyLabel = "Uploading…",
  busy,
  disabled,
  onFile,
}: {
  id: string;
  accept: string;
  label: string;
  busyLabel?: string;
  busy: boolean;
  disabled?: boolean;
  onFile: (file: File) => void;
}) {
  return (
    <label
      htmlFor={id}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-shamba border border-shamba-line bg-shamba-card px-4 py-2 font-sans text-sm font-semibold text-shamba-ink transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-shamba-green ${
        busy || disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer hover:bg-shamba-bg"
      }`}
    >
      {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Upload className="size-4" aria-hidden="true" />}
      {busy ? busyLabel : label}
      <input
        id={id}
        type="file"
        accept={accept}
        disabled={busy || disabled}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onFile(file);
        }}
      />
    </label>
  );
}
