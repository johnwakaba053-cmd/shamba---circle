// Server-only. Downloads KAMIS's own official Excel export mechanism
// (discovered and verified during Stage 2A/2B) -- never scrapes HTML.
// No API key or credential of any kind is needed to call KAMIS itself
// (it's a public, unauthenticated government endpoint); the secret this
// feature actually gates is INGEST_SECRET, checked by the route handler
// that calls into this module, not anything sent to KAMIS.

export const KAMIS_SEARCH_ENDPOINT = "https://kamis.kilimo.go.ke/site/market_search";
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_TRANSIENT_RETRIES = 2;

// Only commodities a human has actually verified against KAMIS's own
// numeric product id scheme (Stage 2B) may ever be requested -- a
// malformed/unknown product[] value is confirmed to crash KAMIS's own
// endpoint with an HTTP 500, so this whitelist exists specifically to
// make that class of request impossible to construct in the first
// place, not just to be tidy.
//
// The 8 "29".."246" entries are Stage 7B's dry bean expansion, added
// only after each was confirmed active in a real KAMIS export (625
// rows, 0 junk, 100% wholesale+retail present) over the 30 days ending
// 2026-09-21. Names are stored exactly as KAMIS's own export renders
// them in its "Commodity" column -- this is also the daily ingestion
// cron's product list (see ingest-kamis-prices/route.ts, which derives
// its scheduled run from Object.keys(WHITELISTED_KAMIS_PRODUCTS)
// directly), so adding a verified id here is the one change that
// extends both the manual test path and the daily job at once.
// The 21 "2".."12" entries below are Stage 7C's high-coverage Kg-priced
// crop/vegetable/fruit/pulse batch, selected from a read-only audit of
// KAMIS's full 190-commodity catalogue (see the Stage 7C migrations for
// the exact row/market/county counts each one was verified against).
// Deliberately excludes anything needing an architecture decision first
// (livestock, milk, eggs, meat, fish, fertilizer, flour) -- see that
// audit for why each of those was held back.
export const WHITELISTED_KAMIS_PRODUCTS: Record<string, string> = {
  "1": "Dry Maize",
  "29": "Beans Red Haricot (Wairimu)",
  "30": "Beans (Yellow-Green)",
  "64": "Beans Rosecoco",
  "65": "Beans (Mwitemania)",
  "66": "Beans (Mwezi Moja)",
  "67": "Beans (Canadian wonder)",
  "183": "Beans Rosecoco (Nyayo)",
  "246": "Mixed Beans",
  "2": "Red Sorghum",
  "54": "Finger Millet",
  "51": "Pearl Rush Millet",
  "61": "Tomatoes",
  "158": "Dry Onions",
  "58": "Cabbages",
  "154": "Kales/Sukuma Wiki",
  "163": "White Irish Potatoes",
  "60": "Carrots",
  "59": "Sweet potatoes",
  "172": "Capsicums",
  "121": "Black nightshade (Managu/ Osuga)",
  "161": "Spinach",
  "143": "Arrow Root",
  "127": "Oranges",
  "150": "Water Melon",
  "255": "Banana (Cooking)",
  "189": "Cowpeas",
  "142": "Avocado",
  "10": "Green Grams",
  "12": "Ground Nuts",
  // Stage 8B: milk, the first non-Kg unit onboarded after Stage 8A's
  // plumbing. Two separate KAMIS commodity ids, deliberately not
  // merged -- "at collection point" and "processed" are different
  // market stages with independently observed prices.
  "133": "Cow Milk(At collection point)",
  "153": "Cow Milk(Processd)",
  // Combined livestock/egg batch: 89 curated (classification, grade,
  // sex) product variants exist for these 5 ids -- see the three
  // migrations dated 20260921{24,25,26}0000. A KAMIS row for one of
  // these ids that doesn't match a curated variant continues to
  // quarantine as unmapped_product rather than being guessed.
  "72": "Eggs",
  "227": "Chicken",
  "168": "Goat",
  "167": "Sheep",
  "140": "Cattle",
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_PER_PAGE = 3000;

// How many days the daily scheduled run looks back, including today.
// KAMIS does not publish on a guaranteed schedule or exact time -- a
// rolling multi-day window (not just "today") means a delayed or
// late-corrected KAMIS update for a recent date is still picked up by
// a later day's run instead of being missed entirely because it wasn't
// published yet at the moment this ran. Safe to re-request the same
// dates on every run: recorded_at is always deterministically midnight
// UTC of the KAMIS date (never the ingestion time), so combined with
// the existing (product_id, market_id, source_id, price_type,
// recorded_at) unique constraint, an already-ingested day is simply
// skipped as a duplicate -- never re-inserted, never overwritten.
export const DAILY_INGESTION_LOOKBACK_DAYS = 3;

function formatDateUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Computes the [start, end] date range (inclusive, YYYY-MM-DD) the
// daily scheduled job requests by default: today and the
// (DAILY_INGESTION_LOOKBACK_DAYS - 1) days before it, in UTC. Exported
// as a pure function (accepts an optional reference date) so it can be
// tested/reasoned about without depending on the real current time.
export function getDefaultDailyIngestionWindow(
  referenceDate: Date = new Date(),
): { start: string; end: string } {
  const end = formatDateUtc(referenceDate);
  const startDate = new Date(referenceDate);
  startDate.setUTCDate(startDate.getUTCDate() - (DAILY_INGESTION_LOOKBACK_DAYS - 1));
  const start = formatDateUtc(startDate);
  return { start, end };
}

export type KamisFetchParams = {
  productIds: string[];
  counties?: string[];
  markets?: string[];
  start: string;
  end: string;
  perPage: number;
};

export type ParamValidationResult =
  | { ok: true; params: KamisFetchParams }
  | { ok: false; error: string };

// Validates operator-supplied request parameters before anything is
// sent to KAMIS. Deliberately conservative: rejects rather than guesses
// or clamps a bad value, since a malformed product id specifically is
// known to crash the upstream endpoint rather than degrade gracefully.
export function validateKamisFetchParams(input: {
  productIds?: unknown;
  counties?: unknown;
  markets?: unknown;
  start?: unknown;
  end?: unknown;
  perPage?: unknown;
}): ParamValidationResult {
  if (!Array.isArray(input.productIds) || input.productIds.length === 0) {
    return { ok: false, error: "productIds must be a non-empty array" };
  }
  const productIds: string[] = [];
  for (const id of input.productIds) {
    if (typeof id !== "string" || !(id in WHITELISTED_KAMIS_PRODUCTS)) {
      return { ok: false, error: `Product id "${String(id)}" is not on the whitelist` };
    }
    productIds.push(id);
  }

  if (typeof input.start !== "string" || !DATE_PATTERN.test(input.start)) {
    return { ok: false, error: "start must be a YYYY-MM-DD date string" };
  }
  if (typeof input.end !== "string" || !DATE_PATTERN.test(input.end)) {
    return { ok: false, error: "end must be a YYYY-MM-DD date string" };
  }
  if (input.start > input.end) {
    return { ok: false, error: "start must not be after end" };
  }

  if (
    typeof input.perPage !== "number" ||
    !Number.isInteger(input.perPage) ||
    input.perPage < 1 ||
    input.perPage > MAX_PER_PAGE
  ) {
    return { ok: false, error: `perPage must be an integer between 1 and ${MAX_PER_PAGE}` };
  }

  let counties: string[] | undefined;
  if (input.counties !== undefined) {
    if (!Array.isArray(input.counties) || !input.counties.every((c) => typeof c === "string")) {
      return { ok: false, error: "counties must be an array of strings if provided" };
    }
    counties = input.counties.map((c) => c.trim()).filter((c) => c.length > 0);
  }

  let markets: string[] | undefined;
  if (input.markets !== undefined) {
    if (!Array.isArray(input.markets) || !input.markets.every((m) => typeof m === "string")) {
      return { ok: false, error: "markets must be an array of strings if provided" };
    }
    markets = input.markets.map((m) => m.trim()).filter((m) => m.length > 0);
  }

  return {
    ok: true,
    params: { productIds, counties, markets, start: input.start, end: input.end, perPage: input.perPage },
  };
}

export function buildKamisExportUrl(params: KamisFetchParams): string {
  const url = new URL(KAMIS_SEARCH_ENDPOINT);
  params.productIds.forEach((id) => url.searchParams.append("product[]", id));
  params.counties?.forEach((c) => url.searchParams.append("county[]", c));
  params.markets?.forEach((m) => url.searchParams.append("market[]", m));
  url.searchParams.set("start", params.start);
  url.searchParams.set("end", params.end);
  url.searchParams.set("per_page", String(params.perPage));
  url.searchParams.set("export", "excel");
  return url.toString();
}

export type KamisDownloadResult =
  | { ok: true; buffer: Buffer; contentType: string | null; url: string }
  | { ok: false; error: string; url: string; httpStatus?: number };

function isTransientError(err: unknown): boolean {
  // Network-level failures only (DNS, connection reset, our own
  // timeout) -- an HTTP response that arrived with a 4xx/5xx status is
  // NOT a transient error and is handled separately, never retried,
  // since it's a deterministic response to the request we sent.
  if (err instanceof DOMException && err.name === "TimeoutError") return true;
  if (err instanceof TypeError) return true;
  return false;
}

// Downloads KAMIS's own "Export to Excel" output for the given,
// already-validated parameters. Never scrapes the HTML market/
// market_search pages themselves -- this is the one mechanism Stage
// 2A/2B identified as the site's own sanctioned download feature.
export async function fetchKamisExport(params: KamisFetchParams): Promise<KamisDownloadResult> {
  const url = buildKamisExportUrl(params);

  let lastError: string = "Unknown error";

  for (let attempt = 0; attempt <= MAX_TRANSIENT_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "ShambaCircle-Ingestion/1.0" },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (response.status !== 200) {
        // Deterministic response from the parameters we sent -- never
        // retried, regardless of whether it's a 4xx or 5xx.
        return {
          ok: false,
          error: `KAMIS responded with HTTP ${response.status}`,
          url,
          httpStatus: response.status,
        };
      }

      const contentType = response.headers.get("content-type");
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      return { ok: true, buffer, contentType, url };
    } catch (err) {
      lastError = err instanceof Error ? err.message : "Unknown error";
      if (!isTransientError(err) || attempt === MAX_TRANSIENT_RETRIES) {
        return { ok: false, error: `KAMIS request failed: ${lastError}`, url };
      }
      // Otherwise: transient failure with retries remaining, loop again.
    }
  }

  return { ok: false, error: `KAMIS request failed: ${lastError}`, url };
}

// The ZIP local-file-header magic bytes every valid, non-empty .xlsx
// must start with. An HTML error page (KAMIS is confirmed to return a
// plain 404 HTML page for at least one broken asset path) would fail
// this check even if it somehow arrived with a 200 status, which is
// exactly the defense-in-depth this check is for.
export function hasXlsxMagicBytes(buffer: Buffer): boolean {
  return (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  );
}
