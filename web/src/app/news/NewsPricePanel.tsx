import { Scale } from "lucide-react";
import { PriceCard } from "@/components/PriceCard";
import type { MarketPriceCard } from "@/lib/marketPrices";
import { PricesSignInPrompt } from "./PricesSignInPrompt";

// A market update's live prices, at the end of the story: the latest
// price for each product the editor linked (N4's
// news_article_price_products). `prices` is null for a signed-out reader,
// who gets the sign-in prompt instead -- prices stay signed-in only.
export function NewsPricePanel({ prices }: { prices: MarketPriceCard[] | null }) {
  return (
    <section aria-labelledby="news-prices-heading" className="mt-8 flex flex-col gap-4 border-t border-shamba-line pt-8">
      <h2 id="news-prices-heading" className="flex items-center gap-2 font-display text-xl font-bold text-shamba-ink">
        <span className="flex size-8 items-center justify-center rounded-full bg-shamba-blue/10 text-shamba-blue">
          <Scale className="size-4" aria-hidden="true" />
        </span>
        Today&apos;s prices
      </h2>

      {prices === null ? (
        <PricesSignInPrompt context="story" />
      ) : prices.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {prices.map((price) => (
            <PriceCard key={price.key} price={price} />
          ))}
        </div>
      ) : (
        <p className="rounded-shamba border border-dashed border-shamba-line bg-shamba-card p-4 text-sm text-shamba-ink-soft">
          No prices have come in yet for the products in this story.
        </p>
      )}
    </section>
  );
}
