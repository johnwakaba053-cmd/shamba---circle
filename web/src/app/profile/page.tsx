import { redirect } from "next/navigation";
import { CloudSun, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { ProfileVisibilityControl } from "./ProfileVisibilityControl";
import { DisplayNameControl } from "./DisplayNameControl";
import { CountyControl } from "./CountyControl";
import { PreferenceMultiSelectControl } from "./PreferenceMultiSelectControl";
import { AlertPreferencesControl } from "./AlertPreferencesControl";

type AlertType = "weather" | "pest_disease" | "market_price";

const ALL_ALERT_TYPES: readonly AlertType[] = [
  "weather",
  "pest_disease",
  "market_price",
];

export default async function Profile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("display_name, profile_visibility")
    .eq("id", user.id)
    .single();

  // Reference lists and this farmer's existing preferences load together
  // and independently of the core profile fetch above -- a failure here
  // degrades to an empty preferences section rather than blocking the
  // rest of the profile page.
  const [
    { data: counties, error: countiesError },
    { data: cropTypes, error: cropTypesError },
    { data: livestockTypes, error: livestockTypesError },
    { data: farmerPreferences },
    { data: cropPreferences },
    { data: livestockPreferences },
    { data: alertPreferences },
  ] = await Promise.all([
    supabase.from("counties").select("id, name").order("name"),
    supabase.from("crop_types").select("id, name").order("name"),
    supabase.from("livestock_types").select("id, name").order("name"),
    supabase.from("farmer_preferences").select("county_id").maybeSingle(),
    supabase.from("farmer_crop_preferences").select("crop_type_id"),
    supabase.from("farmer_livestock_preferences").select("livestock_type_id"),
    supabase.from("alert_notification_preferences").select("alert_type, enabled"),
  ]);

  const preferencesError = Boolean(
    countiesError || cropTypesError || livestockTypesError,
  );

  const enabledByType = Object.fromEntries(
    ALL_ALERT_TYPES.map((type) => [
      type,
      (alertPreferences ?? []).find((row) => row.alert_type === type)?.enabled ??
        false,
    ]),
  ) as Record<AlertType, boolean>;

  return (
    <div className="flex flex-1 flex-col bg-shamba-bg">
      <AppHeader />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center gap-8 px-6 pb-20 pt-8 sm:px-10 sm:pt-16">
        <div className="w-full max-w-sm rounded-shamba border border-shamba-line bg-shamba-card p-6 sm:p-8">
          <UserRound className="size-7 text-shamba-green" aria-hidden="true" />

          <h1 className="mt-4 font-display text-2xl font-bold leading-tight tracking-tight text-shamba-ink">
            Your profile
          </h1>
          <p className="mt-2 text-base leading-6 text-shamba-ink-soft">
            Manage your name and whether other farmers can see your profile.
          </p>

          {error || !profile ? (
            <p role="alert" className="mt-6 text-sm font-semibold text-shamba-rust">
              We couldn&apos;t load your profile right now. Please try again later.
            </p>
          ) : (
            <>
              <DisplayNameControl
                userId={user.id}
                initialDisplayName={profile.display_name ?? ""}
              />
              <ProfileVisibilityControl
                userId={user.id}
                initialVisibility={profile.profile_visibility as "public" | "private"}
              />
            </>
          )}
        </div>

        <div className="w-full max-w-sm rounded-shamba border border-shamba-line bg-shamba-card p-6 sm:p-8">
          <CloudSun className="size-7 text-shamba-green" aria-hidden="true" />

          <h2 className="mt-4 font-display text-2xl font-bold leading-tight tracking-tight text-shamba-ink">
            Farmer preferences
          </h2>
          <p className="mt-2 text-base leading-6 text-shamba-ink-soft">
            These settings will be used to personalize future weather,
            pest &amp; disease, and market-price alerts. Alerts aren&apos;t
            live yet — saving your preferences here just gets you ready for
            when they are.
          </p>

          {preferencesError ? (
            <p role="alert" className="mt-6 text-sm font-semibold text-shamba-rust">
              We couldn&apos;t load your farmer preferences right now. Please
              try again later.
            </p>
          ) : (
            <>
              <section className="mt-8 border-t border-shamba-line pt-6">
                <h3 className="font-display text-lg font-semibold text-shamba-ink">
                  Location
                </h3>
                <p className="mt-1 text-sm text-shamba-ink-soft">
                  The county where you farm.
                </p>
                <CountyControl
                  userId={user.id}
                  counties={counties ?? []}
                  initialCountyId={farmerPreferences?.county_id ?? null}
                />
              </section>

              <section className="mt-8 border-t border-shamba-line pt-6">
                <h3 className="font-display text-lg font-semibold text-shamba-ink">
                  Crops
                </h3>
                <p className="mt-1 text-sm text-shamba-ink-soft">
                  Select the crops you grow.
                </p>
                <PreferenceMultiSelectControl
                  userId={user.id}
                  tableName="farmer_crop_preferences"
                  idColumn="crop_type_id"
                  items={cropTypes ?? []}
                  initialSelectedIds={(cropPreferences ?? []).map(
                    (row) => row.crop_type_id,
                  )}
                  groupLabel="Crops you grow"
                  savedMessage="Crops saved."
                />
              </section>

              <section className="mt-8 border-t border-shamba-line pt-6">
                <h3 className="font-display text-lg font-semibold text-shamba-ink">
                  Livestock
                </h3>
                <p className="mt-1 text-sm text-shamba-ink-soft">
                  Select the livestock you keep.
                </p>
                <PreferenceMultiSelectControl
                  userId={user.id}
                  tableName="farmer_livestock_preferences"
                  idColumn="livestock_type_id"
                  items={livestockTypes ?? []}
                  initialSelectedIds={(livestockPreferences ?? []).map(
                    (row) => row.livestock_type_id,
                  )}
                  groupLabel="Livestock you keep"
                  savedMessage="Livestock saved."
                />
              </section>

              <section className="mt-8 border-t border-shamba-line pt-6">
                <h3 className="font-display text-lg font-semibold text-shamba-ink">
                  Alerts
                </h3>
                <p className="mt-1 text-sm text-shamba-ink-soft">
                  Choose which future alerts you&apos;d like to receive.
                </p>
                <AlertPreferencesControl
                  userId={user.id}
                  initialEnabledByType={enabledByType}
                />
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
