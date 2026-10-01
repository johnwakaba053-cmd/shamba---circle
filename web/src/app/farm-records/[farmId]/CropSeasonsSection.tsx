"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, Loader2, Pencil, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  MAX_CROP_LABEL_LENGTH,
  MAX_RECORD_DATE,
  MIN_RECORD_DATE,
  cropSeasonDates,
  cropSeasonState,
  farmRecordErrorMessage,
  formatAcres,
  parseAcres,
  parseRecordDate,
  todayInKenya,
  type CropSeason,
  type FarmPlot,
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

// What is grown on this farm, one crop season at a time. A season can be
// on one plot or the whole farm (plots are optional). Its state --
// Planned, Growing, Ended or Archived -- is derived from its dates and
// today's date in Kenya (cropSeasonState), never stored. Create, edit,
// end and archive all happen in place, like plots.
//
// Authorization is crop_seasons' RLS (profile_id = auth.uid()) plus the
// composite foreign keys to farms and farm_plots; the database also
// refuses new seasons on an archived farm or plot.
//
// `today` comes from the server render so the server and the browser
// group seasons the same way.
export function CropSeasonsSection({
  farmId,
  seasons,
  plots,
  cropTypes,
  farmArchived,
  today,
}: {
  farmId: string;
  seasons: CropSeason[];
  plots: FarmPlot[];
  cropTypes: TypeOption[];
  farmArchived: boolean;
  today: string;
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const inState = (state: ReturnType<typeof cropSeasonState>) =>
    seasons.filter((season) => cropSeasonState(season, today) === state);
  const growing = inState("growing");
  // Soonest first: the next planting is what the farmer needs to see.
  const planned = inState("planned").sort((x, y) => x.started_on.localeCompare(y.started_on));
  const ended = inState("ended");
  const archived = inState("archived");

  const cropName = (id: string) => cropTypes.find((type) => type.id === id)?.name ?? id;

  const renderRow = (season: CropSeason) =>
    editingId === season.id ? (
      <li key={season.id} className="py-3">
        <CropSeasonForm
          farmId={farmId}
          season={season}
          plots={plots}
          cropTypes={cropTypes}
          onDone={() => setEditingId(null)}
        />
      </li>
    ) : (
      <li key={season.id} className="py-2">
        <CropSeasonSummary season={season} cropName={cropName(season.crop_type_id)} plots={plots} today={today} />
        {!farmArchived && (
          <div className="-ml-2 mt-1 flex flex-wrap items-start gap-x-1">
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setEditingId(season.id);
              }}
              aria-label={`Edit ${cropName(season.crop_type_id)}`}
              className="inline-flex min-h-11 items-center gap-1.5 px-2 font-sans text-xs font-semibold text-shamba-ink-soft transition-colors hover:text-shamba-ink"
            >
              <Pencil className="size-4" aria-hidden="true" />
              Edit
            </button>
            {cropSeasonState(season, today) === "growing" && (
              <EndSeasonButton season={season} cropName={cropName(season.crop_type_id)} />
            )}
            <RecordArchiveButton
              table="crop_seasons"
              recordId={season.id}
              recordName={seasonName(cropName(season.crop_type_id), season)}
              isArchived={false}
            />
          </div>
        )}
      </li>
    );

  return (
    <section className="mt-6 rounded-shamba border border-shamba-line bg-shamba-card p-4">
      <h2 className="font-display text-base font-semibold text-shamba-ink">Crops</h2>

      {growing.length === 0 && planned.length === 0 && ended.length === 0 && !adding && (
        <p className="mt-1 text-sm leading-5 text-shamba-ink-soft">
          No crops yet. Add each crop you plant, like maize for the long
          rains, to keep track of your seasons.
        </p>
      )}

      {growing.length > 0 && (
        <>
          <h3 className="mt-3 font-mono text-xs font-medium uppercase tracking-wider text-shamba-ink-soft">
            Growing now
          </h3>
          <ul className="flex flex-col divide-y divide-shamba-line">{growing.map(renderRow)}</ul>
        </>
      )}

      {planned.length > 0 && (
        <>
          <h3 className="mt-3 font-mono text-xs font-medium uppercase tracking-wider text-shamba-ink-soft">
            Planned
          </h3>
          <ul className="flex flex-col divide-y divide-shamba-line">{planned.map(renderRow)}</ul>
        </>
      )}

      {!farmArchived &&
        (adding ? (
          <div className="mt-3 border-t border-shamba-line pt-3">
            <CropSeasonForm farmId={farmId} plots={plots} cropTypes={cropTypes} onDone={() => setAdding(false)} />
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
            Add a crop
          </button>
        ))}

      {ended.length > 0 && (
        <details className="mt-3 border-t border-shamba-line pt-3">
          <summary className="cursor-pointer font-sans text-sm font-semibold text-shamba-ink-soft hover:text-shamba-ink">
            Ended seasons ({ended.length})
          </summary>
          <ul className="mt-2 flex flex-col divide-y divide-shamba-line">{ended.map(renderRow)}</ul>
        </details>
      )}

      {archived.length > 0 && (
        <details className="mt-3 border-t border-shamba-line pt-3">
          <summary className="cursor-pointer font-sans text-sm font-semibold text-shamba-ink-soft hover:text-shamba-ink">
            Archived crops ({archived.length})
          </summary>
          <ul className="mt-2 flex flex-col divide-y divide-shamba-line">
            {archived.map((season) => (
              <li key={season.id} className="flex items-start justify-between gap-3 py-2">
                <CropSeasonSummary
                  season={season}
                  cropName={cropName(season.crop_type_id)}
                  plots={plots}
                  today={today}
                  muted
                />
                {!farmArchived && (
                  <RecordArchiveButton
                    table="crop_seasons"
                    recordId={season.id}
                    recordName={seasonName(cropName(season.crop_type_id), season)}
                    isArchived
                  />
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

// "Maize" or "Maize · Long rains 2026".
function seasonName(cropName: string, season: CropSeason): string {
  return season.label ? `${cropName} · ${season.label}` : cropName;
}

function CropSeasonSummary({
  season,
  cropName,
  plots,
  today,
  muted = false,
}: {
  season: CropSeason;
  cropName: string;
  plots: FarmPlot[];
  today: string;
  muted?: boolean;
}) {
  const details = [cropSeasonDates(season, today), plotLabel(season.plot_id, plots), season.area_acres !== null ? formatAcres(season.area_acres) : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="min-w-0">
      <p className={`break-words font-sans text-base ${muted ? "text-shamba-ink-soft" : "font-semibold text-shamba-ink"}`}>
        {cropName}
        {season.label && <span className="font-normal text-shamba-ink-soft"> · {season.label}</span>}
      </p>
      <p className="break-words font-mono text-xs leading-5 text-shamba-ink-soft">{details}</p>
    </div>
  );
}

function CropSeasonForm({
  farmId,
  season,
  plots,
  cropTypes,
  onDone,
}: {
  farmId: string;
  season?: CropSeason;
  plots: FarmPlot[];
  cropTypes: TypeOption[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [cropTypeId, setCropTypeId] = useState(season?.crop_type_id ?? "");
  const [label, setLabel] = useState(season?.label ?? "");
  const [startedOn, setStartedOn] = useState(season?.started_on ?? todayInKenya());
  const [endedOn, setEndedOn] = useState(season?.ended_on ?? "");
  const [areaAcres, setAreaAcres] = useState(season?.area_acres != null ? String(season.area_acres) : "");
  const [plotId, setPlotId] = useState(season?.plot_id ?? "");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const isLoading = status.kind === "loading";
  const idPrefix = season ? `crop-${season.id}` : "new-crop";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isLoading) return;

    if (!cropTypeId) {
      setStatus({ kind: "error", message: "Choose the crop." });
      return;
    }
    const start = parseRecordDate(startedOn, { required: true, field: "start date" });
    if (!start.ok) {
      setStatus({ kind: "error", message: start.message });
      return;
    }
    const end = parseRecordDate(endedOn, { required: false, field: "end date" });
    if (!end.ok) {
      setStatus({ kind: "error", message: end.message });
      return;
    }
    if (end.value !== null && start.value !== null && end.value < start.value) {
      setStatus({ kind: "error", message: "The end date can't be before the start date." });
      return;
    }
    const area = parseAcres(areaAcres, "Area");
    if (!area.ok) {
      setStatus({ kind: "error", message: area.message });
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
        crop_type_id: cropTypeId,
        label: label.trim() || null,
        started_on: start.value,
        ended_on: end.value,
        area_acres: area.value,
        plot_id: plotId || null,
      };
      const { error } = season
        ? await supabase.from("crop_seasons").update(fields).eq("id", season.id).eq("profile_id", user.id)
        : await supabase.from("crop_seasons").insert({ farm_id: farmId, profile_id: user.id, ...fields });

      if (error) {
        setStatus({ kind: "error", message: farmRecordErrorMessage(error, "We couldn't save this crop. Please try again.") });
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
          Crop
        </label>
        <select
          id={`${idPrefix}-type`}
          value={cropTypeId}
          onChange={(event) => setCropTypeId(event.target.value)}
          required
          autoFocus
          disabled={isLoading}
          className={INPUT_CLASS}
        >
          <option value="">Choose a crop</option>
          {cropTypes.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${idPrefix}-label`} className={LABEL_CLASS}>
          Season name <Optional />
        </label>
        <input
          id={`${idPrefix}-label`}
          type="text"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          maxLength={MAX_CROP_LABEL_LENGTH}
          placeholder="e.g. Long rains 2026"
          disabled={isLoading}
          className={INPUT_CLASS}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${idPrefix}-start`} className={LABEL_CLASS}>
          Planted or started on
        </label>
        <input
          id={`${idPrefix}-start`}
          type="date"
          value={startedOn}
          onChange={(event) => setStartedOn(event.target.value)}
          min={MIN_RECORD_DATE}
          max={MAX_RECORD_DATE}
          required
          disabled={isLoading}
          className={INPUT_CLASS}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${idPrefix}-end`} className={LABEL_CLASS}>
          Ended on <Optional />
        </label>
        <input
          id={`${idPrefix}-end`}
          type="date"
          value={endedOn}
          onChange={(event) => setEndedOn(event.target.value)}
          min={MIN_RECORD_DATE}
          max={MAX_RECORD_DATE}
          disabled={isLoading}
          className={INPUT_CLASS}
        />
        <p className="text-xs leading-5 text-shamba-ink-soft">Leave empty while the crop is still growing.</p>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${idPrefix}-area`} className={LABEL_CLASS}>
          Area in acres <Optional />
        </label>
        <input
          id={`${idPrefix}-area`}
          type="text"
          inputMode="decimal"
          value={areaAcres}
          onChange={(event) => setAreaAcres(event.target.value)}
          placeholder="e.g. 0.5"
          disabled={isLoading}
          className={INPUT_CLASS}
        />
      </div>

      <PlotSelect id={`${idPrefix}-plot`} value={plotId} onChange={setPlotId} plots={plots} disabled={isLoading} />

      <FormError status={status} />
      <FormButtons isLoading={isLoading} submitLabel={season ? "Save crop" : "Add crop"} onCancel={onDone} />
    </form>
  );
}

// Ends a growing season today. A season that starts after today can't end
// today, so that case points to Edit instead of failing in the database.
function EndSeasonButton({ season, cropName }: { season: CropSeason; cropName: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const isLoading = status.kind === "loading";

  async function handleEnd() {
    if (isLoading) return;

    const today = todayInKenya();
    if (season.started_on > today) {
      setStatus({ kind: "error", message: "This season starts after today. Use Edit to set its dates." });
      return;
    }
    if (!window.confirm(`End the ${seasonName(cropName, season)} season today? You can change the date later with Edit.`)) {
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

      const { error } = await supabase
        .from("crop_seasons")
        .update({ ended_on: today })
        .eq("id", season.id)
        .eq("profile_id", user.id);

      if (error) {
        setStatus({ kind: "error", message: farmRecordErrorMessage(error, "Couldn't end the season. Try again.") });
        return;
      }

      setStatus({ kind: "idle" });
      router.refresh();
    } catch {
      setStatus({ kind: "error", message: "Couldn't end the season. Try again." });
    }
  }

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={handleEnd}
        disabled={isLoading}
        className="inline-flex min-h-11 items-center gap-1.5 px-2 font-sans text-xs font-semibold text-shamba-ink-soft transition-colors hover:text-shamba-ink disabled:opacity-70"
      >
        {isLoading ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <CalendarCheck className="size-4" aria-hidden="true" />
        )}
        End season
      </button>
      {status.kind === "error" && (
        <p role="alert" className="max-w-56 px-2 text-xs font-semibold text-shamba-rust">
          {status.message}
        </p>
      )}
    </div>
  );
}
