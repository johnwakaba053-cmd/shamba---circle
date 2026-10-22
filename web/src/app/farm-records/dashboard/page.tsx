import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  History,
  LandPlot,
  MapPin,
  PawPrint,
  Sprout,
  TrendingDown,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import {
  CROP_SEASON_COLUMNS,
  FARM_COLUMNS,
  LIVESTOCK_GROUP_COLUMNS,
  PLOT_COLUMNS,
  formatAcres,
  formatRecordDate,
  todayInKenya,
  type Farm,
  type TypeOption,
} from "@/lib/farmRecords";
import { isMissingTableError } from "@/lib/farmActivities";
import {
  DASHBOARD_ACTIVITY_COLUMNS,
  DASHBOARD_RANGES,
  buildFarmDashboard,
  parseRange,
  rangeStart,
  type DashboardCropActivity,
  type DashboardGroup,
  type DashboardPlot,
  type DashboardSeason,
  type LivestockSlice,
} from "@/lib/farmDashboard";
import { DashboardCard, EmptyLine } from "../../my-farm/DashboardCard";
import { LoadErrorCard } from "../LoadErrorCard";
import { DashboardControls } from "./DashboardControls";
import { DashboardSidebar, FarmSummaryList, ModuleShortcuts } from "./DashboardNav";
import { QuickAdd } from "./QuickAdd";

export const metadata = { title: "Farm dashboard · Shamba Space" };

// Categorical slots for the livestock composition bar, in fixed order
// (largest type first), checked with the dataviz palette validator on the
// card background. Brand hues are too muted to tell apart as categories.
// Slices always carry a written name and count, so colour is never the
// only label. A fifth or later type folds into a grey "Other".
const SLICE_COLOURS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100"];
const OTHER_COLOUR = "#8f9487";

