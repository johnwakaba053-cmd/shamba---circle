import Link from "next/link";
import { Lock } from "lucide-react";

// Live Market Prices stay signed-in only (decided): signed-out News
// readers get this prompt wherever prices would appear, and nothing about
// the prices themselves.
export function PricesSignInPrompt({ context = "general" }: { context?: "general" | "story" }) {
  return (
    <div className="flex flex-col gap-4 rounded-shamba border border-shamba-line bg-shamba-card p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-shamba-blue/10 text-shamba-blue">
          <Lock className="size-5" aria-hidden="true" />
        </span>
        <div>
          <p className="font-display text-base font-bold leading-snug text-shamba-ink">
            {context === "story" ? "See today's prices for this story" : "Live market prices are for members"}
          </p>
          <p className="mt-1 text-sm leading-6 text-shamba-ink-soft">
            Sign in to see the latest wholesale and retail prices from Kenyan markets.
          </p>
        </div>
      </div>
      <Link
        href="/sign-in"
        className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-shamba bg-shamba-green px-5 font-sans text-sm font-semibold text-shamba-card transition-colors hover:bg-shamba-green-deep"
      >
        Sign in
      </Link>
    </div>
  );
}
