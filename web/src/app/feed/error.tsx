"use client";

import { useEffect } from "react";
import { FeedErrorState } from "./FeedErrorState";
import { FeedTopBar } from "./FeedTopBar";

// Catches anything unexpected thrown while rendering the Feed, so the
// farmer sees the Feed's own error card with Retry (Next.js 16's
// retry(): re-fetch and re-render this segment) instead of the generic
// error page. Expected query failures are handled in page.tsx itself.
export default function FeedError({
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
      <FeedTopBar />
      <FeedErrorState retry={retry} />
    </div>
  );
}
