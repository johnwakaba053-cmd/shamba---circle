import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, MapPin, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import {
  CROP_SEASON_COLUMNS,
  FARM_COLUMNS,
  LIVESTOCK_GROUP_COLUMNS,
  PLOT_COLUMNS,
  formatAcres,
  tenureLabel,
  todayInKenya,
  type CropSeason,
  type Farm,
  type FarmPlot,
  type LivestockGroup,
  type TypeOption,
} from "@/lib/farmRecords";
import { CropSeasonsSection } from "./CropSeasonsSection";
import { FarmArchiveControl } from "./FarmArchiveControl";
import { LivestockSection } from "./LivestockSection";
import { PlotsSection } from "./PlotsSection";

export default async function FarmDetail({
  params,
}: {
  params: Promise<{ farmId: string }>;
}) {
  const { farmId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  // RLS returns only the caller's own farm and plots: anyone else's farm
  // id (or a malformed one) is simply not found, never "forbidden", so
  // the page doesn't even confirm that the farm exists.
  const [
    { data: farmData },
    { data: plotsData },
    { data: seasonsData },
    { data: groupsData },
    { data: cropTypesData },
    { data: livestockTypesData },
  ] = await Promise.all([
    supabase.from("farms").select(FARM_COLUMNS).eq("id", farmId).eq("profile_id", user.id).maybeSingle(),
    supabase
      .from("farm_plots")
      .select(PLOT_COLUMNS)
      .eq("farm_id", farmId)
      .eq("profile_id", user.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("crop_seasons")
      .select(CROP_SEASON_COLUMNS)
      .eq("farm_id", farmId)
      .eq("profile_id", user.id)
      .order("started_on", { ascending: false }),
    supabase
      .from("livestock_groups")
      .select(LIVESTOCK_GROUP_COLUMNS)
      .eq("farm_id", farmId)
      .eq("profile_id", user.id)
      .order("created_at", { ascending: true }),
    supabase.from("crop_types").select("id, name").order("name", { ascending: true }),
    supabase.from("livestock_types").select("id, name").order("name", { ascending: true }),
  ]);

  if (!farmData) {
    notFound();
  }

  const farm = farmData as Farm;
  const plots = (plotsData ?? []) as FarmPlot[];
  const seasons = (seasonsData ?? []) as CropSeason[];
  const groups = (groupsData ?? []) as LivestockGroup[];
  const cropTypes = (cropTypesData ?? []) as TypeOption[];
  const livestockTypes = (livestockTypesData ?? []) as TypeOption[];
  const isArchived = farm.archived_at !== null;
  // One "today" (Kenya time) for the whole render, so crop and livestock
  // states are worked out the same way on the server and in the browser.
  const today = todayInKenya();

  const { data: county } = await supabase.from("counties").select("name").eq("id", farm.county_id).maybeSingle();

  const details = [
    { key: "size", label: "Size", value: farm.size_acres !== null ? formatAcres(farm.size_acres) : null },
    { key: "tenure", label: "Land ownership", value: farm.tenure !== null ? tenureLabel(farm.tenure) : null },
  ].filter((item): item is { key: string; label: string; value: string } => item.value !== null);

  return (
    <div className="flex flex-1 flex-col bg-shamba-bg">
      <AppHeader />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-6 pb-20 pt-8 sm:px-10 sm:pt-16">
        <div className="w-full max-w-sm">
          <Link
            href="/farm-records"
            className="inline-flex items-center gap-2 font-sans text-sm font-semibold text-shamba-ink-soft transition-colors hover:text-shamba-ink relative touch-target"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to Farm Records
          </Link>

          {isArchived && (
            <p className="mt-4 rounded-shamba border border-shamba-line bg-shamba-card px-3 py-2 text-sm text-shamba-ink-soft">
              This farm is archived. Restore it to make changes.
            </p>
          )}

          <h1 className="mt-4 break-words font-display text-2xl font-bold leading-tight tracking-tight text-shamba-ink">
            {farm.name}
          </h1>

          <p className="mt-1 flex items-center gap-1 text-sm text-shamba-ink-soft">
            <MapPin className="size-4 shrink-0" aria-hidden="true" />
            <span className="break-words">
              {[farm.location_text, county?.name].filter(Boolean).join(", ")}
            </span>
          </p>

          {details.length > 0 && (
            <div className="mt-4 rounded-shamba border border-shamba-line bg-shamba-card p-4">
              <h2 className="font-display text-base font-semibold text-shamba-ink">Details</h2>
              <dl className="mt-2 flex flex-col gap-1.5">
                {details.map((item) => (
                  <div key={item.key} className="flex items-baseline justify-between gap-3 text-sm">
                    <dt className="text-shamba-ink-soft">{item.label}</dt>
                    <dd className="text-right font-semibold text-shamba-ink">{item.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-4">
            {!isArchived && (
              <Link
                href={`/farm-records/${farm.id}/edit`}
                className="inline-flex min-h-11 items-center gap-1.5 font-sans text-xs font-semibold text-shamba-ink-soft transition-colors hover:text-shamba-ink"
              >
                <Pencil className="size-3.5" aria-hidden="true" />
                Edit farm
              </Link>
            )}
            <FarmArchiveControl farmId={farm.id} isArchived={isArchived} />
          </div>

          <PlotsSection farmId={farm.id} plots={plots} farmArchived={isArchived} />

          <CropSeasonsSection
            farmId={farm.id}
            seasons={seasons}
            plots={plots}
            cropTypes={cropTypes}
            farmArchived={isArchived}
            today={today}
          />

          <LivestockSection
            farmId={farm.id}
            groups={groups}
            plots={plots}
            livestockTypes={livestockTypes}
            farmArchived={isArchived}
            today={today}
          />
        </div>
      </main>
    </div>
  );
}
