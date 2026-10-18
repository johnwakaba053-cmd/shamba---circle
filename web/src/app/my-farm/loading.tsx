import { AppHeader } from "@/components/AppHeader";
import { DashboardCardSkeleton } from "./DashboardCard";
import { MY_FARM_SURFACE } from "./dashboardTheme";

// Same layout as My Farm while the farmer's preferences load: the welcome
// panel, then the Today and Your farm zones; each section streams in on
// its own once the page is up.
export default function MyFarmLoading() {
  return (
    <div className={`flex flex-1 flex-col bg-shamba-bg ${MY_FARM_SURFACE}`}>
      <AppHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 pb-20 pt-4 sm:gap-10 sm:px-10 sm:pt-8">
        <div
          role="status"
          aria-label="Loading My Farm"
          className="h-56 animate-pulse rounded-3xl bg-shamba-green/20 sm:h-64"
        />
        <div className="flex flex-col gap-3">
          <div className="h-4 w-20 animate-pulse rounded bg-shamba-line" />
          <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <DashboardCardSkeleton label="weather" lines={2} />
            <DashboardCardSkeleton label="farm alerts" lines={1} />
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <div className="h-4 w-24 animate-pulse rounded bg-shamba-line" />
          <DashboardCardSkeleton label="farm records" lines={3} />
        </div>
      </main>
    </div>
  );
}
