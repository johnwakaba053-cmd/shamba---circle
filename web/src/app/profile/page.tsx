import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { AvatarUploadControl } from "./AvatarUploadControl";
import { RoleBadges } from "./RoleBadges";
import { ProfileSettingsHost } from "./ProfileSettingsHost";
import { ProfilePostGrid } from "./ProfilePostGrid";
import { fetchProfileReels } from "./profilePosts";

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

  // Reference lists, this farmer's existing preferences, their own
  // roles, and their own posts all load together and independently of
  // the core profile fetch above -- a failure here degrades to an empty
  // settings/posts section rather than blocking the rest of the profile
  // page.
  const [
    { data: counties },
    { data: cropTypes },
    { data: livestockTypes },
    { data: farmerPreferences },
    { data: cropPreferences },
    { data: livestockPreferences },
    { data: alertPreferences },
    { data: roleRows },
    reels,
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
    // Owner viewing their own posts: get_profile_posts() always allows
    // this (auth.uid() = p_profile_id branch of can_view_profile_posts),
    // same sanctioned RPC path used for any other profile.
    fetchProfileReels(supabase, user.id, user.id),
  ]);

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
                Every actual edit lives behind the three-dot menu, which
                opens exactly one settings panel at a time (see
                ProfileSettingsHost) -- never a stack of always-visible
                settings sections below the profile anymore. */}
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
                  <ProfileSettingsHost
                    userId={user.id}
                    isPublic={profile.profile_visibility === "public"}
                    initialDisplayName={profile.display_name ?? ""}
                    initialBio={profile.bio ?? ""}
                    initialVisibility={profile.profile_visibility as "public" | "private"}
                    counties={counties ?? []}
                    initialCountyId={farmerPreferences?.county_id ?? null}
                    cropTypes={cropTypes ?? []}
                    initialCropIds={(cropPreferences ?? []).map((row) => row.crop_type_id)}
                    livestockTypes={livestockTypes ?? []}
                    initialLivestockIds={(livestockPreferences ?? []).map(
                      (row) => row.livestock_type_id,
                    )}
                    initialEnabledByType={enabledByType}
                  />
                </div>
              </div>

              <RoleBadges roles={roles} />

              {profile.bio && (
                <p className="max-w-md text-sm leading-6 text-shamba-ink-soft">
                  {profile.bio}
                </p>
              )}
            </div>

            <ProfilePostGrid
              reels={reels}
              emptyMessage="Your farm story starts here. Share your first update, photo, or video to see it here."
            />
          </>
        )}
      </main>
    </div>
  );
}
