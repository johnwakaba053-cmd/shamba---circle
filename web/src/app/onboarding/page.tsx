import { redirect } from "next/navigation";
import { Sprout } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { safeReelReturnPath } from "@/lib/reelUrl";
import { OnboardingForm } from "./OnboardingForm";

export default async function Onboarding({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  // A shared Reel the farmer was on their way to before signing in
  // (?next=/reels/<uuid>, validated by the strict allow-list; anything
  // else is ignored and behavior is exactly as before).
  const returnTo = safeReelReturnPath((await searchParams).next);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const [{ data: profile }, { count: roleCount }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    supabase
      .from("user_roles")
      .select("role", { count: "exact", head: true })
      .eq("profile_id", user.id),
  ]);

  const initialDisplayName = profile?.display_name?.trim() ?? "";
  const hasRoles = (roleCount ?? 0) > 0;

  if (initialDisplayName && hasRoles) {
    redirect(returnTo ?? "/communities");
  }

  return (
    <div className="flex flex-1 flex-col bg-shamba-bg">
      <header className="mx-auto flex w-full max-w-5xl flex-wrap items-baseline gap-x-3 gap-y-1 px-6 py-6 sm:px-10">
        <div className="flex items-center gap-2 self-center">
          <Sprout className="size-6 text-shamba-green" aria-hidden="true" />
          <span className="font-display text-lg font-medium tracking-tight text-shamba-ink">
            Shamba Space
          </span>
        </div>
        <span className="text-sm text-shamba-ink-soft">Everything farming. In one space.</span>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-6 pb-20 pt-8 sm:px-10 sm:pt-16">
        <div className="w-full max-w-sm rounded-shamba border border-shamba-line bg-shamba-card p-6 sm:p-8">
          <OnboardingForm
            userId={user.id}
            initialDisplayName={initialDisplayName}
            hasRoles={hasRoles}
            returnTo={returnTo}
          />
        </div>
      </main>
    </div>
  );
}
