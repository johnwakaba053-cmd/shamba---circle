import { Info, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { fetchMarketPricesForProducts, type MarketPriceCard } from "@/lib/marketPrices";
import { PriceCard } from "@/components/PriceCard";
import { DashboardCard, EmptyLine } from "./DashboardCard";
import type { NamedItem } from "./FarmerSummaryCard";

// My Farm's prices: the latest ingested KAMIS price for products linked to
// the farmer's own crops and livestock (agricultural_price_products'
// crop_type_id / livestock_type_id), shown with the existing PriceCard and
// fetched with the same fetchMarketPricesForProducts() News market updates
// use. Nothing is estimated: a crop with no linked product or no ingested
// price is named as having none, and old prices are labelled as old.

// The most cards shown here; the full list is one tap away.
const MAX_PRICE_CARDS = 3;
// Older than this, a "latest" price is flagged so it isn't read as today's.
export const STALE_PRICE_DAYS = 14;

export type FarmPricesResult =
  | { ok: true; cards: MarketPriceCard[]; withoutPrices: string[] }
  | { ok: false };

// Never rejects; resolves to null when the farmer hasn't chosen any crops
// or livestock (nothing to match prices against).
export async function loadFarmPrices(
  crops: NamedItem[],
  livestock: NamedItem[],
): Promise<FarmPricesResult | null> {
  if (crops.length === 0 && livestock.length === 0) return null;
  try {
    const supabase = await createClient();
    const filters = [
      crops.length > 0 && `crop_type_id.in.(${crops.map((crop) => crop.id).join(",")})`,
      livestock.length > 0 && `livestock_type_id.in.(${livestock.map((animal) => animal.id).join(",")})`,
    ].filter(Boolean) as string[];

    const { data: products, error } = await supabase
      .from("agricultural_price_products")
      .select("id, crop_type_id, livestock_type_id")
      .eq("active", true)
      .or(filters.join(","));
    if (error) {
      console.error("[my-farm] price products unavailable:", error.message);
      return { ok: false };
    }

    const allCards = await fetchMarketPricesForProducts(
      supabase,
      (products ?? []).map((product) => product.id as string),
    );
    const cards = allCards
      .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
      .slice(0, MAX_PRICE_CARDS);

    // Which of the farmer's crops/livestock have no price card at all.
    const pricedProductIds = new Set(allCards.map((card) => card.productId));
    const pricedTypeIds = new Set(
      (products ?? [])
        .filter((product) => pricedProductIds.has(product.id))
        .flatMap((product) => [product.crop_type_id, product.livestock_type_id])
        .filter(Boolean),
    );
    const withoutPrices = [...crops, ...livestock]
      .filter((item) => !pricedTypeIds.has(item.id))
      .map((item) => item.name);

    return { ok: true, cards, withoutPrices };
  } catch (err) {
    console.error("[my-farm] prices unavailable:", err instanceof Error ? err.message : err);
    return { ok: false };
  }
}

export async function PricesSection({ prices }: { prices: Promise<FarmPricesResult | null> }) {
  return <PricesCard result={await prices} now={new Date()} />;
}

function formatPriceDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function PricesCard({ result, now }: { result: FarmPricesResult | null; now: Date }) {
  const newest = result?.ok ? result.cards[0]?.recordedAt : undefined;
  const isStale =
    newest !== undefined && now.getTime() - new Date(newest).getTime() > STALE_PRICE_DAYS * 24 * 60 * 60 * 1000;

  return (
    <DashboardCard
      icon={TrendingUp}
      tone="bg-shamba-ochre/15 text-shamba-ochre"
      title="Your market prices"
      subtitle="Latest prices for what you farm"
      href="/market-prices"
      linkLabel="All prices"
    >
      {result === null ? (
        <EmptyLine href="/profile" linkLabel="Add your crops and livestock">
          Choose what you grow or keep to see market prices for it.
        </EmptyLine>
      ) : !result.ok ? (
        <EmptyLine href="/market-prices" linkLabel="Open Market Prices">
          We couldn&apos;t load prices right now.
        </EmptyLine>
      ) : (
        <div className="flex flex-col gap-3">
          {isStale && newest && (
            <p className="rounded-xl border border-shamba-ochre/30 bg-shamba-ochre/10 p-3 text-sm leading-6 text-shamba-ink">
              <span className="font-semibold">Older prices.</span> The newest price we have for your
              crops and livestock is from {formatPriceDate(newest)}. Check the date on each price
              before you sell.
            </p>
          )}

          {result.cards.length === 0 ? (
            <EmptyLine href="/market-prices" linkLabel="See all market prices">
              No market prices have been recorded for your crops or livestock yet.
            </EmptyLine>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {result.cards.map((card) => (
                <PriceCard key={card.key} price={card} />
              ))}
            </div>
          )}

          <div className="flex flex-col gap-1 border-t border-shamba-line pt-3 text-xs leading-5 text-shamba-ink-soft sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <p className="flex items-start gap-1.5">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              Prices are from KAMIS market reports, not live quotes.
            </p>
            {result.cards.length > 0 && result.withoutPrices.length > 0 && (
              <p className="sm:text-right">No prices recorded yet for {result.withoutPrices.join(", ")}.</p>
            )}
          </div>
        </div>
      )}
    </DashboardCard>
  );
}
