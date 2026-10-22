import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, LayoutDashboard, MapPin, RotateCw } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { FARM_COLUMNS, formatAcres, type Farm } from "@/lib/farmRecords";

// Farm Records R1: the farmer's own farms. Everything here is private --
// farms/farm_plots RLS only ever returns the caller's own rows, so no
// extra ownership filter is needed for correctness (the profile_id
// filters below just keep the queries obviously scoped).
export default async function FarmRecords() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const [
    { data: farmsData, error },
    { data: plotsData, error: plotsError },
    { data: countiesData, error: countiesError },
  ] = await Promise.all([
    supabase
      .from("farms")
      .select(FARM_COLUMNS)
      .eq("profile_id", user.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("farm_plots")
      .select("farm_id")
      .eq("profile_id", user.id)
      .is("archived_at", null),
    supabase.from("counties").select("id, name"),
  ]);

  const farms = (farmsData ?? []) as Farm[];
  const activeFarms = farms.filter((farm) => farm.archived_at === null);
  const archivedFarms = farms.filter((farm) => farm.archived_at !== null);

  const countyNames = new Map((countiesData ?? []).map((county) => [county.id, county.name]));
  const missingDetails = [
    activeFarms.length > 0 && plotsError ? "plot counts" : null,
    farms.length > 0 && countiesError ? "county names" : null,
  ].filter((detail): detail is string => detail !== null);
  const plotCounts = new Map<string, number>();
  for (const plot of plotsData ?? []) {
    plotCounts.set(plot.farm_id, (plotCounts.get(plot.farm_id) ?? 0) + 1);
  }

  return (
    <div className="flex flex-1 flex-col bg-shamba-bg">
      <AppHeader />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-6 pb-20 pt-8 sm:px-10 sm:pt-16">
        <div className="w-full max-w-sm">
          <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-shamba-ink">
            Farm Records
          </h1>
          <p className="mt-2 text-base leading-6 text-shamba-ink-soft">
            Keep track of your farms and the plots on them. Only you can see
            your farm records.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link
              href="/farm-records/new"
              className="inline-flex min-h-11 items-center justify-center rounded-shamba bg-shamba-green px-6 py-3 font-sans text-base font-semibold text-shamba-card transition-colors hover:bg-shamba-green-deep"
            >
              Add a farm
            </Link>
            {activeFarms.length > 0 && (
              <Link
                href="/farm-records/dashboard"
                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-shamba border border-shamba-line bg-shamba-card px-5 py-3 font-sans text-base font-semibold text-shamba-ink transition-colors hover:border-shamba-green"
              >
                <LayoutDashboard className="size-4" aria-hidden="true" />
                Farm dashboard
              </Link>
            )}
          </div>

          {error && (
            <p role="alert" className="mt-6 text-sm font-semibold text-shamba-rust">
              We couldn&apos;t load your farms. Please refresh the page.
            </p>
          )}

          {!error && activeFarms.length === 0 && (
            <div className="mt-6 rounded-shamba border border-shamba-line bg-shamba-card p-4">
              <h2 className="font-display text-base font-semibold text-shamba-ink">No farms yet</h2>
              <p className="mt-1 text-sm leading-5 text-shamba-ink-soft">
                Add your first farm to start keeping records. You can add plots
                later if you farm in separate fields — they&apos;re optional.
              </p>
            </div>
          )}

          {/* A card's missing plot count would read as "no plots", and a
              missing county line looks like an unset county, so say which
              details didn't load instead. Only active cards show plot
              counts; every card shows its county. */}
          {missingDetails.length > 0 && (
            <div role="alert" className="mt-6 rounded-shamba border border-shamba-line bg-shamba-card p-4">
              <p className="text-sm leading-5 text-shamba-rust">
                We couldn&apos;t load your {missingDetails.join(" or ")}. Your farms and plots are not affected.
              </p>
              {/* Navigating to this page again reloads it from the server
                  (it is dynamic), and works as a plain link before scripts load. */}
              <Link
                href="/farm-records"
                prefetch={false}
                className="mt-2 inline-flex min-h-11 items-center gap-1.5 font-sans text-sm font-semibold text-shamba-green hover:underline"
              >
                <RotateCw className="size-4" aria-hidden="true" />
                Try again
              </Link>
            </div>
          )}

          {activeFarms.length > 0 && (
            <ul className="mt-6 flex flex-col gap-3">
              {activeFarms.map((farm) => (
                <li key={farm.id}>
                  <FarmCard
                    farm={farm}
                    countyName={countyNames.get(farm.county_id)}
                    plotCount={plotsError ? undefined : (plotCounts.get(farm.id) ?? 0)}
                  />
                </li>
              ))}
            </ul>
          )}

          {archivedFarms.length > 0 && (
            <details className="mt-8">
              <summary className="cursor-pointer font-sans text-sm font-semibold text-shamba-ink-soft hover:text-shamba-ink">
                Archived farms ({archivedFarms.length})
              </summary>
              <ul className="mt-3 flex flex-col gap-3">
                {archivedFarms.map((farm) => (
                  <li key={farm.id}>
                    <FarmCard farm={farm} countyName={countyNames.get(farm.county_id)} />
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </main>
    </div>
  );
}

function FarmCard({
  farm,
  countyName,
  plotCount,
}: {
  farm: Farm;
  countyName: string | undefined;
  // Undefined when plots weren't loaded (archived farms, or a failed plots
  // query), so nothing is shown rather than a count that may be wrong.
  plotCount?: number;
}) {
  const details = [
    farm.size_acres !== null ? formatAcres(farm.size_acres) : null,
    plotCount !== undefined && plotCount > 0 ? `${plotCount} ${plotCount === 1 ? "plot" : "plots"}` : null,
  ].filter(Boolean);

  return (
    <Link
      href={`/farm-records/${farm.id}`}
      className="flex min-h-11 items-center justify-between gap-3 rounded-shamba border border-shamba-line bg-shamba-card p-4 transition-colors hover:border-shamba-green"
    >
      <div className="min-w-0">
        <p className="truncate font-display text-base font-semibold text-shamba-ink">{farm.name}</p>
        {countyName && (
          <p className="mt-1 flex items-center gap-1 text-sm text-shamba-ink-soft">
            <MapPin className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{countyName}</span>
          </p>
        )}
        {details.length > 0 && (
          <p className="mt-1 font-mono text-xs text-shamba-ink-soft">{details.join(" · ")}</p>
        )}
      </div>
      <ChevronRight className="size-5 shrink-0 text-shamba-ink-soft" aria-hidden="true" />
    </Link>
  );
}
