import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import {
  CROP_SEASON_COLUMNS,
  FARM_COLUMNS,
  PLOT_COLUMNS,
  cropSeasonDates,
  cropSeasonState,
  formatAcres,
  todayInKenya,
  type CropSeason,
  type CropSeasonState,
  type Farm,
  type FarmPlot,
} from "@/lib/farmRecords";
import {
  CROP_ACTIVITY_SUBJECT_MODES,
  FARM_ACTIVITY_COLUMNS,
  formatKes,
  formatQuantity,
  isMissingTableError,
  splitActivities,
  type ActivityKind,
  type FarmActivity,
  type InputCategory,
  type MeasurementUnit,
} from "@/lib/farmActivities";
import { LoadErrorCard } from "../../../LoadErrorCard";
import { CropActivities } from "./CropActivities";

export const metadata = { title: "Crop season · Shamba Space" };

const STATE_BADGE: Record<CropSeasonState, { label: string; className: string }> = {
  growing: { label: "Growing", className: "bg-shamba-green/15 text-shamba-green-deep" },
  planned: { label: "Planned", className: "bg-shamba-blue/15 text-shamba-ink" },
  ended: { label: "Ended", className: "bg-shamba-ink/10 text-shamba-ink" },
  archived: { label: "Archived", className: "bg-shamba-ink/10 text-shamba-ink-soft" },
};

type KindRow = ActivityKind & { subject_mode: string; is_active: boolean };
type ActiveRow = { is_active: boolean };

