import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { fetchEditableListingMedia } from "@/lib/listingMedia";
import { AppHeader } from "@/components/AppHeader";
import { ListingForm } from "../../new/ListingForm";

type Listing = {
  id: string;
  profile_id: string;
  title: string;
  description: string;
  category: string;
  category_id: string | null;
  listing_type: "for_sale" | "wanted";
  price: number | null;
  price_unit: string | null;
  location: string | null;
};

export default async function EditListing({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const { data: listing } = await supabase
    .from("listings")
    .select(
      "id, profile_id, title, description, category, category_id, listing_type, price, price_unit, location",
    )
    .eq("id", id)
    .maybeSingle();

  if (!listing) {
    notFound();
  }

  const typedListing = listing as Listing;

  // The listing exists and is (per listings' own open SELECT policy)
  // visible to anyone -- but only its owner may edit it. A non-owner
  // gets sent to the normal read-only detail page rather than a
  // generic error: the listing is real and viewable, it just isn't
  // theirs to change. The actual write-time authorization boundary is
  // still listings'/listing_media's own RLS (profile_id = auth.uid()),
  // not this check -- this only decides whether the edit UI renders.
  if (typedListing.profile_id !== user.id) {
    redirect(`/marketplace/${typedListing.id}`);
  }

  const [{ data: categoriesData }, existingPhotos] = await Promise.all([
    supabase
      .from("marketplace_categories")
      .select("id, name")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    fetchEditableListingMedia(supabase, typedListing.id),
  ]);

  const categories = categoriesData ?? [];

  // Prefer the stable category_id relationship. Fall back to matching
  // the legacy free-text category against a current category's name --
  // safe for any listing saved before Batch M1 (or otherwise not yet
  // backfilled) rather than assuming every listing already has a
  // category_id. If neither resolves, default to the first category so
  // the select always has a valid value instead of silently mismatching
  // whatever the browser happens to render for an unmatched one.
  const resolvedCategoryId =
    typedListing.category_id ??
    categories.find((option) => option.name === typedListing.category)?.id ??
    categories[0]?.id ??
    "";

  return (
    <div className="flex flex-1 flex-col bg-shamba-bg">
      <AppHeader />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-6 pb-20 pt-8 sm:px-10 sm:pt-16">
        <div className="w-full max-w-sm">
          <Link
            href={`/marketplace/${typedListing.id}`}
            className="inline-flex items-center gap-2 font-sans text-sm font-semibold text-shamba-ink-soft transition-colors hover:text-shamba-ink"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to listing
          </Link>

          <div className="mt-4 rounded-shamba border border-shamba-line bg-shamba-card p-6 sm:p-8">
            <h1 className="font-display text-2xl font-bold leading-tight tracking-tight text-shamba-ink">
              Edit listing
            </h1>
            <p className="mt-2 text-base leading-6 text-shamba-ink-soft">
              Update the details below, then save your changes.
            </p>

            <ListingForm
              categories={categories}
              mode="edit"
              listingId={typedListing.id}
              initialValues={{
                title: typedListing.title,
                description: typedListing.description,
                categoryId: resolvedCategoryId,
                listingType: typedListing.listing_type,
                price: typedListing.price !== null ? String(typedListing.price) : "",
                priceUnit: typedListing.price_unit ?? "",
                location: typedListing.location ?? "",
              }}
              initialPhotos={existingPhotos}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
