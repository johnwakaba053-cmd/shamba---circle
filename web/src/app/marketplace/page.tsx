import { redirect } from "next/navigation";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { ProfileLink } from "@/components/ProfileLink";

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

export default async function Marketplace() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const { data: listings, error } = await supabase
    .from("listings")
    .select(
      "id, profile_id, title, description, category, listing_type, price, price_unit, location, seller_display_name, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="flex flex-1 flex-col bg-shamba-bg">
      <AppHeader />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-6 pb-20 pt-8 sm:px-10 sm:pt-16">
        <div className="w-full max-w-sm">
          <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-shamba-ink">
            Marketplace
          </h1>
          <p className="mt-2 text-base leading-6 text-shamba-ink-soft">
            Buy, sell, and find what your farm needs — straight from other
            farmers in Shamba Circle.
          </p>

          <Link
            href="/marketplace/new"
            className="mt-4 inline-flex items-center justify-center rounded-shamba bg-shamba-green px-6 py-3 font-sans text-base font-semibold text-shamba-card transition-colors hover:bg-shamba-green-deep"
          >
            Create listing
          </Link>
        </div>

        {error && (
          <p
            role="alert"
            className="mt-6 w-full max-w-sm text-sm font-semibold text-shamba-rust"
          >
            We couldn&apos;t load the marketplace right now. Please try again later.
          </p>
        )}

        {!error && (listings?.length ?? 0) === 0 && (
          <p className="mt-6 w-full max-w-sm text-sm text-shamba-ink-soft">
            No listings yet. Be the first to post one.
          </p>
        )}

        {!error && listings && listings.length > 0 && (
          <div className="mt-6 flex w-full max-w-sm flex-col gap-3">
            {(listings as Listing[]).map((listing) => (
              <article
                key={listing.id}
                className="rounded-shamba border border-shamba-line bg-shamba-card p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-display text-base font-semibold leading-tight text-shamba-ink">
                    {listing.title}
                  </h2>
                  <span
                    className={
                      listing.listing_type === "for_sale"
                        ? "shrink-0 rounded-shamba bg-shamba-green px-2 py-1 font-mono text-xs font-semibold text-shamba-card"
                        : "shrink-0 rounded-shamba bg-shamba-blue px-2 py-1 font-mono text-xs font-semibold text-shamba-card"
                    }
                  >
                    {listing.listing_type === "for_sale" ? "For Sale" : "Wanted"}
                  </span>
                </div>

                <p className="mt-1 font-mono text-xs text-shamba-ink-soft">
                  {listing.category}
                </p>

                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-shamba-ink-soft">
                  {listing.description}
                </p>

                {listing.price !== null && (
                  <p className="mt-2 font-sans text-sm font-semibold text-shamba-ink">
                    {listing.price}
                    {listing.price_unit ? ` ${listing.price_unit}` : ""}
                  </p>
                )}

                {listing.location && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-shamba-ink-soft">
                    <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                    {listing.location}
                  </p>
                )}

                <p className="mt-2 text-xs text-shamba-ink-soft">
                  Listed by{" "}
                  <ProfileLink
                    profileId={listing.profile_id}
                    displayName={listing.seller_display_name}
                    className="font-semibold text-shamba-ink-soft"
                  />
                </p>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
