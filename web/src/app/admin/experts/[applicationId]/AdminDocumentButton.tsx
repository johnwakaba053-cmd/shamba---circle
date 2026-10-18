"use client";

import { useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { getExpertDocumentLink } from "../actions";

// Opens one private expert document for an admin. The signed link is
// made on the server only when this is tapped and works for 60 seconds.
// The tab is opened before the request so mobile browsers don't treat it
// as an unrequested pop-up (same approach as the applicant's View).
export function AdminDocumentButton({ documentId, label = "Open" }: { documentId: string; label?: string }) {
  const [opening, setOpening] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleOpen() {
    if (opening) return;
    setOpening(true);
    setFailed(false);
    const tab = window.open("", "_blank");
    try {
      const result = await getExpertDocumentLink(documentId);
      if (!result.ok) {
        tab?.close();
        setFailed(true);
        return;
      }
      if (tab) {
        tab.location.href = result.url;
      } else {
        window.location.assign(result.url);
      }
    } catch {
      tab?.close();
      setFailed(true);
    } finally {
      setOpening(false);
    }
  }

  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        onClick={handleOpen}
        disabled={opening}
        className="inline-flex min-h-11 items-center gap-1.5 font-sans text-sm font-semibold text-shamba-green hover:text-shamba-green-deep disabled:opacity-70"
      >
        {opening ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <ExternalLink className="size-4" aria-hidden="true" />
        )}
        {label}
      </button>
      {failed && (
        <span role="alert" className="text-sm font-semibold text-shamba-rust">
          We couldn&apos;t open that file. Please try again.
        </span>
      )}
    </span>
  );
}
