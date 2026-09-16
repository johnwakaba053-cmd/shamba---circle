"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success" }
  | { kind: "error"; message: string };

// Shared by CropPreferencesControl and LivestockPreferencesControl: both
// are a set of (profile_id, <item>_id) rows a farmer adds to or removes
// from, same shape as OnboardingForm's role selection -- diff the
// selection against what's already saved, insert what's new, delete
// what's gone, rather than replacing the whole set on every save.
export function PreferenceMultiSelectControl({
  userId,
  tableName,
  idColumn,
  items,
  initialSelectedIds,
  groupLabel,
  savedMessage,
}: {
  userId: string;
  tableName: "farmer_crop_preferences" | "farmer_livestock_preferences";
  idColumn: "crop_type_id" | "livestock_type_id";
  items: { id: string; name: string }[];
  initialSelectedIds: string[];
  groupLabel: string;
  savedMessage: string;
}) {
  const [existingSelected, setExistingSelected] = useState(
    () => new Set(initialSelectedIds),
  );
  const [selected, setSelected] = useState(() => new Set(initialSelectedIds));
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const isLoading = status.kind === "loading";

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isLoading) return;

    const toAdd = [...selected].filter((id) => !existingSelected.has(id));
    const toRemove = [...existingSelected].filter((id) => !selected.has(id));

    if (toAdd.length === 0 && toRemove.length === 0) {
      setStatus({ kind: "success" });
      return;
    }

    setStatus({ kind: "loading" });

    try {
      const supabase = createClient();

      if (toAdd.length > 0) {
        const { error } = await supabase
          .from(tableName)
          .insert(toAdd.map((id) => ({ profile_id: userId, [idColumn]: id })));

        if (error) {
          setStatus({
            kind: "error",
            message: "We couldn't save your selection. Please try again.",
          });
          return;
        }
      }

      if (toRemove.length > 0) {
        const { error } = await supabase
          .from(tableName)
          .delete()
          .eq("profile_id", userId)
          .in(idColumn, toRemove);

        if (error) {
          setStatus({
            kind: "error",
            message: "We couldn't save your selection. Please try again.",
          });
          return;
        }
      }

      setExistingSelected(new Set(selected));
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
        role="group"
        aria-label={groupLabel}
        className="grid grid-cols-1 gap-2 sm:grid-cols-2"
      >
        {items.map((item) => (
          <label
            key={item.id}
            className="flex items-center gap-3 rounded-shamba border border-shamba-line bg-shamba-bg px-4 py-3 font-sans text-base text-shamba-ink"
          >
            <input
              type="checkbox"
              checked={selected.has(item.id)}
              onChange={() => toggle(item.id)}
              disabled={isLoading}
              className="size-5 rounded border-shamba-line text-shamba-green focus:outline-none focus:ring-2 focus:ring-shamba-green disabled:opacity-60"
            />
            {item.name}
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
          {savedMessage}
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
