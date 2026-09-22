"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Filter, Search, X } from "lucide-react";
import {
  buildMarketplaceHref,
  isListingTypeFilter,
  isSortOption,
  LISTING_TYPE_FILTER_OPTIONS,
  SORT_OPTIONS,
  type SortOption,
} from "@/lib/marketplaceDiscovery";

type CategoryOption = { id: string; name: string };
type CountyOption = { id: string; name: string };

// Client-side navigation only -- there is no local result-fetching or
// state-management library here. Every control updates the URL (via
// buildMarketplaceHref, the same helper page.tsx's own "Load more" link
// uses) and lets the Server Component re-render with the new
// searchParams, exactly like this project's existing Feed pagination
// pattern. Changing any filter or the sort always drops `before` (an
// explicit omission below), since a new filter/sort means a new result
// set -- continuing an old page's cursor into it would be meaningless.
export function MarketplaceFilters({
  categories,
  counties,
  initialQuery,
  initialCategory,
  initialMinPrice,
  initialMaxPrice,
  initialSort,
  initialCounty,
  initialListingType,
}: {
  categories: CategoryOption[];
  counties: CountyOption[];
  initialQuery: string;
  initialCategory: string;
  initialMinPrice: string;
  initialMaxPrice: string;
  initialSort: SortOption;
  initialCounty: string;
  initialListingType: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState(initialCategory);
  const [minPrice, setMinPrice] = useState(initialMinPrice);
  const [maxPrice, setMaxPrice] = useState(initialMaxPrice);
  const [sort, setSort] = useState<SortOption>(initialSort);
  const [county, setCounty] = useState(initialCounty);
  const [listingType, setListingType] = useState(initialListingType);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Reflects the URL this page actually rendered from, not the (possibly
  // not-yet-navigated) in-progress control state -- correct for deciding
  // whether "Reset filters" should appear at all.
  const hasAnyActiveFilter = Boolean(
    initialQuery ||
      initialCategory ||
      initialMinPrice ||
      initialMaxPrice ||
      initialSort !== "newest" ||
      initialCounty ||
      initialListingType,
  );
  const activeFilterBadgeCount =
    (initialCategory ? 1 : 0) +
    (initialMinPrice || initialMaxPrice ? 1 : 0) +
    (initialSort !== "newest" ? 1 : 0) +
    (initialCounty ? 1 : 0) +
    (initialListingType ? 1 : 0);

  function navigate(overrides: {
    q?: string;
    category?: string;
    minPrice?: string;
    maxPrice?: string;
    sort?: SortOption;
    county?: string;
    listingType?: string;
  }) {
    router.push(
      buildMarketplaceHref({
        q: overrides.q ?? query,
        category: overrides.category ?? category,
        minPrice: overrides.minPrice ?? minPrice,
        maxPrice: overrides.maxPrice ?? maxPrice,
        sort: overrides.sort ?? sort,
        county: overrides.county ?? county,
        listingType: overrides.listingType ?? listingType,
      }),
    );
  }

  function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    setQuery(trimmed);
    navigate({ q: trimmed });
  }

  function handleCategoryChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value;
    setCategory(value);
    navigate({ category: value });
  }

  function handleSortChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value;
    if (!isSortOption(value)) return;
    setSort(value);
    navigate({ sort: value });
  }

  function handleCountyChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value;
    setCounty(value);
    navigate({ county: value });
  }

  function handleListingTypeFilterChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value;
    if (value !== "" && !isListingTypeFilter(value)) return;
    setListingType(value);
    navigate({ listingType: value });
  }

  function handlePriceApply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate({ minPrice, maxPrice });
  }

  function handleReset() {
    setQuery("");
    setCategory("");
    setMinPrice("");
    setMaxPrice("");
    setSort("newest");
    setCounty("");
    setListingType("");
    router.push("/marketplace");
  }

  return (
    <div className="mt-4 flex flex-col gap-2">
      <form onSubmit={handleSearchSubmit} className="flex gap-2">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search listings…"
          aria-label="Search listings"
          className="min-h-11 flex-1 rounded-shamba border border-shamba-line bg-shamba-bg px-4 py-2.5 font-sans text-base text-shamba-ink placeholder:text-shamba-ink-soft focus:outline-none focus:ring-2 focus:ring-shamba-green"
        />
        <button
          type="submit"
          aria-label="Search"
          className="flex size-11 shrink-0 items-center justify-center rounded-shamba bg-shamba-green text-shamba-card transition-colors hover:bg-shamba-green-deep"
        >
          <Search className="size-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => setFiltersOpen((open) => !open)}
          aria-expanded={filtersOpen}
          aria-label="Filters"
          className="relative flex size-11 shrink-0 items-center justify-center rounded-shamba border border-shamba-line text-shamba-ink-soft transition-colors hover:bg-shamba-bg"
        >
          <Filter className="size-5" aria-hidden="true" />
          {activeFilterBadgeCount > 0 && (
            <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-shamba-rust font-mono text-[10px] font-bold text-shamba-card">
              {activeFilterBadgeCount}
            </span>
          )}
        </button>
      </form>

      {filtersOpen && (
        <div className="flex flex-col gap-3 rounded-shamba border border-shamba-line bg-shamba-card p-4 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="flex flex-col gap-1.5 sm:min-w-[160px]">
            <label htmlFor="marketplace-category" className="font-sans text-xs font-semibold text-shamba-ink">
              Category
            </label>
            <select
              id="marketplace-category"
              value={category}
              onChange={handleCategoryChange}
              className="min-h-11 rounded-shamba border border-shamba-line bg-shamba-bg px-3 font-sans text-sm text-shamba-ink focus:outline-none focus:ring-2 focus:ring-shamba-green"
            >
              <option value="">All categories</option>
              {categories.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </div>

          <form onSubmit={handlePriceApply} className="flex flex-col gap-1.5">
            <span className="font-sans text-xs font-semibold text-shamba-ink">Price range</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="decimal"
                min={0}
                value={minPrice}
                onChange={(event) => setMinPrice(event.target.value)}
                placeholder="Min"
                aria-label="Minimum price"
                className="min-h-11 w-24 rounded-shamba border border-shamba-line bg-shamba-bg px-3 font-sans text-sm text-shamba-ink placeholder:text-shamba-ink-soft focus:outline-none focus:ring-2 focus:ring-shamba-green"
              />
              <span className="text-shamba-ink-soft" aria-hidden="true">
                –
              </span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                value={maxPrice}
                onChange={(event) => setMaxPrice(event.target.value)}
                placeholder="Max"
                aria-label="Maximum price"
                className="min-h-11 w-24 rounded-shamba border border-shamba-line bg-shamba-bg px-3 font-sans text-sm text-shamba-ink placeholder:text-shamba-ink-soft focus:outline-none focus:ring-2 focus:ring-shamba-green"
              />
              <button
                type="submit"
                className="inline-flex min-h-11 items-center justify-center rounded-shamba border border-shamba-line px-3 font-sans text-sm font-semibold text-shamba-ink transition-colors hover:bg-shamba-bg"
              >
                Apply
              </button>
            </div>
            <p className="font-mono text-[11px] leading-4 text-shamba-ink-soft">
              Prices may use different units (per kg, per bag, etc.)
            </p>
          </form>

          <div className="flex flex-col gap-1.5 sm:min-w-[180px]">
            <label htmlFor="marketplace-sort" className="font-sans text-xs font-semibold text-shamba-ink">
              Sort by
            </label>
            <select
              id="marketplace-sort"
              value={sort}
              onChange={handleSortChange}
              className="min-h-11 rounded-shamba border border-shamba-line bg-shamba-bg px-3 font-sans text-sm text-shamba-ink focus:outline-none focus:ring-2 focus:ring-shamba-green"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5 sm:min-w-[160px]">
            <label htmlFor="marketplace-listing-type" className="font-sans text-xs font-semibold text-shamba-ink">
              Listing type
            </label>
            <select
              id="marketplace-listing-type"
              value={listingType}
              onChange={handleListingTypeFilterChange}
              className="min-h-11 rounded-shamba border border-shamba-line bg-shamba-bg px-3 font-sans text-sm text-shamba-ink focus:outline-none focus:ring-2 focus:ring-shamba-green"
            >
              <option value="">All</option>
              {LISTING_TYPE_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5 sm:min-w-[180px]">
            <label htmlFor="marketplace-county" className="font-sans text-xs font-semibold text-shamba-ink">
              County
            </label>
            <select
              id="marketplace-county"
              value={county}
              onChange={handleCountyChange}
              className="min-h-11 rounded-shamba border border-shamba-line bg-shamba-bg px-3 font-sans text-sm text-shamba-ink focus:outline-none focus:ring-2 focus:ring-shamba-green"
            >
              <option value="">All Counties</option>
              {counties.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </div>

          {hasAnyActiveFilter && (
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex min-h-11 items-center gap-1.5 font-sans text-sm font-semibold text-shamba-ink-soft transition-colors hover:text-shamba-rust"
            >
              <X className="size-4" aria-hidden="true" />
              Reset filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
