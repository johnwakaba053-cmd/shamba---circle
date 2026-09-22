// Marketplace 2.0 Batch M2: discovery query-building helpers, shared by
// marketplace/page.tsx and its filter/pagination UI. Kept as pure
// functions (no Supabase client involved) so the cursor/predicate logic
// can be validated directly, independent of any network call.

export const PAGE_SIZE = 20;

export const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
] as const;

export type SortOption = (typeof SORT_OPTIONS)[number]["value"];

export function isSortOption(value: string | undefined): value is SortOption {
  return SORT_OPTIONS.some((option) => option.value === value);
}

// Escapes a farmer-typed search term for safe use inside a PostgREST
// `.or()` filter string. Two independent escaping concerns, applied in
// order (innermost first):
//
// 1. SQL ILIKE's own wildcard characters (% and _) and its escape
//    character (\) are backslash-escaped so a literal "%" or "_" the
//    farmer typed is matched as a literal character, never as a SQL
//    wildcard.
// 2. The result is embedded as a double-quoted value inside a
//    PostgREST .or() filter string (title.ilike."...") -- double-
//    quoting is PostgREST's own documented way to safely include
//    characters that are otherwise significant in its filter
//    mini-language (comma, parentheses, colon, period). Within that
//    double-quoted value, PostgREST requires backslash and the double
//    quote itself to be backslash-escaped.
//
// Verified empirically against the live listings table with terms
// containing %, _, commas, parentheses, quotes, and backslashes -- all
// resolved to the expected zero/one-row result with no query error.
export function escapeSearchTerm(term: string): string {
  const likeEscaped = term.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
  return likeEscaped.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

// Matches title OR description, case-insensitive, substring anywhere --
// PostgREST's `*` is its own wildcard token for ilike within a filter
// string (translated to SQL `%`), independent of the SQL-level escaping
// already applied to the farmer's literal text above.
export function buildSearchFilter(term: string): string {
  const escaped = escapeSearchTerm(term);
  return `title.ilike."*${escaped}*",description.ilike."*${escaped}*"`;
}

export type DiscoveryCursor = {
  // The current sort column's value for the last row of the previous
  // page. Always a string (ISO timestamp or a numeric string) or null
  // (only possible for price, which is nullable).
  value: string | null;
  id: string;
};

// Cursor wire format: "<value>|<id>", with the literal sentinel "null"
// standing in for an actual null price (price sorts only -- created_at
// is never null, so "newest"/"oldest" cursors always carry a real
// timestamp string).
export function encodeCursor(value: string | number | null, id: string): string {
  const valuePart = value === null ? "null" : String(value);
  return `${valuePart}|${id}`;
}

export function decodeCursor(raw: string): DiscoveryCursor | null {
  const separatorIndex = raw.indexOf("|");
  if (separatorIndex <= 0 || separatorIndex === raw.length - 1) return null;

  const valuePart = raw.slice(0, separatorIndex);
  const id = raw.slice(separatorIndex + 1);
  return { value: valuePart === "null" ? null : valuePart, id };
}

// The `.order()` calls to apply for a given sort mode -- always paired
// with `id ASC` as a deterministic tie-breaker (ties are possible on
// created_at down to the microsecond, and on price by definition), and
// with an explicit `nullsFirst` on price sorts so a farmer's "highest
// price first" list never opens with every unpriced listing at the top
// (Postgres's own default is NULLS FIRST for DESC, which is the wrong
// direction for a price sort's actual intent).
export function getOrderClauses(
  sort: SortOption,
): { column: "created_at" | "price" | "id"; ascending: boolean; nullsFirst?: boolean }[] {
  switch (sort) {
    case "newest":
      return [
        { column: "created_at", ascending: false },
        { column: "id", ascending: true },
      ];
    case "oldest":
      return [
        { column: "created_at", ascending: true },
        { column: "id", ascending: true },
      ];
    case "price_asc":
      return [
        { column: "price", ascending: true, nullsFirst: false },
        { column: "id", ascending: true },
      ];
    case "price_desc":
      return [
        { column: "price", ascending: false, nullsFirst: false },
        { column: "id", ascending: true },
      ];
  }
}

// The keyset predicate (as a PostgREST `.or()` filter string) for "rows
// strictly after this cursor, in this sort's own order." Verified
// empirically against the live listings table for both the
// created_at-based and price-based (including the NULLS-LAST tail)
// cases -- a cursor equal to a real row's own values correctly excludes
// exactly that row with no error, and a price cursor correctly pulls in
// every null-price row once past the priced portion of the list.
export function buildCursorFilter(sort: SortOption, cursor: DiscoveryCursor): string | null {
  const { value, id } = cursor;

  switch (sort) {
    case "newest":
      if (value === null) return null; // created_at is never null; a null cursor here is invalid
      return `created_at.lt.${value},and(created_at.eq.${value},id.gt.${id})`;
    case "oldest":
      if (value === null) return null;
      return `created_at.gt.${value},and(created_at.eq.${value},id.gt.${id})`;
    case "price_asc":
      return value === null
        ? `and(price.is.null,id.gt.${id})`
        : `price.gt.${value},and(price.eq.${value},id.gt.${id}),price.is.null`;
    case "price_desc":
      return value === null
        ? `and(price.is.null,id.gt.${id})`
        : `price.lt.${value},and(price.eq.${value},id.gt.${id}),price.is.null`;
  }
}

// What to encode into the `before` param for the next page, read off
// the last row of the current (already sorted) page.
export function cursorValueForRow(
  sort: SortOption,
  row: { created_at: string; price: number | null },
): string | number | null {
  return sort === "newest" || sort === "oldest" ? row.created_at : row.price;
}

export type DiscoveryParams = {
  q?: string;
  category?: string;
  minPrice?: string;
  maxPrice?: string;
  sort?: string;
  before?: string;
};

// Builds a /marketplace URL carrying exactly the discovery state passed
// in -- the single source of truth for both the server-rendered "Load
// more" link (page.tsx) and the client filter controls
// (MarketplaceFilters.tsx), so the two can never drift into different
// query-string shapes. "newest" (the default sort) and any empty/absent
// value are omitted entirely, keeping the unfiltered URL exactly
// "/marketplace" rather than a longer equivalent -- refreshable,
// shareable, and back/forward-safe either way, but this keeps the
// common case's URL clean.
export function buildMarketplaceHref(params: DiscoveryParams): string {
  const usp = new URLSearchParams();
  if (params.q) usp.set("q", params.q);
  if (params.category) usp.set("category", params.category);
  if (params.minPrice) usp.set("minPrice", params.minPrice);
  if (params.maxPrice) usp.set("maxPrice", params.maxPrice);
  if (params.sort && params.sort !== "newest") usp.set("sort", params.sort);
  if (params.before) usp.set("before", params.before);
  const query = usp.toString();
  return query ? `/marketplace?${query}` : "/marketplace";
}
