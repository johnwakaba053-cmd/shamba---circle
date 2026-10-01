"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  MAX_FARM_NAME_LENGTH,
  MAX_LOCATION_TEXT_LENGTH,
  TENURE_OPTIONS,
  isTenure,
  parseAcres,
  type CountyOption,
} from "@/lib/farmRecords";

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string };

export type FarmFormValues = {
  name: string;
  countyId: string;
  locationText: string;
  sizeAcres: string;
  tenure: string;
};

const INPUT_CLASS =
  "rounded-shamba border border-shamba-line bg-shamba-bg px-4 py-3 font-sans text-base text-shamba-ink placeholder:text-shamba-ink-soft focus:outline-none focus:ring-2 focus:ring-shamba-green disabled:opacity-60";

// Create and edit share this one form, the same way ListingForm serves
// both /marketplace/new and /marketplace/[id]/edit. The write-time
// authorization boundary is farms' own RLS (profile_id = auth.uid()) --
// the explicit profile_id filter on update is belt and braces, not the
// security check.
export function FarmForm({
  counties,
  mode = "create",
  farmId,
  initialValues,
}: {
  counties: CountyOption[];
  mode?: "create" | "edit";
  farmId?: string;
  initialValues: FarmFormValues;
}) {
  const router = useRouter();
  const [values, setValues] = useState<FarmFormValues>(initialValues);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const isLoading = status.kind === "loading";

  function update<K extends keyof FarmFormValues>(key: K, value: FarmFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isLoading) return;

    const name = values.name.trim();
    if (!name) {
      setStatus({ kind: "error", message: "Give your farm a name." });
      return;
    }
    if (!values.countyId) {
      setStatus({ kind: "error", message: "Choose the county your farm is in." });
      return;
    }
    const acres = parseAcres(values.sizeAcres);
    if (!acres.ok) {
      setStatus({ kind: "error", message: acres.message });
      return;
    }

    const fields = {
      name,
      county_id: values.countyId,
      location_text: values.locationText.trim() || null,
      size_acres: acres.value,
      tenure: isTenure(values.tenure) ? values.tenure : null,
    };

    setStatus({ kind: "loading" });

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setStatus({ kind: "error", message: "Please sign in again." });
        return;
      }

      if (mode === "edit" && farmId) {
        const { error } = await supabase
          .from("farms")
          .update(fields)
          .eq("id", farmId)
          .eq("profile_id", user.id);

        if (error) {
          setStatus({ kind: "error", message: "We couldn't save your farm. Please try again." });
          return;
        }

        router.push(`/farm-records/${farmId}`);
        router.refresh();
        return;
      }

      const { data, error } = await supabase
        .from("farms")
        .insert({ profile_id: user.id, ...fields })
        .select("id")
        .single();

      if (error || !data) {
        setStatus({ kind: "error", message: "We couldn't create your farm. Please try again." });
        return;
      }

      router.push(`/farm-records/${data.id}`);
    } catch {
      setStatus({ kind: "error", message: "Something went wrong. Please try again in a moment." });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="farm-name" className="font-sans text-sm font-semibold text-shamba-ink">
          Farm name
        </label>
        <input
          id="farm-name"
          type="text"
          value={values.name}
          onChange={(event) => update("name", event.target.value)}
          maxLength={MAX_FARM_NAME_LENGTH}
          placeholder="e.g. Home shamba"
          required
          disabled={isLoading}
          className={INPUT_CLASS}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="farm-county" className="font-sans text-sm font-semibold text-shamba-ink">
          County
        </label>
        <select
          id="farm-county"
          value={values.countyId}
          onChange={(event) => update("countyId", event.target.value)}
          required
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
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="farm-location" className="font-sans text-sm font-semibold text-shamba-ink">
          Location <span className="font-normal text-shamba-ink-soft">(optional)</span>
        </label>
        <input
          id="farm-location"
          type="text"
          value={values.locationText}
          onChange={(event) => update("locationText", event.target.value)}
          maxLength={MAX_LOCATION_TEXT_LENGTH}
          placeholder="Ward, village or nearest town"
          disabled={isLoading}
          className={INPUT_CLASS}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="farm-size" className="font-sans text-sm font-semibold text-shamba-ink">
          Size in acres <span className="font-normal text-shamba-ink-soft">(optional)</span>
        </label>
        <input
          id="farm-size"
          type="text"
          inputMode="decimal"
          value={values.sizeAcres}
          onChange={(event) => update("sizeAcres", event.target.value)}
          placeholder="e.g. 2.5"
          disabled={isLoading}
          className={INPUT_CLASS}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="farm-tenure" className="font-sans text-sm font-semibold text-shamba-ink">
          Land ownership <span className="font-normal text-shamba-ink-soft">(optional)</span>
        </label>
        <select
          id="farm-tenure"
          value={values.tenure}
          onChange={(event) => update("tenure", event.target.value)}
          disabled={isLoading}
          className={INPUT_CLASS}
        >
          <option value="">Prefer not to say</option>
          {TENURE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <p className="font-mono text-[11px] leading-4 text-shamba-ink-soft">
        Only you can see your farm records.
      </p>

      {status.kind === "error" && (
        <p role="alert" className="text-sm font-semibold text-shamba-rust">
          {status.message}
        </p>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="inline-flex items-center justify-center gap-2 rounded-shamba bg-shamba-green px-6 py-3 font-sans text-base font-semibold text-shamba-card transition-colors hover:bg-shamba-green-deep disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isLoading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        {isLoading ? "Saving…" : mode === "edit" ? "Save changes" : "Create farm"}
      </button>
    </form>
  );
}
