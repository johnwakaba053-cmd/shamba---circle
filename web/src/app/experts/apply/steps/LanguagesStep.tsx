"use client";

import { useState } from "react";
import { Check, Lock, Plus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  APPLICATION_COLUMNS,
  LANGUAGE_SUGGESTIONS,
  MAX_LANGUAGES,
  MAX_LANGUAGE_LENGTH,
  MAX_REGISTRATION_BODY_LENGTH,
  MAX_REGISTRATION_NUMBER_LENGTH,
  expertErrorMessage,
  type ExpertApplication,
} from "@/lib/experts";
import { ErrorText, Field, INPUT_CLASS, SECONDARY_BUTTON_CLASS, StepActions, textOrNull, type Status, type StepProps } from "../formParts";

// Step 7: the languages the expert can advise in, and an optional
// professional registration (body + number). The registration number is
// private; only the body name could ever be shown publicly later.
export function LanguagesStep({ parts, setParts, goTo }: StepProps) {
  const app = parts.application!;
  const [languages, setLanguages] = useState<string[]>(app.languages ?? []);
  const [other, setOther] = useState("");
  const [registrationBody, setRegistrationBody] = useState(app.registration_body ?? "");
  const [registrationNumber, setRegistrationNumber] = useState(app.registration_number ?? "");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const isLoading = status.kind === "loading";
  const atLimit = languages.length >= MAX_LANGUAGES;
  const custom = languages.filter((language) => !LANGUAGE_SUGGESTIONS.includes(language));

  function has(language: string) {
    return languages.some((item) => item.toLowerCase() === language.toLowerCase());
  }

  function toggle(language: string) {
    setLanguages((current) =>
      current.includes(language) ? current.filter((item) => item !== language) : current.length >= MAX_LANGUAGES ? current : [...current, language],
    );
  }

  function addOther() {
    const typed = other.trim().replace(/\s+/g, " ");
    if (!typed) return;
    // "english" picks the existing English chip rather than adding a twin.
    const language = LANGUAGE_SUGGESTIONS.find((item) => item.toLowerCase() === typed.toLowerCase()) ?? typed;
    if (has(language)) {
      setOther("");
      return;
    }
    if (atLimit) {
      setStatus({ kind: "error", message: `You can list up to ${MAX_LANGUAGES} languages.` });
      return;
    }
    setLanguages((current) => [...current, language]);
    setOther("");
    setStatus({ kind: "idle" });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isLoading) return;

    const body = textOrNull(registrationBody);
    const number = textOrNull(registrationNumber);
    if (number && !body) {
      setStatus({ kind: "error", message: "Enter the body you're registered with, or clear the registration number." });
      return;
    }

    setStatus({ kind: "loading" });
    try {
      const { data, error } = await createClient()
        .from("expert_applications")
        .update({ languages: languages.length > 0 ? languages : null, registration_body: body, registration_number: number })
        .eq("id", app.id)
        .select(APPLICATION_COLUMNS)
        .maybeSingle();

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
      goTo("review");
    } catch {
      setStatus({ kind: "error", message: "Something went wrong. Check your connection and try again." });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <fieldset disabled={isLoading} className="flex flex-col gap-3">
        <legend className="mb-1 font-sans text-sm font-semibold text-shamba-ink">
          Languages you can advise farmers in <span className="font-normal text-shamba-ink-soft">(optional)</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {[...LANGUAGE_SUGGESTIONS, ...custom].map((language) => {
            const checked = languages.includes(language);
            const isCustom = !LANGUAGE_SUGGESTIONS.includes(language);
            return (
              <button
                key={language}
                type="button"
                aria-pressed={checked}
                onClick={() => toggle(language)}
                disabled={!checked && atLimit}
                className={`inline-flex min-h-11 items-center gap-1.5 rounded-shamba border px-3 font-sans text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                  checked ? "border-shamba-green bg-shamba-green/10 text-shamba-ink" : "border-shamba-line bg-shamba-bg text-shamba-ink-soft hover:text-shamba-ink"
                }`}
              >
                {checked && (isCustom ? <X className="size-3.5" aria-hidden="true" /> : <Check className="size-3.5" aria-hidden="true" />)}
                {language}
              </button>
            );
          })}
        </div>
        <div className="flex gap-2">
          <label htmlFor="expert-language-other" className="sr-only">
            Another language
          </label>
          <input
            id="expert-language-other"
            type="text"
            value={other}
            onChange={(event) => setOther(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addOther();
              }
            }}
            maxLength={MAX_LANGUAGE_LENGTH}
            placeholder="Another language"
            disabled={atLimit}
            className={`${INPUT_CLASS} min-w-0 flex-1`}
          />
          <button type="button" onClick={addOther} disabled={atLimit || !other.trim()} className={`${SECONDARY_BUTTON_CLASS} shrink-0`}>
            <Plus className="size-4" aria-hidden="true" />
            Add
          </button>
        </div>
        <p className="font-mono text-xs text-shamba-ink-soft">
          {languages.length}/{MAX_LANGUAGES} chosen
        </p>
      </fieldset>

      <div className="flex flex-col gap-4 border-t border-shamba-line pt-4">
        <div>
          <h2 className="font-display text-base font-bold text-shamba-ink">Professional registration</h2>
          <p className="mt-1 text-sm leading-5 text-shamba-ink-soft">
            Optional. If you&apos;re registered with a professional body, adding it helps us verify you.
          </p>
        </div>
        <Field id="expert-registration-body" label="Registered with" optional>
          <input
            id="expert-registration-body"
            type="text"
            value={registrationBody}
            onChange={(event) => setRegistrationBody(event.target.value)}
            maxLength={MAX_REGISTRATION_BODY_LENGTH}
            placeholder="e.g. Kenya Veterinary Board"
            disabled={isLoading}
            className={INPUT_CLASS}
          />
        </Field>
        <Field
          id="expert-registration-number"
          label="Registration number"
          optional
          hint={
            <span className="inline-flex items-center gap-1">
              <Lock className="size-3" aria-hidden="true" />
              Private. Only Shamba Space reviewers see this.
            </span>
          }
        >
          <input
            id="expert-registration-number"
            type="text"
            value={registrationNumber}
            onChange={(event) => setRegistrationNumber(event.target.value)}
            maxLength={MAX_REGISTRATION_NUMBER_LENGTH}
            autoComplete="off"
            disabled={isLoading}
            className={INPUT_CLASS}
          />
        </Field>
      </div>

      <ErrorText status={status} />
      <StepActions onBack={() => goTo("cv")} primaryLabel="Save and continue" busy={isLoading} />
    </form>
  );
}
