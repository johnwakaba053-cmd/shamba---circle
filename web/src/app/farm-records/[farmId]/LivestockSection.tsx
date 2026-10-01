"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  MAX_LIVESTOCK_NAME_LENGTH,
  MAX_RECORD_DATE,
  MIN_RECORD_DATE,
  farmRecordErrorMessage,
  headCountNoun,
  livestockStartLabel,
  parseHeadCount,
  parseRecordDate,
  type FarmPlot,
  type LivestockGroup,
  type TypeOption,
} from "@/lib/farmRecords";
import {
  FormButtons,
  FormError,
  INPUT_CLASS,
  LABEL_CLASS,
  Optional,
  PlotSelect,
  RecordArchiveButton,
  plotLabel,
  type Status,
} from "./recordParts";

// The animals kept on this farm, one group (herd, flock, apiary) per row.
// A group can be on one plot or the whole farm. Create, edit and archive
// happen in place, like plots.
//
// Authorization is livestock_groups' RLS (profile_id = auth.uid()) plus
// the composite foreign keys to farms and farm_plots; the database also
// refuses new groups on an archived farm or plot.
export function LivestockSection({
  farmId,
  groups,
  plots,
  livestockTypes,
  farmArchived,
  today,
}: {
  farmId: string;
  groups: LivestockGroup[];
  plots: FarmPlot[];
  livestockTypes: TypeOption[];
  farmArchived: boolean;
  today: string;
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const active = groups.filter((group) => group.archived_at === null);
  const archived = groups.filter((group) => group.archived_at !== null);

  const typeName = (id: string) => livestockTypes.find((type) => type.id === id)?.name ?? id;

  return (
    <section className="mt-6 rounded-shamba border border-shamba-line bg-shamba-card p-4">
      <h2 className="font-display text-base font-semibold text-shamba-ink">Livestock</h2>

      {active.length === 0 && !adding && (
        <p className="mt-1 text-sm leading-5 text-shamba-ink-soft">
          No livestock yet. Add each group of animals you keep, like your
          dairy cows or a flock of chickens.
        </p>
      )}

      {active.length > 0 && (
        <ul className="mt-2 flex flex-col divide-y divide-shamba-line">
          {active.map((group) =>
            editingId === group.id ? (
              <li key={group.id} className="py-3">
                <LivestockGroupForm
                  farmId={farmId}
                  group={group}
                  plots={plots}
                  livestockTypes={livestockTypes}
                  onDone={() => setEditingId(null)}
                />
              </li>
            ) : (
              <li key={group.id} className="py-2">
                <LivestockGroupSummary group={group} typeName={typeName(group.livestock_type_id)} plots={plots} today={today} />
                {!farmArchived && (
                  <div className="-ml-2 mt-1 flex flex-wrap items-start gap-x-1">
                    <button
                      type="button"
                      onClick={() => {
                        setAdding(false);
                        setEditingId(group.id);
                      }}
                      aria-label={`Edit ${group.name}`}
                      className="inline-flex min-h-11 items-center gap-1.5 px-2 font-sans text-xs font-semibold text-shamba-ink-soft transition-colors hover:text-shamba-ink"
                    >
                      <Pencil className="size-4" aria-hidden="true" />
                      Edit
                    </button>
                    <RecordArchiveButton
                      table="livestock_groups"
                      recordId={group.id}
                      recordName={group.name}
                      isArchived={false}
                    />
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
            <LivestockGroupForm
              farmId={farmId}
              plots={plots}
              livestockTypes={livestockTypes}
              onDone={() => setAdding(false)}
            />
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
            Add livestock
          </button>
        ))}

      {archived.length > 0 && (
        <details className="mt-3 border-t border-shamba-line pt-3">
          <summary className="cursor-pointer font-sans text-sm font-semibold text-shamba-ink-soft hover:text-shamba-ink">
            Archived livestock ({archived.length})
          </summary>
          <ul className="mt-2 flex flex-col divide-y divide-shamba-line">
            {archived.map((group) => (
              <li key={group.id} className="flex items-start justify-between gap-3 py-2">
                <LivestockGroupSummary
                  group={group}
                  typeName={typeName(group.livestock_type_id)}
                  plots={plots}
                  today={today}
                  muted
                />
                {!farmArchived && (
                  <RecordArchiveButton table="livestock_groups" recordId={group.id} recordName={group.name} isArchived />
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function LivestockGroupSummary({
  group,
  typeName,
  plots,
  today,
  muted = false,
}: {
  group: LivestockGroup;
  typeName: string;
  plots: FarmPlot[];
  today: string;
  muted?: boolean;
}) {
  const details = [
    typeName,
    group.head_count !== null
      ? `${group.head_count.toLocaleString("en-KE")} ${headCountNoun(group.livestock_type_id, group.head_count)}`
      : null,
    group.started_on !== null ? livestockStartLabel(group.started_on, today) : null,
    plotLabel(group.plot_id, plots),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="min-w-0">
      <p className={`break-words font-sans text-base ${muted ? "text-shamba-ink-soft" : "font-semibold text-shamba-ink"}`}>
        {group.name}
      </p>
      <p className="break-words font-mono text-xs leading-5 text-shamba-ink-soft">{details}</p>
    </div>
  );
}

function LivestockGroupForm({
  farmId,
  group,
  plots,
  livestockTypes,
  onDone,
}: {
  farmId: string;
  group?: LivestockGroup;
  plots: FarmPlot[];
  livestockTypes: TypeOption[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [typeId, setTypeId] = useState(group?.livestock_type_id ?? "");
  const [name, setName] = useState(group?.name ?? "");
  const [headCount, setHeadCount] = useState(group?.head_count != null ? String(group.head_count) : "");
  const [startedOn, setStartedOn] = useState(group?.started_on ?? "");
  const [plotId, setPlotId] = useState(group?.plot_id ?? "");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const isLoading = status.kind === "loading";
  const idPrefix = group ? `livestock-${group.id}` : "new-livestock";

  // Picking a type fills an empty name with it ("Goats"), so the quickest
  // entry is one choice and Save; the farmer can still type their own.
  function handleTypeChange(nextTypeId: string) {
    setTypeId(nextTypeId);
    if (name.trim() === "") {
      const type = livestockTypes.find((candidate) => candidate.id === nextTypeId);
      if (type) setName(type.name);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isLoading) return;

    if (!typeId) {
      setStatus({ kind: "error", message: "Choose the type of livestock." });
      return;
    }
    const trimmedName = name.trim();
    if (!trimmedName) {
      setStatus({ kind: "error", message: "Give this group a name, like “Milking cows”." });
      return;
    }
    const count = parseHeadCount(headCount);
    if (!count.ok) {
      setStatus({ kind: "error", message: count.message });
      return;
    }
    const start = parseRecordDate(startedOn, { required: false, field: "start date" });
    if (!start.ok) {
      setStatus({ kind: "error", message: start.message });
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

      const fields = {
        livestock_type_id: typeId,
        name: trimmedName,
        head_count: count.value,
        started_on: start.value,
        plot_id: plotId || null,
      };
      const { error } = group
        ? await supabase.from("livestock_groups").update(fields).eq("id", group.id).eq("profile_id", user.id)
        : await supabase.from("livestock_groups").insert({ farm_id: farmId, profile_id: user.id, ...fields });

      if (error) {
        setStatus({
          kind: "error",
          message: farmRecordErrorMessage(error, "We couldn't save this livestock group. Please try again."),
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
        <label htmlFor={`${idPrefix}-type`} className={LABEL_CLASS}>
          Type of livestock
        </label>
        <select
          id={`${idPrefix}-type`}
          value={typeId}
          onChange={(event) => handleTypeChange(event.target.value)}
          required
          autoFocus
          disabled={isLoading}
          className={INPUT_CLASS}
        >
          <option value="">Choose a type</option>
          {livestockTypes.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${idPrefix}-name`} className={LABEL_CLASS}>
          Group name
        </label>
        <input
          id={`${idPrefix}-name`}
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={MAX_LIVESTOCK_NAME_LENGTH}
          placeholder="e.g. Milking cows"
          required
          disabled={isLoading}
          className={INPUT_CLASS}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${idPrefix}-count`} className={LABEL_CLASS}>
          How many <Optional />
        </label>
        <input
          id={`${idPrefix}-count`}
          type="text"
          inputMode="numeric"
          value={headCount}
          onChange={(event) => setHeadCount(event.target.value)}
          placeholder="e.g. 12"
          disabled={isLoading}
          className={INPUT_CLASS}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${idPrefix}-start`} className={LABEL_CLASS}>
          Kept since <Optional />
        </label>
        <input
          id={`${idPrefix}-start`}
          type="date"
          value={startedOn}
          onChange={(event) => setStartedOn(event.target.value)}
          min={MIN_RECORD_DATE}
          max={MAX_RECORD_DATE}
          disabled={isLoading}
          className={INPUT_CLASS}
        />
      </div>

      <PlotSelect id={`${idPrefix}-plot`} value={plotId} onChange={setPlotId} plots={plots} disabled={isLoading} />

      <FormError status={status} />
      <FormButtons isLoading={isLoading} submitLabel={group ? "Save livestock" : "Add livestock"} onCancel={onDone} />
    </form>
  );
}
