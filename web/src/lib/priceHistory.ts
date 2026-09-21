import type { SupabaseClient } from "@supabase/supabase-js";

// Data access for the /market-prices/[productId] history page. Every
// function here only ever reads agricultural_prices and its existing
// reference tables (already open-SELECT to authenticated) -- nothing
// new is exposed, and none of this touches
// agricultural_price_ingestion_conflicts, which has no read policy for
// `authenticated` at all. That matters specifically for livestock: KAMIS
// can report several individual transaction prices for the same
// product/market/day, but agricultural_prices' own unique constraint
// (product_id, market_id, source_id, price_type, recorded_at) means at
// most ONE wholesale and ONE retail row per day ever lands here -- every
// other same-day observation is preserved instead in the conflicts
// table for manual review. This page deliberately does not widen that
// table's access to build a same-day price range; it shows exactly what
// agricultural_prices holds, honestly labeled, per the existing
// ingestion design's own "never overwrite, never guess" rule.

export type PriceHistoryProduct = {
  id: string;
  name: string;
  classification: string | null;
  unit: string;
  category: string;
};

export async function fetchProductById(
  supabase: SupabaseClient,
  productId: string,
): Promise<PriceHistoryProduct | null> {
  const { data } = await supabase
    .from("agricultural_price_products")
    .select("id, name, classification, unit, category")
    .eq("id", productId)
    .maybeSingle();

  if (!data) return null;

  return {
    id: data.id,
    name: data.name,
    classification: data.classification.trim().length > 0 ? data.classification : null,
    unit: data.unit,
    category: data.category,
  };
}

// A safety bound, not a page size: fetchMarketsForProduct and
// fetchLatestPricePerMarket both need only one (market_id, recorded_at)
// pair per market -- at most the ~50-60 markets in the whole catalogue
// -- but derive it by reducing raw price rows in JS rather than a
// database-side GROUP BY, since this project's PostgREST has aggregate
// functions disabled (confirmed live) and adding an RPC/migration for a
// single GROUP BY felt disproportionate. Ordering DESC + this limit
// keeps both queries from scaling unboundedly with a product's entire
// ingestion history as the daily cron accumulates more of it, while
// changing nothing about today's real, still-small dataset (the whole
// agricultural_prices table is a few hundred rows) or any product's
// nearer-term future. A market whose only observations for a product
// fall outside the most recent 2000 rows would stop appearing -- not
// possible today, and not expected for a long time at this feature's
// current growth rate.
const MAX_HISTORY_ROWS_FOR_AGGREGATION = 2000;

export type MarketOption = {
  id: string;
  name: string;
  countyName: string;
  latestRecordedAt: string;
};

// Markets this product actually has observations for -- never every
// market in the catalogue, so the selector can't offer a market with
// nothing to show.
export async function fetchMarketsForProduct(
  supabase: SupabaseClient,
  productId: string,
): Promise<MarketOption[]> {
  const { data: priceRows } = await supabase
    .from("agricultural_prices")
    .select("market_id, recorded_at")
    .eq("product_id", productId)
    .order("recorded_at", { ascending: false })
    .limit(MAX_HISTORY_ROWS_FOR_AGGREGATION);

  if (!priceRows || priceRows.length === 0) return [];

  // DESC order means the first row seen for a given market is already
  // its latest -- so once every market_id in this batch has been
  // recorded once, later (older) rows for the same market are
  // redundant. Kept as a plain "first wins" map rather than an explicit
  // early-exit loop, since the row count is already bounded above.
  const latestByMarket = new Map<string, string>();
  for (const row of priceRows) {
    const current = latestByMarket.get(row.market_id);
    if (!current || row.recorded_at > current) {
      latestByMarket.set(row.market_id, row.recorded_at);
    }
  }

  const marketIds = Array.from(latestByMarket.keys());
  const { data: markets } = await supabase
    .from("agricultural_markets")
    .select("id, name, county_id")
    .in("id", marketIds);

  const countyIds = Array.from(new Set((markets ?? []).map((m) => m.county_id)));
  const { data: counties } =
    countyIds.length > 0
      ? await supabase.from("counties").select("id, name").in("id", countyIds)
      : { data: [] as { id: string; name: string }[] };
  const countyNameById = new Map((counties ?? []).map((c) => [c.id, c.name]));

  const options: MarketOption[] = (markets ?? []).map((m) => ({
    id: m.id,
    name: m.name,
    countyName: countyNameById.get(m.county_id) ?? "",
    latestRecordedAt: latestByMarket.get(m.id) ?? "",
  }));

  return options.sort((a, b) => a.name.localeCompare(b.name));
}

