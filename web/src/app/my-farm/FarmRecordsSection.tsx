import Link from "next/link";
import { CalendarDays, ClipboardList, PawPrint, Plus, Sprout, Tractor, Warehouse, type LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { cropSeasonState, headCountNoun, todayInKenya } from "@/lib/farmRecords";
import { DashboardCard, EmptyLine } from "./DashboardCard";
import { embeddedName } from "./embeddedName";

// My Farm snapshot of the farmer's own Farm Records: how many farms, the
// crops growing (and planned) right now, and livestock head counts. It
// reads the same farms / crop_seasons / livestock_groups tables the Farm
// Records pages do, and RLS limits every row to the farmer's own. Crop
// state comes from lib/farmRecords' cropSeasonState, so "growing" here
// always means what it means on the farm page. Archived farms, seasons
// and groups are left out, as on the Farm Records list.

export type FarmSnapshot = {
  activeFarmCount: number;
  growing: { name: string; count: number }[];
  plannedCount: number;
  livestock: { typeId: string; name: string; groups: number; head: number | null }[];
};

export type FarmSnapshotResult = { ok: true; snapshot: FarmSnapshot } | { ok: false };

// Never rejects, so the page can start it early and stream the card.
export async function loadFarmSnapshot(userId: string): Promise<FarmSnapshotResult> {
  try {
    const supabase = await createClient();
    const [farms, seasons, groups] = await Promise.all([
      supabase.from("farms").select("id").eq("profile_id", userId).is("archived_at", null),
      supabase
        .from("crop_seasons")
        .select("farm_id, crop_type_id, started_on, ended_on, archived_at, crop_types(name)")
        .eq("profile_id", userId)
        .is("archived_at", null),
      supabase
        .from("livestock_groups")
        .select("farm_id, livestock_type_id, head_count, livestock_types(name)")
        .eq("profile_id", userId)
        .is("archived_at", null),
    ]);
    const error = farms.error ?? seasons.error ?? groups.error;
    if (error) {
      console.error("[my-farm] farm records unavailable:", error.message);
      return { ok: false };
    }

    const activeFarmIds = new Set((farms.data ?? []).map((farm) => farm.id as string));
    const today = todayInKenya();

    const growingByName = new Map<string, number>();
    let plannedCount = 0;
    for (const season of seasons.data ?? []) {
      if (!activeFarmIds.has(season.farm_id)) continue;
      const state = cropSeasonState(season, today);
      if (state === "planned") plannedCount += 1;
      if (state !== "growing") continue;
      const name = embeddedName(season.crop_types) ?? season.crop_type_id;
      growingByName.set(name, (growingByName.get(name) ?? 0) + 1);
    }

    // One line per livestock type. The head total stays null when any
    // group of that type has no count recorded, rather than showing a
    // total that silently leaves some animals out.
    const livestockByType = new Map<string, FarmSnapshot["livestock"][number]>();
    for (const group of groups.data ?? []) {
      if (!activeFarmIds.has(group.farm_id)) continue;
      const typeId = group.livestock_type_id as string;
      const entry = livestockByType.get(typeId) ?? {
        typeId,
        name: embeddedName(group.livestock_types) ?? typeId,
        groups: 0,
        head: 0,
      };
      entry.groups += 1;
      entry.head = entry.head === null || group.head_count === null ? null : entry.head + group.head_count;
      livestockByType.set(typeId, entry);
    }

    return {
      ok: true,
      snapshot: {
        activeFarmCount: activeFarmIds.size,
        growing: Array.from(growingByName, ([name, count]) => ({ name, count })).sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
        plannedCount,
        livestock: Array.from(livestockByType.values()).sort((a, b) => a.name.localeCompare(b.name)),
      },
    };
  } catch (err) {
    console.error("[my-farm] farm records unavailable:", err instanceof Error ? err.message : err);
    return { ok: false };
  }
}

export async function FarmRecordsSection({ snapshot }: { snapshot: Promise<FarmSnapshotResult> }) {
  const result = await snapshot;
  return <FarmRecordsCard result={result} />;
}

export function FarmRecordsCard({ result }: { result: FarmSnapshotResult }) {
  const card = (children: React.ReactNode) => (
    <DashboardCard
      icon={ClipboardList}
      tone="bg-shamba-green/10 text-shamba-green"
      title="My Farm Records"
      subtitle="Your farms, crops and animals"
      href="/farm-records"
      linkLabel="Open"
    >
      {children}
    </DashboardCard>
  );

  if (!result.ok) {
    return card(
      <EmptyLine href="/farm-records" linkLabel="Open Farm Records">
        We couldn&apos;t load your farm records right now.
      </EmptyLine>,
    );
  }

  const { activeFarmCount, growing, plannedCount, livestock } = result.snapshot;

  if (activeFarmCount === 0) {
    return card(
      <div className="flex flex-col items-start gap-4 rounded-xl border border-dashed border-shamba-green/30 bg-shamba-green/[0.04] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Tractor className="mt-0.5 size-6 shrink-0 text-shamba-green" aria-hidden="true" />
          <p className="text-sm leading-6 text-shamba-ink">
            Keep track of your plots, crop seasons and animals in one place.
          </p>
        </div>
        <Link
          href="/farm-records/new"
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-shamba-green px-5 font-sans text-sm font-semibold text-shamba-card shadow-sm transition-colors hover:bg-shamba-green-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-shamba-green focus-visible:ring-offset-2"
        >
          <Plus className="size-4" aria-hidden="true" />
          Add your farm
        </Link>
      </div>,
    );
  }

  const growingCount = growing.reduce((sum, crop) => sum + crop.count, 0);
  const hasDetail = growing.length > 0 || livestock.length > 0 || plannedCount > 0;

  return card(
    <div
      className={`flex flex-col gap-4 ${hasDetail ? "md:grid md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:items-start md:gap-6" : ""}`}
    >
      <dl className="grid grid-cols-3 gap-2 sm:gap-3">
        <Stat
          icon={Warehouse}
          tone="text-shamba-green"
          label={activeFarmCount === 1 ? "Farm" : "Farms"}
          value={activeFarmCount}
        />
        <Stat icon={Sprout} tone="text-shamba-green" label="Crops growing" value={growingCount} />
        <Stat
          icon={PawPrint}
          tone="text-shamba-ochre"
          label="Livestock groups"
          value={livestock.reduce((sum, type) => sum + type.groups, 0)}
        />
      </dl>

      {hasDetail && (
        <div className="flex flex-col gap-4">
          {growing.length > 0 && (
            <div>
              <h4 className="font-mono text-[11px] font-medium uppercase tracking-wider text-shamba-ink-soft">
                Growing now
              </h4>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {growing.map((crop) => (
                  <li
                    key={crop.name}
                    className="inline-flex items-center gap-1.5 rounded-full bg-shamba-green/10 px-3 py-1 text-sm font-semibold text-shamba-green-deep"
                  >
                    <Sprout className="size-3.5 text-shamba-green" aria-hidden="true" />
                    {crop.count > 1 ? `${crop.name} (${crop.count})` : crop.name}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {livestock.length > 0 && (
            <div>
              <h4 className="font-mono text-[11px] font-medium uppercase tracking-wider text-shamba-ink-soft">
                Livestock
              </h4>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {livestock.map((type) => (
                  <li
                    key={type.typeId}
                    className="inline-flex items-center gap-1.5 rounded-full bg-shamba-ochre/15 px-3 py-1 text-sm font-semibold text-shamba-ink"
                  >
                    <PawPrint className="size-3.5 text-shamba-ochre" aria-hidden="true" />
                    {type.head === null ? type.name : `${type.name} · ${type.head} ${headCountNoun(type.typeId, type.head)}`}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {plannedCount > 0 && (
            <p className="inline-flex items-center gap-1.5 text-sm leading-6 text-shamba-ink-soft">
              <CalendarDays className="size-4 shrink-0" aria-hidden="true" />
              {plannedCount === 1 ? "1 crop season planned." : `${plannedCount} crop seasons planned.`}
            </p>
          )}
        </div>
      )}
      {!hasDetail && (
        <EmptyLine href="/farm-records" linkLabel="Add a crop season or livestock">
          No crops or livestock recorded yet.
        </EmptyLine>
      )}
    </div>,
  );
}

function Stat({
  icon: Icon,
  tone,
  label,
  value,
}: {
  icon: LucideIcon;
  tone: string;
  label: string;
  value: number;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-shamba-bg p-3">
      <Icon className={`size-4 ${tone}`} aria-hidden="true" />
      <dt className="order-last text-xs font-medium leading-tight text-shamba-ink-soft">{label}</dt>
      <dd className="font-display text-2xl font-bold leading-none text-shamba-ink">{value}</dd>
    </div>
  );
}
