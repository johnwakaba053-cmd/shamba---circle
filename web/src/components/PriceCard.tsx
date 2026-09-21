import Link from "next/link";
import { ArrowRight, CalendarDays, MapPin } from "lucide-react";
import type { MarketPriceCard } from "@/lib/marketPrices";

function formatDisplayDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatKsh(value: number): string {
  return `KSh ${value.toLocaleString("en-KE", { maximumFractionDigits: 2 })}`;
}

export function PriceCard({ price }: { price: MarketPriceCard }) {
  return (
    <Link
      href={`/market-prices/${price.productId}?market=${price.marketId}`}
      className="group flex flex-col gap-3 rounded-shamba border border-shamba-line bg-shamba-card p-4 transition-colors hover:border-shamba-green"
    >
      <h2 className="font-display text-base font-semibold leading-tight text-shamba-ink">
        {price.productName}
        {price.classification && (
          <span className="font-normal text-shamba-ink-soft"> — {price.classification}</span>
        )}
      </h2>

      <p className="flex items-center gap-1.5 text-sm text-shamba-ink-soft">
        <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
        {price.marketName}, {price.countyName}
      </p>

      <div className="flex flex-col gap-1 font-sans text-sm text-shamba-ink">
        {price.wholesalePrice !== null && (
          <p>
            <span className="font-semibold">Wholesale:</span> {formatKsh(price.wholesalePrice)}/
            {price.unit}
          </p>
        )}
        {price.retailPrice !== null && (
          <p>
            <span className="font-semibold">Retail:</span> {formatKsh(price.retailPrice)}/
            {price.unit}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-shamba-line pt-3 text-xs text-shamba-ink-soft">
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays className="size-3.5 shrink-0" aria-hidden="true" />
          Updated: {formatDisplayDate(price.recordedAt)}
        </span>

        <span className="font-semibold">Source: {price.sourceName}</span>
      </div>

      <span className="inline-flex items-center gap-1 self-end font-sans text-xs font-semibold text-shamba-green transition-colors group-hover:text-shamba-green-deep">
        View price history
        <ArrowRight className="size-3.5" aria-hidden="true" />
      </span>
    </Link>
  );
}
