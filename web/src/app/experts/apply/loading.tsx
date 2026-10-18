import { AppHeader } from "@/components/AppHeader";

// Shown while the application and its parts load (a few small queries;
// slow on a weak connection).
export default function ExpertApplyLoading() {
  return (
    <div className="flex flex-1 flex-col bg-shamba-bg">
      <AppHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-4 pb-20 pt-6 sm:px-10 sm:pt-12">
        <div
          className="w-full max-w-xl rounded-shamba border border-shamba-line bg-shamba-card p-5 sm:p-8"
          role="status"
          aria-label="Loading your application"
        >
          <div className="h-3 w-24 animate-pulse rounded-full bg-shamba-line" />
          <div className="mt-3 h-1.5 w-full rounded-full bg-shamba-line" />
          <div className="mt-5 h-7 w-2/3 animate-pulse rounded-shamba bg-shamba-line" />
          <div className="mt-6 flex flex-col gap-4">
            {[0, 1, 2].map((item) => (
              <div key={item} className="flex flex-col gap-2">
                <div className="h-4 w-32 animate-pulse rounded-full bg-shamba-line" />
                <div className="h-12 w-full animate-pulse rounded-shamba bg-shamba-line/60" />
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
