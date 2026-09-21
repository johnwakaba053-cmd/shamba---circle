import type { SupabaseClient } from "@supabase/supabase-js";

// One card per (product, market, source, recorded_at) -- wholesale and
// retail rows for that same combination are merged into a single card,
// never rendered as two near-duplicate cards. Only real, already-ingested
// agricultural_prices rows ever produce a card; no price is computed,
// estimated, or invented here.
export type MarketPriceCard = {
  key: string;
  productId: string;
  marketId: string;
  category: string;
  productName: string;
  classification: string | null;
  unit: string;
  marketName: string;
  countyName: string;
  sourceName: string;
  sourceWebsiteUrl: string | null;
  recordedAt: string;
  wholesalePrice: number | null;
  retailPrice: number | null;
};

// Bounds how much history a first page load pulls -- this is a "recent
// prices" view, not an unbounded historical export. Generous relative to
// today's real row count (4), with headroom as more markets/dates accrue
// from the daily KAMIS cron.
const RECENT_PRICE_ROW_LIMIT = 200;

type PriceRow = {
  product_id: string;
  market_id: string;
  source_id: string;
  price: number | string;
  price_type: "wholesale" | "retail" | null;
  recorded_at: string;
};

// Same batched-query + Map shape already used by fetchListingMediaByListingId
// (lib/listingMedia.ts) and the importer's own market/county lookups
// (lib/kamis/ingest.ts) -- flat queries joined in JS, not a PostgREST
// embed, matching how every other multi-table read in this codebase works.
export async function fetchRecentMarketPrices(
  supabase: SupabaseClient,
): Promise<MarketPriceCard[]> {
  const { data: priceRows } = await supabase
    .from("agricultural_prices")
    .select("product_id, market_id, source_id, price, price_type, recorded_at")
    .order("recorded_at", { ascending: false })
    .limit(RECENT_PRICE_ROW_LIMIT);

  if (!priceRows || priceRows.length === 0) {
    return [];
  }

  const rows = priceRows as PriceRow[];
  const productIds = Array.from(new Set(rows.map((r) => r.product_id)));
  const marketIds = Array.from(new Set(rows.map((r) => r.market_id)));
  const sourceIds = Array.from(new Set(rows.map((r) => r.source_id)));

  const [{ data: products }, { data: markets }, { data: sources }] = await Promise.all([
    supabase
      .from("agricultural_price_products")
      .select("id, name, classification, unit, category")
      .in("id", productIds),
    supabase.from("agricultural_markets").select("id, name, county_id").in("id", marketIds),
    supabase
      .from("agricultural_price_sources")
      .select("id, name, website_url")
      .in("id", sourceIds),
  ]);

  const countyIds = Array.from(new Set((markets ?? []).map((m) => m.county_id)));
  const { data: counties } =
    countyIds.length > 0
      ? await supabase.from("counties").select("id, name").in("id", countyIds)
      : { data: [] as { id: string; name: string }[] };

  const productById = new Map((products ?? []).map((p) => [p.id, p]));
  const countyNameById = new Map((counties ?? []).map((c) => [c.id, c.name]));
  const marketById = new Map((markets ?? []).map((m) => [m.id, m]));
  const sourceById = new Map((sources ?? []).map((s) => [s.id, s]));

  const cardsByKey = new Map<string, MarketPriceCard>();

  for (const row of rows) {
    const product = productById.get(row.product_id);
    const market = marketById.get(row.market_id);
    const source = sourceById.get(row.source_id);

    // FKs are NOT NULL and all three tables grant open SELECT to
    // authenticated -- a missing lookup here would mean the row's
    // reference was deleted out from under it, not a normal case. Skip
    // defensively rather than render a broken card.
    if (!product || !market || !source) continue;

    const key = `${row.product_id}::${row.market_id}::${row.source_id}::${row.recorded_at}`;

    let card = cardsByKey.get(key);
    if (!card) {
      card = {
        key,
        productId: row.product_id,
        marketId: row.market_id,
        category: product.category,
        productName: product.name,
        classification: product.classification.trim().length > 0 ? product.classification : null,
        unit: product.unit,
        marketName: market.name,
        countyName: countyNameById.get(market.county_id) ?? "",
        sourceName: source.name,
        sourceWebsiteUrl: source.website_url,
        recordedAt: row.recorded_at,
        wholesalePrice: null,
        retailPrice: null,
      };
      cardsByKey.set(key, card);
    }

    const numericPrice = Number(row.price);
    if (row.price_type === "wholesale") {
      card.wholesalePrice = numericPrice;
    } else if (row.price_type === "retail") {
      card.retailPrice = numericPrice;
    }
  }

  // Requested ordering: newest recorded_at first, then product, county,
  // market. Re-asserted here (rather than relied on from the DB order)
  // because grouping by key does not preserve the original row order.
  return Array.from(cardsByKey.values()).sort((a, b) => {
    if (a.recordedAt !== b.recordedAt) return a.recordedAt < b.recordedAt ? 1 : -1;
    if (a.productName !== b.productName) return a.productName.localeCompare(b.productName);
    if (a.countyName !== b.countyName) return a.countyName.localeCompare(b.countyName);
    return a.marketName.localeCompare(b.marketName);
  });
}
