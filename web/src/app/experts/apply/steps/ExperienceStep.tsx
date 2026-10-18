"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  EXPERIENCE_COLUMNS,
  MAX_DESCRIPTION_LENGTH,
  MAX_EXPERIENCE,
  MAX_NAME_LENGTH,
  dateToMonth,
  expertErrorMessage,
  formatMonth,
  monthToDate,
  type ExperienceEntry,
} from "@/lib/experts";
import {
  CharactersLeft,
  EntryFormActions,
  EntryRow,
  ErrorText,
  Field,
  INPUT_CLASS,
  StepActions,
  textOrNull,
  type Status,
  type StepProps,
} from "../formParts";

// Step 5: work experience, newest first. Same add/edit/remove pattern as
// the Education step.
export function ExperienceStep({ profileId, parts, setParts, goTo }: StepProps) {
  const app = parts.application!;
  const [editing, setEditing] = useState<string | "new" | null>(parts.experience.length === 0 ? "new" : null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  function upsertSorted(entries: ExperienceEntry[], saved: ExperienceEntry): ExperienceEntry[] {
    const others = entries.filter((item) => item.id !== saved.id);
    return [...others, saved].sort((a, b) => b.start_date.localeCompare(a.start_date));
  }

  async function remove(entry: ExperienceEntry) {
    if (removingId) return;
    setRemovingId(entry.id);
    setStatus({ kind: "idle" });
    try {
      const { data, error } = await createClient().from("expert_experience").delete().eq("id", entry.id).select("id");
      if (error || !data?.length) {
        setStatus({
          kind: "error",
          message: error
            ? expertErrorMessage(error, "We couldn't remove that entry. Please try again.")
            : "This application can't be changed right now. Refresh the page to see its status.",
        });
        return;
      }
      setParts((current) => ({ ...current, experience: current.experience.filter((item) => item.id !== entry.id) }));
    } catch {
      setStatus({ kind: "error", message: "Something went wrong. Check your connection and try again." });
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-base leading-6 text-shamba-ink-soft">
        Add the jobs and roles where you&apos;ve worked with farmers, crops or animals.
      </p>

      {parts.experience.length > 0 && (
        <ul className="flex flex-col divide-y divide-shamba-line border-y border-shamba-line">
          {parts.experience.map((entry) =>
            editing === entry.id ? (
              <li key={entry.id} className="py-3">
                <ExperienceForm
                  applicationId={app.id}
                  profileId={profileId}
                  entry={entry}
                  onSaved={(saved) => {
                    setParts((current) => ({ ...current, experience: upsertSorted(current.experience, saved) }));
                    setEditing(null);
                  }}
                  onCancel={() => setEditing(null)}
                />
              </li>
            ) : (
              <EntryRow
                key={entry.id}
                title={entry.role_title}
                lines={[
                  entry.organisation,
                  <span key="dates" className="font-mono text-xs">
                    {formatMonth(entry.start_date)} – {entry.end_date ? formatMonth(entry.end_date) : "now"}
                  </span>,
                ]}
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
          <ExperienceForm
            applicationId={app.id}
            profileId={profileId}
            onSaved={(saved) => {
              setParts((current) => ({ ...current, experience: upsertSorted(current.experience, saved) }));
              setEditing(null);
            }}
            onCancel={parts.experience.length > 0 ? () => setEditing(null) : undefined}
          />
        </div>
      ) : (
        editing === null &&
        parts.experience.length < MAX_EXPERIENCE && (
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="inline-flex min-h-11 items-center gap-1.5 self-start font-sans text-sm font-semibold text-shamba-green hover:underline"
          >
            <Plus className="size-4" aria-hidden="true" />
            Add work experience
          </button>
        )
      )}

      <ErrorText status={status} />

      {editing !== null && parts.experience.length > 0 && (
        <p className="text-xs leading-4 text-shamba-ink-soft">Save or cancel the entry you&apos;re editing to continue.</p>
      )}

      <StepActions
        onBack={() => goTo("qualifications")}
        primaryLabel={parts.experience.length === 0 ? "Skip for now" : "Continue"}
        primaryType="button"
        onPrimary={() => goTo("cv")}
        disabled={editing !== null && parts.experience.length > 0}
      />
    </div>
  );
}

function ExperienceForm({
  applicationId,
  profileId,
  entry,
  onSaved,
  onCancel,
}: {
  applicationId: string;
  profileId: string;
  entry?: ExperienceEntry;
  onSaved: (entry: ExperienceEntry) => void;
  onCancel?: () => void;
}) {
  const [organisation, setOrganisation] = useState(entry?.organisation ?? "");
  const [role, setRole] = useState(entry?.role_title ?? "");
  const [start, setStart] = useState(dateToMonth(entry?.start_date ?? null));
  const [end, setEnd] = useState(dateToMonth(entry?.end_date ?? null));
  const [current, setCurrent] = useState(entry ? entry.end_date === null : false);
  const [description, setDescription] = useState(entry?.description ?? "");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const isLoading = status.kind === "loading";
  const idPrefix = entry ? `experience-${entry.id}` : "experience-new";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isLoading) return;

    if (!role.trim()) return setStatus({ kind: "error", message: "Enter your role or job title." });
    if (!organisation.trim()) return setStatus({ kind: "error", message: "Enter where you worked." });
    const startDate = monthToDate(start);
    if (!startDate) return setStatus({ kind: "error", message: "Choose the month you started." });
    const endDate = current ? null : monthToDate(end);
    if (!current && !endDate) {
      return setStatus({ kind: "error", message: "Choose the month you finished, or tick “I work here now”." });
    }
    if (endDate && endDate < startDate) {
      return setStatus({ kind: "error", message: "The finish month can't be before the start month." });
    }

    const fields = {
      organisation: organisation.trim(),
      role_title: role.trim(),
      start_date: startDate,
      end_date: endDate,
      description: textOrNull(description),
    };

    setStatus({ kind: "loading" });
    try {
      const supabase = createClient();
      const { data, error } = entry
        ? await supabase.from("expert_experience").update(fields).eq("id", entry.id).select(EXPERIENCE_COLUMNS).maybeSingle()
        : await supabase
            .from("expert_experience")
            .insert({ application_id: applicationId, profile_id: profileId, ...fields })
            .select(EXPERIENCE_COLUMNS)
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
      onSaved(data as ExperienceEntry);
    } catch {
      setStatus({ kind: "error", message: "Something went wrong. Check your connection and try again." });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field id={`${idPrefix}-role`} label="Role or job title">
        <input
          id={`${idPrefix}-role`}
          type="text"
          value={role}
          onChange={(event) => setRole(event.target.value)}
          maxLength={MAX_NAME_LENGTH}
          placeholder="e.g. Extension officer"
          disabled={isLoading}
          className={INPUT_CLASS}
        />
      </Field>
      <Field id={`${idPrefix}-organisation`} label="Where you worked">
        <input
          id={`${idPrefix}-organisation`}
          type="text"
          value={organisation}
          onChange={(event) => setOrganisation(event.target.value)}
          maxLength={MAX_NAME_LENGTH}
          placeholder="e.g. County Department of Agriculture"
          disabled={isLoading}
          className={INPUT_CLASS}
        />
      </Field>
      <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
        <Field id={`${idPrefix}-start`} label="Started">
          <input
            id={`${idPrefix}-start`}
            type="month"
            value={start}
            onChange={(event) => setStart(event.target.value)}
            min="1950-01"
            max="2100-12"
            disabled={isLoading}
            className={INPUT_CLASS}
          />
        </Field>
        <Field id={`${idPrefix}-end`} label="Finished">
          <input
            id={`${idPrefix}-end`}
            type="month"
            value={current ? "" : end}
            onChange={(event) => setEnd(event.target.value)}
            min="1950-01"
            max="2100-12"
            disabled={isLoading || current}
            className={INPUT_CLASS}
          />
        </Field>
      </div>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 font-sans text-sm text-shamba-ink">
        <input
          type="checkbox"
          checked={current}
          onChange={(event) => setCurrent(event.target.checked)}
          disabled={isLoading}
          className="size-5 accent-shamba-green"
        />
        I work here now
      </label>
      <Field id={`${idPrefix}-description`} label="What you did" optional>
        <textarea
          id={`${idPrefix}-description`}
          value={description}
          onChange={(event) => setDescription(event.target.value.slice(0, MAX_DESCRIPTION_LENGTH))}
          maxLength={MAX_DESCRIPTION_LENGTH}
          rows={3}
          disabled={isLoading}
          className={INPUT_CLASS}
        />
        <CharactersLeft value={description} max={MAX_DESCRIPTION_LENGTH} />
      </Field>
      <ErrorText status={status} />
      <EntryFormActions busy={isLoading} onCancel={onCancel} saveLabel={entry ? "Save changes" : "Add"} />
    </form>
  );
}
