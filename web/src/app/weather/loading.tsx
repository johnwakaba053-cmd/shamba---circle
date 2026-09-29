import { AppHeader } from "@/components/AppHeader";
import { FarmAlertsSkeleton } from "./FarmAlertsSection";
import { FarmOutlookSkeleton } from "./FarmOutlookSection";
import { ForecastSkeleton } from "./ForecastSections";

// Same shape as the weather card, forecast, farm alerts and farm outlook
// while the page loads.
export default function WeatherLoading() {
  return (
    <div className="flex flex-1 flex-col bg-shamba-bg">
      <AppHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 pb-20 pt-6 sm:px-10 sm:pt-12">
        <section
          role="status"
          aria-label="Loading weather"
          className="rounded-shamba border border-shamba-line bg-shamba-card p-5 sm:p-6"
        >
          <div className="h-5 w-40 animate-pulse rounded bg-shamba-line" />
          <div className="mt-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-16 animate-pulse rounded-full bg-shamba-line" />
              <div className="h-14 w-24 animate-pulse rounded bg-shamba-line" />
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="h-6 w-24 animate-pulse rounded bg-shamba-line" />
              <div className="h-4 w-28 animate-pulse rounded bg-shamba-line" />
            </div>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-shamba bg-shamba-bg" />
            ))}
          </div>
        </section>
        <ForecastSkeleton />
        <FarmAlertsSkeleton />
        <FarmOutlookSkeleton />
      </main>
    </div>
  );
}
