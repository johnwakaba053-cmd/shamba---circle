import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import {
  fetchLatestPricePerMarket,
  fetchMarketsForProduct,
  fetchPriceChangeSummary,
  fetchPriceHistoryForMarket,
  fetchProductById,
  fetchSourceForProductMarket,
  isValidRangeKey,
  rangeSinceIso,
  type PriceChangeSeries,
} from "@/lib/priceHistory";
import { MarketSelector } from "./MarketSelector";
import { TimeRangeSelector } from "./TimeRangeSelector";
import { PriceHistoryChart } from "./PriceHistoryChart";

function formatKsh(value: number): string {
  return `KSh ${value.toLocaleString("en-KE", { maximumFractionDigits: 2 })}`;
}

function formatDisplayDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function ChangeRow({ label, unit, change }: { label: string; unit: string; change: PriceChangeSeries }) {
  if (change.kind === "none") return null;

  if (change.kind === "single") {
    return (
      <div className="rounded-shamba border border-shamba-line bg-shamba-card p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-shamba-ink-soft">{label}</p>
        <p className="mt-1 text-sm text-shamba-ink">
          Current: <span className="font-semibold">{formatKsh(change.current)}/{unit}</span>
        </p>
        <p className="mt-1 text-xs text-shamba-ink-soft">Not enough historical data to calculate a change.</p>
      </div>
    );
  }

  const arrow = change.direction === "up" ? "↑" : change.direction === "down" ? "↓" : "→";
  const sign = change.absoluteChange > 0 ? "+" : change.absoluteChange < 0 ? "" : "±";

  return (
    <div className="rounded-shamba border border-shamba-line bg-shamba-card p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-shamba-ink-soft">{label}</p>
      <p className="mt-1 text-sm text-shamba-ink">
        Current: <span className="font-semibold">{formatKsh(change.current)}/{unit}</span>
      </p>
      <p className="text-xs text-shamba-ink-soft">
        Previous: {formatKsh(change.previous)}/{unit} ({formatDisplayDate(change.previousRecordedAt)})
      </p>
      <p className="mt-1 text-sm font-semibold text-shamba-ink">
        {arrow} {sign}
        {formatKsh(Math.abs(change.absoluteChange))}/{unit}
        {change.percentChange !== null && (
          <span>
            {" "}
            ({change.absoluteChange >= 0 ? "+" : ""}
            {change.percentChange.toFixed(2)}%)
          </span>
        )}
      </p>
    </div>
  );
}

