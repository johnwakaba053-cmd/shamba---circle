"use client";

import { useEffect } from "react";
import { FeedErrorState } from "@/app/feed/FeedErrorState";
import { FeedTopBar } from "@/app/feed/FeedTopBar";

// Unexpected failures while rendering a single Reel get the Feed's own
// error card with Retry (Next.js 16's retry()), not the generic page.
export default function ReelError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="relative h-[100dvh] overflow-hidden bg-shamba-bg">
      <FeedTopBar href="/feed" label="Farming Reels" ariaLabel="Back to the Farming Reels feed" />
      <FeedErrorState retry={retry} />
    </div>
  );
}
