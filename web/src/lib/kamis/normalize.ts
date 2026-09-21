// Pure functions, no I/O -- normalization/validation rules shared by
// the ingestion orchestrator. Kept separate from ingest.ts so the
// parsing rules themselves (what counts as a valid price, how a KAMIS
// date becomes recorded_at) can be reasoned about independently of the
// database/network orchestration around them.

// Trims, casefolds, strips apostrophes, and treats hyphens/underscores
// as equivalent to a plain space before collapsing whitespace --
// specifically because KAMIS reports county names like "Uasin-Gishu"
// (our table stores "Uasin Gishu", no hyphen) and "Muranga" (our table
// stores "Murang'a", with an apostrophe). Confirmed against a real
// KAMIS export during Stage 6B market discovery -- without stripping
// the apostrophe, "Muranga" fails to match "Murang'a" even after
// hyphen normalization, and a real, correctly-spelled county would be
// wrongly quarantined as unknown.
export function normalizeForMatching(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/['’ʼ.]/g, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type PriceParseResult =
  | { kind: "none" }
  | { kind: "valid"; value: number }
  | { kind: "malformed_price" }
  | { kind: "unexpected_price_unit" }
  | { kind: "negative_price" }
  | { kind: "suspicious_zero_price" };

// "Kg" was the only unit observed through Stage 7C's Kg-only crop
// batches. Stage 8A adds the other three raw unit tokens confirmed
// against real KAMIS exports during the Stage 8 catalogue audit (Head
// for livestock, Lt for milk, Tray(30) for eggs) -- anything else is
// still quarantined rather than silently accepted, per the explicit
// instruction to never treat an unrecognized unit as known. Adding a
// value here only makes a previously-quarantined unit acceptable; it
// can never change the outcome for a unit that was already accepted.
const ALLOWED_UNITS = new Set(["kg", "head", "lt", "tray(30)"]);

// Parses KAMIS's own "45.00/Kg" text format. "-" (with or without
// surrounding spaces, as KAMIS itself renders it) and a blank value
// both mean "no observation for this price_type" -- never zero, never
// an error.
export function parseKamisPrice(raw: string | null | undefined): PriceParseResult {
  const trimmed = (raw ?? "").trim();
  if (trimmed === "" || trimmed === "-") {
    return { kind: "none" };
  }

  const parts = trimmed.split("/");
  if (parts.length !== 2) {
    return { kind: "malformed_price" };
  }

  const [numberPart, unitPart] = parts;
  const numeric = Number(numberPart.trim());
  if (!Number.isFinite(numeric)) {
    return { kind: "malformed_price" };
  }

  if (!ALLOWED_UNITS.has(unitPart.trim().toLowerCase())) {
    return { kind: "unexpected_price_unit" };
  }

  if (numeric < 0) {
    return { kind: "negative_price" };
  }
  if (numeric === 0) {
    return { kind: "suspicious_zero_price" };
  }

  return { kind: "valid", value: numeric };
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// KAMIS supplies a date with no time-of-day at all. Converting it to
// midnight UTC -- always, deterministically, never the ingestion
// moment -- is what makes the existing (product_id, market_id,
// source_id, price_type, recorded_at) unique constraint actually catch
// a repeated import of the same KAMIS date as a duplicate, instead of
// each run producing a slightly different timestamp for "the same"
// observation.
export function toRecordedAtUtcMidnight(dateStr: string): string | null {
  if (!DATE_PATTERN.test(dateStr)) {
    return null;
  }
  const date = new Date(`${dateStr}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}
