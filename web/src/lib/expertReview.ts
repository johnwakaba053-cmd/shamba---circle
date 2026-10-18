import type { ApplicationStatus, DocumentKind, ExpertApplication } from "@/lib/experts";

// Admin side of Expert verification (Experts E3) on top of the E1
// database (20261007090000_add_experts_foundation.sql). Admins read the
// application tables directly (admin-only RLS policies) and change
// anything only through E1's review functions, each of which checks
// is_admin() and records an expert_review_events row.

// Same limit as the expert_review_events / expert_applications note
// check constraints.
export const MAX_REVIEW_NOTE_LENGTH = 1000;

export const QUEUE_PAGE_SIZE = 50;
export const MAX_QUEUE_LIMIT = 500;

// === rows ====================================================================

export type ExpertStatus = "active" | "suspended";

export type AdminApplication = ExpertApplication & {
  profile_id: string;
  consent_at: string | null;
  purge_after: string | null;
  documents_purged_at: string | null;
  updated_at: string;
};

export const ADMIN_APPLICATION_COLUMNS =
  "id, profile_id, status, professional_title, headline, bio, county_id, years_experience, languages, registration_body, registration_number, consent_at, submitted_at, decided_at, applicant_note, purge_after, documents_purged_at, created_at, updated_at";

export type QueueApplication = {
  id: string;
  profile_id: string;
  status: ApplicationStatus;
  professional_title: string | null;
  county_id: string | null;
  submitted_at: string | null;
  decided_at: string | null;
  updated_at: string;
};

export const QUEUE_APPLICATION_COLUMNS = "id, profile_id, status, professional_title, county_id, submitted_at, decided_at, updated_at";

export type QueueExpert = {
  profile_id: string;
  application_id: string;
  status: ExpertStatus;
  professional_title: string;
  county_id: string | null;
  verified_at: string;
  suspended_at: string | null;
};

export const QUEUE_EXPERT_COLUMNS = "profile_id, application_id, status, professional_title, county_id, verified_at, suspended_at";

export type ExpertRecord = {
  status: ExpertStatus;
  application_id: string;
  verified_at: string;
  suspended_at: string | null;
};

export const EXPERT_RECORD_COLUMNS = "status, application_id, verified_at, suspended_at";

export type ReviewAction =
  | "submitted"
  | "withdrawn"
  | "review_started"
  | "changes_requested"
  | "approved"
  | "rejected"
  | "suspended"
  | "reinstated";

export type ReviewEvent = {
  id: string;
  action: ReviewAction;
  actor_profile_id: string | null;
  applicant_note: string | null;
  internal_note: string | null;
  created_at: string;
};

export const REVIEW_EVENT_COLUMNS = "id, action, actor_profile_id, applicant_note, internal_note, created_at";

// === queue tabs ==============================================================

export type QueueTabId = "review" | "changes" | "approved" | "rejected" | "withdrawn" | "experts";

// Drafts are left out: the applicant hasn't sent them yet.
export const QUEUE_TABS: readonly { id: QueueTabId; label: string; statuses: readonly ApplicationStatus[] }[] = [
  { id: "review", label: "Needs review", statuses: ["submitted", "under_review"] },
  { id: "changes", label: "Changes requested", statuses: ["changes_requested"] },
  { id: "approved", label: "Approved", statuses: ["approved"] },
  { id: "rejected", label: "Rejected", statuses: ["rejected"] },
  { id: "withdrawn", label: "Withdrawn", statuses: ["withdrawn"] },
  { id: "experts", label: "Experts", statuses: [] },
];

export function isQueueTabId(value: string | null | undefined): value is QueueTabId {
  return QUEUE_TABS.some((tab) => tab.id === value);
}

// === labels ==================================================================

export type Tone = "neutral" | "blue" | "ochre" | "green" | "rust";