// One crop season and the work done on it. Everything shown comes from
// the farmer's own records; RLS returns only the caller's farm, season
// and activities, so anyone else's id is simply not found.
export default async function CropSeasonPage({
  params,
}: {
  params: Promise<{ farmId: string; seasonId: string }>;
}) {
  const { farmId, seasonId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const [
    { data: farmData, error: farmError },
    { data: seasonData, error: seasonError },
    { data: plotsData, error: plotsError },
    { data: cropTypesData },
    { data: kindsData, error: kindsError },
    { data: inputsData, error: inputsError },
    { data: unitsData, error: unitsError },
    { data: activitiesData, error: activitiesError },
  ] = await Promise.all([
    supabase.from("farms").select(FARM_COLUMNS).eq("id", farmId).eq("profile_id", user.id).maybeSingle(),
    supabase
      .from("crop_seasons")
      .select(CROP_SEASON_COLUMNS)
      .eq("id", seasonId)
      .eq("farm_id", farmId)
      .eq("profile_id", user.id)
      .maybeSingle(),
    supabase.from("farm_plots").select(PLOT_COLUMNS).eq("farm_id", farmId).eq("profile_id", user.id),
    supabase.from("crop_types").select("id, name"),
    supabase.from("farm_record_kinds").select("id, name, input_mode, subject_mode, is_active").order("sort_order", { ascending: true }),
    supabase.from("input_categories").select("id, name, is_active").order("sort_order", { ascending: true }),
    supabase.from("measurement_units").select("id, name, dimension, is_active").order("sort_order", { ascending: true }),
    supabase
      .from("farm_records")
      .select(FARM_ACTIVITY_COLUMNS)
      .eq("crop_season_id", seasonId)
      .eq("profile_id", user.id)
      .order("occurred_on", { ascending: true }),
  ]);

  const farmHref = `/farm-records/${encodeURIComponent(farmId)}`;
  const selfHref = `${farmHref}/crops/${encodeURIComponent(seasonId)}`;

  if (farmError || seasonError) {
    return (
      <Shell backHref={`${farmHref}#crops`} backLabel="Back to the farm">
        <LoadErrorCard
          title="We couldn't load this crop."
          detail="Check your connection and try again. Your farm records are not affected."
          retryHref={selfHref}
        />
      </Shell>
    );
  }

  // No such farm or season for this user -- or crop activities aren't in
  // the database yet (FR-1a not applied), in which case the page doesn't
  // exist either; the farm page doesn't link here until it does.
  if (!farmData || !seasonData || isMissingTableError(activitiesError)) {
    notFound();
  }

  const farm = farmData as Farm;
  const season = seasonData as CropSeason;
  const plots = (plotsData ?? []) as FarmPlot[];
  const today = todayInKenya();
  const state = cropSeasonState(season, today);
  const cropName = ((cropTypesData ?? []) as { id: string; name: string }[]).find((type) => type.id === season.crop_type_id)?.name ?? "Crop";
  const allKinds = (kindsData ?? []) as KindRow[];
  const allInputs = (inputsData ?? []) as (InputCategory & ActiveRow)[];
  const allUnits = (unitsData ?? []) as (MeasurementUnit & ActiveRow)[];
  const referenceFailed = Boolean(kindsError || inputsError || unitsError);
  const activities = (activitiesData ?? []) as FarmActivity[];
  const { current } = splitActivities(activities);

  // New activities only under an active farm and season (the database
  // refuses the rest too).
  const readOnlyReason =
    farm.archived_at !== null
      ? "This farm is archived. Restore it to add or change activities."
      : state === "archived"
        ? "This crop is archived. Restore it on the farm page to add or change activities."
        : null;

  // Season totals from the saved activities -- only what was recorded.
  const recordedCosts = current.filter((activity) => activity.cost_kes !== null);
  const totalCost = recordedCosts.reduce((sum, activity) => sum + Number(activity.cost_kes), 0);
  const harvested = new Map<string, number>();
  for (const activity of current) {
    if (activity.kind_id === "harvest" && activity.quantity !== null && activity.quantity_unit_id !== null) {
      harvested.set(activity.quantity_unit_id, (harvested.get(activity.quantity_unit_id) ?? 0) + Number(activity.quantity));
    }
  }

  const facts = [
    { label: "Farm", value: farm.name, href: farmHref },
    { label: "Where", value: plotsError ? "Plot didn't load" : whereLabel(season.plot_id, plots) },
    { label: state === "planned" ? "Planting" : "Season", value: cropSeasonDates(season, today) },
    { label: "Area", value: season.area_acres !== null ? formatAcres(season.area_acres) : "Not recorded" },
  ];
  const badge = STATE_BADGE[state];

  return (
    <Shell backHref={`${farmHref}#crops`} backLabel={`Back to ${farm.name}`}>
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1">
        <h1 className="break-words font-display text-2xl font-bold leading-tight tracking-tight text-shamba-ink">
          {cropName}
          {season.label && <span className="font-normal text-shamba-ink-soft"> · {season.label}</span>}
        </h1>
        <span className={`rounded-full px-2.5 py-0.5 font-sans text-xs font-semibold ${badge.className}`}>{badge.label}</span>
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 rounded-shamba border border-shamba-line bg-shamba-card p-4 sm:grid-cols-2">
        {facts.map((fact) => (
          <div key={fact.label} className="flex items-baseline justify-between gap-3 text-sm sm:flex-col sm:justify-start sm:gap-0.5">
            <dt className="text-shamba-ink-soft">{fact.label}</dt>
            <dd className="text-right font-semibold text-shamba-ink sm:text-left">
              {fact.href ? (
                <Link href={fact.href} className="text-shamba-green hover:underline">
                  {fact.value}
                </Link>
              ) : (
                fact.value
              )}
            </dd>
          </div>
        ))}
      </dl>

      {!activitiesError && current.length > 0 && !referenceFailed && (
        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Total label="Activities" value={String(current.length)} />
          <Total
            label="Recorded costs"
            value={recordedCosts.length > 0 ? formatKes(totalCost) : "None recorded"}
            note={recordedCosts.length > 0 ? `from ${recordedCosts.length} of ${current.length}` : undefined}
          />
          <Total
            label="Harvested"
            value={harvested.size > 0 ? [...harvested].map(([unit, amount]) => formatQuantity(amount, unit, allUnits)).join(", ") : "None recorded"}
          />
        </dl>
      )}

      <section aria-labelledby="activities-heading" className="mt-6 rounded-shamba border border-shamba-line bg-shamba-card p-4">
        <h2 id="activities-heading" className="font-display text-base font-semibold text-shamba-ink">
          Activities
        </h2>
        {activitiesError ? (
          <LoadErrorCard
            title="Your activities didn't load."
            detail="Check your connection and try again. Nothing has been lost."
            retryHref={selfHref}
          />
        ) : referenceFailed ? (
          <LoadErrorCard
            title="Activity types didn't load."
            detail="Your activities are safe, but they can't be shown or added until the activity types load."
            retryHref={selfHref}
          />
        ) : (
          <CropActivities
            farmId={farm.id}
            seasonId={season.id}
            activities={activities}
            kinds={allKinds}
            formKinds={allKinds.filter((kind) => kind.is_active && CROP_ACTIVITY_SUBJECT_MODES.includes(kind.subject_mode))}
            inputCategories={allInputs}
            formInputCategories={allInputs.filter((category) => category.is_active)}
            units={allUnits}
            formUnits={allUnits.filter((unit) => unit.is_active)}
            today={today}
            readOnlyReason={readOnlyReason}
          />
        )}
      </section>
    </Shell>
  );
}

function Shell({ backHref, backLabel, children }: { backHref: string; backLabel: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col bg-shamba-bg">
      <AppHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-4 pb-20 pt-8 sm:px-10 sm:pt-12">
        <div className="w-full max-w-2xl">
          <Link
            href={backHref}
            className="relative inline-flex items-center gap-2 font-sans text-sm font-semibold text-shamba-ink-soft transition-colors hover:text-shamba-ink touch-target"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            {backLabel}
          </Link>
          {children}
        </div>
      </main>
    </div>
  );
}

// recordParts' plotLabel lives in a client module, so the server page
// has its own copy of the same wording.
function whereLabel(plotId: string | null, plots: FarmPlot[]): string {
  if (plotId === null) return "Whole farm";
  const plot = plots.find((candidate) => candidate.id === plotId);
  if (!plot) return "Plot";
  return plot.archived_at === null ? plot.name : `${plot.name} (archived plot)`;
}

function Total({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-shamba border border-shamba-line bg-shamba-card p-3 last:col-span-2 sm:last:col-span-1">
      <dt className="order-last text-xs text-shamba-ink-soft">
        {label}
        {note && <span className="block">{note}</span>}
      </dt>
      <dd className="break-words font-display text-lg font-bold leading-tight text-shamba-ink">{value}</dd>
    </div>
  );
}
