import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PriceCard } from "@/components/PriceCard";
import type { MarketPriceCard } from "@/lib/marketPrices";
import { PricesSignInPrompt } from "./PricesSignInPrompt";

// The live-prices part of the Markets & Prices section. `prices` is null
// for a signed-out reader (they get the sign-in prompt -- prices stay
// signed-in only); for a signed-in reader it's the newest few cards from
// Market Prices, the same PriceCard the Market Prices page uses.
export function MarketsPanel({ prices }: { prices: MarketPriceCard[] | null }) {
  if (prices === null) {
    return <PricesSignInPrompt />;
  }

  return (
    <div className="flex flex-col gap-3">
      {prices.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {prices.map((price) => (
            <PriceCard key={price.key} price={price} />
          ))}
        </div>
      ) : (
        <p className="rounded-shamba border border-dashed border-shamba-line bg-shamba-card p-4 text-sm text-shamba-ink-soft">
          No market prices have come in yet today.
        </p>
      )}
      <Link
        href="/market-prices"
        className="relative touch-target inline-flex w-fit items-center gap-1.5 rounded-shamba font-sans text-sm font-semibold text-shamba-green transition-colors hover:text-shamba-green-deep"
      >
        All market prices
        <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </div>
  );
}
