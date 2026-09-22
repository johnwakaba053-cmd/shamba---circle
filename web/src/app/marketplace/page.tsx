import { redirect } from "next/navigation";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { fetchListingMediaByListingId } from "@/lib/listingMedia";
import {
  buildCursorFilter,
  buildMarketplaceHref,
  buildSearchFilter,
  cursorValueForRow,
  decodeCursor,
  encodeCursor,
  getOrderClauses,
  isSortOption,
  PAGE_SIZE,
  type SortOption,
} from "@/lib/marketplaceDiscovery";
import { AppHeader } from "@/components/AppHeader";
import { ProfileLink } from "@/components/ProfileLink";
import { ListingMedia } from "./ListingMedia";
import { MarketplaceFilters } from "./MarketplaceFilters";

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

export default async function Marketplace({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    category?: string;
    minPrice?: string;
    maxPrice?: string;
    sort?: string;
    before?: string;
  }>;
}) {
  const params = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const q = params.q?.trim() || undefined;
  const categoryId = params.category || undefined;

  const parsedMinPrice = params.minPrice !== undefined ? Number(params.minPrice) : undefined;
  const minPrice =
    parsedMinPrice !== undefined && Number.isFinite(parsedMinPrice) && parsedMinPrice >= 0
      ? parsedMinPrice
      : undefined;

  const parsedMaxPrice = params.maxPrice !== undefined ? Number(params.maxPrice) : undefined;
  const maxPrice =
    parsedMaxPrice !== undefined && Number.isFinite(parsedMaxPrice) && parsedMaxPrice >= 0
      ? parsedMaxPrice
      : undefined;

  const sort: SortOption = isSortOption(params.sort) ? params.sort : "newest";
  const cursor = params.before ? decodeCursor(params.before) : null;

  // Whether the shopper has narrowed the result set at all -- distinct
  // from `before` (pagination), which doesn't mean "filtered," it means
  // "further down the same list." Used below to choose the correct
  // empty-state message: a genuinely empty Marketplace ("be the first
  // to post one") is a different situation from a search/filter that
  // simply matched nothing.
  const hasActiveFilter = Boolean(
    q || categoryId || minPrice !== undefined || maxPrice !== undefined,
  );

  const [{ data: categoriesData }, listingsResult] = await Promise.all([
    supabase
      .from("marketplace_categories")
      .select("id, name")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    (async () => {
      let query = supabase
        .from("listings")
        .select(
          "id, profile_id, title, description, category, listing_type, price, price_unit, location, seller_display_name, created_at",
        );

      if (categoryId) {
        query = query.eq("category_id", categoryId);
      }
      if (minPrice !== undefined) {
        query = query.gte("price", minPrice);
      }
      if (maxPrice !== undefined) {
        query = query.lte("price", maxPrice);
      }
      // Server-side only -- never fetches the full table to filter in
      // the browser. Safe against literal %, _, and PostgREST filter
      // syntax characters (see buildSearchFilter/escapeSearchTerm),
      // verified empirically against the live database.
      if (q) {
        query = query.or(buildSearchFilter(q));
      }

      for (const clause of getOrderClauses(sort)) {
        query = query.order(clause.column, {
          ascending: clause.ascending,
          nullsFirst: clause.nullsFirst,
        });
      }

      // Keyset/cursor pagination, not OFFSET -- the predicate always
      // includes the listing id as a deterministic tie-breaker
      // alongside whichever column this sort orders by, so identical
      // created_at or price values can never cause a skipped or
      // duplicated listing across pages.
      if (cursor) {
        const cursorFilter = buildCursorFilter(sort, cursor);
        if (cursorFilter) {
          query = query.or(cursorFilter);
        }
      }

      return query.limit(PAGE_SIZE + 1);
    })(),
  ]);

  const categories = categoriesData ?? [];
  const { data: listingsRaw, error } = listingsResult;

  const hasMore = (listingsRaw?.length ?? 0) > PAGE_SIZE;
  const listings = ((listingsRaw ?? []) as Listing[]).slice(0, PAGE_SIZE);
  const lastListing = listings.at(-1);
  const nextCursor =
    hasMore && lastListing
      ? encodeCursor(cursorValueForRow(sort, lastListing), lastListing.id)
      : null;

  const listingIds = listings.map((listing) => listing.id);
  const listingMediaByListingId = await fetchListingMediaByListingId(supabase, listingIds);

  const currentParams = {
    q: params.q,
    category: params.category,
    minPrice: params.minPrice,
    maxPrice: params.maxPrice,
    sort: params.sort,
  };

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
            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-shamba bg-shamba-green px-6 py-3 font-sans text-base font-semibold text-shamba-card transition-colors hover:bg-shamba-green-deep"
          >
            Create listing
          </Link>

          <MarketplaceFilters
            categories={categories}
            initialQuery={params.q ?? ""}
            initialCategory={params.category ?? ""}
            initialMinPrice={params.minPrice ?? ""}
            initialMaxPrice={params.maxPrice ?? ""}
            initialSort={sort}
          />
        </div>

        {error && (
          <p
            role="alert"
            className="mt-6 w-full max-w-sm text-sm font-semibold text-shamba-rust"
          >
            We couldn&apos;t load the marketplace right now. Please try again later.
          </p>
        )}

        {!error && listings.length === 0 && hasActiveFilter && (
          <div className="mt-6 w-full max-w-sm">
            <p className="text-sm text-shamba-ink-soft">
              No listings match your search or filters.
            </p>
            <Link
              href="/marketplace"
              className="mt-2 inline-flex min-h-11 items-center font-sans text-sm font-semibold text-shamba-green hover:underline"
            >
              Reset filters
            </Link>
          </div>
        )}

        {!error && listings.length === 0 && !hasActiveFilter && cursor && (
          <p className="mt-6 w-full max-w-sm text-sm text-shamba-ink-soft">
            You&apos;ve reached the end of the results.
          </p>
        )}

        {!error && listings.length === 0 && !hasActiveFilter && !cursor && (
          <p className="mt-6 w-full max-w-sm text-sm text-shamba-ink-soft">
            No listings yet. Be the first to post one.
          </p>
        )}

        {!error && listings.length > 0 && (
          <div className="mt-6 flex w-full max-w-sm flex-col gap-3">
            {listings.map((listing) => (
              <article
                key={listing.id}
                className="rounded-shamba border border-shamba-line bg-shamba-card p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-display text-base font-semibold leading-tight text-shamba-ink">
                    <Link
                      href={`/marketplace/${listing.id}`}
                      className="transition-colors hover:text-shamba-green hover:underline"
                    >
                      {listing.title}
                    </Link>
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

                <ListingMedia
                  items={listingMediaByListingId.get(listing.id) ?? []}
                  listingTitle={listing.title}
                />

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

            {nextCursor ? (
              <Link
                href={buildMarketplaceHref({ ...currentParams, before: nextCursor })}
                className="mt-2 inline-flex min-h-11 items-center justify-center rounded-shamba border border-shamba-line px-6 py-3 font-sans text-sm font-semibold text-shamba-ink transition-colors hover:bg-shamba-card"
              >
                Load more
              </Link>
            ) : (
              <p className="mt-2 text-center text-xs text-shamba-ink-soft">
                You&apos;ve reached the end of the results.
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
