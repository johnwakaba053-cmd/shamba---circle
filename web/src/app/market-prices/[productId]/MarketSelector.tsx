"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { MarketOption } from "@/lib/priceHistory";

// Pure URL-driven navigation -- no client-side data fetching. Changing
// the market re-runs the Server Component page with a new `market`
// searchParam, keeping every Supabase query server-side.
export function MarketSelector({
  productId,
  markets,
  selectedMarketId,
}: {
  productId: string;
  markets: MarketOption[];
  selectedMarketId: string | "all";
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("market", value);
    router.push(`/market-prices/${productId}?${params.toString()}`);
  }

  return (
    <label className="flex w-full flex-col gap-1 text-sm">
      <span className="font-semibold text-shamba-ink">Market</span>
      {/* w-full + min-w-0: a native <select> can otherwise size itself
          to its widest <option> text (a long "Market Name (County
          Name)" string), which on a narrow phone screen would push the
          control past the viewport edge instead of wrapping. */}
      <select
        value={selectedMarketId}
        onChange={(e) => handleChange(e.target.value)}
        className="w-full min-w-0 rounded-shamba border border-shamba-line bg-shamba-card px-3 py-2 text-sm text-shamba-ink"
      >
        <option value="all">All Markets</option>
        {markets.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name} ({m.countyName})
          </option>
        ))}
      </select>
    </label>
  );
}
