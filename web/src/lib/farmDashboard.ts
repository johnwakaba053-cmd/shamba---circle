// Farm Records dashboard: every figure here is worked out from the
// farmer's own saved records (farms, plots, crop seasons, livestock
// groups, and crop activities once the farm activity log is in the
// database) -- nothing is estimated or filled in. Anything the database
// doesn't record yet (money, inventory, tasks, livestock and whole-farm
// diary entries) is reported as unavailable by the page, never as zero.

import { cropSeasonState, type CropSeason, type Farm, type FarmPlot, type LivestockGroup, type TypeOption } from "@/lib/farmRecords";

export type DashboardPlot = FarmPlot & { created_at: string };
export type DashboardSeason = CropSeason & { created_at: string };
export type DashboardGroup = LivestockGroup & { created_at: string };
// A current (not voided) crop activity from farm_records.
export type DashboardCropActivity = {
  id: string;
  farm_id: string;
  crop_season_id: string;
  kind_id: string;
  occurred_on: string;
  description: string | null;
};
export const DASHBOARD_ACTIVITY_COLUMNS = "id, farm_id, crop_season_id, kind_id, occurred_on, description";

export const DASHBOARD_RANGES = [
  { value: "30", label: "Last 30 days", days: 30 },
  { value: "90", label: "Last 90 days", days: 90 },
  { value: "365", label: "Last 12 months", days: 365 },
  { value: "all", label: "All time", days: null },
] as const;
export type DashboardRange = (typeof DASHBOARD_RANGES)[number]["value"];

export function parseRange(value: string | undefined): DashboardRange {
  return DASHBOARD_RANGES.some((range) => range.value === value) ? (value as DashboardRange) : "90";
}

