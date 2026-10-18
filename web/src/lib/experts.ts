import type { SupabaseClient } from "@supabase/supabase-js";
import { randomId } from "@/lib/randomId";

// Expert registration (Experts E2) on top of the E1 database
// (20261007090000_add_experts_foundation.sql). Limits below mirror that
// migration's check constraints and triggers exactly; the database stays
// the real boundary -- these only give fast, friendly feedback.

export const MAX_TITLE_LENGTH = 80;
export const MAX_HEADLINE_LENGTH = 140;
export const MAX_BIO_LENGTH = 1500;
export const MAX_YEARS_EXPERIENCE = 70;
export const MAX_LANGUAGES = 8;
export const MAX_LANGUAGE_LENGTH = 40;
export const MAX_REGISTRATION_BODY_LENGTH = 150;
export const MAX_REGISTRATION_NUMBER_LENGTH = 100;
export const MAX_SPECIALTIES = 3;
export const MAX_EDUCATION = 10;
export const MAX_QUALIFICATIONS = 15;
export const MAX_EXPERIENCE = 15;
export const MAX_NAME_LENGTH = 150; // institution, field, organisation, role, title, issuing body
export const MAX_CREDENTIAL_NUMBER_LENGTH = 100;
export const MAX_DESCRIPTION_LENGTH = 1000;
export const MAX_FILE_NAME_LENGTH = 200;
export const MIN_YEAR = 1950;
export const MAX_YEAR = 2100;
export const MAX_FILE_BYTES = 10 * 1024 * 1024; // the bucket's file_size_limit

export const EXPERT_DOCUMENTS_BUCKET = "expert-documents";
const SIGNED_URL_EXPIRY_SECONDS = 60;

// === steps ===================================================================

export const EXPERT_STEPS = [
  { id: "about", title: "About you" },
  { id: "specialties", title: "Specialties" },
  { id: "education", title: "Education" },
  { id: "qualifications", title: "Qualifications and certificates" },
  { id: "experience", title: "Work experience" },
  { id: "cv", title: "Your CV" },
  { id: "languages", title: "Languages and registration" },
  { id: "review", title: "Review and submit" },
] as const;

export type ExpertStepId = (typeof EXPERT_STEPS)[number]["id"];

export function isExpertStepId(value: string | null | undefined): value is ExpertStepId {
  return EXPERT_STEPS.some((step) => step.id === value);
}

export function stepIndex(step: ExpertStepId): number {
  return EXPERT_STEPS.findIndex((item) => item.id === step);
}

// === rows ====================================================================

export type ApplicationStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "changes_requested"
  | "approved"
  | "rejected"
  | "withdrawn";

export const EDITABLE_STATUSES: readonly ApplicationStatus[] = ["draft", "changes_requested"];

export type ExpertApplication = {
  id: string;
  status: ApplicationStatus;
  professional_title: string | null;
  headline: string | null;
  bio: string | null;
  county_id: string | null;
  years_experience: number | null;
  languages: string[] | null;
  registration_body: string | null;
  registration_number: string | null;
  submitted_at: string | null;
  decided_at: string | null;
  applicant_note: string | null;
  created_at: string;
};

export const APPLICATION_COLUMNS =
  "id, status, professional_title, headline, bio, county_id, years_experience, languages, registration_body, registration_number, submitted_at, decided_at, applicant_note, created_at";

export type EducationLevel = "certificate" | "diploma" | "bachelors" | "masters" | "doctorate" | "other";

export const EDUCATION_LEVELS: readonly { value: EducationLevel; label: string }[] = [
  { value: "certificate", label: "Certificate" },
  { value: "diploma", label: "Diploma" },
  { value: "bachelors", label: "Bachelor's degree" },
  { value: "masters", label: "Master's degree" },
  { value: "doctorate", label: "Doctorate (PhD)" },
  { value: "other", label: "Other" },
];

export function educationLevelLabel(level: string): string {
  return EDUCATION_LEVELS.find((option) => option.value === level)?.label ?? level;
}

export type EducationEntry = {
  id: string;
  institution: string;
  level: EducationLevel;
  field_of_study: string;
  start_year: number | null;
  end_year: number | null;
  sort_order: number;
};

export const EDUCATION_COLUMNS = "id, institution, level, field_of_study, start_year, end_year, sort_order";

export type ExperienceEntry = {
  id: string;
  organisation: string;
  role_title: string;
  start_date: string;
  end_date: string | null;
  description: string | null;
};

export const EXPERIENCE_COLUMNS = "id, organisation, role_title, start_date, end_date, description";

export type QualificationEntry = {
  id: string;
  title: string;
  issuing_body: string;
  credential_number: string | null;
  issued_on: string | null;
  expires_on: string | null;
  document_id: string | null;
};

export const QUALIFICATION_COLUMNS = "id, title, issuing_body, credential_number, issued_on, expires_on, document_id";

export type DocumentKind = "cv" | "certificate" | "licence" | "other";

export type ExpertDocument = {
  id: string;
  kind: DocumentKind;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
};

