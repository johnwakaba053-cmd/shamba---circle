"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Loader2, Pencil, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { MAX_PLOT_NAME_LENGTH, formatAcres, parseAcres, type FarmPlot } from "@/lib/farmRecords";

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string };

// Postgres unique_violation: farm_plots_active_name_key rejects a second
// active plot with the same name (case and outer spaces ignored) on one
// farm -- on add, rename, or restoring an archived plot.
const UNIQUE_VIOLATION = "23505";

const INPUT_CLASS =
  "rounded-shamba border border-shamba-line bg-shamba-bg px-4 py-3 font-sans text-base text-shamba-ink placeholder:text-shamba-ink-soft focus:outline-none focus:ring-2 focus:ring-shamba-green disabled:opacity-60";

// Plots are optional, so this section never nags: with no plots it just
// says the farm can be used as one piece of land. Create, edit and
// archive all happen in place on the farm page -- a plot is only a name
// and an optional size, too small to deserve pages of its own.
//
// Authorization is farm_plots' RLS (profile_id = auth.uid()) plus the
// composite foreign key (farm_id, profile_id) -> farms, which makes it
// impossible to attach a plot to anyone else's farm.
export function PlotsSection({
  farmId,
  plots,
  farmArchived,
}: {
  farmId: string;
  plots: FarmPlot[];
  farmArchived: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const activePlots = plots.filter((plot) => plot.archived_at === null);
  const archivedPlots = plots.filter((plot) => plot.archived_at !== null);

  return (
    <section className="mt-6 rounded-shamba border border-shamba-line bg-shamba-card p-4">
      <h2 className="font-display text-base font-semibold text-shamba-ink">Plots</h2>

      {activePlots.length === 0 && !adding && (
        <p className="mt-1 text-sm leading-5 text-shamba-ink-soft">
          No plots yet. Plots are optional — add them only if you farm in
          separate fields, like &ldquo;Lower field&rdquo; or &ldquo;Greenhouse 1&rdquo;.
        </p>
      )}

      {activePlots.length > 0 && (
        <ul className="mt-2 flex flex-col divide-y divide-shamba-line">
          {activePlots.map((plot) =>
            editingId === plot.id ? (
              <li key={plot.id} className="py-3">
                <PlotForm
                  farmId={farmId}
                  plot={plot}
                  onDone={() => setEditingId(null)}
                />
              </li>
            ) : (
              <li key={plot.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate font-sans text-base font-semibold text-shamba-ink">{plot.name}</p>
                  {plot.size_acres !== null && (
                    <p className="font-mono text-xs text-shamba-ink-soft">{formatAcres(plot.size_acres)}</p>
                  )}
                </div>
                {!farmArchived && (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setAdding(false);
                        setEditingId(plot.id);
                      }}
                      aria-label={`Edit ${plot.name}`}
                      className="inline-flex size-11 items-center justify-center rounded-full text-shamba-ink-soft transition-colors hover:bg-shamba-bg hover:text-shamba-ink"
                    >
                      <Pencil className="size-4" aria-hidden="true" />
                    </button>
                    <PlotArchiveButton plot={plot} />
                  </div>
                )}
              </li>
            ),
          )}
        </ul>
      )}

      {!farmArchived &&
        (adding ? (
          <div className="mt-3 border-t border-shamba-line pt-3">
            <PlotForm farmId={farmId} onDone={() => setAdding(false)} />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setEditingId(null);
              setAdding(true);
            }}
            className="mt-3 inline-flex min-h-11 items-center gap-1.5 font-sans text-sm font-semibold text-shamba-green hover:underline"
          >
            <Plus className="size-4" aria-hidden="true" />
            Add a plot
          </button>
        ))}

      {archivedPlots.length > 0 && (
        <details className="mt-3 border-t border-shamba-line pt-3">
          <summary className="cursor-pointer font-sans text-sm font-semibold text-shamba-ink-soft hover:text-shamba-ink">
            Archived plots ({archivedPlots.length})
          </summary>
          <ul className="mt-2 flex flex-col divide-y divide-shamba-line">
            {archivedPlots.map((plot) => (
              <li key={plot.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate font-sans text-base text-shamba-ink-soft">{plot.name}</p>
                  {plot.size_acres !== null && (
                    <p className="font-mono text-xs text-shamba-ink-soft">{formatAcres(plot.size_acres)}</p>
                  )}
                </div>
                {!farmArchived && <PlotArchiveButton plot={plot} />}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function PlotForm({
  farmId,
  plot,
  onDone,
}: {
  farmId: string;
  plot?: FarmPlot;
  onDone: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(plot?.name ?? "");
  const [sizeAcres, setSizeAcres] = useState(plot?.size_acres != null ? String(plot.size_acres) : "");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const isLoading = status.kind === "loading";
  const idPrefix = plot ? `plot-${plot.id}` : "new-plot";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isLoading) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setStatus({ kind: "error", message: "Give the plot a name." });
      return;
    }
    const acres = parseAcres(sizeAcres);
    if (!acres.ok) {
      setStatus({ kind: "error", message: acres.message });
      return;
    }

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

      const fields = { name: trimmedName, size_acres: acres.value };
      const { error } = plot
        ? await supabase.from("farm_plots").update(fields).eq("id", plot.id).eq("profile_id", user.id)
        : await supabase.from("farm_plots").insert({ farm_id: farmId, profile_id: user.id, ...fields });

      if (error) {
        setStatus({
          kind: "error",
          message:
            error.code === UNIQUE_VIOLATION
              ? `You already have a plot called "${trimmedName}" on this farm. Choose a different name.`
              : "We couldn't save this plot. Please try again.",
        });
        return;
      }

      setStatus({ kind: "idle" });
      onDone();
      router.refresh();
    } catch {
      setStatus({ kind: "error", message: "Something went wrong. Please try again in a moment." });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <label htmlFor={`${idPrefix}-name`} className="font-sans text-sm font-semibold text-shamba-ink">
          Plot name
        </label>
        <input
          id={`${idPrefix}-name`}
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={MAX_PLOT_NAME_LENGTH}
          placeholder="e.g. Lower field"
          required
          autoFocus
          disabled={isLoading}
          className={INPUT_CLASS}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${idPrefix}-size`} className="font-sans text-sm font-semibold text-shamba-ink">
          Size in acres <span className="font-normal text-shamba-ink-soft">(optional)</span>
        </label>
        <input
          id={`${idPrefix}-size`}
          type="text"
          inputMode="decimal"
          value={sizeAcres}
          onChange={(event) => setSizeAcres(event.target.value)}
          placeholder="e.g. 0.5"
          disabled={isLoading}
          className={INPUT_CLASS}
        />
      </div>

      {status.kind === "error" && (
        <p role="alert" className="text-sm font-semibold text-shamba-rust">
          {status.message}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onDone}
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
          {isLoading ? "Saving…" : plot ? "Save plot" : "Add plot"}
        </button>
      </div>
    </form>
  );
}

function PlotArchiveButton({ plot }: { plot: FarmPlot }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const isLoading = status.kind === "loading";
  const isArchived = plot.archived_at !== null;

  async function handleToggle() {
    if (isLoading) return;

    const confirmMessage = isArchived
      ? `Restore "${plot.name}"?`
      : `Archive "${plot.name}"? Nothing is deleted and you can restore it later.`;

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
        .from("farm_plots")
        .update({ archived_at: isArchived ? null : new Date().toISOString() })
        .eq("id", plot.id)
        .eq("profile_id", user.id);

      if (error) {
        setStatus({
          kind: "error",
          message:
            error.code === UNIQUE_VIOLATION
              ? `Another plot is already called "${plot.name}". Rename or archive it first.`
              : "Couldn't update. Try again.",
        });
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
        aria-label={isArchived ? `Restore ${plot.name}` : `Archive ${plot.name}`}
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
        <p role="alert" className="text-xs font-semibold text-shamba-rust">
          {status.message}
        </p>
      )}
    </div>
  );
}
