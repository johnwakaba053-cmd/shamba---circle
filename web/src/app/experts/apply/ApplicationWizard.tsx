"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  EXPERT_STEPS,
  isExpertStepId,
  stepIndex,
  type ApplicationParts,
  type CountyOption,
  type ExpertStepId,
  type SpecialtyOption,
} from "@/lib/experts";
import { ReviewerNote } from "./ApplicationStatusView";
import { AboutStep } from "./steps/AboutStep";
import { SpecialtiesStep } from "./steps/SpecialtiesStep";
import { EducationStep } from "./steps/EducationStep";
import { QualificationsStep } from "./steps/QualificationsStep";
import { ExperienceStep } from "./steps/ExperienceStep";
import { CvStep } from "./steps/CvStep";
import { LanguagesStep } from "./steps/LanguagesStep";
import { ReviewStep } from "./steps/ReviewStep";

// The step-by-step Expert Registration form. Every step saves straight to
// the database (the draft), so a farmer can leave at any point and pick
// up again later; the server sends them back to the first unfinished
// step.
//
// The current step lives in ?step=, moved with history.pushState (which
// Next.js keeps in sync with useSearchParams). Changing step needs no
// server round trip, and Android Back goes to the previous step.
export function ApplicationWizard({
  profileId,
  initialParts,
  initialStep,
  specialtyOptions,
  counties,
}: {
  profileId: string;
  initialParts: ApplicationParts;
  initialStep: ExpertStepId;
  specialtyOptions: SpecialtyOption[];
  counties: CountyOption[];
}) {
  const searchParams = useSearchParams();
  const [parts, setPartsState] = useState<ApplicationParts>(initialParts);

  const requested = searchParams.get("step");
  // Nothing exists until "About you" is saved, so that's the only step a
  // brand-new application can show.
  const step: ExpertStepId = !parts.application ? "about" : isExpertStepId(requested) ? requested : initialStep;
  const index = stepIndex(step);

  const setParts = useCallback((update: (current: ApplicationParts) => ApplicationParts) => {
    setPartsState(update);
  }, []);

  const goTo = useCallback((next: ExpertStepId) => {
    window.history.pushState(null, "", `/experts/apply?step=${next}`);
    window.scrollTo({ top: 0 });
  }, []);

  const stepProps = { profileId, parts, setParts, goTo };
  const note = parts.application?.status === "changes_requested" ? parts.application.applicant_note : null;

  return (
    <div className="rounded-shamba border border-shamba-line bg-shamba-card p-5 sm:p-8">
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-xs font-semibold uppercase tracking-wide text-shamba-ochre">
          Step {index + 1} of {EXPERT_STEPS.length}
        </p>
        {parts.application && (
          <Link
            href="/profile"
            className="inline-flex min-h-11 items-center font-sans text-sm font-semibold text-shamba-ink-soft hover:text-shamba-ink"
          >
            Finish later
          </Link>
        )}
      </div>

      <div
        className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-shamba-line"
        role="progressbar"
        aria-label="Application progress"
        aria-valuemin={1}
        aria-valuemax={EXPERT_STEPS.length}
        aria-valuenow={index + 1}
      >
        <div className="h-full rounded-full bg-shamba-green" style={{ width: `${((index + 1) / EXPERT_STEPS.length) * 100}%` }} />
      </div>

      <h1 className="mt-4 font-display text-2xl font-bold leading-tight tracking-tight text-shamba-ink">
        {EXPERT_STEPS[index].title}
      </h1>

      {note && <ReviewerNote note={note} />}

      <div className="mt-4">
        {step === "about" && <AboutStep {...stepProps} counties={counties} />}
        {step === "specialties" && <SpecialtiesStep {...stepProps} options={specialtyOptions} />}
        {step === "education" && <EducationStep {...stepProps} />}
        {step === "qualifications" && <QualificationsStep {...stepProps} />}
        {step === "experience" && <ExperienceStep {...stepProps} />}
        {step === "cv" && <CvStep {...stepProps} />}
        {step === "languages" && <LanguagesStep {...stepProps} />}
        {step === "review" && <ReviewStep {...stepProps} specialtyOptions={specialtyOptions} counties={counties} />}
      </div>
    </div>
  );
}