export type PriceObservation = {
  recordedAt: string;
  wholesale: number | null;
  retail: number | null;
};

const RANGE_DAYS: Record<string, number | null> = {
  "7": 7,
  "30": 30,
  "90": 90,
  "180": 180,
  "365": 365,
  all: null,
};

// Object.hasOwn (not `in`) deliberately: `in` also matches inherited
// Object.prototype members, so a crafted `?range=constructor` (or
// `toString`, `hasOwnProperty`, `valueOf`, ...) would otherwise pass
// this check and hand rangeSinceIso a function where it expects a
// number or null -- that previously propagated into date arithmetic as
// NaN and made `.toISOString()` throw, crashing the page.
export function isValidRangeKey(value: string): boolean {
  return Object.hasOwn(RANGE_DAYS, value);
}

export function rangeSinceIso(rangeKey: string, now: Date = new Date()): string | null {
  // "all" legitimately maps to `null` -- `??` would treat that null as
  // missing and wrongly fall back to 30 days, so presence is checked
  // explicitly (via Object.hasOwn, not `in` -- see isValidRangeKey)
  // instead of relying on nullish coalescing here.
  const days = Object.hasOwn(RANGE_DAYS, rangeKey) ? RANGE_DAYS[rangeKey] : RANGE_DAYS["30"];
  if (days === null) return null;
  // Anchored to UTC midnight of *today* before subtracting days, not to
  // `now`'s own time-of-day -- every recorded_at is always exactly
  // midnight UTC, so subtracting whole days from a `now` that carries
  // the current time-of-day would push the boundary past midnight on
  // the oldest requested day and silently exclude it (e.g. "7 Days" at
  // 18:00 UTC would cut off virtually all of day 7). Anchoring to
  // midnight first guarantees the oldest requested calendar day is
  // always included.
  const todayUtcMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const since = new Date(todayUtcMidnight - days * 24 * 60 * 60 * 1000);
  return since.toISOString();
}

// One product+market's observations within the given range, oldest
// first (chart reading order). At most one wholesale and one retail
// value per date, by construction of agricultural_prices' own unique
// constraint -- never averaged, never interpolated.
export async function fetchPriceHistoryForMarket(
  supabase: SupabaseClient,
  params: { productId: string; marketId: string; sinceIso: string | null },
): Promise<PriceObservation[]> {
  let query = supabase
    .from("agricultural_prices")
    .select("recorded_at, price, price_type")
    .eq("product_id", params.productId)
    .eq("market_id", params.marketId);

  if (params.sinceIso) {
    query = query.gte("recorded_at", params.sinceIso);
  }

  const { data: rows } = await query.order("recorded_at", { ascending: true });
  if (!rows || rows.length === 0) return [];

  const byDate = new Map<string, PriceObservation>();
  for (const row of rows) {
    let obs = byDate.get(row.recorded_at);
    if (!obs) {
      obs = { recordedAt: row.recorded_at, wholesale: null, retail: null };
      byDate.set(row.recorded_at, obs);
    }
    const value = Number(row.price);
    if (row.price_type === "wholesale") obs.wholesale = value;
    else if (row.price_type === "retail") obs.retail = value;
  }

  return Array.from(byDate.values()).sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
}

export type PriceChangeSeries =
  | { kind: "none" }
  | { kind: "single"; current: number; currentRecordedAt: string }
  | {
      kind: "comparable";
      current: number;
      currentRecordedAt: string;
      previous: number;
      previousRecordedAt: string;
      absoluteChange: number;
      percentChange: number | null;
      direction: "up" | "down" | "unchanged";
    };

export type PriceChangeSummary = {
  wholesale: PriceChangeSeries;
  retail: PriceChangeSeries;
};

function buildSeries(observations: { recordedAt: string; value: number }[]): PriceChangeSeries {
  if (observations.length === 0) return { kind: "none" };
  const [current, previous] = observations;
  if (!previous) {
    return { kind: "single", current: current.value, currentRecordedAt: current.recordedAt };
  }

  const absoluteChange = current.value - previous.value;
  const percentChange = previous.value !== 0 ? (absoluteChange / previous.value) * 100 : null;
  const direction = absoluteChange > 0 ? "up" : absoluteChange < 0 ? "down" : "unchanged";

  return {
    kind: "comparable",
    current: current.value,
    currentRecordedAt: current.recordedAt,
    previous: previous.value,
    previousRecordedAt: previous.recordedAt,
    absoluteChange,
    percentChange,
    direction,
  };
}

