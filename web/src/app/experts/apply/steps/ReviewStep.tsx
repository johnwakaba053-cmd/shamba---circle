"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  educationLevelLabel,
  expertErrorMessage,
  formatMonth,
  missingParts,
  missingPartsFromDetail,
  type CountyOption,
  type ExpertStepId,
  type MissingPart,
  type SpecialtyOption,
} from "@/lib/experts";
import { WithdrawControl } from "../WithdrawControl";
import { SECONDARY_BUTTON_CLASS, type StepProps } from "../formParts";

type SubmitStatus =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string; missing: MissingPart[] };

// Step 8: everything on one page, what's still missing (linked to its
// step), consent, and submit. Submitting locks the application; the page
// then shows its status instead of the form.
export function ReviewStep({
  parts,
  goTo,
  specialtyOptions,
  counties,
}: StepProps & { specialtyOptions: SpecialtyOption[]; counties: CountyOption[] }) {
  const router = useRouter();
  const app = parts.application!;
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<SubmitStatus>({ kind: "idle" });
  const isLoading = status.kind === "loading";
  const missing = missingParts(parts);
  const cv = parts.documents.find((document) => document.kind === "cv");
  const county = counties.find((item) => item.id === app.county_id)?.name;
  const specialtyNames = parts.specialtyIds.map((id) => specialtyOptions.find((option) => option.id === id)?.name ?? id);
  const isResubmission = app.status === "changes_requested";

  async function handleSubmit() {
    if (isLoading || missing.length > 0 || !consent) return;
    setStatus({ kind: "loading" });
    try {
      const { error } = await createClient().rpc("submit_expert_application", {
        p_application_id: app.id,
        p_consent: true,
      });
      if (error) {
        setStatus({
          kind: "error",
          message:
            error.message === "expert_application_incomplete"
              ? "A few things are still missing:"
              : expertErrorMessage(error, "We couldn't submit your application. Please try again."),
          missing: error.message === "expert_application_incomplete" ? missingPartsFromDetail(error.details) : [],
        });
        return;
      }
      router.replace("/experts/apply");
      router.refresh();
    } catch {
      setStatus({ kind: "error", message: "Something went wrong. Check your connection and try again.", missing: [] });
    }
  }

  const shownMissing = status.kind === "error" && status.missing.length > 0 ? status.missing : missing;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-base leading-6 text-shamba-ink-soft">
        Check your details. You can&apos;t change them while our team is reviewing your application.
      </p>

      {shownMissing.length > 0 && (
        <div role="alert" className="rounded-shamba border border-shamba-rust/40 bg-shamba-card px-4 py-3">
          <p className="flex items-center gap-2 font-sans text-sm font-semibold text-shamba-rust">
            <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
            Add these before you submit
          </p>
          <ul className="mt-2 flex flex-col">
            {shownMissing.map((part) => (
              <li key={part.label}>
                <button
                  type="button"
                  onClick={() => goTo(part.step)}
                  className="inline-flex min-h-11 items-center text-left font-sans text-sm font-semibold text-shamba-green underline-offset-2 hover:underline"
                >
                  {part.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Section title="About you" step="about" goTo={goTo}>
        <Row label="Title" value={app.professional_title} />
        <Row label="Headline" value={app.headline} />
        <Row label="County" value={county ?? null} />
        <Row label="Experience" value={app.years_experience != null ? `${app.years_experience} ${app.years_experience === 1 ? "year" : "years"}` : null} />
        {app.bio && <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-5 text-shamba-ink">{app.bio}</p>}
      </Section>

      <Section title="Specialties" step="specialties" goTo={goTo}>
        <List items={specialtyNames} empty="None chosen" />
      </Section>

      <Section title="Education" step="education" goTo={goTo}>
        <List
          items={parts.education.map((entry) => `${educationLevelLabel(entry.level)} · ${entry.field_of_study}, ${entry.institution}`)}
          empty="None added"
        />
      </Section>

      <Section title="Qualifications and certificates" step="qualifications" goTo={goTo}>
        <List
          items={parts.qualifications.map(
            (entry) => `${entry.title}, ${entry.issuing_body}${entry.document_id ? " · file attached" : ""}`,
          )}
          empty="None added (optional)"
        />
      </Section>

      <Section title="Work experience" step="experience" goTo={goTo}>
        <List
          items={parts.experience.map(
            (entry) =>
              `${entry.role_title}, ${entry.organisation} (${formatMonth(entry.start_date)} – ${entry.end_date ? formatMonth(entry.end_date) : "now"})`,
          )}
          empty="None added"
        />
      </Section>

      <Section title="CV" step="cv" goTo={goTo}>
        <List items={cv ? [cv.file_name] : []} empty="Not uploaded" />
      </Section>

      <Section title="Languages and registration" step="languages" goTo={goTo}>
        <Row label="Languages" value={app.languages?.length ? app.languages.join(", ") : null} />
        <Row label="Registered with" value={app.registration_body} />
        {app.registration_number && <Row label="Registration number" value="Added (private)" />}
      </Section>

      <label className="flex cursor-pointer items-start gap-3 rounded-shamba border border-shamba-line bg-shamba-bg px-4 py-3 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-shamba-green">
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          disabled={isLoading}
          className="mt-0.5 size-5 shrink-0 accent-shamba-green"
        />
        <span className="text-sm leading-5 text-shamba-ink">
          I confirm these details are true, and I agree that Shamba Space reviewers may check my documents and
          contact the bodies that issued them to verify me.
        </span>
      </label>

      <p className="flex items-start gap-2 text-xs leading-4 text-shamba-ink-soft">
        <Lock className="mt-px size-3.5 shrink-0" aria-hidden="true" />
        Your CV, certificates and registration numbers stay private. Only your title, headline, bio, county,
        specialties, languages and the names of your qualifications appear on your profile once you&apos;re verified.
      </p>

      {status.kind === "error" && status.missing.length === 0 && (
        <p role="alert" className="text-sm font-semibold text-shamba-rust">
          {status.message}
        </p>
      )}

      <div className="mt-2 flex flex-col-reverse gap-3 border-t border-shamba-line pt-4 sm:flex-row sm:items-center sm:justify-between">
        <button type="button" onClick={() => goTo("languages")} disabled={isLoading} className={SECONDARY_BUTTON_CLASS}>
          Back
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isLoading || missing.length > 0 || !consent}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-shamba bg-shamba-green px-6 py-3 font-sans text-base font-semibold text-shamba-card transition-colors hover:bg-shamba-green-deep disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isLoading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {isLoading ? "Submitting…" : isResubmission ? "Send updated application" : "Submit application"}
        </button>
      </div>
      {missing.length === 0 && !consent && (
        <p className="text-xs leading-4 text-shamba-ink-soft sm:text-right">Tick the box above to submit.</p>
      )}

      <div className="mt-4 border-t border-shamba-line pt-4">
        <WithdrawControl applicationId={app.id} />
      </div>
    </div>
  );
}

function Section({
  title,
  step,
  goTo,
  children,
}: {
  title: string;
  step: ExpertStepId;
  goTo: (step: ExpertStepId) => void;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-shamba border border-shamba-line px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-base font-bold text-shamba-ink">{title}</h2>
        <button
          type="button"
          onClick={() => goTo(step)}
          aria-label={`Edit ${title}`}
          className="inline-flex min-h-11 shrink-0 items-center font-sans text-sm font-semibold text-shamba-green hover:text-shamba-green-deep"
        >
          Edit
        </button>
      </div>
      <div className="flex flex-col gap-1">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <p className="break-words text-sm leading-5">
      <span className="text-shamba-ink-soft">{label}: </span>
      {value ? <span className="text-shamba-ink">{value}</span> : <span className="italic text-shamba-ink-soft">Not added</span>}
    </p>
  );
}

function List({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) return <p className="text-sm italic leading-5 text-shamba-ink-soft">{empty}</p>;
  return (
    <ul className="flex flex-col gap-1">
      {items.map((item, index) => (
        <li key={index} className="break-words text-sm leading-5 text-shamba-ink">
          {item}
        </li>
      ))}
    </ul>
  );
}
