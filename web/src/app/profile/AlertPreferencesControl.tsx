"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type AlertType = "weather" | "pest_disease" | "market_price";

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success" }
  | { kind: "error"; message: string };

const ALERT_OPTIONS: { value: AlertType; label: string; description: string }[] = [
  {
    value: "weather",
    label: "Weather alerts",
    description: "Rainfall, drought and other weather conditions affecting your area.",
  },
  {
    value: "pest_disease",
    label: "Pest & disease alerts",
    description: "Outbreaks or risks affecting crops and livestock near you.",
  },
  {
    value: "market_price",
    label: "Market-price alerts",
    description: "Price changes for crops and livestock you're interested in.",
  },
];

export function AlertPreferencesControl({
  userId,
  initialEnabledByType,
}: {
  userId: string;
  initialEnabledByType: Record<AlertType, boolean>;
}) {
  const [enabledByType, setEnabledByType] = useState(initialEnabledByType);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const isLoading = status.kind === "loading";

  function toggle(type: AlertType) {
    setEnabledByType((prev) => ({ ...prev, [type]: !prev[type] }));
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isLoading) return;

    setStatus({ kind: "loading" });

    try {
      const supabase = createClient();
      const now = new Date().toISOString();
      const { error } = await supabase.from("alert_notification_preferences").upsert(
        ALERT_OPTIONS.map(({ value }) => ({
          profile_id: userId,
          alert_type: value,
          enabled: enabledByType[value],
          updated_at: now,
        })),
        { onConflict: "profile_id,alert_type" },
      );

      if (error) {
        setStatus({
          kind: "error",
          message: "We couldn't save your alert preferences. Please try again.",
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
      <div role="group" aria-label="Alert preferences" className="flex flex-col gap-3">
        {ALERT_OPTIONS.map((option) => (
          <label
            key={option.value}
            className="flex items-start gap-3 rounded-shamba border border-shamba-line bg-shamba-bg px-4 py-3 font-sans text-base text-shamba-ink"
          >
            <input
              type="checkbox"
              checked={enabledByType[option.value]}
              onChange={() => toggle(option.value)}
              disabled={isLoading}
              className="mt-0.5 size-5 rounded border-shamba-line text-shamba-green focus:outline-none focus:ring-2 focus:ring-shamba-green disabled:opacity-60"
            />
            <span className="flex flex-col">
              <span className="font-semibold">{option.label}</span>
              <span className="text-sm text-shamba-ink-soft">
                {option.description}
              </span>
            </span>
          </label>
        ))}
      </div>

      {status.kind === "error" && (
        <p role="alert" className="text-sm font-semibold text-shamba-rust">
          {status.message}
        </p>
      )}

      {status.kind === "success" && (
        <p role="status" className="text-sm font-semibold text-shamba-green">
          Alert preferences saved.
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