// The two most recent actual observations per price type, independent
// of whatever date range the chart is currently showing -- "previous"
// means the previous real database row, never the previous calendar
// day. A small bounded query (most recent 20 rows for this
// product+market is far more than enough to find 2 wholesale + 2
// retail values even if one price type reports far less often than the
// other).
export async function fetchPriceChangeSummary(
  supabase: SupabaseClient,
  params: { productId: string; marketId: string },
): Promise<PriceChangeSummary> {
  const { data: rows } = await supabase
    .from("agricultural_prices")
    .select("recorded_at, price, price_type")
    .eq("product_id", params.productId)
    .eq("market_id", params.marketId)
    .order("recorded_at", { ascending: false })
    .limit(20);

  const wholesaleObs: { recordedAt: string; value: number }[] = [];
  const retailObs: { recordedAt: string; value: number }[] = [];

  for (const row of rows ?? []) {
    const target = row.price_type === "wholesale" ? wholesaleObs : row.price_type === "retail" ? retailObs : null;
    if (!target || target.length >= 2) continue;
    target.push({ recordedAt: row.recorded_at, value: Number(row.price) });
  }

  return {
    wholesale: buildSeries(wholesaleObs),
    retail: buildSeries(retailObs),
  };
}

export type SourceInfo = {
  name: string;
  websiteUrl: string | null;
};

// The source attached to this product+market's most recent observation.
// Every existing agricultural_prices row for one product/market pair
// has come from a single source in practice (KAMIS), but this looks it
// up rather than hardcoding it, so a future second source is picked up
// automatically.
export async function fetchSourceForProductMarket(
  supabase: SupabaseClient,
  params: { productId: string; marketId: string },
): Promise<SourceInfo | null> {
  const { data: row } = await supabase
    .from("agricultural_prices")
    .select("source_id")
    .eq("product_id", params.productId)
    .eq("market_id", params.marketId)
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row) return null;

  const { data: source } = await supabase
    .from("agricultural_price_sources")
    .select("name, website_url")
    .eq("id", row.source_id)
    .maybeSingle();

  if (!source) return null;

  return { name: source.name, websiteUrl: source.website_url };
}

export type MarketComparisonRow = {
  marketId: string;
  marketName: string;
  countyName: string;
  wholesale: number | null;
  retail: number | null;
  recordedAt: string;
};

// "All Markets" view: each market's own most recent observation, shown
// side by side -- never averaged or blended into one invented number.
export async function fetchLatestPricePerMarket(
  supabase: SupabaseClient,
  productId: string,
): Promise<MarketComparisonRow[]> {
  const { data: rows } = await supabase
    .from("agricultural_prices")
    .select("market_id, recorded_at, price, price_type")
    .eq("product_id", productId)
    .order("recorded_at", { ascending: false })
    .limit(MAX_HISTORY_ROWS_FOR_AGGREGATION);

  if (!rows || rows.length === 0) return [];

  const latestDateByMarket = new Map<string, string>();
  for (const row of rows) {
    if (!latestDateByMarket.has(row.market_id)) {
      latestDateByMarket.set(row.market_id, row.recorded_at);
    }
  }

  const byMarket = new Map<string, MarketComparisonRow>();
  for (const row of rows) {
    if (row.recorded_at !== latestDateByMarket.get(row.market_id)) continue;
    let entry = byMarket.get(row.market_id);
    if (!entry) {
      entry = {
        marketId: row.market_id,
        marketName: "",
        countyName: "",
        wholesale: null,
        retail: null,
        recordedAt: row.recorded_at,
      };
      byMarket.set(row.market_id, entry);
    }
    const value = Number(row.price);
    if (row.price_type === "wholesale") entry.wholesale = value;
    else if (row.price_type === "retail") entry.retail = value;
  }

  const marketIds = Array.from(byMarket.keys());
  const { data: markets } = await supabase
    .from("agricultural_markets")
    .select("id, name, county_id")
    .in("id", marketIds);

  const countyIds = Array.from(new Set((markets ?? []).map((m) => m.county_id)));
  const { data: counties } =
    countyIds.length > 0
      ? await supabase.from("counties").select("id, name").in("id", countyIds)
      : { data: [] as { id: string; name: string }[] };
  const countyNameById = new Map((counties ?? []).map((c) => [c.id, c.name]));

  for (const market of markets ?? []) {
    const entry = byMarket.get(market.id);
    if (!entry) continue;
    entry.marketName = market.name;
    entry.countyName = countyNameById.get(market.county_id) ?? "";
  }

  return Array.from(byMarket.values()).sort((a, b) => a.marketName.localeCompare(b.marketName));
}
