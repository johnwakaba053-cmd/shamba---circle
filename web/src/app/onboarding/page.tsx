import { redirect } from "next/navigation";
import { Sprout } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "./OnboardingForm";

export default async function Onboarding() {
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
    redirect("/communities");
  }

  return (
    <div className="flex flex-1 flex-col bg-shamba-bg">
      <header className="mx-auto flex w-full max-w-5xl items-center gap-2 px-6 py-6 sm:px-10">
        <Sprout className="size-6 text-shamba-green" aria-hidden="true" />
        <span className="font-display text-lg font-medium tracking-tight text-shamba-ink">
          Shamba Circle
        </span>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-6 pb-20 pt-8 sm:px-10 sm:pt-16">
        <div className="w-full max-w-sm rounded-shamba border border-shamba-line bg-shamba-card p-6 sm:p-8">
          <OnboardingForm
            userId={user.id}
            initialDisplayName={initialDisplayName}
            hasRoles={hasRoles}
          />
        </div>
      </main>
    </div>
  );
}
