"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  APPLICATION_COLUMNS,
  MAX_BIO_LENGTH,
  MAX_HEADLINE_LENGTH,
  MAX_TITLE_LENGTH,
  MAX_YEARS_EXPERIENCE,
  expertErrorMessage,
  type CountyOption,
  type ExpertApplication,
} from "@/lib/experts";
import {
  CharactersLeft,
  ErrorText,
  Field,
  INPUT_CLASS,
  StepActions,
  parseWholeNumber,
  textOrNull,
  type Status,
  type StepProps,
} from "../formParts";

// Step 1. Saving it the first time creates the draft application; every
// field may be left empty for now -- the review step lists whatever is
// still needed before submitting.
export function AboutStep({ profileId, parts, setParts, goTo, counties }: StepProps & { counties: CountyOption[] }) {
  const app = parts.application;
  const [title, setTitle] = useState(app?.professional_title ?? "");
  const [headline, setHeadline] = useState(app?.headline ?? "");
  const [bio, setBio] = useState(app?.bio ?? "");
  const [countyId, setCountyId] = useState(app?.county_id ?? "");
  const [years, setYears] = useState(app?.years_experience != null ? String(app.years_experience) : "");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const isLoading = status.kind === "loading";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isLoading) return;

    const yearsResult = parseWholeNumber(years, 0, MAX_YEARS_EXPERIENCE, "Years of experience");
    if (!yearsResult.ok) {
      setStatus({ kind: "error", message: yearsResult.message });
      return;
    }

    const fields = {
      professional_title: textOrNull(title),
      headline: textOrNull(headline),
      bio: textOrNull(bio),
      county_id: countyId || null,
      years_experience: yearsResult.value,
    };

    setStatus({ kind: "loading" });
    try {
      const supabase = createClient();
      const { data, error } = app
        ? await supabase.from("expert_applications").update(fields).eq("id", app.id).select(APPLICATION_COLUMNS).maybeSingle()
        : await supabase
            .from("expert_applications")
            .insert({ profile_id: profileId, ...fields })
            .select(APPLICATION_COLUMNS)
            .single();

      if (error || !data) {
        setStatus({
          kind: "error",
          message: error
            ? expertErrorMessage(error, "We couldn't save this step. Please try again.")
            : "This application can't be changed right now. Refresh the page to see its status.",
        });
        return;
      }

      setParts((current) => ({ ...current, application: data as ExpertApplication }));
      setStatus({ kind: "idle" });
      goTo("specialties");
    } catch {
      setStatus({ kind: "error", message: "Something went wrong. Check your connection and try again." });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <p className="text-base leading-6 text-shamba-ink-soft">
        This is what farmers will see on your expert profile once you&apos;re verified.
      </p>

      <Field id="expert-title" label="Professional title" hint="For example: Veterinary surgeon, Agronomist, Animal health assistant.">
        <input
          id="expert-title"
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={MAX_TITLE_LENGTH}
          autoComplete="organization-title"
          disabled={isLoading}
          className={INPUT_CLASS}
        />
      </Field>

      <Field id="expert-headline" label="Headline" hint="One line about what you help farmers with.">
        <input
          id="expert-headline"
          type="text"
          value={headline}
          onChange={(event) => setHeadline(event.target.value)}
          maxLength={MAX_HEADLINE_LENGTH}
          placeholder="e.g. Dairy cattle health and fertility"
          disabled={isLoading}
          className={INPUT_CLASS}
        />
      </Field>

      <Field id="expert-bio" label="About your work">
        <textarea
          id="expert-bio"
          value={bio}
          onChange={(event) => setBio(event.target.value.slice(0, MAX_BIO_LENGTH))}
          maxLength={MAX_BIO_LENGTH}
          rows={5}
          placeholder="Who you work with, what you do, and where."
          disabled={isLoading}
          className={INPUT_CLASS}
        />
        <CharactersLeft value={bio} max={MAX_BIO_LENGTH} />
      </Field>

      <Field id="expert-county" label="County you work in">
        <select
          id="expert-county"
          value={countyId}
          onChange={(event) => setCountyId(event.target.value)}
          disabled={isLoading}
          className={INPUT_CLASS}
        >
          <option value="">Select county</option>
          {counties.map((county) => (
            <option key={county.id} value={county.id}>
              {county.name}
            </option>
          ))}
        </select>
      </Field>

      <Field id="expert-years" label="Years of experience">
        <input
          id="expert-years"
          type="text"
          inputMode="numeric"
          value={years}
          onChange={(event) => setYears(event.target.value)}
          maxLength={2}
          placeholder="e.g. 5"
          disabled={isLoading}
          className={`${INPUT_CLASS} max-w-32`}
        />
      </Field>

      <ErrorText status={status} />
      <StepActions primaryLabel="Save and continue" busy={isLoading} />
    </form>
  );
}