export const DOCUMENT_COLUMNS = "id, kind, storage_path, file_name, mime_type, size_bytes";

export type SpecialtyOption = { id: string; name: string };
export type CountyOption = { id: string; name: string };

export type ApplicationParts = {
  application: ExpertApplication | null;
  specialtyIds: string[];
  education: EducationEntry[];
  qualifications: QualificationEntry[];
  experience: ExperienceEntry[];
  documents: ExpertDocument[];
};

// Suggestions only -- farmers can add any language.
export const LANGUAGE_SUGGESTIONS = [
  "English",
  "Kiswahili",
  "Kikuyu",
  "Dholuo",
  "Luhya",
  "Kalenjin",
  "Kamba",
  "Kisii",
  "Meru",
  "Maasai",
  "Somali",
];

// === completeness ============================================================

// What submit_expert_application() requires, by step, so the review step
// can point at exactly what's missing before the farmer submits.
export type MissingPart = { step: ExpertStepId; label: string };

export function missingParts(parts: ApplicationParts): MissingPart[] {
  const missing: MissingPart[] = [];
  const app = parts.application;

  if (!app?.professional_title) missing.push({ step: "about", label: "Your professional title" });
  if (!app?.headline) missing.push({ step: "about", label: "A one-line headline" });
  if (!app?.bio) missing.push({ step: "about", label: "A short bio" });
  if (!app?.county_id) missing.push({ step: "about", label: "Your county" });
  if (app?.years_experience == null) missing.push({ step: "about", label: "Years of experience" });
  if (parts.specialtyIds.length === 0) missing.push({ step: "specialties", label: "At least one specialty" });
  if (parts.education.length === 0) missing.push({ step: "education", label: "At least one education entry" });
  if (parts.experience.length === 0) missing.push({ step: "experience", label: "At least one work experience entry" });
  if (!parts.documents.some((document) => document.kind === "cv")) missing.push({ step: "cv", label: "Your CV (PDF)" });

  return missing;
}

// Where to resume a draft: the first step with something still missing,
// otherwise the review step.
export function resumeStep(parts: ApplicationParts): ExpertStepId {
  return missingParts(parts)[0]?.step ?? "review";
}

// submit_expert_application() lists what's missing in the error DETAIL
// (comma-separated). Maps those keys back to steps.
const INCOMPLETE_KEY_STEPS: Record<string, MissingPart> = {
  professional_title: { step: "about", label: "Your professional title" },
  headline: { step: "about", label: "A one-line headline" },
  bio: { step: "about", label: "A short bio" },
  county: { step: "about", label: "Your county" },
  years_experience: { step: "about", label: "Years of experience" },
  specialties: { step: "specialties", label: "At least one specialty" },
  education: { step: "education", label: "At least one education entry" },
  experience: { step: "experience", label: "At least one work experience entry" },
  cv: { step: "cv", label: "Your CV (PDF)" },
};

export function missingPartsFromDetail(detail: string | null | undefined): MissingPart[] {
  return (detail ?? "")
    .split(",")
    .map((key) => INCOMPLETE_KEY_STEPS[key.trim()])
    .filter((part): part is MissingPart => Boolean(part));
}

// === errors ==================================================================

type DbError = { code?: string; message?: string; details?: string | null };

// Turns a Supabase error from an expert-application write into a sentence
// a farmer can act on. The fixed messages come from the E1 triggers and
// functions; 42501 is a row-level security refusal, which here almost
// always means the application was submitted (and locked) elsewhere.
export function expertErrorMessage(error: DbError, fallback: string): string {
  switch (error.message) {
    case "expert_limit_reached":
      return "You've reached the limit for this section. Remove an entry to add another.";
    case "expert_suspended":
      return "Your Verified Expert status is suspended, so you can't apply right now.";
    case "expert_application_cooldown":
      return "You can apply again 30 days after your last application was declined.";
    case "expert_cv_must_be_pdf":
      return "Your CV must be a PDF file.";
    case "expert_document_not_uploaded":
    case "expert_document_path_invalid":
      return "Your file didn't finish uploading. Please try again.";
    case "expert_consent_required":
      return "Please tick the box to agree before you submit.";
    case "invalid_expert_application_state":
      return "This application can't be changed right now. Refresh the page to see its status.";
    case "expert_application_not_found":
      return "We couldn't find your application. Refresh the page and try again.";
    case "not_signed_in":
      return "Please sign in again.";
  }
  if (error.code === "23505") {
    return "You already have an application in progress. Refresh the page to continue it.";
  }
  if (error.code === "42501") {
    return "This application can't be changed right now. Refresh the page to see its status.";
  }
  if (error.code === "23514") {
    return "Some details aren't valid. Check the dates, numbers and lengths and try again.";
  }
  if (error.code === "23503") {
    return "Something you chose no longer exists. Refresh the page and try again.";
  }
  return fallback;
}

// === files ===================================================================

const PDF = "application/pdf";
const IMAGE_TYPES = new Set(["image/jpeg", "image/png"]);

