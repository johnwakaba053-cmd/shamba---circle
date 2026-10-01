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
// limit, with at most two decimal places (numeric(10, 2)). `noun` names
// the field in messages ("Size" for farms and plots, "Area" for crops).
export function parseAcres(
  input: string,
  noun = "Size",
): { ok: true; value: number | null } | { ok: false; message: string } {
  const trimmed = input.trim();
  if (trimmed === "") return { ok: true, value: null };

  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return { ok: false, message: `Enter the ${noun.toLowerCase()} in acres as a number, e.g. 2 or 0.5.` };
  }

  const value = Number(trimmed);
  if (value <= 0) {
    return { ok: false, message: `${noun} must be more than 0 acres.` };
  }
  if (value > MAX_SIZE_ACRES) {
    return { ok: false, message: `${noun} can't be more than ${MAX_SIZE_ACRES.toLocaleString("en-KE")} acres.` };
  }

  return { ok: true, value };
}

// Supabase returns numeric columns as numbers; show whole numbers without
// a trailing ".00" and everything else to at most two decimals.
export function formatAcres(sizeAcres: number): string {
  const formatted = Number(sizeAcres).toLocaleString("en-KE", { maximumFractionDigits: 2 });
  return `${formatted} ${Number(sizeAcres) === 1 ? "acre" : "acres"}`;
}

// === R2: crop seasons and livestock groups ==================================
//
// Limits mirror the CHECK constraints in
// 20261001110000_add_farm_records_crop_seasons_and_livestock_groups.sql.

export const MAX_CROP_LABEL_LENGTH = 80;
export const MAX_LIVESTOCK_NAME_LENGTH = 80;
export const MAX_HEAD_COUNT = 1000000;
export const MIN_RECORD_DATE = "1900-01-01";
export const MAX_RECORD_DATE = "2100-12-31";

export type TypeOption = { id: string; name: string };

export type CropSeason = {
  id: string;
  farm_id: string;
  plot_id: string | null;
  crop_type_id: string;
  label: string | null;
  started_on: string;
  ended_on: string | null;
  area_acres: number | null;
  archived_at: string | null;
};

export type LivestockGroup = {
  id: string;
  farm_id: string;
  plot_id: string | null;
  livestock_type_id: string;
  name: string;
  head_count: number | null;
  started_on: string | null;
  archived_at: string | null;
};

export const CROP_SEASON_COLUMNS =
  "id, farm_id, plot_id, crop_type_id, label, started_on, ended_on, area_acres, archived_at";
export const LIVESTOCK_GROUP_COLUMNS =
  "id, farm_id, plot_id, livestock_type_id, name, head_count, started_on, archived_at";

// Today's date (YYYY-MM-DD) in Kenya, whatever the device's time zone.
export function todayInKenya(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });
}

// Validates a YYYY-MM-DD value from a date input. Empty is "not given"
// (null) unless the field is required.
export function parseRecordDate(
  input: string,
  { required, field }: { required: boolean; field: string },
): { ok: true; value: string | null } | { ok: false; message: string } {
  const value = input.trim();
  if (value === "") {
    return required ? { ok: false, message: `Choose the ${field}.` } : { ok: true, value: null };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    return { ok: false, message: `Enter a real ${field}.` };
  }
  if (value < MIN_RECORD_DATE || value > MAX_RECORD_DATE) {
    return { ok: false, message: `Check the year of the ${field}.` };
  }
  return { ok: true, value };
}

// "15 Mar 2026". Date-only values are formatted in UTC so they never
// shift a day in either direction.
export function formatRecordDate(value: string): string {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

// Optional whole number of animals (or birds, or hives). Empty is null.
export function parseHeadCount(input: string): { ok: true; value: number | null } | { ok: false; message: string } {
  const trimmed = input.trim();
  if (trimmed === "") return { ok: true, value: null };
  if (!/^\d+$/.test(trimmed)) {
    return { ok: false, message: "Enter the number as a whole number, e.g. 12." };
  }
  const value = Number(trimmed);
  if (value > MAX_HEAD_COUNT) {
    return { ok: false, message: `The number can't be more than ${MAX_HEAD_COUNT.toLocaleString("en-KE")}.` };
  }
  return { ok: true, value };
}

// What the head count counts, in plain words, by livestock type.
export function headCountNoun(livestockTypeId: string, count: number): string {
  const one = count === 1;
  if (livestockTypeId === "bees") return one ? "hive" : "hives";
  if (livestockTypeId === "poultry") return one ? "bird" : "birds";
  return one ? "animal" : "animals";
}

// Turns a Supabase error from a crop season / livestock group write into a
// sentence a farmer can act on. 'farm_archived' / 'plot_archived' come
// from check_farm_record_parents_active (SQLSTATE P0001); 23503 is a
// farm, plot or type that doesn't exist (or isn't the caller's).
export function farmRecordErrorMessage(error: { code?: string; message?: string }, fallback: string): string {
  if (error.code === "P0001" && error.message === "farm_archived") {
    return "This farm is archived. Restore the farm first.";
  }
  if (error.code === "P0001" && error.message === "plot_archived") {
    return "That plot is archived. Choose another plot or the whole farm, or restore the plot first.";
  }
  if (error.code === "23503") {
    return "We couldn't find that farm, plot or type any more. Refresh the page and try again.";
  }
  if (error.code === "23514") {
    return "Some details aren't valid. Check the dates and numbers and try again.";
  }
  return fallback;
}

// === Display states (derived, never stored) =================================
//
// A crop season's state comes only from its dates, its archive stamp and
// today's date in Kenya (YYYY-MM-DD strings compare correctly as text).
// There is no status column and no daily job: the state moves from
// Planned to Growing to Ended on its own as the dates pass.
//   Archived  archived_at is set (wins over everything else)
//   Ended     ended_on <= today
//   Planned   started_on > today
//   Growing   started_on <= today and (ended_on is empty or ended_on > today)
// A future end date is an expected end, not an ended season. Ended and
// Planned can't both hold, since ended_on >= started_on.
export type CropSeasonState = "planned" | "growing" | "ended" | "archived";

export function cropSeasonState(
  season: Pick<CropSeason, "started_on" | "ended_on" | "archived_at">,
  today: string,
): CropSeasonState {
  if (season.archived_at !== null) return "archived";
  if (season.ended_on !== null && season.ended_on <= today) return "ended";
  if (season.started_on > today) return "planned";
  return "growing";
}

// The date line for a crop season, worded for where it is in its life:
// "Starts 15 Nov 2026", "Started 15 Mar 2026 · until 30 Aug 2026",
// "15 Mar 2026 – 1 Aug 2026".
export function cropSeasonDates(
  season: Pick<CropSeason, "started_on" | "ended_on">,
  today: string,
): string {
  const start = formatRecordDate(season.started_on);
  if (season.ended_on !== null && season.ended_on <= today) {
    return `${start} – ${formatRecordDate(season.ended_on)}`;
  }
  const until = season.ended_on !== null ? ` · until ${formatRecordDate(season.ended_on)}` : "";
  return `${season.started_on > today ? "Starts" : "Started"} ${start}${until}`;
}

// "Starting 1 Dec 2026" for a group that hasn't started yet, otherwise
// "Since 1 Jun 2025". Display only -- livestock has no stored status.
export function livestockStartLabel(startedOn: string, today: string): string {
  return `${startedOn > today ? "Starting" : "Since"} ${formatRecordDate(startedOn)}`;
}
