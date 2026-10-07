import type { SupabaseClient } from "@supabase/supabase-js";

// Farmer-facing side of Trust & Safety reporting (Step 3). Reports go
// through the report_content() RPC (migration 20260929150000), which
// builds its own snapshot of the reported item from the database -- so
// the app only ever sends WHAT is reported (type + id), WHY (reason) and
// optional free-text details, never any copy of the content itself.

export type ReportTargetType = "profile" | "post" | "comment" | "listing" | "story" | "message";

// Same values, in the same order, as the reports.reason check constraint.
export const REPORT_REASONS = [
  { value: "spam", label: "Spam" },
  { value: "scam_or_fraud", label: "Scam or fraud" },
  { value: "harassment", label: "Harassment or bullying" },
  { value: "hate_speech", label: "Hate speech" },
  { value: "violence", label: "Violence or threats" },
  { value: "sexual_content", label: "Sexual content" },
  { value: "prohibited_item", label: "Prohibited or illegal item" },
  { value: "misinformation", label: "False or misleading information" },
  { value: "other", label: "Something else" },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]["value"];

// Matches the reports.details check constraint.
export const REPORT_DETAILS_MAX_LENGTH = 1000;

export const REPORT_TARGET_LABELS: Record<ReportTargetType, string> = {
  profile: "profile",
  post: "post",
  comment: "comment",
  listing: "listing",
  story: "story",
  message: "message",
};

export type ReportResult =
  | { kind: "submitted" }
  // Not a failure from the farmer's point of view: their earlier report
  // on this item is still open.
  | { kind: "already_reported" }
  | { kind: "error"; message: string };

// report_content() raises these exact messages (see the migration).
function errorMessageFor(rpcMessage: string): string {
  if (rpcMessage.includes("report_rate_limited")) {
    return "You've sent a lot of reports today. Please try again tomorrow.";
  }
  if (rpcMessage.includes("report_target_not_found")) {
    return "This is no longer available, so it can't be reported.";
  }
  if (rpcMessage.includes("cannot_report_own_content")) {
    return "You can't report your own content.";
  }
  if (rpcMessage.includes("not_signed_in")) {
    return "Please sign in again.";
  }
  return "We couldn't send your report. Please try again.";
}

export async function submitReport(
  supabase: SupabaseClient,
  report: { targetType: ReportTargetType; targetId: string; reason: ReportReason; details: string },
): Promise<ReportResult> {
  const details = report.details.trim().slice(0, REPORT_DETAILS_MAX_LENGTH);

  const { error } = await supabase.rpc("report_content", {
    p_target_type: report.targetType,
    p_target_id: report.targetId,
    p_reason: report.reason,
    p_details: details || null,
  });

  if (!error) return { kind: "submitted" };
  if (error.message.includes("report_already_open")) return { kind: "already_reported" };
  return { kind: "error", message: errorMessageFor(error.message) };
}