export const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-shamba-line/60 text-shamba-ink-soft",
  blue: "bg-shamba-blue/10 text-shamba-blue",
  ochre: "bg-shamba-ochre/15 text-shamba-ink",
  green: "bg-shamba-green/10 text-shamba-green-deep",
  rust: "bg-shamba-rust/10 text-shamba-rust",
};

export const APPLICATION_STATUS_META: Record<ApplicationStatus, { label: string; tone: Tone }> = {
  draft: { label: "Draft", tone: "neutral" },
  submitted: { label: "Submitted", tone: "blue" },
  under_review: { label: "Being reviewed", tone: "blue" },
  changes_requested: { label: "Changes requested", tone: "ochre" },
  approved: { label: "Approved", tone: "green" },
  rejected: { label: "Rejected", tone: "rust" },
  withdrawn: { label: "Withdrawn", tone: "neutral" },
};

export const EXPERT_STATUS_META: Record<ExpertStatus, { label: string; tone: Tone }> = {
  active: { label: "Active expert", tone: "green" },
  suspended: { label: "Suspended", tone: "rust" },
};

export const REVIEW_ACTION_LABELS: Record<ReviewAction, string> = {
  submitted: "Submitted",
  withdrawn: "Withdrawn",
  review_started: "Review started",
  changes_requested: "Changes requested",
  approved: "Approved",
  rejected: "Rejected",
  suspended: "Expert suspended",
  reinstated: "Expert reinstated",
};

// Actions the applicant takes themselves; every other event is an admin's.
export const APPLICANT_ACTIONS: readonly ReviewAction[] = ["submitted", "withdrawn"];

export const DOCUMENT_KIND_LABELS: Record<DocumentKind, string> = {
  cv: "CV",
  certificate: "Certificate",
  licence: "Licence",
  other: "Other document",
};

// A short, stable reference for an application, used instead of a
// private applicant's name: "A1B2C3D4".
export function shortApplicationId(id: string): string {
  return id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

// === what an admin can do ====================================================

export type AdminAction = "start_review" | "request_changes" | "approve" | "reject" | "suspend" | "reinstate";

// Mirrors the from-states each E1 function accepts. The database is still
// the real check; this only decides which buttons to show.
export function applicationActions(status: ApplicationStatus): AdminAction[] {
  switch (status) {
    case "submitted":
      return ["start_review", "request_changes", "approve", "reject"];
    case "under_review":
      return ["request_changes", "approve", "reject"];
    default:
      return [];
  }
}

export function expertActions(status: ExpertStatus | null): AdminAction[] {
  if (status === "active") return ["suspend"];
  if (status === "suspended") return ["reinstate"];
  return [];
}

// === errors ==================================================================

type DbError = { code?: string; message?: string };

// The fixed messages come from E1's admin functions.
export function reviewErrorMessage(error: DbError): string {
  switch (error.message) {
    case "not_authorized":
      return "Only admins can review expert applications. Sign in with an admin account.";
    case "cannot_review_own_expert_application":
      return "You can't review your own application. Another admin needs to do this.";
    case "expert_note_required":
      return "Write a message to the applicant before sending this.";
    case "invalid_expert_application_state":
      return "This application has changed since you opened it (another admin, or the applicant, may have acted). The page has been refreshed.";
    case "expert_application_not_found":
      return "This application no longer exists.";
    case "expert_suspended":
      return "This person's Verified Expert status is suspended. Reinstate them before approving a new application.";
    case "invalid_expert_state":
      return "This expert's status has changed since you opened the page. The page has been refreshed.";
    case "expert_not_found":
      return "There's no expert record for this person.";
  }
  if (error.code === "23514") {
    return `Notes can be up to ${MAX_REVIEW_NOTE_LENGTH} characters.`;
  }
  return "We couldn't save that. Check your connection and try again.";
}

// Errors that mean the page is showing an out-of-date state.
export function isStaleStateError(error: DbError): boolean {
  return error.message === "invalid_expert_application_state" || error.message === "invalid_expert_state";
}
