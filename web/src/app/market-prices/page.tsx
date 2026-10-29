import { redirect } from "next/navigation";
import { Clock, Leaf, PawPrint, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { PriceCard } from "@/components/PriceCard";
import { STALE_PRICE_DAYS } from "@/app/my-farm/PricesSection";
import { fetchRecentMarketPrices, type MarketPriceCard } from "@/lib/marketPrices";

function formatPriceDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// Plant vs. Animal is a presentation grouping only, derived from the
// same agricultural_price_products.category column used everywhere else
// -- 'crop' is Plant, 'livestock'/'livestock_product' are Animal. No
// product list is hardcoded, and the underlying data/query stays
// unified; this only changes how the same cards are sectioned on screen.
function isPlant(price: MarketPriceCard): boolean {
  return price.category === "crop";
}

function PriceSection({
  title,
  icon: Icon,
  prices,
}: {
  title: string;
  icon: typeof Leaf;
  prices: MarketPriceCard[];
}) {
  if (prices.length === 0) return null;

  return (
    <div>
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-shamba-ink">
        <Icon className="size-5 text-shamba-green" aria-hidden="true" />
        {title}
      </h2>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {prices.map((price) => (
          <PriceCard key={price.key} price={price} />
        ))}
      </div>
    </div>
  );
}

export default async function MarketPrices() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const prices = await fetchRecentMarketPrices(supabase);
  // Cards come newest first, so the first one is the newest price we have.
  // Older than STALE_PRICE_DAYS (the same rule as My Farm), the whole page
  // is flagged so old prices aren't read as today's.
  const newest = prices[0]?.recordedAt;
  const now = new Date();
  const isStale =
    newest !== undefined && now.getTime() - new Date(newest).getTime() > STALE_PRICE_DAYS * 24 * 60 * 60 * 1000;

  return (
    <div className="flex flex-1 flex-col bg-shamba-bg">
      <AppHeader />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 pb-20 pt-8 sm:px-10 sm:pt-16">
        <div>
          <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-shamba-ink">
            Market Prices
          </h1>
          <p className="mt-2 max-w-2xl text-base leading-6 text-shamba-ink-soft">
            The latest agricultural prices reported by trusted market sources
            in Kenya.
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-shamba-ink-soft">
            Prices come from a curated set of KAMIS-reporting markets and do
            not yet cover every market in Kenya.
          </p>
        </div>

        {isStale && newest && (
          <div
            role="note"
            className="flex max-w-2xl items-start gap-3 rounded-xl border border-shamba-ochre/30 bg-shamba-ochre/10 p-4 text-sm leading-6 text-shamba-ink"
          >
            <Clock className="mt-0.5 size-5 shrink-0 text-shamba-ochre" aria-hidden="true" />
            <p>
              <span className="font-semibold">These prices are not current.</span> The newest price
              we have is from {formatPriceDate(newest)}, and no newer KAMIS prices have come in
              since. Check the date on each price before you buy or sell.
            </p>
          </div>
        )}

        {prices.length === 0 ? (
          <div className="w-full max-w-sm rounded-shamba border border-shamba-line bg-shamba-card p-6">
            <TrendingUp className="size-7 text-shamba-ink-soft" aria-hidden="true" />
            <h2 className="mt-4 font-display text-lg font-semibold text-shamba-ink">
              No market prices available yet
            </h2>
            <p className="mt-2 text-sm leading-6 text-shamba-ink-soft">
              Prices will appear here as verified market data becomes
              available.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            <PriceSection title="Plant Prices" icon={Leaf} prices={prices.filter(isPlant)} />
            <PriceSection title="Animal Prices" icon={PawPrint} prices={prices.filter((p) => !isPlant(p))} />
          </div>
        )}
      </main>
    </div>
  );
}
