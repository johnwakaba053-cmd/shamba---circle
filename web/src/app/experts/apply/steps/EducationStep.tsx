"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  EDUCATION_COLUMNS,
  EDUCATION_LEVELS,
  MAX_EDUCATION,
  MAX_NAME_LENGTH,
  MAX_YEAR,
  MIN_YEAR,
  educationLevelLabel,
  expertErrorMessage,
  type EducationEntry,
  type EducationLevel,
} from "@/lib/experts";
import {
  EntryFormActions,
  EntryRow,
  ErrorText,
  Field,
  INPUT_CLASS,
  StepActions,
  parseWholeNumber,
  type Status,
  type StepProps,
} from "../formParts";

// Step 3: education, added and edited one entry at a time. Each entry is
// saved as soon as it's added, so there is nothing else to save here.
export function EducationStep({ profileId, parts, setParts, goTo }: StepProps) {
  const app = parts.application!;
  const [editing, setEditing] = useState<string | "new" | null>(parts.education.length === 0 ? "new" : null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function remove(entry: EducationEntry) {
    if (removingId) return;
    setRemovingId(entry.id);
    setStatus({ kind: "idle" });
    try {
      const { data, error } = await createClient().from("expert_education").delete().eq("id", entry.id).select("id");
      if (error || !data?.length) {
        setStatus({
          kind: "error",
          message: error
            ? expertErrorMessage(error, "We couldn't remove that entry. Please try again.")
            : "This application can't be changed right now. Refresh the page to see its status.",
        });
        return;
      }
      setParts((current) => ({ ...current, education: current.education.filter((item) => item.id !== entry.id) }));
    } catch {
      setStatus({ kind: "error", message: "Something went wrong. Check your connection and try again." });
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-base leading-6 text-shamba-ink-soft">
        Add your certificates, diplomas and degrees, starting with the most relevant.
      </p>

      {parts.education.length > 0 && (
        <ul className="flex flex-col divide-y divide-shamba-line border-y border-shamba-line">
          {parts.education.map((entry) =>
            editing === entry.id ? (
              <li key={entry.id} className="py-3">
                <EducationForm
                  applicationId={app.id}
                  profileId={profileId}
                  entry={entry}
                  nextSortOrder={entry.sort_order}
                  onSaved={(saved) => {
                    setParts((current) => ({
                      ...current,
                      education: current.education.map((item) => (item.id === saved.id ? saved : item)),
                    }));
                    setEditing(null);
                  }}
                  onCancel={() => setEditing(null)}
                />
              </li>
            ) : (
              <EntryRow
                key={entry.id}
                title={`${educationLevelLabel(entry.level)} · ${entry.field_of_study}`}
                lines={[entry.institution, yearRange(entry)]}
                onEdit={() => setEditing(entry.id)}
                onRemove={() => remove(entry)}
                removing={removingId === entry.id}
                disabled={editing !== null || removingId !== null}
              />
            ),
          )}
        </ul>
      )}

      {editing === "new" ? (
        <div className="rounded-shamba border border-shamba-line bg-shamba-bg/40 p-4">
          <EducationForm
            applicationId={app.id}
            profileId={profileId}
            nextSortOrder={parts.education.length}
            onSaved={(saved) => {
              setParts((current) => ({ ...current, education: [...current.education, saved] }));
              setEditing(null);
            }}
            onCancel={parts.education.length > 0 ? () => setEditing(null) : undefined}
          />
        </div>
      ) : (
        editing === null &&
        parts.education.length < MAX_EDUCATION && (
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="inline-flex min-h-11 items-center gap-1.5 self-start font-sans text-sm font-semibold text-shamba-green hover:underline"
          >
            <Plus className="size-4" aria-hidden="true" />
            Add education
          </button>
        )
      )}

      <ErrorText status={status} />

      {editing !== null && parts.education.length > 0 && (
        <p className="text-xs leading-4 text-shamba-ink-soft">Save or cancel the entry you&apos;re editing to continue.</p>
      )}

      <StepActions
        onBack={() => goTo("specialties")}
        primaryLabel={parts.education.length === 0 ? "Skip for now" : "Continue"}
        primaryType="button"
        onPrimary={() => goTo("qualifications")}
        disabled={editing !== null && parts.education.length > 0}
      />
    </div>
  );
}

function yearRange(entry: EducationEntry): string {
  if (entry.start_year && entry.end_year) return `${entry.start_year}–${entry.end_year}`;
  if (entry.end_year) return `Completed ${entry.end_year}`;
  if (entry.start_year) return `${entry.start_year}–still studying`;
  return "Still studying";
}

function EducationForm({
  applicationId,
  profileId,
  entry,
  nextSortOrder,
  onSaved,
  onCancel,
}: {
  applicationId: string;
  profileId: string;
  entry?: EducationEntry;
  nextSortOrder: number;
  onSaved: (entry: EducationEntry) => void;
  onCancel?: () => void;
}) {
  const [institution, setInstitution] = useState(entry?.institution ?? "");
  const [level, setLevel] = useState<EducationLevel | "">(entry?.level ?? "");
  const [field, setField] = useState(entry?.field_of_study ?? "");
  const [startYear, setStartYear] = useState(entry?.start_year != null ? String(entry.start_year) : "");
  const [endYear, setEndYear] = useState(entry?.end_year != null ? String(entry.end_year) : "");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const isLoading = status.kind === "loading";
  const idPrefix = entry ? `education-${entry.id}` : "education-new";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isLoading) return;

    if (!institution.trim()) return setStatus({ kind: "error", message: "Enter the school, college or university." });
    if (!level) return setStatus({ kind: "error", message: "Choose the level of this qualification." });
    if (!field.trim()) return setStatus({ kind: "error", message: "Enter what you studied." });
    const start = parseWholeNumber(startYear, MIN_YEAR, MAX_YEAR, "Start year");
    if (!start.ok) return setStatus({ kind: "error", message: start.message });
    const end = parseWholeNumber(endYear, MIN_YEAR, MAX_YEAR, "Year completed");
    if (!end.ok) return setStatus({ kind: "error", message: end.message });
    if (start.value !== null && end.value !== null && end.value < start.value) {
      return setStatus({ kind: "error", message: "The year completed can't be before the start year." });
    }

    const fields = {
      institution: institution.trim(),
      level,
      field_of_study: field.trim(),
      start_year: start.value,
      end_year: end.value,
    };

    setStatus({ kind: "loading" });
    try {
      const supabase = createClient();
      const { data, error } = entry
        ? await supabase.from("expert_education").update(fields).eq("id", entry.id).select(EDUCATION_COLUMNS).maybeSingle()
        : await supabase
            .from("expert_education")
            .insert({ application_id: applicationId, profile_id: profileId, sort_order: nextSortOrder, ...fields })
            .select(EDUCATION_COLUMNS)
            .single();

      if (error || !data) {
        setStatus({
          kind: "error",
          message: error
            ? expertErrorMessage(error, "We couldn't save this entry. Please try again.")
            : "This application can't be changed right now. Refresh the page to see its status.",
        });
        return;
      }
      onSaved(data as EducationEntry);
    } catch {
      setStatus({ kind: "error", message: "Something went wrong. Check your connection and try again." });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field id={`${idPrefix}-institution`} label="School, college or university">
        <input
          id={`${idPrefix}-institution`}
          type="text"
          value={institution}
          onChange={(event) => setInstitution(event.target.value)}
          maxLength={MAX_NAME_LENGTH}
          placeholder="e.g. Egerton University"
          disabled={isLoading}
          className={INPUT_CLASS}
        />
      </Field>
      <Field id={`${idPrefix}-level`} label="Level">
        <select
          id={`${idPrefix}-level`}
          value={level}
          onChange={(event) => setLevel(event.target.value as EducationLevel | "")}
          disabled={isLoading}
          className={INPUT_CLASS}
        >
          <option value="">Select level</option>
          {EDUCATION_LEVELS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </Field>
      <Field id={`${idPrefix}-field`} label="What you studied">
        <input
          id={`${idPrefix}-field`}
          type="text"
          value={field}
          onChange={(event) => setField(event.target.value)}
          maxLength={MAX_NAME_LENGTH}
          placeholder="e.g. Animal Health and Production"
          disabled={isLoading}
          className={INPUT_CLASS}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field id={`${idPrefix}-start`} label="Start year" optional>
          <input
            id={`${idPrefix}-start`}
            type="text"
            inputMode="numeric"
            value={startYear}
            onChange={(event) => setStartYear(event.target.value)}
            maxLength={4}
            placeholder="e.g. 2015"
            disabled={isLoading}
            className={INPUT_CLASS}
          />
        </Field>
        <Field id={`${idPrefix}-end`} label="Year completed" optional>
          <input
            id={`${idPrefix}-end`}
            type="text"
            inputMode="numeric"
            value={endYear}
            onChange={(event) => setEndYear(event.target.value)}
            maxLength={4}
            placeholder="e.g. 2019"
            disabled={isLoading}
            className={INPUT_CLASS}
          />
        </Field>
      </div>
      <p className="-mt-2 text-xs leading-4 text-shamba-ink-soft">Leave &ldquo;Year completed&rdquo; empty if you&apos;re still studying.</p>
      <ErrorText status={status} />
      <EntryFormActions busy={isLoading} onCancel={onCancel} saveLabel={entry ? "Save changes" : "Add"} />
    </form>
  );
}