// Farm Records dashboard: a summary of the farmer's own records, for all
// active farms or one. Every number comes from saved farms, plots, crop
// seasons, livestock groups and -- once the farm activity log is in the
// database -- crop activities (lib/farmDashboard). Money, inventory,
// tasks and livestock or whole-farm diary entries aren't recorded in the
// app yet, so those parts say so instead of showing figures.
export default async function FarmDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ farm?: string; range?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const range = parseRange(params.range);
  const today = todayInKenya();
  const from = rangeStart(today, range);

  // Current crop activities in the period, newest first (capped: the
  // dashboard only shows the latest few).
  let activitiesQuery = supabase
    .from("farm_records")
    .select(DASHBOARD_ACTIVITY_COLUMNS)
    .eq("profile_id", user.id)
    .not("crop_season_id", "is", null)
    .is("voided_at", null)
    .lte("occurred_on", today)
    .order("occurred_on", { ascending: false })
    .limit(200);
  if (from !== null) activitiesQuery = activitiesQuery.gte("occurred_on", from);

  const [
    { data: farmsData, error: farmsError },
    { data: plotsData, error: plotsError },
    { data: seasonsData, error: seasonsError },
    { data: groupsData, error: groupsError },
    { data: cropTypesData, error: cropTypesError },
    { data: livestockTypesData, error: livestockTypesError },
    { data: activitiesData, error: activitiesError },
    { data: kindsData, error: kindsError },
  ] = await Promise.all([
    supabase.from("farms").select(FARM_COLUMNS).eq("profile_id", user.id).order("created_at", { ascending: true }),
    supabase.from("farm_plots").select(`${PLOT_COLUMNS}, created_at`).eq("profile_id", user.id),
    supabase.from("crop_seasons").select(`${CROP_SEASON_COLUMNS}, created_at`).eq("profile_id", user.id).is("archived_at", null),
    supabase.from("livestock_groups").select(`${LIVESTOCK_GROUP_COLUMNS}, created_at`).eq("profile_id", user.id).is("archived_at", null),
    supabase.from("crop_types").select("id, name, category_id"),
    supabase.from("livestock_types").select("id, name, category_id"),
    activitiesQuery,
    supabase.from("farm_record_kinds").select("id, name"),
  ]);

  const activeFarms = ((farmsData ?? []) as Farm[]).filter((farm) => farm.archived_at === null);
  const selected = activeFarms.find((farm) => farm.id === params.farm) ?? null;
  // One farm: always show it. Several: "all" unless one is picked.
  const scopeFarm = selected ?? (activeFarms.length === 1 ? activeFarms[0] : null);
  const scope = scopeFarm ? [scopeFarm] : activeFarms;
  // Crop activities exist only once the farm activity log (FR-1a) is in
  // the database; until then they're simply not part of the dashboard.
  const activitiesEnabled = !isMissingTableError(activitiesError);
  const activitiesFailed = activitiesEnabled && Boolean(activitiesError || kindsError);

  // The county is only a label in the header; if it doesn't load the
  // header just leaves it out.
  const { data: county } = scopeFarm
    ? await supabase.from("counties").select("name").eq("id", scopeFarm.county_id).maybeSingle()
    : { data: null };

  const dashboard = buildFarmDashboard({
    farms: scope,
    plots: (plotsData ?? []) as DashboardPlot[],
    seasons: (seasonsData ?? []) as DashboardSeason[],
    groups: (groupsData ?? []) as DashboardGroup[],
    cropActivities: activitiesEnabled && !activitiesFailed ? ((activitiesData ?? []) as DashboardCropActivity[]) : [],
    activityKinds: (kindsData ?? []) as { id: string; name: string }[],
    cropTypes: (cropTypesData ?? []) as TypeOption[],
    livestockTypes: (livestockTypesData ?? []) as TypeOption[],
    today,
    from,
  });

  const cropsFailed = Boolean(seasonsError || cropTypesError);
  const livestockFailed = Boolean(groupsError || livestockTypesError);
  const plotsFailed = Boolean(plotsError);
  const anyFailed = cropsFailed || livestockFailed || plotsFailed;
  const rangeLabel = DASHBOARD_RANGES.find((r) => r.value === range)?.label.toLowerCase() ?? "";
  const farmHref = scopeFarm ? `/farm-records/${scopeFarm.id}` : "/farm-records";
  const section = (anchor: string) => `${farmHref}${scopeFarm ? `#${anchor}` : ""}`;
  const retryHref = `/farm-records/dashboard?farm=${encodeURIComponent(scopeFarm?.id ?? "all")}&range=${range}`;
  const countyName = (county as { name: string } | null)?.name ?? null;

  return (
    <div className="flex flex-1 flex-col bg-shamba-bg">
      <AppHeader />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-20 pt-6 sm:px-6 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8 lg:px-10 lg:pt-10">
        <DashboardSidebar farmId={scopeFarm?.id ?? null} />

        <div className="flex min-w-0 flex-col gap-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-bold leading-tight tracking-tight text-shamba-ink sm:text-3xl">
                Farm dashboard
              </h1>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-shamba-ink-soft">
                <MapPin className="size-4 shrink-0 text-shamba-green" aria-hidden="true" />
                <span className="min-w-0 truncate">
                  {scopeFarm ? (
                    <>
                      <span className="font-semibold text-shamba-ink">{scopeFarm.name}</span>
                      {countyName && ` · ${countyName} County`}
                    </>
                  ) : (
                    <span className="font-semibold text-shamba-ink">
                      All {activeFarms.length} {activeFarms.length === 1 ? "farm" : "farms"}
                    </span>
                  )}
                </span>
              </p>
            </div>
            {activeFarms.length > 0 && <QuickAdd farm={scopeFarm} />}
          </div>

          {farmsError ? (
            <LoadErrorCard
              title="We couldn't load your farms."
              detail="Check your connection and try again. Your farm records are not affected."
              retryHref={retryHref}
            />
          ) : activeFarms.length === 0 ? (
            <DashboardCard icon={ClipboardList} tone="bg-shamba-green/10 text-shamba-green" title="No farms yet">
              <EmptyLine href="/farm-records/new" linkLabel="Add your first farm">
                The dashboard fills in from your farm records.
              </EmptyLine>
            </DashboardCard>
          ) : (
            <>
              <DashboardControls
                farms={activeFarms.map((farm) => ({ id: farm.id, name: farm.name }))}
                farmId={scopeFarm?.id ?? "all"}
                range={range}
              />

              {anyFailed && (
                <LoadErrorCard
                  title="Some farm records didn't load."
                  detail={`Missing: ${[plotsFailed && "plots", cropsFailed && "crops", livestockFailed && "livestock"].filter(Boolean).join(", ")}. Those parts are left blank rather than shown as zero.`}
                  retryHref={retryHref}
                />
              )}

              {/* Key figures. Money has its own tiles so the gap is plain to
                  see; on phones the two share one tile. */}
              <dl className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                <Stat
                  icon={LandPlot}
                  tone="border-shamba-green/25 bg-shamba-green/[0.07]"
                  iconTone="bg-shamba-green/15 text-shamba-green"
                  label="Active plots"
                  value={plotsFailed ? null : String(dashboard.activePlots)}
                  note={plotsFailed ? undefined : `${dashboard.plotsAddedInRange} added · ${rangeLabel}`}
                />
                <Stat
                  icon={Sprout}
                  tone="border-shamba-green/25 bg-shamba-green/[0.07]"
                  iconTone="bg-shamba-green/15 text-shamba-green"
                  label="Growing seasons"
                  value={cropsFailed ? null : String(dashboard.growingSeasons)}
                  note={cropsFailed ? undefined : `${dashboard.plannedSeasons} planned`}
                />
                <Stat
                  icon={PawPrint}
                  tone="border-shamba-ochre/30 bg-shamba-ochre/[0.08]"
                  iconTone="bg-shamba-ochre/20 text-shamba-ochre"
                  label="Livestock (head)"
                  value={livestockFailed ? null : dashboard.livestockHead.toLocaleString("en-KE")}
                  note={
                    livestockFailed
                      ? undefined
                      : `${dashboard.livestockGroups} ${dashboard.livestockGroups === 1 ? "group" : "groups"}${dashboard.groupsWithoutCount > 0 ? `, ${dashboard.groupsWithoutCount} uncounted` : ""}`
                  }
                />
                <MoneyStat icon={TrendingUp} label="Total income" className="hidden lg:flex" />
                <MoneyStat icon={TrendingDown} label="Total expenses" className="hidden lg:flex" />
                <MoneyStat icon={Wallet} label="Income · Expenses" className="lg:hidden" />
              </dl>

              {/* Urgent first: records missing details the figures rely on. */}
              {!cropsFailed && !livestockFailed && (
                <section aria-labelledby="attention-heading">
                  {dashboard.attention.length > 0 ? (
                    <div className="rounded-2xl border border-shamba-rust/30 bg-shamba-rust/[0.06] p-4">
                      <h2 id="attention-heading" className="flex items-center gap-2 font-display text-base font-semibold text-shamba-ink">
                        <AlertTriangle className="size-5 text-shamba-rust" aria-hidden="true" />
                        Needs attention ({dashboard.attention.length})
                      </h2>
                      <ul className="mt-2 flex flex-col gap-1.5">
                        {dashboard.attention.map((item) => (
                          <li key={item.key}>
                            <Link
                              href={item.href}
                              className="flex min-h-11 items-center gap-2 rounded-xl bg-shamba-card px-3 py-2 text-sm leading-5 text-shamba-ink hover:bg-shamba-card/70"
                            >
                              <span className="min-w-0 flex-1">{item.text}</span>
                              <span className="shrink-0 font-semibold text-shamba-rust">Fix</span>
                              <ArrowRight className="size-4 shrink-0 text-shamba-rust" aria-hidden="true" />
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="flex min-h-11 items-center gap-2 rounded-2xl border border-shamba-green/25 bg-shamba-green/[0.06] px-4 text-sm text-shamba-ink">
                      <CheckCircle2 className="size-4 shrink-0 text-shamba-green" aria-hidden="true" />
                      <span id="attention-heading">Nothing needs attention. Your crop and livestock records are complete.</span>
                    </p>
                  )}
                </section>
              )}

              {/* Desktop: analytics row, then records row. Phones: what's
                  coming, then crops, livestock, money, the summary list and
                  recent activity last (order-*). */}
              <div className="flex flex-col gap-5 lg:grid lg:grid-cols-3">
                <DashboardCard
                  icon={Sprout}
                  tone="bg-shamba-green/10 text-shamba-green"
                  title="Crops"
                  subtitle="Area growing now"
                  href={section("crops")}
                  linkLabel="Open"
                  className="order-2 lg:order-none"
                >
                  {cropsFailed ? (
                    <EmptyLine>Crops didn&apos;t load.</EmptyLine>
                  ) : dashboard.crops.length === 0 ? (
                    <EmptyLine href={section("crops")} linkLabel="Add a crop">
                      No crops growing right now.
                    </EmptyLine>
                  ) : (
                    <BarList
                      label="Area under each crop growing now"
                      tone="bg-shamba-green"
                      bars={dashboard.crops.map((crop) => ({
                        key: crop.cropTypeId,
                        name: crop.name,
                        value: crop.acres,
                        display: crop.acres > 0 ? formatAcres(crop.acres) : "Area not recorded",
                        note:
                          crop.withoutArea > 0 && crop.acres > 0
                            ? `+ ${crop.withoutArea} without area`
                            : `${crop.seasons} ${crop.seasons === 1 ? "season" : "seasons"}`,
                      }))}
                    />
                  )}
                  <p className="mt-3 text-xs leading-5 text-shamba-ink-soft">
                    {activitiesEnabled
                      ? "Harvests are recorded on each crop's activities; production totals across farms aren't worked out yet."
                      : "Harvests and yields aren't recorded yet, so production can't be shown."}
                  </p>
                </DashboardCard>

                <DashboardCard
                  icon={Wallet}
                  tone="bg-shamba-blue/15 text-shamba-blue"
                  title="Finances"
                  subtitle="Income vs expenses"
                  className="order-4 lg:order-none"
                >
                  <EmptyLine>
                    Farm finances aren&apos;t tracked in Shamba Space yet, so there are no income or expense figures to
                    show.
                  </EmptyLine>
                </DashboardCard>

                <DashboardCard
                  icon={PawPrint}
                  tone="bg-shamba-ochre/15 text-shamba-ochre"
                  title="Livestock"
                  subtitle="Head count by type"
                  href={section("livestock")}
                  linkLabel="Open"
                  className="order-3 lg:order-none"
                >
                  {livestockFailed ? (
                    <EmptyLine>Livestock didn&apos;t load.</EmptyLine>
                  ) : dashboard.livestockGroups === 0 ? (
                    <EmptyLine href={section("livestock")} linkLabel="Add livestock">
                      No livestock recorded.
                    </EmptyLine>
                  ) : (
                    <LivestockComposition
                      total={dashboard.livestockHead}
                      slices={dashboard.livestockSlices}
                      uncounted={dashboard.groupsWithoutCount}
                    />
                  )}
                </DashboardCard>

                <DashboardCard
                  icon={History}
                  tone="bg-shamba-ink/5 text-shamba-ink"
                  title="Recent farm activities"
                  subtitle={`From your records · ${rangeLabel}`}
                  href={scopeFarm ? farmHref : undefined}
                  linkLabel="View all"
                  className="order-last scroll-mt-4 lg:order-none lg:col-span-2"
                >
                  <div id="recent-activity" />
                  {(anyFailed || activitiesFailed) && (
                    <EmptyLine>Some records didn&apos;t load, so activity may be incomplete.</EmptyLine>
                  )}
                  {dashboard.activity.length === 0 ? (
                    <EmptyLine>
                      {activitiesEnabled
                        ? "No crop activities, plantings, season ends, livestock or new plots in this period."
                        : "No plantings, season ends, livestock or new plots in this period."}
                    </EmptyLine>
                  ) : (
                    <>
                      <RecordTable
                        caption="Recent farm activities"
                        columns={["Date", "Activity", "Details"]}
                        items={dashboard.activity.slice(0, 8)}
                      />
                      <DatedList className="lg:hidden" items={dashboard.activity.slice(0, 8)} />
                    </>
                  )}
                  <p className="mt-3 text-xs leading-5 text-shamba-ink-soft">
                    {activitiesEnabled
                      ? "Crop activities are included. Livestock and whole-farm diary entries (feeding, treatments) can't be recorded in the app yet."
                      : "A full farm diary (spraying, feeding, treatments, who recorded it) isn't built yet."}
                  </p>
                </DashboardCard>

                <DashboardCard
                  icon={CalendarClock}
                  tone="bg-shamba-green/10 text-shamba-green"
                  title="Coming up"
                  subtitle="Plantings, season ends"
                  href={scopeFarm ? section("crops") : undefined}
                  linkLabel="View all"
                  className="order-1 lg:order-none"
                >
                  {cropsFailed ? (
                    <EmptyLine>Crops didn&apos;t load.</EmptyLine>
                  ) : dashboard.upcoming.length === 0 ? (
                    <EmptyLine>Nothing scheduled. Planned crops and season end dates will show here.</EmptyLine>
                  ) : (
                    <DatedList items={dashboard.upcoming.slice(0, 6)} />
                  )}
                  <p className="mt-3 text-xs leading-5 text-shamba-ink-soft">Tasks and assignments need People &amp; Work, which isn&apos;t built yet.</p>
                </DashboardCard>

                <div className="order-5 lg:hidden">
                  <FarmSummaryList
                    farmId={scopeFarm?.id ?? null}
                    plots={plotsFailed ? null : dashboard.activePlots}
                    seasons={cropsFailed ? null : dashboard.seasonsOnRecord}
                    groups={livestockFailed ? null : dashboard.livestockGroups}
                  />
                </div>
              </div>

              <ModuleShortcuts farmId={scopeFarm?.id ?? null} />
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function Stat({
  icon: Icon,
  tone,
  iconTone,
  label,
  value,
  note,
}: {
  icon: LucideIcon;
  tone: string;
  iconTone: string;
  label: string;
  value: string | null;
  note?: string;
}) {
  return (
    <div className={`flex flex-col gap-1 rounded-2xl border p-3.5 ${tone}`}>
      <span className={`mb-1 inline-flex size-8 items-center justify-center rounded-lg ${iconTone}`}>
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <dt className="order-last text-xs font-medium leading-tight text-shamba-ink-soft">
        {label}
        {note && <span className="block font-normal">{note}</span>}
      </dt>
      <dd className="font-display text-2xl font-bold leading-none text-shamba-ink">{value ?? "—"}</dd>
    </div>
  );
}

// Money isn't recorded anywhere yet: a dashed tile, never a zero.
function MoneyStat({ icon: Icon, label, className }: { icon: LucideIcon; label: string; className: string }) {
  return (
    <div className={`flex-col gap-1 rounded-2xl border border-dashed border-shamba-line bg-shamba-card/60 p-3.5 ${className}`}>
      <span className="mb-1 inline-flex size-8 items-center justify-center rounded-lg bg-shamba-ink/5 text-shamba-ink-soft">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <dt className="order-last text-xs font-medium leading-tight text-shamba-ink-soft">
        {label}
        <span className="block font-normal">Needs Finances</span>
      </dt>
      <dd className="font-sans text-sm font-semibold leading-6 text-shamba-ink-soft">Not tracked yet</dd>
    </div>
  );
}

// A one-series horizontal bar chart as a plain list: name and value are
// always written out (so the list is also its own table), and the bar
// only shows relative size. Bars are thin, round-ended and start at zero.
function BarList({
  label,
  tone,
  bars,
}: {
  label: string;
  tone: string;
  bars: { key: string; name: string; value: number; display: string; note: string }[];
}) {
  const max = Math.max(...bars.map((bar) => bar.value), 0);
  return (
    <ul aria-label={label} className="flex flex-col gap-3">
      {bars.map((bar) => (
        <li key={bar.key} title={`${bar.name}: ${bar.display} (${bar.note})`}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-semibold text-shamba-ink">{bar.name}</span>
            <span className="shrink-0 font-semibold text-shamba-ink">{bar.display}</span>
          </div>
          <div className="mt-1.5 h-2.5 rounded-full bg-shamba-bg" aria-hidden="true">
            <div
              className={`h-full rounded-full ${tone}`}
              style={{ width: max > 0 && bar.value > 0 ? `${Math.max((bar.value / max) * 100, 3)}%` : "0%" }}
            />
          </div>
          <p className="mt-1 text-xs text-shamba-ink-soft">{bar.note}</p>
        </li>
      ))}
    </ul>
  );
}

// Part-to-whole of counted animals: the total as a headline, one stacked
// bar (2px gaps between slices, round outer ends) and a legend that
// writes out every name, count and share.
function LivestockComposition({ total, slices, uncounted }: { total: number; slices: LivestockSlice[]; uncounted: number }) {
  const colour = (index: number, key: string) => (key === "other" ? OTHER_COLOUR : SLICE_COLOURS[index]);
  const percent = (share: number) => `${Math.round(share * 100)}%`;
  return (
    <div>
      <p className="font-display text-3xl font-bold leading-none text-shamba-ink">
        {total.toLocaleString("en-KE")}
        <span className="ml-1.5 font-sans text-sm font-medium text-shamba-ink-soft">head counted</span>
      </p>
      {slices.length > 0 ? (
        <>
          <div className="mt-4 flex h-3 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
            {slices.map((slice, index) => (
              <div
                key={slice.key}
                title={`${slice.name}: ${slice.head.toLocaleString("en-KE")} (${percent(slice.share)})`}
                className="h-full min-w-1 first:rounded-l-full last:rounded-r-full"
                style={{ width: `${slice.share * 100}%`, backgroundColor: colour(index, slice.key) }}
              />
            ))}
          </div>
          <ul aria-label="Head count by livestock type" className="mt-3 flex flex-col gap-1.5">
            {slices.map((slice, index) => (
              <li key={slice.key} className="flex items-center gap-2 text-sm">
                <span className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: colour(index, slice.key) }} aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-shamba-ink">{slice.name}</span>
                <span className="shrink-0 font-semibold text-shamba-ink">{slice.head.toLocaleString("en-KE")}</span>
                <span className="w-10 shrink-0 text-right text-xs text-shamba-ink-soft">{percent(slice.share)}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-3 text-sm text-shamba-ink-soft">No head counts recorded yet.</p>
      )}
      {uncounted > 0 && (
        <p className="mt-3 text-xs leading-5 text-shamba-ink-soft">
          + {uncounted} {uncounted === 1 ? "group" : "groups"} without a head count, not in the total.
        </p>
      )}
    </div>
  );
}

type RecordItem = { key: string; date: string; text: string; where: string; detail: string; href: string };

// Desktop: a real table (date, what happened, where).
function RecordTable({ caption, columns, items }: { caption: string; columns: string[]; items: RecordItem[] }) {
  return (
    <table className="hidden w-full text-left text-sm lg:table">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="border-b border-shamba-line text-xs text-shamba-ink-soft">
          {columns.map((column) => (
            <th key={column} scope="col" className="pb-2 pr-3 font-medium">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-shamba-line">
        {items.map((item) => (
          <tr key={item.key}>
            <td className="whitespace-nowrap py-2.5 pr-3 font-mono text-xs text-shamba-ink-soft">{formatRecordDate(item.date)}</td>
            <td className="py-2.5 pr-3">
              <Link href={item.href} className="font-semibold text-shamba-ink hover:text-shamba-green-deep">
                {item.text}
              </Link>
            </td>
            <td className="py-2.5 text-shamba-ink-soft">{[item.where, item.detail].filter(Boolean).join(" · ") || "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DatedList({ items, className = "" }: { items: RecordItem[]; className?: string }) {
  return (
    <ul className={`flex flex-col divide-y divide-shamba-line ${className}`}>
      {items.map((item) => {
        const related = [item.where, item.detail].filter(Boolean).join(" · ");
        return (
          <li key={item.key}>
            <Link href={item.href} className="flex min-h-11 items-baseline gap-3 py-2 text-sm hover:text-shamba-green-deep">
              <span className="w-24 shrink-0 font-mono text-xs text-shamba-ink-soft">{formatRecordDate(item.date)}</span>
              <span className="min-w-0 flex-1 text-shamba-ink">
                {item.text}
                {related && <span className="block text-xs text-shamba-ink-soft">{related}</span>}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
