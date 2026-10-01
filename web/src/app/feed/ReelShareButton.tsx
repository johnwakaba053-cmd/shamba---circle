"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Share2 } from "lucide-react";
import { reelShareUrl } from "@/lib/reelUrl";
import type { Reel } from "./types";

type ShareStatus = "idle" | "copied" | "manual";

const COPIED_FEEDBACK_MS = 2000;
const SHARE_TEXT_MAX_CHARS = 100;

// Shares the Reel's canonical address, /reels/<id>, which opens exactly
// this Reel for anyone allowed to see it (see app/reels/[reelId]).
//
// 1. navigator.share -- the native share sheet (Android Chrome and the
//    installed PWA, and desktop browsers that support it).
// 2. Otherwise navigator.clipboard.writeText, with a brief "Link copied".
// 3. If neither is allowed (e.g. plain http:// on a LAN, which browsers
//    don't treat as secure), the link is shown in a small read-only field
//    to copy by hand -- never a crash, never a big modal.
//
// Share text: a Feed-level Reel can carry a short caption excerpt; a
// community Reel is members-only, so its text stays generic and nothing
// from it leaves the app except the (still members-only) link.
export function ReelShareButton({ reel }: { reel: Reel }) {
  const [status, setStatus] = useState<ShareStatus>("idle");
  const [manualUrl, setManualUrl] = useState("");
  const manualInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (status !== "copied") return;
    const id = window.setTimeout(() => setStatus("idle"), COPIED_FEEDBACK_MS);
    return () => window.clearTimeout(id);
  }, [status]);

  useEffect(() => {
    if (status === "manual") manualInputRef.current?.select();
  }, [status]);

  async function handleShare() {
    const url = reelShareUrl(reel.id, window.location.origin);
    const isFeedLevel = reel.communityId === null;
    const caption = reel.body.replace(/\s+/g, " ").trim();
    const excerpt =
      caption.length > SHARE_TEXT_MAX_CHARS ? `${caption.slice(0, SHARE_TEXT_MAX_CHARS - 1)}…` : caption;

    const shareData: ShareData = {
      title: isFeedLevel ? `${reel.authorDisplayName} on Shamba Space` : "A Farming Reel on Shamba Space",
      text: isFeedLevel && excerpt ? excerpt : "Watch this Farming Reel on Shamba Space.",
      url,
    };

    if (typeof navigator.share === "function" && (!navigator.canShare || navigator.canShare(shareData))) {
      try {
        await navigator.share(shareData);
        return;
      } catch (error) {
        // The farmer closed the share sheet -- nothing to do.
        if (error instanceof DOMException && error.name === "AbortError") return;
        // Any other refusal falls through to copying the link.
      }
    }

    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(url);
      setStatus("copied");
    } catch {
      setManualUrl(url);
      setStatus("manual");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleShare}
        aria-label="Share this Reel"
        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-black/30 px-3 font-sans text-xs font-semibold text-shamba-card backdrop-blur-sm transition-colors hover:bg-black/45 relative touch-target"
      >
        {status === "copied" ? (
          <Check className="size-3.5" aria-hidden="true" />
        ) : (
          <Share2 className="size-3.5" aria-hidden="true" />
        )}
        {status === "copied" ? "Link copied" : "Share"}
      </button>

      <span role="status" aria-live="polite" className="sr-only">
        {status === "copied" ? "Link copied" : ""}
      </span>

      {/* Positioned just under the author row (ReelInfo's row is
          `relative`), so the row itself never wraps or grows. */}
      {status === "manual" && (
        <div className="absolute inset-x-0 top-full z-10 mt-2 flex items-center gap-2 rounded-shamba bg-black/70 p-2 backdrop-blur-sm">
          <label htmlFor={`reel-link-${reel.id}`} className="sr-only">
            Link to this Reel
          </label>
          <input
            ref={manualInputRef}
            id={`reel-link-${reel.id}`}
            readOnly
            value={manualUrl}
            onFocus={(event) => event.currentTarget.select()}
            className="min-w-0 flex-1 rounded bg-shamba-card px-2 py-1 font-mono text-xs text-shamba-ink"
          />
          <button
            type="button"
            onClick={() => setStatus("idle")}
            className="shrink-0 font-sans text-xs font-semibold text-shamba-card/80 hover:text-shamba-card relative touch-target"
          >
            Done
          </button>
        </div>
      )}
    </>
  );
}
