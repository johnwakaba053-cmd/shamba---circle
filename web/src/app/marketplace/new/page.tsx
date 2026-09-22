import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { ListingForm } from "./ListingForm";

export default async function NewListing() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  // Marketplace's own product taxonomy (Batch M1) -- independent of
  // Communities' discussion taxonomy. Previously this borrowed
  // communities.name directly, which had no referential integrity: a
  // Community rename silently orphaned any listing using the old name.
  const [{ data: categoriesData }, { data: countiesData }] = await Promise.all([
    supabase
      .from("marketplace_categories")
      .select("id, name")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    // The existing, authoritative public.counties table (Marketplace
    // 2.1) -- never a new/second county list.
    supabase.from("counties").select("id, name").order("name", { ascending: true }),
  ]);

  const categories = categoriesData ?? [];
  const counties = countiesData ?? [];

  return (
    <div className="flex flex-1 flex-col bg-shamba-bg">
      <AppHeader />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-6 pb-20 pt-8 sm:px-10 sm:pt-16">
        <div className="w-full max-w-sm rounded-shamba border border-shamba-line bg-shamba-card p-6 sm:p-8">
          <h1 className="font-display text-2xl font-bold leading-tight tracking-tight text-shamba-ink">
            Create a listing
          </h1>
          <p className="mt-2 text-base leading-6 text-shamba-ink-soft">
            Share what you&apos;re selling or looking for with other farmers.
          </p>

          <ListingForm categories={categories} counties={counties} />
        </div>
      </main>
    </div>
  );
}
