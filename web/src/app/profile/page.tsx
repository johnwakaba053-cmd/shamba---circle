import { redirect } from "next/navigation";
import { UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { ProfileVisibilityControl } from "./ProfileVisibilityControl";
import { DisplayNameControl } from "./DisplayNameControl";

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

  return (
    <div className="flex flex-1 flex-col bg-shamba-bg">
      <AppHeader />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-6 pb-20 pt-8 sm:px-10 sm:pt-16">
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
      </main>
    </div>
  );
}