// Returns a farmer-facing problem with the chosen file, or null if it can
// be uploaded. The bucket enforces the same type and size rules.
export function fileProblem(file: File, kind: DocumentKind): string | null {
  if (kind === "cv") {
    if (file.type !== PDF) return "Your CV must be a PDF file.";
  } else if (file.type !== PDF && !IMAGE_TYPES.has(file.type)) {
    return "Choose a PDF, JPEG or PNG file.";
  }
  if (file.size === 0) return "That file is empty. Choose another one.";
  if (file.size > MAX_FILE_BYTES) return "That file is too large. Choose one under 10 MB.";
  return null;
}

function extensionFor(mimeType: string): string {
  if (mimeType === PDF) return "pdf";
  if (mimeType === "image/png") return "png";
  return "jpg";
}

function storageErrorMessage(error: { message?: string }): string {
  const message = (error.message ?? "").toLowerCase();
  if (message.includes("size") || message.includes("too large")) {
    return "That file is too large. Choose one under 10 MB.";
  }
  if (message.includes("mime") || message.includes("type")) {
    return "That type of file isn't accepted. Choose a PDF, JPEG or PNG file.";
  }
  if (message.includes("row-level security") || message.includes("unauthorized")) {
    return "This application can't be changed right now. Refresh the page to see its status.";
  }
  return "We couldn't upload your file. Check your connection and try again.";
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export type UploadResult = { ok: true; document: ExpertDocument } | { ok: false; message: string };

// Uploads a file into the application's private folder
// ({profile_id}/{application_id}/{random}.{ext}), then registers it. If
// registering fails, the uploaded file is removed again so nothing is
// left behind.
export async function uploadExpertDocument(
  supabase: SupabaseClient,
  {
    profileId,
    applicationId,
    kind,
    file,
  }: { profileId: string; applicationId: string; kind: DocumentKind; file: File },
): Promise<UploadResult> {
  const problem = fileProblem(file, kind);
  if (problem) return { ok: false, message: problem };

  const path = `${profileId}/${applicationId}/${randomId()}.${extensionFor(file.type)}`;

  const { error: uploadError } = await supabase.storage
    .from(EXPERT_DOCUMENTS_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (uploadError) return { ok: false, message: storageErrorMessage(uploadError) };

  const { data, error } = await supabase
    .from("expert_documents")
    .insert({
      application_id: applicationId,
      profile_id: profileId,
      kind,
      storage_path: path,
      file_name: file.name.slice(0, MAX_FILE_NAME_LENGTH) || "document",
    })
    .select(DOCUMENT_COLUMNS)
    .single();

  if (error || !data) {
    await supabase.storage.from(EXPERT_DOCUMENTS_BUCKET).remove([path]);
    return {
      ok: false,
      message: error ? expertErrorMessage(error, "We couldn't save your file. Please try again.") : "We couldn't save your file. Please try again.",
    };
  }

  return { ok: true, document: data as ExpertDocument };
}

// Removes the record first (that's what the application reads), then the
// file. A file left behind by a failed second step is harmless: it is
// private and is cleared with the application's folder later.
export async function removeExpertDocument(
  supabase: SupabaseClient,
  document: ExpertDocument,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.from("expert_documents").delete().eq("id", document.id);
  if (error) {
    return { ok: false, message: expertErrorMessage(error, "We couldn't remove that file. Please try again.") };
  }
  await supabase.storage.from(EXPERT_DOCUMENTS_BUCKET).remove([document.storage_path]);
  return { ok: true };
}

// Opens one of the applicant's own files through a short-lived signed
// URL. The tab is opened before the request so mobile browsers don't
// treat it as an unrequested pop-up.
export async function openExpertDocument(supabase: SupabaseClient, document: ExpertDocument): Promise<boolean> {
  const tab = window.open("", "_blank");
  const { data, error } = await supabase.storage
    .from(EXPERT_DOCUMENTS_BUCKET)
    .createSignedUrl(document.storage_path, SIGNED_URL_EXPIRY_SECONDS);

  if (error || !data?.signedUrl) {
    tab?.close();
    return false;
  }
  if (tab) {
    tab.location.href = data.signedUrl;
  } else {
    window.location.assign(data.signedUrl);
  }
  return true;
}

// === dates ===================================================================

const MONTH_FORMAT = new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
const DAY_FORMAT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Nairobi" });

// "2014-03-01" -> "Mar 2014".
export function formatMonth(date: string): string {
  return MONTH_FORMAT.format(new Date(`${date.slice(0, 10)}T00:00:00Z`));
}

// A timestamp -> "8 Oct 2026" in Kenya time.
export function formatDay(timestamp: string): string {
  return DAY_FORMAT.format(new Date(timestamp));
}

// <input type="month"> works in "YYYY-MM"; the database stores dates.
export function monthToDate(month: string): string | null {
  return /^\d{4}-\d{2}$/.test(month) ? `${month}-01` : null;
}

export function dateToMonth(date: string | null): string {
  return date ? date.slice(0, 7) : "";
}
