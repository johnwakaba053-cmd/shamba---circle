import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ArrowLeft, ClipboardList, MapPin } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { createClient } from "@/lib/supabase/server";
import {
  CROP_SEASON_COLUMNS,
  FARM_COLUMNS,
  LIVESTOCK_GROUP_COLUMNS,
  PLOT_COLUMNS,
  cropSeasonState,
  formatAcres,
  formatRecordDate,
  todayInKenya,
  tenureLabel,
  type CropSeason,
  type CropSeasonState,
  type Farm,
  type FarmPlot,
  type LivestockGroup,
  type TypeOption,
} from "@/lib/farmRecords";
import { PrintReportButton } from "./PrintReportButton";

export const metadata = { title: "Farm Records report · Shamba Space" };

type SectionKey = "profile" | "plots" | "seasons" | "livestock";
type SearchParams = Promise<{ farm?: string; section?: string | string[]; controls?: string; mode?: string }>;
type PageResult<T> = { data: T[] | null; error: unknown | null };

const REPORT_SECTIONS: { value: SectionKey; label: string }[] = [
  { value: "profile", label: "Farm profile" },
  { value: "plots", label: "Plots" },
  { value: "seasons", label: "Crop seasons" },
  { value: "livestock", label: "Livestock groups" },
];

const CROP_SEASON_STATE_LABELS: Record<CropSeasonState, string> = {
  planned: "Planned",
  growing: "Growing",
  ended: "Ended",
  archived: "Archived",
};

const PAGE_SIZE = 500;
const MAX_REPORT_ROWS = 20_000;

async function readAllRows<T>(
  page: (from: number, to: number) => PromiseLike<PageResult<T>>,
): Promise<{ rows: T[]; failed: boolean; capped: boolean }> {
  const rows: T[] = [];
  for (let from = 0; from <= MAX_REPORT_ROWS; from += PAGE_SIZE) {
    const result = await page(from, from + PAGE_SIZE - 1);
    if (result.error) return { rows, failed: true, capped: false };
    const batch = result.data ?? [];
    if (from === MAX_REPORT_ROWS) {
      return { rows, failed: false, capped: batch.length > 0 };
    }
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) return { rows, failed: false, capped: false };
  }
  // Do not quietly generate a partial report if a farm exceeds the
  // deliberately high safety bound.
  return { rows, failed: false, capped: true };
}

function generatedAtLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Nairobi",
  }).format(date) + " EAT";
}

function MissingData({ label }: { label: string }) {
  return <p className="text-sm text-shamba-rust">{label} could not be loaded. This report is incomplete; reload before saving it.</p>;
}

function parseSelectedSections(params: { section?: string | string[]; controls?: string }): Set<SectionKey> {
  if (params.controls !== "1") return new Set(REPORT_SECTIONS.map((section) => section.value));
  const values = Array.isArray(params.section) ? params.section : params.section ? [params.section] : [];
  return new Set(values.filter((value): value is SectionKey => REPORT_SECTIONS.some((section) => section.value === value)));
}

