// Farm Records R1: shared types, labels and form helpers for farms and
// plots. The limits mirror the CHECK constraints in
// 20261001090000_add_farm_records_farms_and_plots.sql exactly -- keep the
// two in sync, so a bad value is caught here with a clear message rather
// than rejected by the database with a generic one.

export const MAX_FARM_NAME_LENGTH = 80;
export const MAX_PLOT_NAME_LENGTH = 80;
export const MAX_LOCATION_TEXT_LENGTH = 200;
export const MAX_SIZE_ACRES = 100000;

export const TENURE_OPTIONS = [
  { value: "owned", label: "Owned" },
  { value: "leased", label: "Leased / rented" },
  { value: "family", label: "Family land" },
  { value: "communal", label: "Communal" },
  { value: "other", label: "Other" },
] as const;

export type Tenure = (typeof TENURE_OPTIONS)[number]["value"];

export function isTenure(value: string): value is Tenure {
  return TENURE_OPTIONS.some((option) => option.value === value);
}

export function tenureLabel(tenure: Tenure): string {
  return TENURE_OPTIONS.find((option) => option.value === tenure)?.label ?? tenure;
}

export type Farm = {
  id: string;
  name: string;
  county_id: string;
  location_text: string | null;
  size_acres: number | null;
  tenure: Tenure | null;
  archived_at: string | null;
};

export type FarmPlot = {
  id: string;
  farm_id: string;
  name: string;
  size_acres: number | null;
  archived_at: string | null;
};

export const FARM_COLUMNS = "id, name, county_id, location_text, size_acres, tenure, archived_at";
export const PLOT_COLUMNS = "id, farm_id, name, size_acres, archived_at";

export type CountyOption = { id: string; name: string };

// Parses the optional acreage text field. Empty means "not given" (null);
// anything else must be a positive number no larger than the database
// limit, with at most two decimal places (numeric(10, 2)).
export function parseAcres(input: string): { ok: true; value: number | null } | { ok: false; message: string } {
  const trimmed = input.trim();
  if (trimmed === "") return { ok: true, value: null };

  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return { ok: false, message: "Enter the size in acres as a number, e.g. 2 or 0.5." };
  }

  const value = Number(trimmed);
  if (value <= 0) {
    return { ok: false, message: "Size must be more than 0 acres." };
  }
  if (value > MAX_SIZE_ACRES) {
    return { ok: false, message: `Size can't be more than ${MAX_SIZE_ACRES.toLocaleString("en-KE")} acres.` };
  }

  return { ok: true, value };
}

// Supabase returns numeric columns as numbers; show whole numbers without
// a trailing ".00" and everything else to at most two decimals.
export function formatAcres(sizeAcres: number): string {
  const formatted = Number(sizeAcres).toLocaleString("en-KE", { maximumFractionDigits: 2 });
  return `${formatted} ${Number(sizeAcres) === 1 ? "acre" : "acres"}`;
}