export default async function ProductPriceHistory({
  params,
  searchParams,
}: {
  params: Promise<{ productId: string }>;
  searchParams: Promise<{ market?: string; range?: string }>;
}) {
  const { productId } = await params;
  const { market: marketParam, range: rangeParam } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const product = await fetchProductById(supabase, productId);
  if (!product) {
    notFound();
  }

  const markets = await fetchMarketsForProduct(supabase, productId);
  const range = rangeParam && isValidRangeKey(rangeParam) ? rangeParam : "30";

  const requestedMarketId = marketParam ?? "all";
  const selectedMarket =
    requestedMarketId === "all" ? null : markets.find((m) => m.id === requestedMarketId) ?? null;
  const marketIsInvalid = requestedMarketId !== "all" && !selectedMarket;

  return (
    <div className="flex flex-1 flex-col bg-shamba-bg">
      <AppHeader />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 pb-20 pt-8 sm:px-10 sm:pt-16">
        <Link
          href="/market-prices"
          className="inline-flex items-center gap-2 font-sans text-sm font-semibold text-shamba-ink-soft transition-colors hover:text-shamba-ink"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to Market Prices
        </Link>

        <div>
          <h1 className="font-display text-2xl font-bold leading-tight tracking-tight text-shamba-ink sm:text-3xl">
            {product.name}
          </h1>
          {product.classification && (
            <p className="mt-1 text-base text-shamba-ink-soft">{product.classification}</p>
          )}
        </div>

        {/* Livestock/livestock-product only: KAMIS can report several
            individual same-day transactions for one product/market, but
            agricultural_prices keeps only the one accepted observation
            per day (see the ingestion design's own conflict handling,
            which this page never reads from). Disclosing that plainly
            here is the honest alternative to either hiding the
            limitation or inventing a range this data can't support. */}
        {(product.category === "livestock" || product.category === "livestock_product") && (
          <p className="rounded-shamba border border-shamba-line bg-shamba-card p-3 text-xs leading-5 text-shamba-ink-soft">
            Livestock prices shown are the accepted KAMIS observation for that market and date.
            KAMIS markets can report more than one sale on the same day, so the actual range of
            prices at a given market may be wider than the single value shown here.
          </p>
        )}

        {markets.length === 0 ? (
          <div className="w-full max-w-sm rounded-shamba border border-shamba-line bg-shamba-card p-6">
            <p className="text-sm leading-6 text-shamba-ink-soft">
              No historical price observations are available for this product yet.
            </p>
          </div>
        ) : (
          <>
            <MarketSelector productId={productId} markets={markets} selectedMarketId={requestedMarketId} />

            {marketIsInvalid && (
              <p role="alert" className="text-sm font-semibold text-shamba-rust">
                That market has no observations for this product. Showing all markets instead.
              </p>
            )}

            {!selectedMarket ? (
              <AllMarketsComparison supabase={supabase} productId={productId} unit={product.unit} />
            ) : (
              <MarketDetail
                supabase={supabase}
                productId={productId}
                unit={product.unit}
                marketId={selectedMarket.id}
                marketName={selectedMarket.name}
                countyName={selectedMarket.countyName}
                range={range}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}

async function AllMarketsComparison({
  supabase,
  productId,
  unit,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  productId: string;
  unit: string;
}) {
  const rows = await fetchLatestPricePerMarket(supabase, productId);

  if (rows.length === 0) {
    return (
      <p className="text-sm text-shamba-ink-soft">No price observations available for this period.</p>
    );
  }

  return (
    <div>
      <p className="mb-3 text-sm text-shamba-ink-soft">
        Each market&apos;s own most recent observation. Prices are never averaged across markets.
      </p>
      <div className="flex flex-col gap-2">
        {rows.map((row) => (
          <div
            key={row.marketId}
            className="flex flex-wrap items-center justify-between gap-2 rounded-shamba border border-shamba-line bg-shamba-card p-3"
          >
            <div>
              <p className="flex items-center gap-1.5 text-sm font-semibold text-shamba-ink">
                <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                {row.marketName}, {row.countyName}
              </p>
              <p className="text-xs text-shamba-ink-soft">Updated: {formatDisplayDate(row.recordedAt)}</p>
            </div>
            <div className="text-right text-sm text-shamba-ink">
              {row.wholesale !== null && (
                <p>
                  Wholesale: <span className="font-semibold">{formatKsh(row.wholesale)}/{unit}</span>
                </p>
              )}
              {row.retail !== null && (
                <p>
                  Retail: <span className="font-semibold">{formatKsh(row.retail)}/{unit}</span>
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

async function MarketDetail({
  supabase,
  productId,
  unit,
  marketId,
  marketName,
  countyName,
  range,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  productId: string;
  unit: string;
  marketId: string;
  marketName: string;
  countyName: string;
  range: string;
}) {
  const [source, changeSummary, observations] = await Promise.all([
    fetchSourceForProductMarket(supabase, { productId, marketId }),
    fetchPriceChangeSummary(supabase, { productId, marketId }),
    fetchPriceHistoryForMarket(supabase, { productId, marketId, sinceIso: rangeSinceIso(range) }),
  ]);

  // "Latest available price" always reflects the true most recent
  // database observation for each price type -- independent of the
  // selected time range, same as the change summary -- so filtering to
  // "7 Days" never makes the current price disappear just because the
  // last observation happens to be 9 days old.
  const latestWholesaleAt =
    changeSummary.wholesale.kind !== "none" ? changeSummary.wholesale.currentRecordedAt : null;
  const latestRetailAt = changeSummary.retail.kind !== "none" ? changeSummary.retail.currentRecordedAt : null;
  const latestWholesale = changeSummary.wholesale.kind !== "none" ? changeSummary.wholesale.current : null;
  const latestRetail = changeSummary.retail.kind !== "none" ? changeSummary.retail.current : null;
  const hasAnyObservationEver = latestWholesale !== null || latestRetail !== null;

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-shamba border border-shamba-line bg-shamba-card p-4">
        <p className="flex items-center gap-1.5 text-sm text-shamba-ink-soft">
          <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
          {marketName}, {countyName}
        </p>
        {source && (
          <p className="mt-2 text-xs text-shamba-ink-soft">
            Source:{" "}
            {source.websiteUrl ? (
              <a
                href={source.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-shamba-blue transition-colors hover:text-shamba-green-deep"
              >
                {source.name}
                <ExternalLink className="size-3" aria-hidden="true" />
              </a>
            ) : (
              <span className="font-semibold">{source.name}</span>
            )}
          </p>
        )}

        {hasAnyObservationEver ? (
          <div className="mt-3 flex flex-col gap-1 border-t border-shamba-line pt-3 text-sm text-shamba-ink">
            <p className="text-xs font-semibold uppercase tracking-wide text-shamba-ink-soft">
              Latest available price
            </p>
            {/* Wholesale and retail carry their own date, never a single
                shared one -- their most recent observations can genuinely
                fall on different days (e.g. wholesale reported today,
                retail last reported yesterday), and showing one merged
                date would misattribute the older price to a day it
                wasn't actually observed on. */}
            {latestWholesale !== null && latestWholesaleAt && (
              <p>
                Wholesale: <span className="font-semibold">{formatKsh(latestWholesale)}/{unit}</span>
                {" — "}
                {formatDisplayDate(latestWholesaleAt)}
              </p>
            )}
            {latestRetail !== null && latestRetailAt && (
              <p>
                Retail: <span className="font-semibold">{formatKsh(latestRetail)}/{unit}</span>
                {" — "}
                {formatDisplayDate(latestRetailAt)}
              </p>
            )}
          </div>
        ) : (
          <p className="mt-3 border-t border-shamba-line pt-3 text-sm text-shamba-ink-soft">
            No price observations are available for this product at this market yet.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ChangeRow label="Wholesale change" unit={unit} change={changeSummary.wholesale} />
        <ChangeRow label="Retail change" unit={unit} change={changeSummary.retail} />
      </div>

      {observations.length > 0 ? (
        <PriceHistoryChart observations={observations} unit={unit} />
      ) : (
        <p className="text-sm text-shamba-ink-soft">No price observations available for this period.</p>
      )}

      <TimeRangeSelector productId={productId} selectedRange={range} />

      {observations.length > 0 && (
        <div>
          <h2 className="font-display text-base font-semibold text-shamba-ink">Historical observations</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {[...observations]
              .reverse()
              .map((obs) => (
                <li
                  key={obs.recordedAt}
                  className="rounded-shamba border border-shamba-line bg-shamba-card p-3 text-sm"
                >
                  <p className="font-semibold text-shamba-ink">{formatDisplayDate(obs.recordedAt)}</p>
                  {obs.wholesale !== null && (
                    <p className="text-shamba-ink-soft">
                      Wholesale — {formatKsh(obs.wholesale)}/{unit}
                    </p>
                  )}
                  {obs.retail !== null && (
                    <p className="text-shamba-ink-soft">
                      Retail — {formatKsh(obs.retail)}/{unit}
                    </p>
                  )}
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}
