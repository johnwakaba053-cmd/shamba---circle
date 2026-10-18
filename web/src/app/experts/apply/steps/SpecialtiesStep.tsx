"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { MAX_SPECIALTIES, expertErrorMessage, type SpecialtyOption } from "@/lib/experts";
import { ErrorText, StepActions, type Status, type StepProps } from "../formParts";

// Step 2: up to three specialties. Saving applies only the difference
// (removed ones deleted, new ones added).
export function SpecialtiesStep({ profileId, parts, setParts, goTo, options }: StepProps & { options: SpecialtyOption[] }) {
  const app = parts.application!;
  const [selected, setSelected] = useState<string[]>(parts.specialtyIds);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const isLoading = status.kind === "loading";
  const atLimit = selected.length >= MAX_SPECIALTIES;

  function toggle(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isLoading) return;

    const removed = parts.specialtyIds.filter((id) => !selected.includes(id));
    const added = selected.filter((id) => !parts.specialtyIds.includes(id));

    if (removed.length === 0 && added.length === 0) {
      goTo("education");
      return;
    }

    setStatus({ kind: "loading" });
    try {
      const supabase = createClient();
      // Removals first, so swapping one specialty for another never trips
      // the three-specialty limit.
      if (removed.length > 0) {
        const { data, error } = await supabase
          .from("expert_application_specialties")
          .delete()
          .eq("application_id", app.id)
          .in("specialty_id", removed)
          .select("specialty_id");
        // A locked (submitted) application deletes nothing rather than
        // failing, so check that the rows really went.
        if (error || (data?.length ?? 0) !== removed.length) {
          setStatus({
            kind: "error",
            message: error
              ? expertErrorMessage(error, "We couldn't save your specialties. Please try again.")
              : "This application can't be changed right now. Refresh the page to see its status.",
          });
          return;
        }
      }
      if (added.length > 0) {
        const { error } = await supabase
          .from("expert_application_specialties")
          .insert(added.map((specialtyId) => ({ application_id: app.id, profile_id: profileId, specialty_id: specialtyId })));
        if (error) {
          // The removals above did go through.
          setParts((current) => ({ ...current, specialtyIds: current.specialtyIds.filter((id) => !removed.includes(id)) }));
          setStatus({ kind: "error", message: expertErrorMessage(error, "We couldn't save your specialties. Please try again.") });
          return;
        }
      }

      setParts((current) => ({ ...current, specialtyIds: selected }));
      setStatus({ kind: "idle" });
      goTo("education");
    } catch {
      setStatus({ kind: "error", message: "Something went wrong. Check your connection and try again." });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <fieldset disabled={isLoading} className="flex flex-col gap-2">
        <legend className="mb-3 text-base leading-6 text-shamba-ink-soft">
          Choose up to {MAX_SPECIALTIES} areas you know best.{" "}
          <span className="font-mono text-xs text-shamba-ink-soft">
            {selected.length}/{MAX_SPECIALTIES} chosen
          </span>
        </legend>
        {options.map((option) => {
          const checked = selected.includes(option.id);
          const unavailable = !checked && atLimit;
          return (
            <label
              key={option.id}
              className={`flex min-h-11 items-center gap-3 rounded-shamba border px-4 py-2.5 font-sans text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-shamba-green ${
                checked
                  ? "border-shamba-green bg-shamba-green/10 text-shamba-ink"
                  : "border-shamba-line bg-shamba-bg text-shamba-ink"
              } ${unavailable ? "opacity-60" : "cursor-pointer"}`}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={unavailable}
                onChange={() => toggle(option.id)}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${
                  checked ? "border-shamba-green bg-shamba-green text-shamba-card" : "border-shamba-line bg-shamba-card"
                }`}
              >
                {checked && <Check className="size-3.5" />}
              </span>
              <span className="font-semibold">{option.name}</span>
            </label>
          );
        })}
      </fieldset>

      {atLimit && (
        <p className="text-xs leading-4 text-shamba-ink-soft">You&apos;ve chosen {MAX_SPECIALTIES}. Untick one to choose another.</p>
      )}

      <ErrorText status={status} />
      <StepActions onBack={() => goTo("about")} primaryLabel="Save and continue" busy={isLoading} />
    </form>
  );
}
