import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { FARM_COLUMNS, type Farm } from "@/lib/farmRecords";
import { FarmForm } from "../../FarmForm";
import { LoadErrorCard } from "../../LoadErrorCard";

export default async function EditFarm({
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

  // RLS returns only the caller's own farms, so someone else's farm id
  // (or a malformed one) simply isn't found.
  const [{ data: farmData, error: farmError }, { data: countiesData, error: countiesError }] = await Promise.all([
    supabase.from("farms").select(FARM_COLUMNS).eq("id", farmId).eq("profile_id", user.id).maybeSingle(),
    supabase.from("counties").select("id, name").order("name", { ascending: true }),
  ]);

  const retryHref = `/farm-records/${encodeURIComponent(farmId)}/edit`;

  // A failed query is not "no such farm": say so, and offer a reload,
  // rather than a 404 that tells the farmer the farm is gone.
  if (farmError) {
    return (
      <EditShell backHref="/farm-records" backLabel="Back to Farm Records">
        <LoadErrorCard
          title="We couldn't load this farm."
          detail="Check your connection and try again. Your farm and its records are not affected."
          retryHref={retryHref}
        />
      </EditShell>
    );
  }

  if (!farmData) {
    notFound();
  }

  const farm = farmData as Farm;

  // An archived farm is read-only in the UI until it's restored.
  if (farm.archived_at !== null) {
    redirect(`/farm-records/${farm.id}`);
  }

  // The county is required, so without the list the form couldn't be saved.
  if (countiesError) {
    return (
      <EditShell backHref={`/farm-records/${farm.id}`} backLabel="Back to farm">
        <LoadErrorCard
          title="We couldn't load the list of counties."
          detail="The farm can't be edited without it. Check your connection and try again."
          retryHref={retryHref}
        />
      </EditShell>
    );
  }

  return (
    <EditShell backHref={`/farm-records/${farm.id}`} backLabel="Back to farm">
      <div className="mt-4 rounded-shamba border border-shamba-line bg-shamba-card p-6 sm:p-8">
        <h1 className="font-display text-2xl font-bold leading-tight tracking-tight text-shamba-ink">
          Edit farm
        </h1>
        <p className="mt-2 text-base leading-6 text-shamba-ink-soft">
          Update the details below, then save your changes.
        </p>

        <FarmForm
          counties={countiesData ?? []}
          mode="edit"
          farmId={farm.id}
          initialValues={{
            name: farm.name,
            countyId: farm.county_id,
            locationText: farm.location_text ?? "",
            sizeAcres: farm.size_acres !== null ? String(farm.size_acres) : "",
            tenure: farm.tenure ?? "",
          }}
        />
      </div>
    </EditShell>
  );
}

function EditShell({
  backHref,
  backLabel,
  children,
}: {
  backHref: string;
  backLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col bg-shamba-bg">
      <AppHeader />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-6 pb-20 pt-8 sm:px-10 sm:pt-16">
        <div className="w-full max-w-sm">
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 font-sans text-sm font-semibold text-shamba-ink-soft transition-colors hover:text-shamba-ink relative touch-target"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            {backLabel}
          </Link>

          {children}
        </div>
      </main>
    </div>
  );
}
