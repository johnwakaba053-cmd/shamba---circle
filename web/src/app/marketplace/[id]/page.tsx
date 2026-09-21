import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { fetchListingMediaByListingId } from "@/lib/listingMedia";
import { AppHeader } from "@/components/AppHeader";
import { ProfileLink } from "@/components/ProfileLink";
import { ListingGallery } from "./ListingGallery";

type Listing = {
  id: string;
  profile_id: string;
  title: string;
  description: string;
  category: string;
  listing_type: "for_sale" | "wanted";
  price: number | null;
  price_unit: string | null;
  location: string | null;
  seller_display_name: string;
  created_at: string;
};

export default async function ListingDetail({
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

  // Same shape as marketplace/page.tsx's own listings query -- only the
  // fields the UI actually renders, nothing extra. listings' SELECT
  // policy is already open (`using (true)`), same as the browse page,
  // so a single-row lookup here needs no different authorization path.
  const { data: listing } = await supabase
    .from("listings")
    .select(
      "id, profile_id, title, description, category, listing_type, price, price_unit, location, seller_display_name, created_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (!listing) {
    notFound();
  }

  const typedListing = listing as Listing;

  // Reused as-is, called with a one-element array -- no separate
  // single-listing fetch helper needed. Resolves to an empty array if
  // this listing has no photos, same "nothing to render" outcome
  // ListingMedia.tsx already relies on.
  const listingMediaByListingId = await fetchListingMediaByListingId(supabase, [
    typedListing.id,
  ]);
  const media = listingMediaByListingId.get(typedListing.id) ?? [];

  return (
    <div className="flex flex-1 flex-col bg-shamba-bg">
      <AppHeader />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-6 pb-20 pt-8 sm:px-10 sm:pt-16">
        <div className="w-full max-w-sm">
          <Link
            href="/marketplace"
            className="inline-flex items-center gap-2 font-sans text-sm font-semibold text-shamba-ink-soft transition-colors hover:text-shamba-ink"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to Marketplace
          </Link>

          <div className="mt-4">
            <ListingGallery items={media} listingTitle={typedListing.title} />
          </div>

          <div className="mt-4 flex items-start justify-between gap-2">
            <h1 className="font-display text-2xl font-bold leading-tight tracking-tight text-shamba-ink">
              {typedListing.title}
            </h1>
            <span
              className={
                typedListing.listing_type === "for_sale"
                  ? "shrink-0 rounded-shamba bg-shamba-green px-2 py-1 font-mono text-xs font-semibold text-shamba-card"
                  : "shrink-0 rounded-shamba bg-shamba-blue px-2 py-1 font-mono text-xs font-semibold text-shamba-card"
              }
            >
              {typedListing.listing_type === "for_sale" ? "For Sale" : "Wanted"}
            </span>
          </div>

          {typedListing.price !== null && (
            <p className="mt-2 font-sans text-lg font-semibold text-shamba-ink">
              {typedListing.price}
              {typedListing.price_unit ? ` ${typedListing.price_unit}` : ""}
            </p>
          )}

          <p className="mt-1 font-mono text-xs text-shamba-ink-soft">{typedListing.category}</p>

          {typedListing.location && (
            <p className="mt-1 flex items-center gap-1 text-sm text-shamba-ink-soft">
              <MapPin className="size-4 shrink-0" aria-hidden="true" />
              {typedListing.location}
            </p>
          )}

          <p className="mt-4 whitespace-pre-wrap text-base leading-6 text-shamba-ink-soft">
            {typedListing.description}
          </p>

          <p className="mt-4 font-mono text-xs text-shamba-ink-soft">
            Listed {new Date(typedListing.created_at).toLocaleDateString()}
          </p>

          <div className="mt-6 rounded-shamba border border-shamba-line bg-shamba-card p-4">
            <h2 className="font-display text-base font-semibold text-shamba-ink">Seller</h2>
            <p className="mt-2 text-sm text-shamba-ink-soft">
              Listed by{" "}
              <ProfileLink
                profileId={typedListing.profile_id}
                displayName={typedListing.seller_display_name}
                className="font-semibold text-shamba-ink"
              />
            </p>
            {/* A "Contact seller" action belongs here once a messaging
                subsystem exists -- not part of this stage. */}
          </div>
        </div>
      </main>
    </div>
  );
}
