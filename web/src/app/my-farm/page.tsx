import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { loadFarmAlerts } from "@/app/weather/FarmAlertsSection";
import { AlertsSummarySection } from "./AlertsSummarySection";
import { DashboardCardSkeleton, DashboardZone } from "./DashboardCard";
import { MY_FARM_SURFACE } from "./dashboardTheme";
import { embeddedName } from "./embeddedName";
import { FarmerSummaryCard } from "./FarmerSummaryCard";
import { FarmRecordsSection, loadFarmSnapshot } from "./FarmRecordsSection";
import { loadWeatherSummary, WeatherSummarySection } from "./WeatherSummarySection";
import { loadFarmPrices, PricesSection } from "./PricesSection";
import { LearnSection, loadFarmGuides } from "./LearnSection";
import { CommunitiesSection, loadFarmCommunities } from "./CommunitiesSection";
import { loadFarmNews, NewsSection } from "./NewsSection";

export const metadata: Metadata = {
  title: "My Farm · Shamba Space",
};

// My Farm: one page that pulls together what the farmer has already told
// Shamba Space (county, crops and livestock from Profile; their Farm
// Records; the communities they joined) and points at the existing
// feature for each. It summarises and links -- it never creates advice,
// forecasts or prices of its own. Every read goes through the signed-in
// farmer's own client, so the existing RLS policies and the
// get_my_alerts() RPC decide what can be seen, exactly as on the full
// pages.
export default async function MyFarmPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  // Embedded names (counties / crop_types / livestock_types are readable
  // by any signed-in user) keep this to one round trip per table.
  const [
    { data: profile },
    { data: preferences, error: preferencesError },
    { data: cropRows, error: cropsError },
    { data: livestockRows, error: livestockError },
  ] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    supabase.from("farmer_preferences").select("county_id, counties(name)").maybeSingle(),
    supabase.from("farmer_crop_preferences").select("crop_type_id, crop_types(name)"),
    supabase.from("farmer_livestock_preferences").select("livestock_type_id, livestock_types(name)"),
  ]);

  // If the preferences can't be read, the weather, prices and guides
  // cards (which all depend on them) are left out rather than telling the
  // farmer to set preferences they may already have.
  const preferencesFailed = Boolean(preferencesError ?? cropsError ?? livestockError);
  if (preferencesFailed) {
    console.error(
      "[my-farm] preferences unavailable:",
      (preferencesError ?? cropsError ?? livestockError)?.message,
    );
  }

  const countyId: string | null = preferences?.county_id ?? null;
  const countyName = embeddedName(preferences?.counties);
  const crops = (cropRows ?? [])
    .map((row) => ({ id: row.crop_type_id as string, name: embeddedName(row.crop_types) ?? row.crop_type_id }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const livestock = (livestockRows ?? [])
    .map((row) => ({
      id: row.livestock_type_id as string,
      name: embeddedName(row.livestock_types) ?? row.livestock_type_id,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Each section's data starts loading now, in parallel, and streams into
  // its own card behind <Suspense>, so one slow source (e.g. WeatherAPI on
  // a cold start) never holds up the rest of the page. Every loader
  // returns { ok: false } instead of throwing.
  const weather = preferencesFailed ? null : loadWeatherSummary(countyId);
  const alerts = loadFarmAlerts();
  const farmSnapshot = loadFarmSnapshot(user.id);
  const prices = preferencesFailed ? null : loadFarmPrices(crops, livestock);
  const guides = preferencesFailed ? null : loadFarmGuides(crops, livestock);
  const communities = loadFarmCommunities(user.id);
  const news = loadFarmNews();

  const firstName = (profile?.display_name as string | null | undefined)?.trim().split(/\s+/)[0] ?? "";
  // Today's date as farmers in Kenya see it, whatever the server's zone.
  const todayLabel = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Africa/Nairobi",
  });

  return (
    <div className={`flex flex-1 flex-col bg-shamba-bg ${MY_FARM_SURFACE}`}>
      <AppHeader />

      {/* Three zones under the welcome panel: Today (weather and alerts,
          side by side from md), Your farm (records, then prices with room
          for a row of price cards), and Learn & connect (guides, news and
          communities, in columns from md/lg). On phones everything is one
          column in that order. */}
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 pb-20 pt-4 sm:gap-10 sm:px-10 sm:pt-8">
        <FarmerSummaryCard
          firstName={firstName}
          todayLabel={todayLabel}
          countyName={countyId ? countyName : null}
          crops={crops}
          livestock={livestock}
          loadFailed={preferencesFailed}
        />

        <DashboardZone id="my-farm-today" title="Today">
          <div
            className={`grid grid-cols-1 gap-4 sm:gap-5 ${weather ? "md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]" : ""}`}
          >
            {weather && (
              <Suspense fallback={<DashboardCardSkeleton label="weather" lines={2} />}>
                <WeatherSummarySection weather={weather} countyName={countyId ? countyName : null} />
              </Suspense>
            )}

            <Suspense fallback={<DashboardCardSkeleton label="farm alerts" lines={1} />}>
              <AlertsSummarySection alerts={alerts} />
            </Suspense>
          </div>
        </DashboardZone>

        <DashboardZone id="my-farm-your-farm" title="Your farm">
          <div className="flex flex-col gap-4 sm:gap-5">
            <Suspense fallback={<DashboardCardSkeleton label="farm records" lines={3} />}>
              <FarmRecordsSection snapshot={farmSnapshot} />
            </Suspense>

            {prices && (
              <Suspense fallback={<DashboardCardSkeleton label="prices" lines={3} />}>
                <PricesSection prices={prices} />
              </Suspense>
            )}
          </div>
        </DashboardZone>

        <DashboardZone id="my-farm-learn-connect" title="Learn & connect">
          <div
            className={`grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 ${guides ? "lg:grid-cols-3" : ""}`}
          >
            {guides && (
              <Suspense fallback={<DashboardCardSkeleton label="guides" lines={3} />}>
                <LearnSection guides={guides} />
              </Suspense>
            )}

            <Suspense fallback={<DashboardCardSkeleton label="news" lines={3} />}>
              <NewsSection news={news} />
            </Suspense>

            {/* With guides, the third card spans the md row on its own. */}
            <div className={`grid min-w-0 ${guides ? "md:col-span-2 lg:col-span-1" : ""}`}>
              <Suspense fallback={<DashboardCardSkeleton label="communities" lines={1} />}>
                <CommunitiesSection communities={communities} />
              </Suspense>
            </div>
          </div>
        </DashboardZone>
      </main>
    </div>
  );
}