export default async function FarmRecordsReportPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const selectedSections = parseSelectedSections(params);
  const summaryMode = params.mode === "summary";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  const farmsResult = await readAllRows<Farm>((from, to) => supabase
    .from("farms")
    .select(FARM_COLUMNS)
    .eq("profile_id", user.id)
    .order("created_at", { ascending: true })
    .range(from, to));
  const farmsError = farmsResult.failed || farmsResult.capped;
  const activeFarms = farmsResult.rows.filter((farm) => farm.archived_at === null);
  const selectedFarm = activeFarms.find((farm) => farm.id === params.farm)
    ?? (activeFarms.length === 1 ? activeFarms[0] : null);

  let plots: FarmPlot[] = [];
  let seasons: CropSeason[] = [];
  let groups: LivestockGroup[] = [];
  let cropTypes: TypeOption[] = [];
  let livestockTypes: TypeOption[] = [];
  let countyName: string | null = null;
  let plotsError = false;
  let seasonsError = false;
  let groupsError = false;
  let cropTypesError = false;
  let livestockTypesError = false;
  let countyError = false;
  let plotsCapped = false;
  let seasonsCapped = false;
  let groupsCapped = false;
  let cropTypesCapped = false;
  let livestockTypesCapped = false;

  if (selectedFarm) {
    const [plotResult, seasonResult, groupResult, cropTypeResult, livestockTypeResult, countyResult] = await Promise.all([
      readAllRows<FarmPlot>((from, to) => supabase.from("farm_plots").select(PLOT_COLUMNS).eq("profile_id", user.id).eq("farm_id", selectedFarm.id).order("id").range(from, to)),
      readAllRows<CropSeason>((from, to) => supabase.from("crop_seasons").select(CROP_SEASON_COLUMNS).eq("profile_id", user.id).eq("farm_id", selectedFarm.id).order("started_on").order("id").range(from, to)),
      readAllRows<LivestockGroup>((from, to) => supabase.from("livestock_groups").select(LIVESTOCK_GROUP_COLUMNS).eq("profile_id", user.id).eq("farm_id", selectedFarm.id).order("name").order("id").range(from, to)),
      readAllRows<TypeOption>((from, to) => supabase.from("crop_types").select("id, name, category_id").order("name").range(from, to)),
      readAllRows<TypeOption>((from, to) => supabase.from("livestock_types").select("id, name, category_id").order("name").range(from, to)),
      supabase.from("counties").select("name").eq("id", selectedFarm.county_id).maybeSingle(),
    ]);
    plots = plotResult.rows;
    seasons = seasonResult.rows;
    groups = groupResult.rows;
    cropTypes = cropTypeResult.rows;
    livestockTypes = livestockTypeResult.rows;
    countyName = countyResult.data?.name ?? null;
    plotsError = plotResult.failed;
    seasonsError = seasonResult.failed;
    groupsError = groupResult.failed;
    cropTypesError = cropTypeResult.failed;
    livestockTypesError = livestockTypeResult.failed;
    plotsCapped = plotResult.capped;
    seasonsCapped = seasonResult.capped;
    groupsCapped = groupResult.capped;
    cropTypesCapped = cropTypeResult.capped;
    livestockTypesCapped = livestockTypeResult.capped;
    countyError = Boolean(countyResult.error);
  }

  const activePlots = plots.filter((plot) => plot.archived_at === null);
  const activeSeasons = seasons.filter((season) => season.archived_at === null);
  const activeGroups = groups.filter((group) => group.archived_at === null);
  const plotsById = new Map(plots.map((plot) => [plot.id, { name: plot.name, archived: plot.archived_at !== null }]));
  const cropName = new Map(cropTypes.map((item) => [item.id, item.name]));
  const livestockName = new Map(livestockTypes.map((item) => [item.id, item.name]));
  const today = todayInKenya();
  const cropSummary = new Map<string, number>();
  const cropStateSummary = new Map<CropSeasonState, number>();
  for (const season of activeSeasons) {
    const name = cropName.get(season.crop_type_id) ?? "Unknown crop";
    cropSummary.set(name, (cropSummary.get(name) ?? 0) + 1);
    const state = cropSeasonState(season, today);
    cropStateSummary.set(state, (cropStateSummary.get(state) ?? 0) + 1);
  }
  const livestockSummary = new Map<string, { groups: number; knownHead: number; unknown: number }>();
  for (const group of activeGroups) {
    const name = livestockName.get(group.livestock_type_id) ?? "Unknown type";
    const total = livestockSummary.get(name) ?? { groups: 0, knownHead: 0, unknown: 0 };
    total.groups += 1;
    if (group.head_count === null) total.unknown += 1;
    else total.knownHead += group.head_count;
    livestockSummary.set(name, total);
  }
  const generatedAt = generatedAtLabel(new Date());
  const reportHasErrors = Boolean(farmsError || plotsError || seasonsError || groupsError || cropTypesError || livestockTypesError || plotsCapped || seasonsCapped || groupsCapped || cropTypesCapped || livestockTypesCapped);
  const canPrint = selectedSections.size > 0 && !reportHasErrors;
  const retryParams = new URLSearchParams();
  if (selectedFarm) retryParams.set("farm", selectedFarm.id);
  retryParams.set("controls", "1");
  for (const section of selectedSections) retryParams.append("section", section);
  retryParams.set("mode", summaryMode ? "summary" : "detail");
  const retryHref = `/farm-records/reports?${retryParams.toString()}`;

  return (
    <div className="min-h-screen bg-shamba-bg text-shamba-ink">
      <div data-print-hide><AppHeader /></div>
      <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-6 sm:px-6 lg:px-10 lg:pt-10">
        <div data-print-hide className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Link href="/farm-records/dashboard" className="inline-flex min-h-11 items-center gap-2 font-sans text-sm font-semibold text-shamba-green hover:underline">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to Farm dashboard
          </Link>
          {selectedFarm && canPrint && <PrintReportButton />}
        </div>

        <header data-print-hide className="mb-5">
          <h1 className="font-display text-2xl font-bold leading-tight tracking-tight sm:text-3xl">Farm Records report</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-shamba-ink-soft">
            A private, current snapshot of the farm records saved in Shamba Space. Choose one farm, review the preview, then print or save it as a PDF.
          </p>
        </header>

        {farmsError ? (
          <div role="alert" className="rounded-2xl border border-shamba-rust/30 bg-shamba-card p-5">
            <MissingData label="Your farms" />
            <Link href="/farm-records/reports" className="mt-3 inline-flex min-h-11 items-center font-semibold text-shamba-green">Try again</Link>
          </div>
        ) : activeFarms.length === 0 ? (
          <div className="rounded-2xl border border-shamba-line bg-shamba-card p-6">
            <ClipboardList className="size-7 text-shamba-green" aria-hidden="true" />
            <h2 className="mt-3 font-display text-lg font-semibold">No active farms to report</h2>
            <p className="mt-1 text-sm leading-6 text-shamba-ink-soft">Add or restore a farm before creating a Farm Records snapshot.</p>
            <Link href="/farm-records" className="mt-4 inline-flex min-h-11 items-center font-semibold text-shamba-green">Open Farm Records</Link>
          </div>
        ) : (
          <>
            <form data-print-hide action="/farm-records/reports" method="get" className="mb-5 rounded-2xl border border-shamba-line bg-shamba-card p-4 sm:p-5">
              <input type="hidden" name="controls" value="1" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="min-w-0">
                <label htmlFor="report-farm" className="mb-1 block text-sm font-semibold">Farm for this report</label>
                <select id="report-farm" name="farm" defaultValue={selectedFarm?.id ?? ""} className="min-h-11 w-full rounded-shamba border border-shamba-line bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-shamba-green">
                  <option value="" disabled>Choose a farm</option>
                  {activeFarms.map((farm) => <option key={farm.id} value={farm.id}>{farm.name}</option>)}
                </select>
              </div>
                <div>
                  <label htmlFor="report-mode" className="mb-1 block text-sm font-semibold">Report layout</label>
                  <select id="report-mode" name="mode" defaultValue={summaryMode ? "summary" : "detail"} className="min-h-11 w-full rounded-shamba border border-shamba-line bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-shamba-green">
                    <option value="summary">Summary</option>
                    <option value="detail">Detailed records</option>
                  </select>
                </div>
                <fieldset className="sm:col-span-2">
                  <legend className="text-sm font-semibold">Sections to include</legend>
                  <p className="mt-1 text-xs text-shamba-ink-soft">Choose at least one section. Farm identity and report limitations stay on every report.</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {REPORT_SECTIONS.map((section) => (
                      <label key={section.value} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-shamba-line px-3 text-sm">
                        <input type="checkbox" name="section" value={section.value} defaultChecked={selectedSections.has(section.value)} className="size-4 accent-shamba-green" />
                        <span>{section.label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>
              <button type="submit" className="mt-4 min-h-11 w-full rounded-shamba border border-shamba-line px-4 text-sm font-semibold hover:border-shamba-green sm:w-auto">Preview report</button>
            </form>

            {!selectedFarm ? (
              <p className="rounded-2xl border border-shamba-line bg-shamba-card p-5 text-sm text-shamba-ink-soft">Choose a farm to build its report preview.</p>
            ) : selectedSections.size === 0 ? (
              <p role="status" className="rounded-2xl border border-shamba-line bg-shamba-card p-5 text-sm text-shamba-ink-soft">Select at least one report section, then choose Preview report.</p>
            ) : (
              <article className="report-sheet rounded-2xl border border-shamba-line bg-shamba-card p-5 shadow-sm sm:p-8">
                <div className="border-b border-shamba-line pb-5">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-shamba-green">Shamba Space · Farm Records</p>
                  <h2 className="mt-2 font-display text-2xl font-bold leading-tight sm:text-3xl">Current farm snapshot</h2>
                  <p className="mt-2 text-sm text-shamba-ink-soft">Generated {generatedAt}</p>
                  <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                    <span className="font-semibold">{selectedFarm.name}</span>
                    {countyName && <span className="inline-flex items-center gap-1 text-shamba-ink-soft"><MapPin className="size-3.5" aria-hidden="true" />{countyName} County</span>}
                    {countyError && <span className="text-shamba-rust">County could not be loaded</span>}
                  </div>
                  <p className="mt-3 rounded-xl bg-shamba-green/5 p-3 text-sm leading-5 text-shamba-ink-soft">
                    This is a current snapshot, not a report for a past date range or a measure of farm performance. Non-archived plots, crop seasons and livestock groups are included; archived rows are excluded.
                  </p>
                  {summaryMode && <p className="mt-3 text-sm font-semibold text-shamba-ink-soft">Summary view · grouped counts and recorded totals</p>}
                </div>

                {reportHasErrors && (
                  <div role="alert" className="my-5 flex gap-3 rounded-xl border border-shamba-rust/30 bg-shamba-rust/5 p-4">
                    <AlertTriangle className="mt-0.5 size-5 shrink-0 text-shamba-rust" aria-hidden="true" />
                    <div className="flex-1 text-sm leading-5">
                      <p className="font-semibold text-shamba-rust">This preview is incomplete</p>
                      <p className="mt-1 text-shamba-ink-soft">{[
                        (plotsError || plotsCapped) && (plotsCapped ? "more than 20,000 plots" : "plots"),
                        (seasonsError || seasonsCapped) && (seasonsCapped ? "more than 20,000 crop seasons" : "crop seasons"),
                        (groupsError || groupsCapped) && (groupsCapped ? "more than 20,000 livestock groups" : "livestock groups"),
                        (cropTypesError || cropTypesCapped) && "crop names",
                        (livestockTypesError || livestockTypesCapped) && "livestock names",
                      ].filter(Boolean).join(", ")} did not load completely. Do not use this preview as a complete report; the print button is unavailable.</p>
                      <Link data-print-hide href={retryHref} prefetch={false} className="mt-2 inline-flex min-h-11 items-center font-semibold text-shamba-green">Try again</Link>
                    </div>
                  </div>
                )}

                {selectedSections.has("profile") && <section className="report-section mt-6" aria-labelledby="farm-profile-heading">
                  <h3 id="farm-profile-heading" className="font-display text-lg font-bold">Farm profile</h3>
                  <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <ProfileValue label="Farm size" value={selectedFarm.size_acres === null ? "Not recorded" : formatAcres(selectedFarm.size_acres)} />
                    <ProfileValue label="Land tenure" value={selectedFarm.tenure ? tenureLabel(selectedFarm.tenure) : "Not recorded"} />
                    <ProfileValue label="Location" value={selectedFarm.location_text || "Not recorded"} />
                  </dl>
                </section>}

                {selectedSections.has("plots") && <section className="report-section mt-7" aria-labelledby="plots-heading">
                  <h3 id="plots-heading" className="font-display text-lg font-bold">Plots <span className="text-sm font-medium text-shamba-ink-soft">({plotsError ? "not available" : `${activePlots.length} active`})</span></h3>
                  {plotsError ? <MissingData label="Plots" /> : summaryMode ? (
                    <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <ProfileValue label="Active plots" value={activePlots.length.toLocaleString("en-KE")} />
                      <ProfileValue label="Active plots without recorded area" value={activePlots.filter((plot) => plot.size_acres === null).length.toLocaleString("en-KE")} />
                    </dl>
                  ) : activePlots.length === 0 ? <p className="mt-2 text-sm text-shamba-ink-soft">No active plots are recorded.</p> : (
                    <div className="report-table-wrap mt-3 overflow-x-auto rounded-xl border border-shamba-line">
                      <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
                        <thead className="bg-shamba-bg text-xs uppercase tracking-wide text-shamba-ink-soft"><tr><th className="p-3">Plot</th><th className="p-3">Recorded area</th></tr></thead>
                        <tbody>{activePlots.map((plot) => <tr key={plot.id} className="border-t border-shamba-line"><td className="p-3 font-medium">{plot.name}</td><td className="p-3">{plot.size_acres === null ? "Not recorded" : formatAcres(plot.size_acres)}</td></tr>)}</tbody>
                      </table>
                    </div>
                  )}
                </section>}

                {selectedSections.has("seasons") && <section className="report-section mt-7" aria-labelledby="seasons-heading">
                  <h3 id="seasons-heading" className="font-display text-lg font-bold">Crop seasons <span className="text-sm font-medium text-shamba-ink-soft">({seasonsError ? "not available" : `${activeSeasons.length} non-archived`})</span></h3>
                  {seasonsError ? <MissingData label="Crop seasons" /> : summaryMode ? (
                    <>
                      <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <ProfileValue label="Non-archived crop seasons" value={activeSeasons.length.toLocaleString("en-KE")} />
                        <ProfileValue label="Seasons without recorded area" value={activeSeasons.filter((season) => season.area_acres === null).length.toLocaleString("en-KE")} />
                      </dl>
                      {cropStateSummary.size > 0 && <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">{(["planned", "growing", "ended"] as const).filter((state) => cropStateSummary.has(state)).map((state) => <li key={state} className="rounded-xl border border-shamba-line p-3 text-sm"><span className="font-medium">{CROP_SEASON_STATE_LABELS[state]}</span><span className="float-right text-shamba-ink-soft">{cropStateSummary.get(state)} {cropStateSummary.get(state) === 1 ? "season" : "seasons"}</span></li>)}</ul>}
                      {cropSummary.size > 0 && <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">{[...cropSummary].sort(([a], [b]) => a.localeCompare(b)).map(([name, count]) => <li key={name} className="rounded-xl border border-shamba-line p-3 text-sm"><span className="font-medium">{name}</span><span className="float-right text-shamba-ink-soft">{count} {count === 1 ? "season" : "seasons"}</span></li>)}</ul>}
                    </>
                  ) : activeSeasons.length === 0 ? <p className="mt-2 text-sm text-shamba-ink-soft">No active crop seasons are recorded.</p> : (
                    <div className="report-table-wrap mt-3 overflow-x-auto rounded-xl border border-shamba-line">
                      <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
                        <thead className="bg-shamba-bg text-xs uppercase tracking-wide text-shamba-ink-soft"><tr><th className="p-3">Crop / season</th><th className="p-3">Plot</th><th className="p-3">Dates</th><th className="p-3">Recorded area</th></tr></thead>
                        <tbody>{activeSeasons.map((season) => {
                          const plot = season.plot_id ? plotsById.get(season.plot_id) : null;
                          const state = cropSeasonState(season, today);
                          return <tr key={season.id} className="border-t border-shamba-line align-top"><td className="p-3 font-medium">{cropName.get(season.crop_type_id) ?? (cropTypesError ? "Crop name unavailable" : "Unknown crop")}{season.label && <span className="block text-xs font-normal text-shamba-ink-soft">{season.label}</span>}<span className="mt-1 block text-xs font-normal text-shamba-ink-soft">{CROP_SEASON_STATE_LABELS[state]}</span></td><td className="p-3">{season.plot_id ? plot ? <>{plot.name}{plot.archived && <span className="block text-xs text-shamba-ink-soft">Archived plot</span>}</> : "Plot not available" : "Whole farm"}</td><td className="p-3">{formatRecordDate(season.started_on)}{season.ended_on ? ` - ${formatRecordDate(season.ended_on)}` : " - Ongoing"}</td><td className="p-3">{season.area_acres === null ? "Not recorded" : formatAcres(season.area_acres)}<span className="block text-xs text-shamba-ink-soft">season area, not harvested area</span></td></tr>;
                        })}</tbody>
                      </table>
                    </div>
                  )}
                </section>}

                {selectedSections.has("livestock") && <section className="report-section mt-7" aria-labelledby="livestock-heading">
                  <h3 id="livestock-heading" className="font-display text-lg font-bold">Livestock groups <span className="text-sm font-medium text-shamba-ink-soft">({groupsError ? "not available" : `${activeGroups.length} active`})</span></h3>
                  {groupsError ? <MissingData label="Livestock groups" /> : activeGroups.length === 0 ? <p className="mt-2 text-sm text-shamba-ink-soft">No active livestock groups are recorded.</p> : (
                    <>
                      {summaryMode ? <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">{[...livestockSummary].sort(([a], [b]) => a.localeCompare(b)).map(([name, summary]) => <li key={name} className="rounded-xl border border-shamba-line p-3 text-sm"><span className="font-medium">{name}</span><span className="mt-1 block text-shamba-ink-soft">{summary.groups} {summary.groups === 1 ? "group" : "groups"} · {summary.knownHead.toLocaleString("en-KE")} known head · {summary.unknown} uncounted</span></li>)}</ul> : <div className="report-table-wrap mt-3 overflow-x-auto rounded-xl border border-shamba-line">
                        <table className="w-full min-w-[30rem] border-collapse text-left text-sm">
                          <thead className="bg-shamba-bg text-xs uppercase tracking-wide text-shamba-ink-soft"><tr><th className="p-3">Group</th><th className="p-3">Type</th><th className="p-3">Plot</th><th className="p-3">Since</th><th className="p-3">Head count</th></tr></thead>
                          <tbody>{activeGroups.map((group) => {
                            const plot = group.plot_id ? plotsById.get(group.plot_id) : null;
                            return <tr key={group.id} className="border-t border-shamba-line"><td className="p-3 font-medium">{group.name}</td><td className="p-3">{livestockName.get(group.livestock_type_id) ?? (livestockTypesError ? "Type unavailable" : "Unknown type")}</td><td className="p-3">{group.plot_id ? plot ? <>{plot.name}{plot.archived && <span className="block text-xs text-shamba-ink-soft">Archived plot</span>}</> : "Plot not available" : "Whole farm"}</td><td className="p-3">{group.started_on ? formatRecordDate(group.started_on) : "Not recorded"}</td><td className="p-3">{group.head_count === null ? "Not recorded" : group.head_count.toLocaleString("en-KE")}</td></tr>;
                          })}</tbody>
                        </table>
                      </div>}
                    </>
                  )}
                  <p className="mt-2 text-xs leading-5 text-shamba-ink-soft">These are current group records, not a historical census or individual-animal health history.</p>
                </section>}

                <section className="report-section mt-7 border-t border-shamba-line pt-5" aria-labelledby="coverage-heading">
                  <h3 id="coverage-heading" className="font-display text-base font-bold">Coverage and limitations</h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-5 text-shamba-ink-soft">
                    <li>Archived plots: {plotsError ? "not counted because plots did not load" : plots.length - activePlots.length}; archived crop seasons: {seasonsError ? "not counted because seasons did not load" : seasons.length - activeSeasons.length}; archived livestock groups: {groupsError ? "not counted because groups did not load" : groups.length - activeGroups.length}. These are excluded from the tables above.</li>
                    <li>Area is shown only where recorded; missing area is not treated as zero. Crop-season area is not actual harvested area, so no yield is calculated.</li>
                    <li>Crop activity events and livestock treatment, feeding or observation events are not included. This report does not filter activity by a reporting period.</li>
                    <li>This snapshot does not include income or profit, expenses, inventory balances, sales or deliveries, workforce attendance, individual-animal histories, assets, insurance, or farm incidents.</li>
                    <li>No report data is stored by Shamba Space. The PDF is created by your browser&apos;s print/save feature when you choose the button.</li>
                  </ul>
                </section>
              </article>
            )}
          </>
        )}
      </main>
      <style>{`
        @page { size: A4; margin: 14mm 13mm 18mm; @bottom-right { content: "Page " counter(page); color: #62685f; font: 9pt sans-serif; } }
        @media print {
          body { background: #fff !important; }
          [data-print-hide] { display: none !important; }
          main { max-width: none !important; padding: 0 !important; }
          .report-sheet { border: 0 !important; border-radius: 0 !important; box-shadow: none !important; padding: 0 !important; }
          .report-section { break-inside: auto; }
          h2, h3 { break-after: avoid; }
          table { break-inside: auto; }
          .report-table-wrap { overflow: visible !important; border-color: #d4d8d1 !important; }
          .report-sheet table { width: 100% !important; min-width: 0 !important; table-layout: fixed; }
          .report-sheet th, .report-sheet td { padding: 5pt !important; font-size: 8.5pt !important; overflow-wrap: anywhere; }
          tr { break-inside: avoid; break-after: auto; }
          thead { display: table-header-group; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
}

function ProfileValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-shamba-bg p-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-shamba-ink-soft">{label}</dt>
      <dd className="mt-1 break-words text-sm font-semibold">{value}</dd>
    </div>
  );
}
