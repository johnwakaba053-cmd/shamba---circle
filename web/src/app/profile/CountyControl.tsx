"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success" }
  | { kind: "error"; message: string };

export function CountyControl({
  userId,
  counties,
  initialCountyId,
}: {
  userId: string;
  counties: { id: string; name: string }[];
  initialCountyId: string | null;
}) {
  const [countyId, setCountyId] = useState(initialCountyId ?? "");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const isLoading = status.kind === "loading";

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isLoading) return;

    setStatus({ kind: "loading" });

    try {
      const supabase = createClient();
      const { error } = await supabase.from("farmer_preferences").upsert(
        {
          profile_id: userId,
          county_id: countyId || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "profile_id" },
      );

      if (error) {
        setStatus({
          kind: "error",
          message: "We couldn't save your county. Please try again.",
        });
        return;
      }

      setStatus({ kind: "success" });
    } catch {
      setStatus({
        kind: "error",
        message: "Something went wrong. Please try again in a moment.",
      });
    }
  }

  return (
    <form onSubmit={handleSave} className="mt-6 flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label
          htmlFor="county"
          className="font-sans text-sm font-semibold text-shamba-ink"
        >
          County
        </label>
        <select
          id="county"
          value={countyId}
          onChange={(event) => setCountyId(event.target.value)}
          disabled={isLoading}
          className="rounded-shamba border border-shamba-line bg-shamba-bg px-4 py-3 font-sans text-base text-shamba-ink focus:outline-none focus:ring-2 focus:ring-shamba-green disabled:opacity-60"
        >
          <option value="">Select your county</option>
          {counties.map((county) => (
            <option key={county.id} value={county.id}>
              {county.name}
            </option>
          ))}
        </select>
      </div>

      {status.kind === "error" && (
        <p role="alert" className="text-sm font-semibold text-shamba-rust">
          {status.message}
        </p>
      )}

      {status.kind === "success" && (
        <p role="status" className="text-sm font-semibold text-shamba-green">
          County saved.
        </p>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="inline-flex items-center justify-center gap-2 rounded-shamba bg-shamba-green px-6 py-3 font-sans text-base font-semibold text-shamba-card transition-colors hover:bg-shamba-green-deep disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isLoading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        {isLoading ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
