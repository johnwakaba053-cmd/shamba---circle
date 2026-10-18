import { AppHeader } from "@/components/AppHeader";

// Shown while the admin expert pages load (a few small queries; slow on a
// weak connection).
export default function ExpertVerificationLoading() {
  return (
    <div className="flex flex-1 flex-col bg-shamba-bg">
      <AppHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-4 pb-20 pt-6 sm:px-10 sm:pt-12">
        <div className="flex w-full max-w-2xl flex-col gap-4" role="status" aria-label="Loading expert applications">
          <div className="h-3 w-16 animate-pulse rounded-full bg-shamba-line" />
          <div className="h-8 w-2/3 animate-pulse rounded-shamba bg-shamba-line" />
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-24 w-full animate-pulse rounded-shamba bg-shamba-line/60" />
          ))}
        </div>
      </main>
    </div>
  );
}
