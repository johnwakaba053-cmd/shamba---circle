import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { FarmForm } from "../FarmForm";

export default async function NewFarm() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const [{ data: countiesData }, { data: preferences }, { count: farmCount }] = await Promise.all([
    supabase.from("counties").select("id, name").order("name", { ascending: true }),
    // Read-only: the Profile county is only a starting suggestion for the
    // form. farmer_preferences is never written from Farm Records.
    supabase.from("farmer_preferences").select("county_id").eq("profile_id", user.id).maybeSingle(),
    supabase.from("farms").select("id", { count: "exact", head: true }).eq("profile_id", user.id),
  ]);

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

          <div className="mt-4 rounded-shamba border border-shamba-line bg-shamba-card p-6 sm:p-8">
            <h1 className="font-display text-2xl font-bold leading-tight tracking-tight text-shamba-ink">
              Add a farm
            </h1>
            <p className="mt-2 text-base leading-6 text-shamba-ink-soft">
              Only the name and county are needed. You can change anything later.
            </p>

            <FarmForm
              counties={countiesData ?? []}
              initialValues={{
                name: (farmCount ?? 0) === 0 ? "My Farm" : "",
                countyId: preferences?.county_id ?? "",
                locationText: "",
                sizeAcres: "",
                tenure: "",
              }}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
