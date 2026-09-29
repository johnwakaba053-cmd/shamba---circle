"use client";

import { useEffect } from "react";
import Link from "next/link";
import { CloudOff, Sprout } from "lucide-react";

// Catches anything unexpected thrown while rendering the Weather screen,
// so the farmer gets a Try again (Next.js 16's retry(): re-fetch and
// re-render this segment) instead of the generic error page. Expected
// WeatherAPI failures are handled in page.tsx / ForecastSections.tsx.
// AppHeader is a Server Component, so this client boundary shows just
// the brand link home.
export default function WeatherError({
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
    <div className="flex flex-1 flex-col bg-shamba-bg">
      <header className="mx-auto flex w-full max-w-5xl px-4 pt-4 sm:px-10 sm:pt-6">
        <Link href="/communities" className="flex items-center gap-2">
          <Sprout className="size-6 text-shamba-green" aria-hidden="true" />
          <span className="font-display text-lg font-medium tracking-tight text-shamba-ink">
            Shamba Space
          </span>
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pb-20 pt-6 sm:px-10 sm:pt-12">
        <section className="flex flex-col items-center rounded-shamba border border-shamba-line bg-shamba-card p-6 text-center">
          <CloudOff className="size-8 text-shamba-ink-soft" aria-hidden="true" />
          <h1 className="mt-3 font-display text-xl font-bold text-shamba-ink">
            We couldn&apos;t load the weather
          </h1>
          <p role="alert" className="mt-2 text-sm leading-6 text-shamba-ink-soft">
            Check your connection and try again in a moment.
          </p>
          <button
            type="button"
            onClick={retry}
            className="mt-5 inline-flex items-center justify-center rounded-shamba border border-shamba-line px-6 py-3 font-sans text-base font-semibold text-shamba-ink transition-colors hover:bg-shamba-bg"
          >
            Try again
          </button>
        </section>
      </main>
    </div>
  );
}
