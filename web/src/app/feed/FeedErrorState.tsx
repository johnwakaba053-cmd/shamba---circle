"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw, WifiOff } from "lucide-react";

// Shown when the Feed can't load: by page.tsx when its queries report an
// error, and by error.tsx for anything unexpected. Retry re-runs the
// page's server render in place (router.refresh), or error.tsx's own
// retry() -- the farmer never lands on the generic error page and never
// has to leave the Feed to try again.
export function FeedErrorState({ retry }: { retry?: () => void }) {
  const router = useRouter();
  const [isRetrying, startTransition] = useTransition();

  function handleRetry() {
    startTransition(() => {
      if (retry) {
        retry();
      } else {
        router.refresh();
      }
    });
  }

  return (
    <main className="absolute inset-0 flex flex-col items-center justify-center px-6 pb-[env(safe-area-inset-bottom,0px)]">
      <div className="w-full max-w-sm rounded-shamba border border-shamba-line bg-shamba-card p-6 text-center">
        <WifiOff className="mx-auto size-8 text-shamba-ink-soft" aria-hidden="true" />
        <h1 className="mt-3 font-display text-xl font-bold text-shamba-ink">
          We couldn&apos;t load Farming Reels
        </h1>
        <p role="alert" className="mt-2 text-sm leading-6 text-shamba-ink-soft">
          Check your connection and try again.
        </p>

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={handleRetry}
            disabled={isRetrying}
            className="inline-flex items-center justify-center gap-2 rounded-shamba bg-shamba-green px-6 py-3 font-sans text-base font-semibold text-shamba-card transition-colors hover:bg-shamba-green-deep disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isRetrying ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <RotateCcw className="size-4" aria-hidden="true" />
            )}
            {isRetrying ? "Retrying…" : "Retry"}
          </button>
          <Link
            href="/communities"
            className="inline-flex items-center justify-center rounded-shamba border border-shamba-line px-6 py-3 font-sans text-base font-semibold text-shamba-ink transition-colors hover:bg-shamba-bg"
          >
            Go to Communities
          </Link>
        </div>
      </div>
    </main>
  );
}