// YYYY-MM-DD, `days` before `today` (also YYYY-MM-DD).
export function rangeStart(today: string, range: DashboardRange): string | null {
  const days = DASHBOARD_RANGES.find((r) => r.value === range)?.days ?? null;
  if (days === null) return null;
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

export type CropBar = { cropTypeId: string; name: string; seasons: number; acres: number; withoutArea: number };
export type LivestockBar = { typeId: string; name: string; groups: number; head: number; uncounted: number };

// `where` is the plot (or "Whole farm"); `detail` is the farm name when
// more than one farm is in view.
export type ActivityItem = { key: string; date: string; text: string; where: string; detail: string; href: string };
export type UpcomingItem = { key: string; date: string; text: string; where: string; detail: string; href: string };
// One slice of the livestock composition bar (head counts only).
export type LivestockSlice = { key: string; name: string; head: number; share: number };
export type AttentionItem = { key: string; text: string; href: string };

export type FarmDashboard = {
  farmCount: number;
  activePlots: number;
  growingSeasons: number;
  plannedSeasons: number;
  livestockGroups: number;
  livestockHead: number;
  groupsWithoutCount: number;
  plotsAddedInRange: number;
  seasonsOnRecord: number;
  livestockSlices: LivestockSlice[];
  crops: CropBar[];
  livestock: LivestockBar[];
  activity: ActivityItem[];
  upcoming: UpcomingItem[];
  attention: AttentionItem[];
};

// Builds the dashboard for the given active farms (already narrowed to the
// selected farm, if any). Archived plots, seasons and groups don't count.
export function buildFarmDashboard({
  farms,
  plots,
  seasons,
  groups,
  cropActivities = [],
  activityKinds = [],
  cropTypes,
  livestockTypes,
  today,
  from,
}: {
  farms: Farm[];
  plots: DashboardPlot[];
  seasons: DashboardSeason[];
  groups: DashboardGroup[];
  cropActivities?: DashboardCropActivity[];
  activityKinds?: { id: string; name: string }[];
  cropTypes: TypeOption[];
  livestockTypes: TypeOption[];
  today: string;
  from: string | null;
}): FarmDashboard {
  const farmIds = new Set(farms.map((farm) => farm.id));
  const farmName = new Map(farms.map((farm) => [farm.id, farm.name]));
  const cropName = (id: string) => cropTypes.find((type) => type.id === id)?.name ?? id;
  const typeName = (id: string) => livestockTypes.find((type) => type.id === id)?.name ?? id;
  const showFarm = farms.length > 1;
  const where = (farmId: string) => (showFarm ? farmName.get(farmId) ?? "" : "");
  const plotName = new Map(plots.map((plot) => [plot.id, plot.name]));
  const onPlot = (plotId: string | null) => (plotId ? plotName.get(plotId) ?? "Plot" : "Whole farm");

  const activePlots = plots.filter((plot) => farmIds.has(plot.farm_id) && plot.archived_at === null);
  const liveSeasons = seasons.filter((season) => farmIds.has(season.farm_id) && season.archived_at === null);
  const liveGroups = groups.filter((group) => farmIds.has(group.farm_id) && group.archived_at === null);
  const state = (season: DashboardSeason) => cropSeasonState(season, today);
  const growing = liveSeasons.filter((season) => state(season) === "growing");
  const planned = liveSeasons.filter((season) => state(season) === "planned");

  // Area under each crop growing now.
  const cropMap = new Map<string, CropBar>();
  for (const season of growing) {
    const bar = cropMap.get(season.crop_type_id) ?? {
      cropTypeId: season.crop_type_id,
      name: cropName(season.crop_type_id),
      seasons: 0,
      acres: 0,
      withoutArea: 0,
    };
    bar.seasons += 1;
    if (season.area_acres === null) bar.withoutArea += 1;
    else bar.acres += Number(season.area_acres);
    cropMap.set(season.crop_type_id, bar);
  }
  const crops = [...cropMap.values()].sort((a, b) => b.acres - a.acres || b.seasons - a.seasons || a.name.localeCompare(b.name));

  // Head count by livestock type.
  const livestockMap = new Map<string, LivestockBar>();
  for (const group of liveGroups) {
    const bar = livestockMap.get(group.livestock_type_id) ?? {
      typeId: group.livestock_type_id,
      name: typeName(group.livestock_type_id),
      groups: 0,
      head: 0,
      uncounted: 0,
    };
    bar.groups += 1;
    if (group.head_count === null) bar.uncounted += 1;
    else bar.head += group.head_count;
    livestockMap.set(group.livestock_type_id, bar);
  }
  const livestock = [...livestockMap.values()].sort((a, b) => b.head - a.head || a.name.localeCompare(b.name));

  const inRange = (date: string) => date <= today && (from === null || date >= from);

  // Recent activity: dates the farmer recorded (planting, ending, animals
  // kept since) and when plots were added -- newest first.
  const activity: ActivityItem[] = [];
  for (const season of liveSeasons) {
    const name = season.label ? `${cropName(season.crop_type_id)} · ${season.label}` : cropName(season.crop_type_id);
    const href = `/farm-records/${season.farm_id}#crops`;
    if (inRange(season.started_on)) {
      activity.push({ key: `start-${season.id}`, date: season.started_on, text: `Planted ${name}`, where: onPlot(season.plot_id), detail: where(season.farm_id), href });
    }
    if (season.ended_on !== null && inRange(season.ended_on)) {
      activity.push({ key: `end-${season.id}`, date: season.ended_on, text: `Ended ${name}`, where: onPlot(season.plot_id), detail: where(season.farm_id), href });
    }
  }
  for (const group of liveGroups) {
    if (group.started_on !== null && inRange(group.started_on)) {
      activity.push({
        key: `group-${group.id}`,
        date: group.started_on,
        text: `Started keeping ${group.name}`,
        where: onPlot(group.plot_id),
        detail: where(group.farm_id),
        href: `/farm-records/${group.farm_id}#livestock`,
      });
    }
  }
  // Crop activities on the seasons in view (archived seasons and other
  // farms are already left out of liveSeasons). A "Planted" record on the
  // season's own start date would repeat the "Planted …" line above, so
  // it is skipped.
  const seasonById = new Map(liveSeasons.map((season) => [season.id, season]));
  const kindName = (id: string) => activityKinds.find((kind) => kind.id === id)?.name ?? "Activity";
  for (const record of cropActivities) {
    const season = seasonById.get(record.crop_season_id);
    if (!season || !inRange(record.occurred_on)) continue;
    if (record.kind_id === "planting" && record.occurred_on === season.started_on) continue;
    const crop = season.label ? `${cropName(season.crop_type_id)} · ${season.label}` : cropName(season.crop_type_id);
    activity.push({
      key: `record-${record.id}`,
      date: record.occurred_on,
      text: `${kindName(record.kind_id)} · ${crop}${record.description ? ` · ${record.description}` : ""}`,
      where: onPlot(season.plot_id),
      detail: where(season.farm_id),
      href: `/farm-records/${season.farm_id}/crops/${season.id}`,
    });
  }
  for (const plot of activePlots) {
    const added = plot.created_at.slice(0, 10);
    if (inRange(added)) {
      activity.push({ key: `plot-${plot.id}`, date: added, text: `Added plot ${plot.name}`, where: plot.size_acres !== null ? `${Number(plot.size_acres).toLocaleString("en-KE", { maximumFractionDigits: 2 })} ${Number(plot.size_acres) === 1 ? "acre" : "acres"}` : "", detail: where(plot.farm_id), href: `/farm-records/${plot.farm_id}#plots` });
    }
  }
  activity.sort((a, b) => b.date.localeCompare(a.date) || a.text.localeCompare(b.text));

  // Coming up: planned plantings and season end dates still ahead.
  const upcoming: UpcomingItem[] = [];
  for (const season of planned) {
    upcoming.push({
      key: `plan-${season.id}`,
      date: season.started_on,
      text: `Plant ${cropName(season.crop_type_id)}${season.label ? ` · ${season.label}` : ""}`,
      where: onPlot(season.plot_id),
      detail: where(season.farm_id),
      href: `/farm-records/${season.farm_id}#crops`,
    });
  }
  for (const season of growing) {
    if (season.ended_on !== null && season.ended_on > today) {
      upcoming.push({
        key: `due-${season.id}`,
        date: season.ended_on,
        text: `${cropName(season.crop_type_id)}${season.label ? ` · ${season.label}` : ""} season ends`,
        where: onPlot(season.plot_id),
        detail: where(season.farm_id),
        href: `/farm-records/${season.farm_id}#crops`,
      });
    }
  }
  upcoming.sort((a, b) => a.date.localeCompare(b.date));

  // Records missing details the dashboard needs.
  const attention: AttentionItem[] = [];
  const noArea = growing.filter((season) => season.area_acres === null);
  if (noArea.length > 0) {
    attention.push({
      key: "no-area",
      text: `${noArea.length} growing ${noArea.length === 1 ? "crop has" : "crops have"} no area recorded, so ${noArea.length === 1 ? "it isn't" : "they aren't"} in the area totals.`,
      href: `/farm-records/${noArea[0].farm_id}#crops`,
    });
  }
  const noCount = liveGroups.filter((group) => group.head_count === null);
  if (noCount.length > 0) {
    attention.push({
      key: "no-count",
      text: `${noCount.length} livestock ${noCount.length === 1 ? "group has" : "groups have"} no head count recorded.`,
      href: `/farm-records/${noCount[0].farm_id}#livestock`,
    });
  }

  // Composition of counted animals: the four largest types, the rest as
  // "Other" (four categorical colours at most; see the dashboard page).
  const counted = livestock.filter((type) => type.head > 0);
  const totalHead = counted.reduce((sum, type) => sum + type.head, 0);
  const top = counted.slice(0, 4);
  const rest = counted.slice(4);
  const livestockSlices: LivestockSlice[] = totalHead === 0 ? [] : [
    ...top.map((type) => ({ key: type.typeId, name: type.name, head: type.head, share: type.head / totalHead })),
    ...(rest.length > 0
      ? [{ key: "other", name: `Other (${rest.length} types)`, head: rest.reduce((sum, type) => sum + type.head, 0), share: rest.reduce((sum, type) => sum + type.head, 0) / totalHead }]
      : []),
  ];

  return {
    farmCount: farms.length,
    activePlots: activePlots.length,
    growingSeasons: growing.length,
    plannedSeasons: planned.length,
    livestockGroups: liveGroups.length,
    livestockHead: liveGroups.reduce((sum, group) => sum + (group.head_count ?? 0), 0),
    groupsWithoutCount: noCount.length,
    plotsAddedInRange: activePlots.filter((plot) => inRange(plot.created_at.slice(0, 10))).length,
    seasonsOnRecord: liveSeasons.length,
    livestockSlices,
    crops,
    livestock,
    activity,
    upcoming,
    attention,
  };
}
