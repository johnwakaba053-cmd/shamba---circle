// Farm Records FR-1b: crop season activities (the farm_records table from
// supabase/migrations/20261021055110_add_farm_activity_log.sql). The limits
// mirror that migration's CHECK constraints -- keep the two in sync, so a
// bad value is caught here with a clear message rather than rejected by
// the database with a generic one.
//
// Records are append-only: an activity is never edited in place. A
// mistake is fixed by correcting it (correct_farm_record: the old record
// is voided with a reason and a linked replacement is added, in one
// transaction) or removed by voiding it (void_farm_record). Both stay in
// the history.

import { farmRecordErrorMessage } from "@/lib/farmRecords";

export const MAX_ACTIVITY_DESCRIPTION_LENGTH = 200;
export const MAX_INPUT_PRODUCT_NAME_LENGTH = 120;
export const MAX_ACTIVITY_NOTES_LENGTH = 2000;
export const MAX_VOID_REASON_LENGTH = 300;
export const MAX_ACTIVITY_QUANTITY = 1000000;
export const MAX_LABOUR_WORKERS = 10000;
export const MAX_LABOUR_HOURS = 100000;
export const MAX_COST_KES = 1000000000;

export type FarmActivity = {
  id: string;
  kind_id: string;
  occurred_on: string;
  description: string | null;
  input_category_id: string | null;
  input_product_name: string | null;
  input_quantity: number | null;
  input_unit_id: string | null;
  quantity: number | null;
  quantity_unit_id: string | null;
  labour_workers: number | null;
  labour_hours: number | null;
  cost_kes: number | null;
  notes: string | null;
  created_at: string;
  supersedes_id: string | null;
  voided_at: string | null;
  void_reason: string | null;
};

export const FARM_ACTIVITY_COLUMNS =
  "id, kind_id, occurred_on, description, input_category_id, input_product_name, input_quantity, input_unit_id, quantity, quantity_unit_id, labour_workers, labour_hours, cost_kes, notes, created_at, supersedes_id, voided_at, void_reason";

// farm_record_kinds: input_mode says whether the activity takes an input
// (none), may have one (optional) or usually has one (expected -- prompted,
// never forced).
export type ActivityKind = { id: string; name: string; input_mode: "none" | "optional" | "expected" };
export type InputCategory = { id: string; name: string };
export type MeasurementUnit = { id: string; name: string; dimension: string };

// Kinds that can be recorded against a crop season (the database checks
// this again: record_kind_subject_mismatch).
export const CROP_ACTIVITY_SUBJECT_MODES = ["crop", "farm_or_crop", "any"];

// The table isn't in the database yet (the migration hasn't been
// applied): PostgREST says PGRST205, PostgreSQL 42P01. Pages hide or 404
// crop activities in that case rather than show a broken form.
export function isMissingTableError(error: { code?: string } | null): boolean {
  return error?.code === "PGRST205" || error?.code === "42P01";
}

// Current records oldest first (by date, then by when they were saved);
// corrected and removed ones separately, newest change first.
export function splitActivities(activities: FarmActivity[]): { current: FarmActivity[]; history: FarmActivity[] } {
  const byDate = (a: FarmActivity, b: FarmActivity) =>
    a.occurred_on.localeCompare(b.occurred_on) || a.created_at.localeCompare(b.created_at);
  return {
    current: activities.filter((activity) => activity.voided_at === null).sort(byDate),
    history: activities
      .filter((activity) => activity.voided_at !== null)
      .sort((a, b) => (b.voided_at ?? "").localeCompare(a.voided_at ?? "")),
  };
}

type Parsed = { ok: true; value: number | null } | { ok: false; message: string };

// An optional positive decimal with at most `decimals` places, no more
// than `max`. Empty is "not given" (null). `allowZero` is for cost.
export function parseAmount(
  input: string,
  { field, max, decimals, allowZero = false }: { field: string; max: number; decimals: number; allowZero?: boolean },
): Parsed {
  const trimmed = input.trim().replace(/,/g, "");
  if (trimmed === "") return { ok: true, value: null };
  const pattern = decimals === 0 ? /^\d+$/ : new RegExp(`^\\d+(\\.\\d{1,${decimals}})?$`);
  if (!pattern.test(trimmed)) {
    return {
      ok: false,
      message:
        decimals === 0
          ? `Enter the ${field} as a whole number, e.g. 3.`
          : `Enter the ${field} as a number with at most ${decimals} decimal places.`,
    };
  }
  const value = Number(trimmed);
  if (value === 0 && !allowZero) return { ok: false, message: `The ${field} must be more than 0.` };
  if (value > max) return { ok: false, message: `The ${field} can't be more than ${max.toLocaleString("en-KE")}.` };
  return { ok: true, value };
}

export function formatNumber(value: number): string {
  return Number(value).toLocaleString("en-KE", { maximumFractionDigits: 3 });
}

export function formatKes(value: number): string {
  return `KES ${Number(value).toLocaleString("en-KE", { maximumFractionDigits: 2 })}`;
}

// "12 × 90 kg bag" for units named by a size, otherwise "2.5 Litres".
export function formatQuantity(value: number, unitId: string | null, units: MeasurementUnit[]): string {
  const name = units.find((unit) => unit.id === unitId)?.name ?? unitId ?? "";
  return /^\d/.test(name) ? `${formatNumber(value)} × ${name}` : `${formatNumber(value)} ${name}`;
}

// "3 workers · 4.5 hours", "2 workers", "6 hours".
export function formatLabour(workers: number | null, hours: number | null): string | null {
  const parts = [
    workers !== null ? `${workers} ${workers === 1 ? "worker" : "workers"}` : null,
    hours !== null ? `${formatNumber(hours)} ${Number(hours) === 1 ? "hour" : "hours"}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

// Messages for the activity log's own errors (raised by its triggers and
// functions with these fixed texts); anything else falls back to the
// shared Farm Records messages.
export function activityErrorMessage(error: { code?: string; message?: string }, fallback: string): string {
  switch (error.message) {
    case "farm_record_in_future":
      return "The date can't be after today.";
    case "record_kind_inactive":
      return "That activity type can't be used any more. Choose another one.";
    case "record_kind_subject_mismatch":
      return "That activity type can't be recorded on a crop. Choose another one.";
    case "record_kind_no_input":
      return "This activity type doesn't take an input. Clear the input fields.";
    case "input_category_inactive":
      return "That input type can't be used any more. Choose another one.";
    case "measurement_unit_inactive":
      return "That unit can't be used any more. Choose another one.";
    case "crop_season_archived":
      return "This crop is archived. Restore it before adding activities.";
    case "farm_record_already_voided":
      return "This activity was already corrected or removed. Refresh the page to see the latest.";
    case "farm_record_not_found":
      return "We couldn't find that activity any more. Refresh the page and try again.";
    case "void_reason_required":
      return "Say why you're changing or removing this activity.";
    case "void_reason_too_long":
      return `Keep the reason to ${MAX_VOID_REASON_LENGTH} characters or fewer.`;
    case "not_signed_in":
      return "Please sign in again.";
  }
  return farmRecordErrorMessage(error, fallback);
}
