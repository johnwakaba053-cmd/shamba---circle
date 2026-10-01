"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  farmRecordErrorMessage,
  groupTypesByCategory,
  type CategoryOption,
  type FarmPlot,
  type TypeOption,
} from "@/lib/farmRecords";

// Shared pieces of the Crops and Livestock sections on the farm page.
// They follow PlotsSection's patterns exactly (same input style, inline
// forms, archive with a confirm) so the three sections read as one page.

export type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string };

export const INPUT_CLASS =
  "w-full rounded-shamba border border-shamba-line bg-shamba-bg px-4 py-3 font-sans text-base text-shamba-ink placeholder:text-shamba-ink-soft focus:outline-none focus:ring-2 focus:ring-shamba-green disabled:opacity-60";

export const LABEL_CLASS = "font-sans text-sm font-semibold text-shamba-ink";

export function Optional() {
  return <span className="font-normal text-shamba-ink-soft">(optional)</span>;
}

// "Whole farm" (no plot) first, then the farm's active plots. A record
// already on a plot that has since been archived keeps it as an option so
// editing other fields doesn't silently move the record off its plot.
export function PlotSelect({
  id,
  value,
  onChange,
  plots,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  plots: FarmPlot[];
  disabled: boolean;
}) {
  const options = plots.filter((plot) => plot.archived_at === null || plot.id === value);

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className={LABEL_CLASS}>
        Where on the farm
      </label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} className={INPUT_CLASS}>
        <option value="">Whole farm</option>
        {options.map((plot) => (
          <option key={plot.id} value={plot.id}>
            {plot.archived_at === null ? plot.name : `${plot.name} (archived plot)`}
          </option>
        ))}
      </select>
    </div>
  );
}

// The crop or livestock type picker: one native dropdown with the types
// grouped under their category headings (Cereals -> Maize, Rice, ...), so
// a long list stays scannable and Android shows its own picker. The
// caller keeps its label (so htmlFor/id still pair up) and its value.
export function TypeSelect({
  id,
  value,
  onChange,
  types,
  categories,
  placeholder,
  disabled,
  autoFocus = false,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  types: TypeOption[];
  categories: CategoryOption[];
  placeholder: string;
  disabled: boolean;
  autoFocus?: boolean;
}) {
  const groups = groupTypesByCategory(types, categories);

  return (
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      required
      autoFocus={autoFocus}
      disabled={disabled}
      className={INPUT_CLASS}
    >
      <option value="">{placeholder}</option>
      {groups.map((group) => (
        <optgroup key={group.category.id} label={group.category.name}>
          {group.types.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

// "Lower field", "Lower field (archived plot)" or "Whole farm".
export function plotLabel(plotId: string | null, plots: FarmPlot[]): string {
  if (plotId === null) return "Whole farm";
  const plot = plots.find((candidate) => candidate.id === plotId);
  if (!plot) return "Plot";
  return plot.archived_at === null ? plot.name : `${plot.name} (archived plot)`;
}

export function FormButtons({
  isLoading,
  submitLabel,
  onCancel,
}: {
  isLoading: boolean;
  submitLabel: string;
  onCancel: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onCancel}
        disabled={isLoading}
        className="inline-flex items-center justify-center rounded-shamba border border-shamba-line px-5 py-3 font-sans text-base font-semibold text-shamba-ink transition-colors hover:bg-shamba-bg disabled:cursor-not-allowed disabled:opacity-70"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={isLoading}
        className="inline-flex flex-1 items-center justify-center gap-2 rounded-shamba bg-shamba-green px-5 py-3 font-sans text-base font-semibold text-shamba-card transition-colors hover:bg-shamba-green-deep disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isLoading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        {isLoading ? "Saving…" : submitLabel}
      </button>
    </div>
  );
}

export function FormError({ status }: { status: Status }) {
  if (status.kind !== "error") return null;
  return (
    <p role="alert" className="text-sm font-semibold text-shamba-rust">
      {status.message}
    </p>
  );
}

// Archive / restore for a crop season or livestock group. Restoring is
// refused by the database while the farm or plot is archived; that comes
// back as a plain sentence.
export function RecordArchiveButton({
  table,
  recordId,
  recordName,
  isArchived,
}: {
  table: "crop_seasons" | "livestock_groups";
  recordId: string;
  recordName: string;
  isArchived: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const isLoading = status.kind === "loading";

  async function handleToggle() {
    if (isLoading) return;

    const confirmMessage = isArchived
      ? `Restore "${recordName}"?`
      : `Archive "${recordName}"? Nothing is deleted and you can restore it later.`;
    if (!window.confirm(confirmMessage)) return;

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

      const { error } = await supabase
        .from(table)
        .update({ archived_at: isArchived ? null : new Date().toISOString() })
        .eq("id", recordId)
        .eq("profile_id", user.id);

      if (error) {
        setStatus({ kind: "error", message: farmRecordErrorMessage(error, "Couldn't update. Try again.") });
        return;
      }

      setStatus({ kind: "idle" });
      router.refresh();
    } catch {
      setStatus({ kind: "error", message: "Couldn't update. Try again." });
    }
  }

  return (
    <div className="flex flex-col items-end">
      <button
        type="button"
        onClick={handleToggle}
        disabled={isLoading}
        aria-label={isArchived ? `Restore ${recordName}` : `Archive ${recordName}`}
        className="inline-flex min-h-11 items-center gap-1.5 px-2 font-sans text-xs font-semibold text-shamba-ink-soft transition-colors hover:text-shamba-ink disabled:opacity-70"
      >
        {isLoading ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : isArchived ? (
          <ArchiveRestore className="size-4" aria-hidden="true" />
        ) : (
          <Archive className="size-4" aria-hidden="true" />
        )}
        {isArchived ? "Restore" : "Archive"}
      </button>
      {status.kind === "error" && (
        <p role="alert" className="max-w-56 text-right text-xs font-semibold text-shamba-rust">
          {status.message}
        </p>
      )}
    </div>
  );
}
