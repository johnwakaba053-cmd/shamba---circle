"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Visibility = "public" | "private";

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success" }
  | { kind: "error"; message: string };

const OPTIONS: { value: Visibility; label: string; description: string }[] = [
  {
    value: "public",
    label: "Public",
    description: "Other farmers can see my profile",
  },
  {
    value: "private",
    label: "Private",
    description: "Only I can see my profile",
  },
];

export function ProfileVisibilityControl({
  userId,
  initialVisibility,
}: {
  userId: string;
  initialVisibility: Visibility;
}) {
  const [selected, setSelected] = useState<Visibility>(initialVisibility);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const isLoading = status.kind === "loading";

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isLoading) return;

    setStatus({ kind: "loading" });

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("profiles")
        .update({ profile_visibility: selected })
        .eq("id", userId);

      if (error) {
        setStatus({
          kind: "error",
          message: "We couldn't save your visibility. Please try again.",
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
      <div
        role="radiogroup"
        aria-label="Profile visibility"
        className="flex flex-col gap-3"
      >
        {OPTIONS.map((option) => (
          <label
            key={option.value}
            className="flex items-center gap-3 rounded-shamba border border-shamba-line bg-shamba-bg px-4 py-3 font-sans text-base text-shamba-ink"
          >
            <input
              type="radio"
              name="profile_visibility"
              value={option.value}
              checked={selected === option.value}
              onChange={() => setSelected(option.value)}
              disabled={isLoading}
              className="size-5 border-shamba-line text-shamba-green focus:outline-none focus:ring-2 focus:ring-shamba-green disabled:opacity-60"
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
          Profile visibility saved.
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
