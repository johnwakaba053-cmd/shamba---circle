import { redirect } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { AvatarUploadControl } from "./AvatarUploadControl";
import { BioControl } from "./BioControl";
import { RoleBadges } from "./RoleBadges";
import { ProfileMenu } from "./ProfileMenu";
import { ProfileVisibilityControl } from "./ProfileVisibilityControl";
import { DisplayNameControl } from "./DisplayNameControl";
import { CountyControl } from "./CountyControl";
import { PreferenceMultiSelectControl } from "./PreferenceMultiSelectControl";
import { AlertPreferencesControl } from "./AlertPreferencesControl";

const SIGNED_URL_EXPIRY_SECONDS = 3600;

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
    .select("display_name, profile_visibility, avatar_path, bio")
    .eq("id", user.id)
    .single();

  // Reference lists, this farmer's existing preferences, and their own
  // roles all load together and independently of the core profile fetch
  // above -- a failure here degrades to an empty preferences section
  // rather than blocking the rest of the profile page.
  const [
    { data: counties, error: countiesError },
    { data: cropTypes, error: cropTypesError },
    { data: livestockTypes, error: livestockTypesError },
    { data: farmerPreferences },
    { data: cropPreferences },
    { data: livestockPreferences },
    { data: alertPreferences },
    { data: roleRows },
  ] = await Promise.all([
    supabase.from("counties").select("id, name").order("name"),
    supabase.from("crop_types").select("id, name").order("name"),
    supabase.from("livestock_types").select("id, name").order("name"),
    supabase.from("farmer_preferences").select("county_id").maybeSingle(),
    supabase.from("farmer_crop_preferences").select("crop_type_id"),
    supabase.from("farmer_livestock_preferences").select("livestock_type_id"),
    supabase.from("alert_notification_preferences").select("alert_type, enabled"),
    // RLS already scopes this to the caller's own roles (profile_id =
    // auth.uid()) -- same "no explicit .eq needed" convention already
    // used by the crop/livestock preference queries above.
    supabase.from("user_roles").select("role"),
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

  const roles = (roleRows ?? []).map((row) => row.role);

  // Resolved once, server-side, into a short-lived signed URL -- same
  // "resolve on the server, pass a plain string to the client" split
  // already used for post/listing/story media (see lib/postMedia.ts) --
  // never a public bucket URL, since the avatars bucket isn't public.
  let avatarUrl: string | null = null;
  if (!error && profile?.avatar_path) {
    const { data: signedUrlData } = await supabase.storage
      .from("avatars")
      .createSignedUrl(profile.avatar_path, SIGNED_URL_EXPIRY_SECONDS);
    avatarUrl = signedUrlData?.signedUrl ?? null;
  }

  return (
    <div className="flex flex-1 flex-col bg-shamba-bg">
      <AppHeader />

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 pb-20 pt-8 sm:px-10 sm:pt-16">
        {error || !profile ? (
          <div className="rounded-shamba border border-shamba-line bg-shamba-card p-6 sm:p-8">
            <p role="alert" className="text-sm font-semibold text-shamba-rust">
              We couldn&apos;t load your profile right now. Please try again later.
            </p>
          </div>
        ) : (
          <>
            {/* Identity header -- read-only display of who this farmer is.
                Every actual edit lives behind the three-dot menu, in the
                collapsed sections below, never inline up here. The menu
                sits directly beside the display name rather than in its
                own row, so the two read as one unit. */}
            <div className="flex flex-col items-center gap-3 rounded-shamba border border-shamba-line bg-shamba-card p-6 text-center sm:p-8">
              <AvatarUploadControl
                userId={user.id}
                displayName={profile.display_name ?? "Your"}
                initialAvatarUrl={avatarUrl}
              />

              <div className="flex w-full max-w-full items-center justify-center gap-1">
                <h1 className="min-w-0 truncate font-display text-2xl font-bold leading-tight tracking-tight text-shamba-ink">
                  {profile.display_name || "Add your name"}
                </h1>
                <div className="shrink-0">
                  <ProfileMenu isPublic={profile.profile_visibility === "public"} />
                </div>
              </div>

              <RoleBadges roles={roles} />

              {profile.bio && (
                <p className="max-w-md text-sm leading-6 text-shamba-ink-soft">
                  {profile.bio}
                </p>
              )}
            </div>

            {/* Settings -- collapsed by default, reached via the
                three-dot menu above (which expands the matching section
                and jumps to it) or by opening any section directly. Every
                control here is the exact same existing component/logic
                already used before this page's header was redesigned --
                nothing about how a save actually happens has changed. */}
            <div className="flex flex-col gap-3">
              <details id="settings-display-name" className="group rounded-shamba border border-shamba-line bg-shamba-card p-4">
                <summary className="flex cursor-pointer list-none items-center justify-between font-display text-base font-semibold text-shamba-ink [&::-webkit-details-marker]:hidden">
                  Display name
                  <ChevronDown
                    className="size-4 text-shamba-ink-soft transition-transform group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>
                <DisplayNameControl
                  userId={user.id}
                  initialDisplayName={profile.display_name ?? ""}
                />
              </details>

              <details id="settings-bio" className="group rounded-shamba border border-shamba-line bg-shamba-card p-4">
                <summary className="flex cursor-pointer list-none items-center justify-between font-display text-base font-semibold text-shamba-ink [&::-webkit-details-marker]:hidden">
                  Bio
                  <ChevronDown
                    className="size-4 text-shamba-ink-soft transition-transform group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>
                <div className="mt-4">
                  <BioControl userId={user.id} initialBio={profile.bio ?? ""} />
                </div>
              </details>

              <details id="settings-visibility" className="group rounded-shamba border border-shamba-line bg-shamba-card p-4">
                <summary className="flex cursor-pointer list-none items-center justify-between font-display text-base font-semibold text-shamba-ink [&::-webkit-details-marker]:hidden">
                  Privacy
                  <ChevronDown
                    className="size-4 text-shamba-ink-soft transition-transform group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>
                <ProfileVisibilityControl
                  userId={user.id}
                  initialVisibility={profile.profile_visibility as "public" | "private"}
                />
              </details>

              {preferencesError ? (
                <div className="rounded-shamba border border-shamba-line bg-shamba-card p-4">
                  <p role="alert" className="text-sm font-semibold text-shamba-rust">
                    We couldn&apos;t load your farmer preferences right now. Please
                    try again later.
                  </p>
                </div>
              ) : (
                <>
                  <details id="settings-county" className="group rounded-shamba border border-shamba-line bg-shamba-card p-4">
                    <summary className="flex cursor-pointer list-none items-center justify-between font-display text-base font-semibold text-shamba-ink [&::-webkit-details-marker]:hidden">
                      Farmer preferences — Location
                      <ChevronDown
                        className="size-4 text-shamba-ink-soft transition-transform group-open:rotate-180"
                        aria-hidden="true"
                      />
                    </summary>
                    <p className="mt-1 text-sm text-shamba-ink-soft">
                      The county where you farm.
                    </p>
                    <CountyControl
                      userId={user.id}
                      counties={counties ?? []}
                      initialCountyId={farmerPreferences?.county_id ?? null}
                    />
                  </details>

                  <details id="settings-crops" className="group rounded-shamba border border-shamba-line bg-shamba-card p-4">
                    <summary className="flex cursor-pointer list-none items-center justify-between font-display text-base font-semibold text-shamba-ink [&::-webkit-details-marker]:hidden">
                      Crops &amp; crop alerts
                      <ChevronDown
                        className="size-4 text-shamba-ink-soft transition-transform group-open:rotate-180"
                        aria-hidden="true"
                      />
                    </summary>
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
                  </details>

                  <details id="settings-livestock" className="group rounded-shamba border border-shamba-line bg-shamba-card p-4">
                    <summary className="flex cursor-pointer list-none items-center justify-between font-display text-base font-semibold text-shamba-ink [&::-webkit-details-marker]:hidden">
                      Livestock &amp; other alerts
                      <ChevronDown
                        className="size-4 text-shamba-ink-soft transition-transform group-open:rotate-180"
                        aria-hidden="true"
                      />
                    </summary>
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
                  </details>

                  <details id="settings-alerts" className="group rounded-shamba border border-shamba-line bg-shamba-card p-4">
                    <summary className="flex cursor-pointer list-none items-center justify-between font-display text-base font-semibold text-shamba-ink [&::-webkit-details-marker]:hidden">
                      Weather &amp; alert notifications
                      <ChevronDown
                        className="size-4 text-shamba-ink-soft transition-transform group-open:rotate-180"
                        aria-hidden="true"
                      />
                    </summary>
                    <p className="mt-1 text-sm text-shamba-ink-soft">
                      Choose which future alerts you&apos;d like to receive.
                    </p>
                    <AlertPreferencesControl
                      userId={user.id}
                      initialEnabledByType={enabledByType}
                    />
                  </details>
                </>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
