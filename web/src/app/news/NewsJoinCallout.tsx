import Link from "next/link";
import { ArrowRight, MessagesSquare } from "lucide-react";

// Shown to signed-out readers only, below the stories: reading is open
// to everyone, taking part needs an account.
export function NewsJoinCallout() {
  return (
    <aside className="flex flex-col gap-4 rounded-shamba border border-shamba-line bg-shamba-card p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div className="flex items-start gap-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-shamba-green/10 text-shamba-green">
          <MessagesSquare className="size-5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="font-display text-lg font-bold leading-snug text-shamba-ink">
            Talk about the news with other farmers
          </h2>
          <p className="mt-1 text-sm leading-6 text-shamba-ink-soft">
            Join Shamba Space with your phone number to share your farm, ask questions and check market prices.
          </p>
        </div>
      </div>
      <Link
        href="/sign-in"
        className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-shamba bg-shamba-green px-5 font-sans text-sm font-semibold text-shamba-card transition-colors hover:bg-shamba-green-deep"
      >
        Join Shamba Space
        <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </aside>
  );
}
